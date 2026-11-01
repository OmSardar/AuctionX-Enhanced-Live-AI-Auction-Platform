/**
 * Resend Email Provider (Production Delivery via HTTPS API)
 * 
 * Uses the official `resend` Node.js SDK to send transactional emails
 * across port 443 HTTPS. Bypasses restricted outbound SMTP ports on Render.
 * 
 * Verified Domain: mail.omslabs.tech
 * Default Sender: AuctionX <notifications@mail.omslabs.tech>
 */

const { Resend } = require("resend");

class ResendProvider {
  /**
   * @param {Object} config - Sanitized email configuration
   * @param {Object} [resendClient] - Optional injected Resend instance (for testing)
   */
  constructor(config, resendClient = null) {
    this.config = config;
    if (!config.resendApiKey) {
      throw new Error(
        "Missing required environment variable RESEND_API_KEY for Resend email provider."
      );
    }
    this.resend = resendClient || new Resend(config.resendApiKey);
  }

  /**
   * Send an email via Resend HTTPS API.
   *
   * @param {Object} params
   * @param {string|string[]} params.to - Recipient email address(es)
   * @param {string} params.subject - Email subject
   * @param {string} params.html - HTML body
   * @param {string} [params.text] - Plain text fallback
   * @param {string} [params.from] - Sender override (must belong to verified domain)
   * @param {string} [params.replyTo] - Reply-To override
   * @returns {Promise<{ success: boolean, messageId: string, provider: string }>}
   */
  async sendMail({ to, subject, html, text, from, replyTo }) {
    const recipientList = Array.isArray(to) ? to : [to];
    const maskedRecipients = recipientList.map((r) =>
      typeof r === "string" ? r.replace(/(?<=.{2}).(?=.*@)/g, "*") : "unknown"
    ).join(", ");

    const fromAddress = from || this.config.from;
    console.info(
      `[Resend Diagnostic] Dispatching email to ${maskedRecipients} | From: ${fromAddress} | Subject: "${subject}"`
    );

    const payload = {
      from: fromAddress,
      to: recipientList,
      subject,
      html,
    };

    if (text) {
      payload.text = text;
    }

    const effectiveReplyTo = replyTo || this.config.replyTo;
    if (effectiveReplyTo) {
      payload.reply_to = effectiveReplyTo;
    }

    try {
      const response = await this.resend.emails.send(payload);

      if (response.error) {
        const errorMsg =
          typeof response.error === "object"
            ? response.error.message || JSON.stringify(response.error)
            : String(response.error);
        console.error(`[Resend Diagnostic] API rejected email: ${errorMsg}`);
        throw new Error(`Resend API error: ${errorMsg}`);
      }

      const messageId = response.data?.id || `resend-${Date.now()}`;
      console.info(
        `[Resend Diagnostic] Delivery succeeded | MessageId: ${messageId}`
      );
      return {
        success: true,
        messageId,
        provider: "resend",
      };
    } catch (error) {
      // Ensure API key never leaks in stack traces or logs
      const safeMessage = (error.message || "Unknown Resend error").replace(
        this.config.resendApiKey,
        "***"
      );
      console.error(
        `[Resend Diagnostic] Delivery attempt failed: ${safeMessage}`
      );
      throw new Error(`Resend email delivery failed: ${safeMessage}`);
    }
  }
}

module.exports = ResendProvider;
