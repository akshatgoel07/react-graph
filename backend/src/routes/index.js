const express = require("express");
const visualizationRoutes = require("./visualization-routes");
const ragRoutes = require("./rag-routes");

const router = express.Router();

// Health check endpoint
router.get("/health", (req, res) => {
  res.json({ status: "ok", message: "Service is running" });
});

// Register routes
router.use("/visualization", visualizationRoutes);
router.use("/rag", ragRoutes);

module.exports = router;
