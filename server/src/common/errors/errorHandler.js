const { logger } = require("../../infrastructure/logging/loggerMiddleware");

const errorHandler = (err, req, res, next) => {
  // Determine status code and error classification
  let statusCode = err.statusCode || err.status || 500;
  let message = err.message || "Internal Server Error";
  let code = err.code || undefined;
  let errors = undefined;

  // Handle Mongoose CastError (invalid ObjectId or type casting)
  if (err.name === "CastError") {
    statusCode = 400;
    code = "INVALID_IDENTIFIER";
    message = `Invalid ${err.path || "identifier"} format`;
  }

  // Handle Mongoose ValidationError
  if (err.name === "ValidationError") {
    statusCode = 400;
    code = "VALIDATION_ERROR";
    message = "Request validation failed";
    errors = Object.values(err.errors || {}).map((e) => ({
      field: e.path,
      message: e.message,
    }));
  }

  // Handle Body-parser / express.json syntax error (malformed JSON)
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    statusCode = 400;
    code = "MALFORMED_JSON";
    message = "Malformed JSON payload in request body";
  }

  // Log error with stack trace via Winston (redaction applied automatically)
  const requestId =
    req?.id ||
    req?.correlationId ||
    req?.headers?.["x-request-id"] ||
    req?.headers?.["x-correlation-id"] ||
    "-";

  logger.error(`${message}`, {
    requestId,
    stack: err.stack,
    method: req?.method,
    url: req?.originalUrl,
    ip: req?.ip,
    statusCode,
    errorCode: code,
  });

  // In production, never leak 500 internals to client
  if (process.env.NODE_ENV === "production" && statusCode === 500) {
    message = "Internal Server Error";
  }

  const responseBody = {
    success: false,
    message,
  };

  if (code) {
    responseBody.code = code;
  }
  if (errors) {
    responseBody.errors = errors;
  }

  res.status(statusCode).json(responseBody);
};

module.exports = errorHandler;
