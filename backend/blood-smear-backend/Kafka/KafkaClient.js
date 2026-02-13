const { Kafka } = require("kafkajs");
require("dotenv").config();

const kafkaBrokers = (process.env.KAFKA_BROKERS || "localhost:9092").split(",");
const kafka = new Kafka({
  clientId: "blood-smear-app",
  brokers: kafkaBrokers,
});

const producer = kafka.producer();

async function connectProducer() {
  await producer.connect();
}

// producer sends the message to the queue and the message is consumed by the consumer
async function sendJobToQueue(job_id) {
  const payload = { job_id };
  await producer.send({
    //topic that we created is image-processing
    topic: "image-processing",
    //you can add partition here if you want to send the message to a specific partition
    messages: [{ value: JSON.stringify(payload) }],
  });
}


module.exports = { connectProducer, sendJobToQueue };


