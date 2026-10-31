/**
 * Legacy OTP Email Sender (Backward Compatible Facade)
 * Delegates to centralized EmailService supporting SMTP & Resend.
 */

const { defaultEmailService } = require("./email");

/**
 * Sends an OTP email to the given recipient.
 *
 * @param {string} email
 * @param {string|number} otp
 * @returns {Promise<{ success: boolean, messageId: string, provider: string }>}
 */
const sendOtpEmail = async (email, otp) => {
  return defaultEmailService.sendOtpEmail(email, otp);
};

module.exports = sendOtpEmail;
