/**
 * Gmail SMTP Email Provider (Local Development & Fallback)
 * 
 * Uses Nodemailer to deliver emails via Gmail SMTP.
 * Used exclusively for local development and non-production environments.
 */

const nodemailer = require("nodemailer");

class SmtpProvider {
  /**
   * @param {Object} config - Sanitized email configuration
   * @param {Object} [transporter] - Optional injected Nodemailer transporter (for testing)
   */
  constructor(config, transporter = null) {
    this.config = config;
    this.transporter =
      transporter ||
      nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: config.smtpUser,
          pass: config.smtpPass,
        },
      });
  }

  /**
   * Send an email via Nodemailer SMTP.
   *
   * @param {Object} params
   * @param {string|string[]} params.to - Recipient email address(es)
   * @param {string} params.subject - Email subject
   * @param {string} params.html - HTML body
   * @param {string} [params.text] - Plain text fallback
   * @param {string} [params.from] - Sender override
   * @param {string} [params.replyTo] - Reply-To override
   * @returns {Promise<{ success: boolean, messageId: string, provider: string }>}
   */
  async sendMail({ to, subject, html, text, from, replyTo }) {
    if (this.config.isProduction && (!this.config.smtpUser || !this.config.smtpPass)) {
      throw new Error(
        "SMTP email delivery failed: EMAIL_USER and EMAIL_PASS must be configured."
      );
    }

    const mailOptions = {
      from:
        from ||
        this.config.from ||
        this.config.smtpUser ||
        "AuctionX <notifications@mail.omslabs.tech>",
      to: Array.isArray(to) ? to.join(", ") : to,
      subject,
      html,
      text: text || undefined,
      replyTo: replyTo || this.config.replyTo || undefined,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      return {
        success: true,
        messageId: info?.messageId || `smtp-${Date.now()}`,
        provider: "smtp",
      };
    } catch (error) {
      // Sanitize error message to ensure no passwords or credentials leak
      const safeMessage = (error.message || "Unknown SMTP error").replace(
        this.config.smtpPass || "___",
        "***"
      );
      throw new Error(`SMTP email delivery failed: ${safeMessage}`);
    }
  }
}

module.exports = SmtpProvider;
