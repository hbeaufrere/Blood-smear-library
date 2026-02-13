require('dotenv').config();
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const uploadRoute = require("./routes/uploadImagesRoute");
const getUploadRoute = require("./routes/getUploadImageRoute");
const speciesRoute = require("./routes/speciesRoute");
const { connectProducer } = require("./Kafka/KafkaClient");
const cors = require("cors");



const app = express();
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));


app.use(express.json());
app.use(express.urlencoded({ extended: true }));
mongoose.connect(
  process.env.MONGO_URI ||
    "",
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
);

connectProducer()
  .then(() => console.log("Kafka producer connected!"))
  .catch((err) => console.error("Kafka connection error:", err));
mongoose.connection.once("open", () => {
  console.log("Connected to MongoDB");
});

// Routes
app.use("/api", uploadRoute);
app.use("/api", getUploadRoute);
app.use("/api/species", speciesRoute);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
