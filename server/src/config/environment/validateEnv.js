/**
 * Environment Configuration Validator
 * Validates critical environment variables safely without leaking secret values.
 */

const { logger } = require("../../infrastructure/logging/loggerMiddleware");

/**
 * Validates the runtime environment configuration.
 * @param {Object} options
 * @param {boolean} options.strict - Whether to throw an error on validation failure
 * @returns {Object} { isValid: boolean, missing: string[], warnings: string[] }
 */
function validateEnv({ strict = false } = {}) {
  const missing = [];
  const warnings = [];

  // Required core configuration
  if (!process.env.MONGODB_URL) {
    missing.push("MONGODB_URL");
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    missing.push("JWT_SECRET");
  } else if (jwtSecret.length < 32 && process.env.NODE_ENV === "production") {
    warnings.push("JWT_SECRET is shorter than recommended 32 characters in production");
  }

  // Production-only requirements
  if (process.env.NODE_ENV === "production") {
    if (!process.env.CLIENT_URL) {
      warnings.push("CLIENT_URL is not set for production CORS");
    }
  }

  // Stage 4 Payment integration prerequisites check
  const hasRazorpayKeys =
    Boolean(process.env.RAZORPAY_KEY_ID) &&
    Boolean(process.env.RAZORPAY_KEY_SECRET);
  const hasWebhookSecret = Boolean(process.env.RAZORPAY_WEBHOOK_SECRET);

  if (!hasRazorpayKeys || !hasWebhookSecret) {
    warnings.push(
      "Razorpay payment keys or webhook secret are not yet configured (required for live gateway transactions)"
    );
  }

  const isValid = missing.length === 0;

  if (!isValid) {
    const errorMsg = `FATAL: Missing required environment variable(s): ${missing.join(", ")}`;
    if (logger) {
      logger.error(errorMsg);
    } else {
      console.error(errorMsg);
    }
    if (strict) {
      throw new Error(errorMsg);
    }
  }

  return {
    isValid,
    missing,
    warnings,
  };
}

module.exports = {
  validateEnv,
};
