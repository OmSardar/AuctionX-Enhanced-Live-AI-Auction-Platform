const winston = require("winston");
const morgan = require("morgan");
const fs = require("fs");
const path = require("path");
const { resolveAuthenticClientIp } = require("../../common/utilities/ipResolver");

// Ensure the 'logs' directory exists in runtime/logs
const logDirectory = path.resolve(__dirname, "../../../runtime/logs");
if (!fs.existsSync(logDirectory)) {
  fs.mkdirSync(logDirectory, { recursive: true });
}

// Set of sensitive keys to scrub from logs
const SENSITIVE_KEYS = new Set([
  "password",
  "pass",
  "token",
  "secret",
  "jwt",
  "authorization",
  "razorpay_signature",
  "signature",
  "key_secret",
  "apikey",
  "api_secret",
  "client_secret",
  "credit_card",
  "cardnumber",
  "cvv",
  "cookie",
  "set-cookie",
  "session",
  "accesstoken",
  "refreshtoken",
]);

function redactObject(obj) {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(redactObject);

  const cleaned = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lowerKey)) {
      cleaned[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      cleaned[key] = redactObject(value);
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

const redactSensitiveData = winston.format((info) => {
  return redactObject(info);
});

// Configure Winston Transports
const transports = [
  new winston.transports.File({
    filename: path.join(logDirectory, "error.log"),
    level: "error",
  }),
  new winston.transports.File({
    filename: path.join(logDirectory, "combined.log"),
  }),
];

// In non-test environments or when explicitly enabled, stream single-line JSON logs to Console (stdout)
// for Docker, Render, and cloud log shippers.
if (process.env.NODE_ENV !== "test" || process.env.ENABLE_CONSOLE_LOGS === "true") {
  transports.push(
    new winston.transports.Console({
      format: winston.format.combine(
        redactSensitiveData(),
        winston.format.timestamp(),
        winston.format.json()
      ),
    })
  );
}

// Winston Logger Configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    redactSensitiveData(),
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports,
});

// Morgan Middleware (Logging HTTP Requests with Correlation ID and IP)
const httpLogger = morgan(
  (tokens, req, res) => {
    try {
      const clientIp = resolveAuthenticClientIp(req);
      const requestId =
        req.id ||
        req.correlationId ||
        req.headers["x-request-id"] ||
        req.headers["x-correlation-id"] ||
        "-";

      const logData = {
        requestId,
        ip: clientIp,
        method: tokens.method(req, res),
        url: tokens.url(req, res),
        status: Number(tokens.status(req, res)) || 0,
        response_time_ms: parseFloat(tokens["response-time"](req, res)) || 0,
        user_agent: tokens["user-agent"](req, res),
      };

      return JSON.stringify(logData);
    } catch (error) {
      logger.error("Error in request logging: " + error.message);
      return "";
    }
  },
  {
    stream: {
      write: (message) => {
        try {
          const parsed = JSON.parse(message.trim());
          logger.info("HTTP Request", parsed);
        } catch (_) {
          logger.info(message.trim());
        }
      },
    },
  }
);

module.exports = {
  logger,
  httpLogger,
  redactObject,
  SENSITIVE_KEYS,
};
