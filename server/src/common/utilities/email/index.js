const {
  EmailService,
  defaultEmailService,
  sendEmail,
  sendOtpEmail,
  DEFAULT_SENDER,
} = require("./emailService");
const { getEmailConfig } = require("./emailConfig");
const SmtpProvider = require("./providers/smtpProvider");
const ResendProvider = require("./providers/resendProvider");

module.exports = {
  EmailService,
  defaultEmailService,
  sendEmail,
  sendOtpEmail,
  getEmailConfig,
  DEFAULT_SENDER,
  SmtpProvider,
  ResendProvider,
};

