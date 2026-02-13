const { Kafka } = require("kafkajs");
require("dotenv").config();
const mongoose = require("mongoose");
const { scanS3StreamForVirusStreaming } = require("../utility/virusScanner.js");
const UploadMetadata = require("../models/UploadMetadata.js");
const path = require("path");
const { checkIfTheImagesAreMultiSceneForWholeSlide,convertToDZI,streamFullSlideImageToLocalTempFile } = require("../utility/dziProcessor.js");

// CloudFront configuration
const CLOUD_FRONT_DOMAIN_RAW = process.env.CLOUD_FRONT_DOMAIN_RAW || process.env.CLOUD_FRONT_DOMAIN;

// 1. Connect to MongoDB using environment variable
mongoose.connect(
  process.env.MONGO_URI || "",
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
);

// 2. Kafka setup (configurable via KAFKA_BROKERS env var)
const kafkaBrokers = (process.env.KAFKA_BROKERS || "localhost:9092").split(",");
const kafka = new Kafka({
  clientId: "blood-smear-worker",
  brokers: kafkaBrokers,
});

// 3. Create consumer in a group

const consumer = kafka.consumer({ 
  groupId: "image-processing-group",
  sessionTimeout: 600000,        // 10 minutes (matches maxPollInterval)
  heartbeatInterval: 10000,      // 10 seconds
  maxPollInterval: 600000,       // 10 minutes (600,000ms)
  rebalanceTimeout: 60000,       // 1 minute
});

// 4. Job processing logic
  async function processJob(job_id){
    console.log(` Starting processing for job: ${job_id}`);
    //get the job from the database
    const job = await UploadMetadata.findOne({ job_id: job_id });
    

    if (!job) {
      console.error(`[${job_id}]  No job found in DB`);
      throw new Error("Job not found");
    }
   
    //create a step function divide the larger whole slide images into and call the lambda function which executes the clamAV scan

    //check the virus scan for cellavision images, use existing ClamAV function
    if (job.cellavision_images && job.cellavision_images.size > 0) {
      
      
      for (const [cellType, images] of job.cellavision_images.entries()) {
        
        
        for (const image of images) {
          if (image.s3_storage?.s3_key) {
            
            
            const scanResult = await scanS3StreamForVirusStreaming(image.s3_storage.s3_key);
            
            if (!scanResult.success) {
              
              await UploadMetadata.updateOne({job_id: job_id}, {status: "failed"});
              throw new Error(`Virus scan failed for cellavision image: ${image.original_filename}`);
            }
            
            if (scanResult.isInfected) {
              
              await UploadMetadata.updateOne({job_id: job_id}, {status: "failed"});
              throw new Error(`Virus detected in cellavision image: ${image.original_filename}`);
            }
            
            
          }
        }
      }
      
      console.log(`[${job_id}] All cellavision images passed virus scan`);
    }
    
    // Update CloudFront URLs for cellavision images
    if (job.cellavision_images && job.cellavision_images.size > 0) {
      console.log(`[${job_id}] Updating CloudFront URLs for cellavision images...`);
      
      for (const [cellType, images] of job.cellavision_images.entries()) {
        for (let i = 0; i < images.length; i++) {
          const image = images[i];
          if (image.s3_storage?.s3_key && !image.s3_storage?.cloudfront_url) {
            // Generate CloudFront URL from s3_key
            const cloudfrontUrl = `${CLOUD_FRONT_DOMAIN_RAW}/${image.s3_storage.s3_key}`;
            
            // Update the specific image in the array
            await UploadMetadata.updateOne(
              { job_id: job_id },
              { 
                $set: { 
                  [`cellavision_images.${cellType}.${i}.s3_storage.cloudfront_url`]: cloudfrontUrl 
                } 
              }
            );
            
            console.log(`[${job_id}] Updated CloudFront URL for ${cellType}[${i}]: ${image.original_filename}`);
          }
        }
      }
      
      console.log(`[${job_id}] ✅ CloudFront URLs updated for all cellavision images`);
    }
    
    
    
    //update status to virus_clean
     await UploadMetadata.updateOne({job_id: job_id}, {status: "virus_clean"});

    //process the whole slide image
    if(job.whole_slide_image)
    {
    const s3Key = job.whole_slide_image.s3_storage.s3_key;
    const mimeType = job.whole_slide_image.mime_type;
    console.log(`[${job_id}] Starting to check if the whole slide image is multi scene`);
    const streamImagesToLocalTempFile = await streamFullSlideImageToLocalTempFile(s3Key);
    const isMultiScene = await checkIfTheImagesAreMultiSceneForWholeSlide(streamImagesToLocalTempFile);
    const startTime = Date.now(); // Track processing time
    const dziOutput = await convertToDZI(streamImagesToLocalTempFile, s3Key, job_id);

   if (dziOutput) {
  const processingTime = Date.now() - startTime;
  const dziId = path.parse(s3Key).name; // Extract filename from s3Key
  
  await UploadMetadata.findOneAndUpdate(
    { job_id: job_id },
    {
      $push: {
        'dzi_outputs.whole_slide': {
          scene_number: 0,
          scene_name: 'scene0',
          z_level: 0,
          channel: 0,
          dzi_url: dziOutput.dzi_url,              
          pyramid_levels: dziOutput.pyramid_levels, 
          tile_count: dziOutput.tile_count,         
          tile_size: 256,
          tile_format: 'jpeg',
          tile_overlap: 0,
          image_width: isMultiScene.width,        
          image_height: isMultiScene.height,        
          s3_dzi_key: `processed/${job_id}/full_slide_dzi/${dziId}/scene0_z0_c0.dzi`,
          s3_tiles_prefix: `processed/${job_id}/full_slide_dzi/${dziId}/`,
          processing_status: 'completed',
          processing_time_ms: processingTime,     
          processed_at: new Date()
        }
       
      },
      status: 'ready_for_viewer'
    }
  );
  // Update CloudFront URL for whole slide image
  if (job.whole_slide_image?.s3_storage?.s3_key && !job.whole_slide_image.s3_storage?.cloudfront_url) {
    // FIX: dziOutput.dzi_url already contains full URL, extract just the S3 key
    // dziOutput.dzi_url format: https://domain.com/uploads/job_id/full_slide_dzi/...
    const dziUrlPath = dziOutput.dzi_url.replace(/^https?:\/\/[^\/]+/, ''); // Remove domain, keep path
    const cloudfrontUrl = `${CLOUD_FRONT_DOMAIN_RAW}${dziUrlPath}`;
    await UploadMetadata.updateOne(
      { job_id: job_id },
      { $set: { 'whole_slide_image.s3_storage.cloudfront_url': cloudfrontUrl } }
    );
    console.log(`[${job_id}] ✅ CloudFront URL updated for whole slide image`);
  }
  
  console.log(`[${job_id}] ✅ Converted whole slide to DZI:`, dziOutput);
}
  } else {
    // No whole slide image, only cellavision images - mark as ready
    await UploadMetadata.updateOne({job_id: job_id}, {status: "ready_for_viewer"});
    console.log(`[${job_id}] ✅ Cellavision-only upload ready for viewer`);
  }
  }
    


// 5. Main loop: listen for jobs and process
async function run() {
  await consumer.connect();
  await consumer.subscribe({ topic: "image-processing", fromBeginning: false });

  await consumer.run({
    
    eachMessage: async ({ message }) => {
      const {job_id} = JSON.parse(message.value.toString());
      console.log("Received job from Kafka:", job_id);
      await processJob(job_id);
    },
  });
}

run().catch((e) => {
  console.error("Fatal consumer error:", e);
  process.exit(1);
});