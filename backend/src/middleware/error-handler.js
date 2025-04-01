const config = require("../config/env");

/**
 * Global error handling middleware
 * @param {Error} err - Error object
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 * @param {Function} next - Next middleware
 */
function errorHandler(err, req, res, next) {
  // Log error
  console.error(`[ERROR] ${err.name}: ${err.message}`);
  console.error(err.stack);

  // Set default status code and message
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal server error";

  // Build error response
  const errorResponse = {
    success: false,
    message,
    // Only include error stack in development
    ...(config.nodeEnv === "development" && {
      stack: err.stack,
      error: err.toString(),
    }),
  };

  // Send error response
  res.status(statusCode).json(errorResponse);
}

module.exports = errorHandler;
