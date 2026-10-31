const crypto = require("crypto");

/**
 * Request Correlation ID Middleware
 *
 * Ensures every incoming HTTP request is assigned a unique, traceable correlation ID.
 * Honors existing upstream correlation IDs (e.g., from Cloudflare, reverse proxies, or API clients)
 * if they match safe formatting constraints; otherwise generates a secure cryptographically random UUIDv4.
 *
 * Sets both 'X-Request-ID' and 'X-Correlation-ID' on the response headers.
 * Attaches 'req.id' and 'req.correlationId' to the Express request object for downstream logging and tracing.
 */
function correlationIdMiddleware(req, res, next) {
  const incomingId =
    req.headers["x-request-id"] ||
    req.headers["x-correlation-id"] ||
    req.headers["x-trace-id"];

  // Sanitize incoming correlation ID: alphanumeric, dashes, underscores only, max 64 chars
  let correlationId;
  if (
    typeof incomingId === "string" &&
    /^[a-zA-Z0-9_-]{8,64}$/.test(incomingId.trim())
  ) {
    correlationId = incomingId.trim();
  } else {
    correlationId = crypto.randomUUID();
  }

  req.id = correlationId;
  req.correlationId = correlationId;
  req._requestStartTime = process.hrtime.bigint();

  res.setHeader("X-Request-ID", correlationId);
  res.setHeader("X-Correlation-ID", correlationId);

  next();
}

module.exports = correlationIdMiddleware;
