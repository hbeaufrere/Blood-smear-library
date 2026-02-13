const NodeClam = require("clamscan");
const path = require("path");
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");


// Initialize S3 client
const s3 = new S3Client({
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  region: process.env.AWS_REGION,
});

const S3_BUCKET_RAW = process.env.S3_BUCKET_RAW;

let clamAV = null;

async function initClamAV() {
  if (clamAV) return clamAV;

  clamAV = await new NodeClam().init({
    removeInfected: false,
    quarantineInfected: false,
    clamdscan: {
      socket: false,
      host: process.env.CLAMAV_HOST || "127.0.0.1",
      port: parseInt(process.env.CLAMAV_PORT) || 3310,
      timeout: 120000,
    },
  });

  return clamAV;
}

async function scanS3StreamForVirusStreaming(s3Key, bucketName = S3_BUCKET_RAW) {
  try {
    const clam = await initClamAV();
    
    // Create a command to get the object from S3
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: s3Key
    });
    //execute the command
    const response = await s3.send(command);
    //Convert the response body to a readable stream
    const s3Stream = response.Body;
    // Scan the stream
    const { isInfected, viruses } = await clam.scanStream(s3Stream);
    
    return { 
      isInfected, 
      viruses,
      success: true
    };
  } catch (error) {
    console.error(`Error scanning S3 stream ${s3Key}:`, error);
    return {
      isInfected: false,
      viruses: [],
      success: false,
      error: error.message
    };
  }
}

module.exports = { scanS3StreamForVirusStreaming };