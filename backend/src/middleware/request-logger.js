/**
 * Request logging middleware
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 * @param {Function} next - Next middleware
 */
function requestLogger(req, res, next) {
  const start = Date.now();

  // Log request
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);

  // Log request body if present and not a file upload
  if (
    req.body &&
    Object.keys(req.body).length > 0 &&
    !req.is("multipart/form-data")
  ) {
    // Mask sensitive data like tokens
    const sanitizedBody = { ...req.body };
    if (sanitizedBody.accessToken) sanitizedBody.accessToken = "***MASKED***";

    console.log("Request Body:", JSON.stringify(sanitizedBody, null, 2));
  }

  // Capture response data
  const originalEnd = res.end;

  res.end = function (chunk, encoding) {
    // Calculate request duration
    const duration = Date.now() - start;

    // Restore original end method
    res.end = originalEnd;

    // Call original end method
    res.end(chunk, encoding);

    // Log response status and duration
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - ${
        res.statusCode
      } (${duration}ms)`,
    );
  };

  next();
}

module.exports = requestLogger;
