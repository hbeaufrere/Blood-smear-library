#!/bin/bash
##############################################
# Blood Smear Library - AWS Infrastructure Setup
# Creates S3 buckets and CloudFront distributions
#
# Prerequisites:
#   - AWS CLI v2 installed (brew install awscli / apt install awscli)
#   - AWS credentials configured (aws configure)
#
# Usage:
#   chmod +x deploy/setup-aws.sh
#   ./deploy/setup-aws.sh
##############################################

set -e

# Configuration - EDIT THESE
AWS_REGION="${AWS_REGION:-us-west-1}"
BUCKET_RAW="${S3_BUCKET_RAW:-blood-smear-raw-hbeaufrere}"
BUCKET_PROCESSED="${S3_BUCKET_PROCESSED:-blood-smear-processed-hbeaufrere}"

echo "========================================="
echo "Blood Smear Library - AWS Setup"
echo "========================================="
echo "Region: $AWS_REGION"
echo "Raw Bucket: $BUCKET_RAW"
echo "Processed Bucket: $BUCKET_PROCESSED"
echo "========================================="
echo ""

# --- Step 1: Create S3 Buckets ---
echo "Step 1: Creating S3 buckets..."

for BUCKET in "$BUCKET_RAW" "$BUCKET_PROCESSED"; do
    if aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
        echo "  Bucket '$BUCKET' already exists, skipping."
    else
        if [ "$AWS_REGION" = "us-east-1" ]; then
            aws s3api create-bucket --bucket "$BUCKET" --region "$AWS_REGION"
        else
            aws s3api create-bucket --bucket "$BUCKET" --region "$AWS_REGION" \
                --create-bucket-configuration LocationConstraint="$AWS_REGION"
        fi
        echo "  Created bucket: $BUCKET"
    fi

    # Enable CORS for the bucket
    aws s3api put-bucket-cors --bucket "$BUCKET" --cors-configuration '{
        "CORSRules": [
            {
                "AllowedHeaders": ["*"],
                "AllowedMethods": ["GET", "PUT", "POST"],
                "AllowedOrigins": ["*"],
                "ExposeHeaders": ["ETag"],
                "MaxAgeSeconds": 3600
            }
        ]
    }'
    echo "  CORS configured for: $BUCKET"
done

echo ""

# --- Step 2: Create CloudFront Origin Access Identity ---
echo "Step 2: Creating CloudFront Origin Access Identity..."

OAI_COMMENT="blood-smear-oai-$(date +%s)"
OAI_RESULT=$(aws cloudfront create-cloud-front-origin-access-identity \
    --cloud-front-origin-access-identity-config "{
        \"CallerReference\": \"$OAI_COMMENT\",
        \"Comment\": \"Blood Smear Library OAI\"
    }" --output json)
OAI_ID=$(echo "$OAI_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['CloudFrontOriginAccessIdentity']['Id'])")
echo "  OAI created: $OAI_ID"

# --- Step 3: Grant CloudFront access to S3 buckets ---
echo "Step 3: Setting bucket policies for CloudFront access..."

# Remove any existing public access block so we can set the policy
for BUCKET in "$BUCKET_RAW" "$BUCKET_PROCESSED"; do
    aws s3api delete-public-access-block --bucket "$BUCKET" 2>/dev/null || true
    echo "  Cleared public access block for: $BUCKET"
done

for BUCKET in "$BUCKET_RAW" "$BUCKET_PROCESSED"; do
    POLICY=$(cat <<EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "AllowCloudFrontOAI",
            "Effect": "Allow",
            "Principal": {
                "AWS": "arn:aws:iam::cloudfront:user/CloudFront Origin Access Identity $OAI_ID"
            },
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::$BUCKET/*"
        }
    ]
}
EOF
)
    aws s3api put-bucket-policy --bucket "$BUCKET" --policy "$POLICY"
    echo "  Bucket policy set for: $BUCKET"
done

# --- Step 3b: Block public access (after policies are set) ---
echo "Step 3b: Blocking public access on buckets..."

for BUCKET in "$BUCKET_RAW" "$BUCKET_PROCESSED"; do
    aws s3api put-public-access-block --bucket "$BUCKET" \
        --public-access-block-configuration \
        "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
    echo "  Public access blocked for: $BUCKET"
done

echo ""

# --- Step 4: Create CloudFront Distributions ---
echo "Step 4: Creating CloudFront distributions..."

create_distribution() {
    local BUCKET_NAME=$1
    local COMMENT=$2

    DIST_CONFIG=$(cat <<EOF
{
    "CallerReference": "$BUCKET_NAME-$(date +%s)",
    "Comment": "$COMMENT",
    "DefaultCacheBehavior": {
        "TargetOriginId": "$BUCKET_NAME",
        "ViewerProtocolPolicy": "redirect-to-https",
        "AllowedMethods": {
            "Quantity": 2,
            "Items": ["GET", "HEAD"]
        },
        "ForwardedValues": {
            "QueryString": false,
            "Cookies": { "Forward": "none" }
        },
        "MinTTL": 0,
        "DefaultTTL": 86400,
        "MaxTTL": 31536000,
        "Compress": true
    },
    "Origins": {
        "Quantity": 1,
        "Items": [
            {
                "Id": "$BUCKET_NAME",
                "DomainName": "$BUCKET_NAME.s3.$AWS_REGION.amazonaws.com",
                "S3OriginConfig": {
                    "OriginAccessIdentity": "origin-access-identity/cloudfront/$OAI_ID"
                }
            }
        ]
    },
    "Enabled": true
}
EOF
)
    local RESULT=$(aws cloudfront create-distribution \
        --distribution-config "$DIST_CONFIG" --output json)
    local DOMAIN=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['Distribution']['DomainName'])")
    local DIST_ID=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['Distribution']['Id'])")
    echo "  Distribution created: https://$DOMAIN (ID: $DIST_ID)"
    echo "$DOMAIN"
}

echo "  Creating distribution for raw bucket..."
CF_DOMAIN_RAW=$(create_distribution "$BUCKET_RAW" "Blood Smear Raw Images")

echo "  Creating distribution for processed bucket..."
CF_DOMAIN_PROCESSED=$(create_distribution "$BUCKET_PROCESSED" "Blood Smear Processed Images")

echo ""
echo "========================================="
echo "Setup Complete!"
echo "========================================="
echo ""
echo "Update your backend .env file with these values:"
echo ""
echo "  S3_BUCKET_RAW=$BUCKET_RAW"
echo "  S3_BUCKET_PROCESSED=$BUCKET_PROCESSED"
echo "  CLOUD_FRONT_DOMAIN=https://$CF_DOMAIN_PROCESSED"
echo "  CLOUD_FRONT_DOMAIN_RAW=https://$CF_DOMAIN_RAW"
echo ""
echo "Note: CloudFront distributions take 10-15 minutes to deploy globally."
echo "========================================="
