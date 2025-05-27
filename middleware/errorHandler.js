const { errorResponse } = require('../utils/apiResponse');

// Handle 404 Not Found errors
const routeNotFoundHandler = (req, res, next) => {
  errorResponse(res, 404, `Route not found - ${req.originalUrl}`);
};

// General error handler
const generalErrorHandler = (err, req, res, next) => {
  console.error("Global Error Handler:", err);

  // Multer error handling
  if (err.code === 'LIMIT_FILE_SIZE') {
    return errorResponse(res, 400, 'File too large. Max size is 500MB.');
  }
  // Check if the error message starts with "Invalid file type"
  if (err.message && err.message.startsWith('Invalid file type.')) {
      return errorResponse(res, 400, err.message);
  }


  // Default to 500 server error
  const statusCode = err.statusCode || 500;
  const message = err.message || 'An unexpected server error occurred.';
  
  errorResponse(res, statusCode, message, process.env.NODE_ENV === 'development' ? err.stack : undefined);
};

module.exports = {
  routeNotFoundHandler,
  generalErrorHandler,
};
