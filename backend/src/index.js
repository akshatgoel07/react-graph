const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const requestLogger = require("./middleware/request-logger");
const errorHandler = require("./middleware/error-handler");

const apiRoutes = require("./routes");

const app = express();

app.use(cors());
app.use(express.json());
app.use(requestLogger);

app.use("/api", apiRoutes);

app.use(errorHandler);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
});

process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED REJECTION! Shutting down...");
  console.error(err.name, err.message);
  console.error(err.stack);

  process.exit(1);
});

module.exports = app;
