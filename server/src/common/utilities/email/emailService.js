/**
 * Centralized Email Service Facade
 * 
 * Provides a unified, provider-agnostic interface for sending emails across
 * local development (Gmail SMTP) and production (Resend HTTPS API).
 * 
 * Features:
 * - Environment-driven provider selection (SMTP vs Resend)
 * - Zero SMTP fallback in production
 * - Bounded retry for transient network failures
 * - OTP safety: Zero internal retry on OTP emails to eliminate duplicate OTP dispatches
 * - Standardized OTP email generator
 * - Safe sanitization: zero credential leakage
 */

const { getEmailConfig, DEFAULT_SENDER } = require("./emailConfig");
const SmtpProvider = require("./providers/smtpProvider");
const ResendProvider = require("./providers/resendProvider");

class EmailService {
  /**
   * @param {Object} [customConfig] - Optional configuration override (useful in unit tests)
   * @param {Object} [customProvider] - Optional pre-instantiated provider
   */
  constructor(customConfig = null, customProvider = null) {
    this.customConfig = customConfig;
    this.providerInstance = customProvider;
  }

  /**
   * Resolves the active provider instance based on runtime configuration.
   */
  getProvider() {
    if (this.providerInstance) {
      return this.providerInstance;
    }

    const config = this.customConfig || getEmailConfig();

    if (config.provider === "resend") {
      return new ResendProvider(config);
    }
    return new SmtpProvider(config);
  }

  /**
   * Sends an email through the active provider with transient error resilience.
   *
   * @param {Object} options
   * @param {string|string[]} options.to - Recipient(s)
   * @param {string} options.subject - Subject line
   * @param {string} options.html - HTML content
   * @param {string} [options.text] - Plaintext fallback
   * @param {string} [options.from] - Sender override
   * @param {string} [options.replyTo] - Reply-To override
   * @param {string} [options.category] - Diagnostic category (e.g. 'otp', 'security_alert', 'contact')
   * @returns {Promise<{ success: boolean, messageId: string, provider: string }>}
   */
  async sendEmail(options) {
    const { to, subject, html, text, from, replyTo, category = "general" } = options;

    if (!to || (Array.isArray(to) && to.length === 0)) {
      throw new Error("Cannot send email: recipient 'to' address is required.");
    }
    if (!subject) {
      throw new Error("Cannot send email: 'subject' is required.");
    }
    if (!html && !text) {
      throw new Error("Cannot send email: either 'html' or 'text' content is required.");
    }

    const provider = this.getProvider();

    // OTP emails must NEVER be retried by internal automatic loops to prevent duplicate delivery.
    // For non-OTP emails, bounded to 2 attempts max (1 retry) strictly for transient network/5xx errors.
    const maxAttempts = category === "otp" ? 1 : 2;
    let lastError = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await provider.sendMail({
          to,
          subject,
          html,
          text,
          from,
          replyTo,
        });
        return result;
      } catch (error) {
        lastError = error;

        // Permanent errors (validation, 4xx, bad auth, invalid address) are never retried
        const isTransient =
          error.message?.includes("ETIMEDOUT") ||
          error.message?.includes("ECONNRESET") ||
          error.message?.includes("ECONNREFUSED") ||
          error.message?.includes("500") ||
          error.message?.includes("502") ||
          error.message?.includes("503");

        if (attempt < maxAttempts && isTransient) {
          // Short backoff before 2nd attempt
          await new Promise((resolve) => setTimeout(resolve, 300));
          continue;
        }
        break;
      }
    }

    throw lastError;
  }

  /**
   * Sends an OTP verification email using the standard branded AuctionX template.
   *
   * @param {string} email - Recipient email address
   * @param {string|number} otp - 6-digit OTP code
   * @returns {Promise<{ success: boolean, messageId: string, provider: string }>}
   */
  async sendOtpEmail(email, otp) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ccc; border-radius: 8px; background-color: #000; color: #fff;">
        <h2 style="text-align: center; color: #fae570;">Your OTP Code</h2>
        <p style="font-size: 18px; text-align: center; color: #ddd;">
          Use the OTP below to complete your verification process. The OTP is valid for the next 10 minutes.
        </p>
        <div style="margin: 20px auto; text-align: center; font-size: 24px; font-weight: bold; color: #fae570; padding: 10px; border: 2px dashed #fae570; width: fit-content;">
          ${otp}
        </div>
        <p style="font-size: 16px; text-align: center; color: #aaa;">
          If you did not request this, please ignore this email.
        </p>
        <footer style="text-align: center; margin-top: 20px; font-size: 14px; color: #666;">
          © ${new Date().getFullYear()} Auction X. All rights reserved.
        </footer>
      </div>
    `;

    const text = `Your OTP Code is ${otp}. Use this code to complete your verification process. This OTP is valid for 10 minutes.`;

    return this.sendEmail({
      to: email,
      subject: "Your OTP Code",
      html,
      text,
      category: "otp",
    });
  }
}

// Singleton instance for standard application use
const defaultEmailService = new EmailService();

module.exports = {
  EmailService,
  defaultEmailService,
  sendEmail: (opts) => defaultEmailService.sendEmail(opts),
  sendOtpEmail: (email, otp) => defaultEmailService.sendOtpEmail(email, otp),
  DEFAULT_SENDER,
};
