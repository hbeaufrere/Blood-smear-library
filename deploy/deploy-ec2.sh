#!/bin/bash
##############################################
# Blood Smear Library - EC2 Deployment Script
# Deploys the full stack to an EC2 instance
#
# Prerequisites:
#   - AWS CLI configured
#   - SSH key pair created in AWS
#
# Usage:
#   chmod +x deploy/deploy-ec2.sh
#   ./deploy/deploy-ec2.sh
##############################################

set -e

AWS_REGION="${AWS_REGION:-us-west-1}"
INSTANCE_TYPE="${INSTANCE_TYPE:-t3.medium}"
KEY_NAME="${KEY_NAME:-blood-smear-key}"
SECURITY_GROUP_NAME="blood-smear-sg"

echo "========================================="
echo "Blood Smear Library - EC2 Deployment"
echo "========================================="
echo "Region: $AWS_REGION"
echo "Instance Type: $INSTANCE_TYPE"
echo "========================================="

# --- Step 1: Create key pair if it doesn't exist ---
echo "Step 1: Checking SSH key pair..."
if ! aws ec2 describe-key-pairs --key-names "$KEY_NAME" --region "$AWS_REGION" 2>/dev/null; then
    aws ec2 create-key-pair --key-name "$KEY_NAME" --region "$AWS_REGION" \
        --query 'KeyMaterial' --output text > "${KEY_NAME}.pem"
    chmod 400 "${KEY_NAME}.pem"
    echo "  Key pair created: ${KEY_NAME}.pem"
    echo "  IMPORTANT: Keep this file safe - it's your only way to SSH into the server!"
else
    echo "  Key pair '$KEY_NAME' already exists."
fi

# --- Step 2: Create security group ---
echo "Step 2: Setting up security group..."
VPC_ID=$(aws ec2 describe-vpcs --region "$AWS_REGION" \
    --filters "Name=is-default,Values=true" \
    --query 'Vpcs[0].VpcId' --output text)

SG_ID=$(aws ec2 describe-security-groups --region "$AWS_REGION" \
    --filters "Name=group-name,Values=$SECURITY_GROUP_NAME" \
    --query 'SecurityGroups[0].GroupId' --output text 2>/dev/null || echo "None")

if [ "$SG_ID" = "None" ] || [ -z "$SG_ID" ]; then
    SG_ID=$(aws ec2 create-security-group \
        --group-name "$SECURITY_GROUP_NAME" \
        --description "Blood Smear Library security group" \
        --vpc-id "$VPC_ID" \
        --region "$AWS_REGION" \
        --query 'GroupId' --output text)

    # Allow SSH, HTTP, HTTPS, and backend port
    aws ec2 authorize-security-group-ingress --group-id "$SG_ID" --region "$AWS_REGION" \
        --protocol tcp --port 22 --cidr 0.0.0.0/0
    aws ec2 authorize-security-group-ingress --group-id "$SG_ID" --region "$AWS_REGION" \
        --protocol tcp --port 80 --cidr 0.0.0.0/0
    aws ec2 authorize-security-group-ingress --group-id "$SG_ID" --region "$AWS_REGION" \
        --protocol tcp --port 443 --cidr 0.0.0.0/0
    aws ec2 authorize-security-group-ingress --group-id "$SG_ID" --region "$AWS_REGION" \
        --protocol tcp --port 3000 --cidr 0.0.0.0/0
    echo "  Security group created: $SG_ID"
else
    echo "  Security group exists: $SG_ID"
fi

# --- Step 3: Get latest Amazon Linux 2023 AMI ---
echo "Step 3: Finding latest AMI..."
AMI_ID=$(aws ec2 describe-images --region "$AWS_REGION" \
    --owners amazon \
    --filters "Name=name,Values=al2023-ami-2023*-x86_64" "Name=state,Values=available" \
    --query 'sort_by(Images, &CreationDate)[-1].ImageId' --output text)
echo "  AMI: $AMI_ID"

# --- Step 4: Create user data script for EC2 ---
USER_DATA=$(cat <<'USERDATA'
#!/bin/bash
# Install Docker
dnf update -y
dnf install -y docker git
systemctl start docker
systemctl enable docker
usermod -aG docker ec2-user

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Clone the repository
cd /home/ec2-user
git clone https://github.com/hbeaufrere/Blood-smear-library.git
cd Blood-smear-library

echo "EC2 setup complete. SSH in and run: cd Blood-smear-library && docker compose up -d"
USERDATA
)

# --- Step 5: Launch EC2 instance ---
echo "Step 4: Launching EC2 instance..."
INSTANCE_ID=$(aws ec2 run-instances --region "$AWS_REGION" \
    --image-id "$AMI_ID" \
    --instance-type "$INSTANCE_TYPE" \
    --key-name "$KEY_NAME" \
    --security-group-ids "$SG_ID" \
    --user-data "$USER_DATA" \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=blood-smear-library}]" \
    --block-device-mappings '[{"DeviceName":"/dev/xvda","Ebs":{"VolumeSize":30,"VolumeType":"gp3"}}]' \
    --query 'Instances[0].InstanceId' --output text)
echo "  Instance launched: $INSTANCE_ID"

# Wait for instance to be running
echo "  Waiting for instance to be ready..."
aws ec2 wait instance-running --instance-ids "$INSTANCE_ID" --region "$AWS_REGION"

# Get public IP
PUBLIC_IP=$(aws ec2 describe-instances --instance-ids "$INSTANCE_ID" --region "$AWS_REGION" \
    --query 'Reservations[0].Instances[0].PublicIpAddress' --output text)

echo ""
echo "========================================="
echo "EC2 Instance Ready!"
echo "========================================="
echo ""
echo "Instance ID:  $INSTANCE_ID"
echo "Public IP:    $PUBLIC_IP"
echo "SSH Command:  ssh -i ${KEY_NAME}.pem ec2-user@$PUBLIC_IP"
echo ""
echo "Next steps:"
echo "  1. SSH into the instance"
echo "  2. Wait ~2 min for Docker install to complete"
echo "  3. Copy your .env file to the server:"
echo "     scp -i ${KEY_NAME}.pem backend/blood-smear-backend/.env ec2-user@$PUBLIC_IP:~/Blood-smear-library/backend/blood-smear-backend/.env"
echo "  4. Set the frontend API URL and start:"
echo "     cd Blood-smear-library"
echo "     VITE_API_URL=http://$PUBLIC_IP:3000 docker compose up -d --build"
echo ""
echo "Your app will be available at:"
echo "  Frontend: http://$PUBLIC_IP"
echo "  Backend:  http://$PUBLIC_IP:3000"
echo "========================================="
