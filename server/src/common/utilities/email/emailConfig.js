/**
 * Email Configuration and Provider Selection
 * 
 * Centralizes configuration for dual email delivery:
 * - Local Development: Gmail SMTP (EMAIL_PROVIDER=smtp)
 * - Production: Resend HTTPS API (EMAIL_PROVIDER=resend)
 * 
 * Sender Identity: AuctionX <notifications@mail.omslabs.tech>
 * Reply-To: Configurable via EMAIL_REPLY_TO (e.g. Gmail support address)
 */

const DEFAULT_SENDER = "AuctionX <notifications@mail.omslabs.tech>";

/**
 * Robust production/Render environment detection.
 * Detects standard production flags as well as Render hosting environment variables.
 */
function isProductionEnvironment() {
  return Boolean(
    process.env.NODE_ENV === "production" ||
    process.env.ENVIRONMENT === "production" ||
    process.env.RENDER === "true" ||
    process.env.RENDER_EXTERNAL_URL ||
    process.env.RENDER_SERVICE_ID ||
    process.env.RENDER_INSTANCE_ID
  );
}

/**
 * Validates and retrieves the active email configuration.
 * Never logs or returns raw credentials.
 */
function getEmailConfig() {
  const isProduction = isProductionEnvironment();

  // Provider resolution:
  // 1. Explicit EMAIL_PROVIDER if set
  // 2. If RESEND_API_KEY is configured, default to resend
  // 3. If running in production or on Render, default to resend (SMTP ports are blocked)
  // 4. Otherwise, default to smtp for local development
  let provider = (process.env.EMAIL_PROVIDER || "").trim().toLowerCase();

  if (!provider) {
    if (process.env.RESEND_API_KEY || isProduction) {
      provider = "resend";
    } else {
      provider = "smtp";
    }
  }

  if (provider !== "smtp" && provider !== "resend") {
    throw new Error(
      `Invalid EMAIL_PROVIDER "${provider}". Supported values are "smtp" and "resend".`
    );
  }

  // Enforce zero SMTP connections in production on Render
  if (isProduction && provider === "smtp") {
    // Render blocks outbound SMTP ports 25, 465, and 587
    throw new Error(
      "EMAIL_PROVIDER=smtp is strictly prohibited in production. Outbound SMTP ports are blocked on Render. Use EMAIL_PROVIDER=resend."
    );
  }

  // Validate provider-specific credentials
  if (provider === "resend") {
    const apiKey = (process.env.RESEND_API_KEY || "").trim();
    if (!apiKey) {
      throw new Error(
        "Missing required environment variable RESEND_API_KEY for Resend email provider."
      );
    }
  }

  if (provider === "smtp") {
    const user = (process.env.EMAIL_USER || "").trim();
    const pass = (process.env.EMAIL_PASS || "").trim();
    if (!user || !pass) {
      // In development or test, note missing credentials without crashing config load
      if (isProduction) {
        throw new Error(
          "Missing required SMTP credentials (EMAIL_USER and EMAIL_PASS)."
        );
      }
    }
  }

  // Sender resolution:
  // For Resend, must use the verified domain identity: mail.omslabs.tech
  let fromAddress = (process.env.EMAIL_FROM || "").trim();
  if (!fromAddress) {
    if (provider === "resend") {
      fromAddress = DEFAULT_SENDER;
    } else {
      fromAddress = process.env.EMAIL_USER
        ? `AuctionX <${process.env.EMAIL_USER}>`
        : DEFAULT_SENDER;
    }
  }

  const replyTo =
    (process.env.EMAIL_REPLY_TO || "").trim() ||
    (process.env.EMAIL_USER || "").trim() ||
    undefined;

  return {
    provider,
    isProduction,
    from: fromAddress,
    replyTo,
    resendApiKey: (process.env.RESEND_API_KEY || "").trim(),
    smtpUser: (process.env.EMAIL_USER || "").trim(),
    smtpPass: (process.env.EMAIL_PASS || "").trim(),
  };
}

module.exports = {
  getEmailConfig,
  isProductionEnvironment,
  DEFAULT_SENDER,
};
