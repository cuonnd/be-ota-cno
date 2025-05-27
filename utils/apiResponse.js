
/**
 * Sends a success response.
 * @param {object} res - Express response object.
 * @param {number} statusCode - HTTP status code.
 * @param {object|array|null} data - Data to be sent in the response.
 * @param {string} message - Optional success message.
 */
const successResponse = (res, statusCode, data, message = 'Success') => {
  res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

/**
 * Sends an error response.
 * @param {object} res - Express response object.
 * @param {number} statusCode - HTTP status code.
 * @param {string} message - Error message.
 * @param {string} [details] - Optional additional error details (e.g., stack trace in dev).
 */
const errorResponse = (res, statusCode, message, details = null) => {
  const responsePayload = {
    success: false,
    message,
  };
  if (details) {
    responsePayload.details = details;
  }
  res.status(statusCode).json(responsePayload);
};

module.exports = {
  successResponse,
  errorResponse,
};
