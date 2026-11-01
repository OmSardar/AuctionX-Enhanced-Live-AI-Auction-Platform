const {
  EmailService,
  defaultEmailService,
  sendEmail,
  sendOtpEmail,
  DEFAULT_SENDER,
} = require("./emailService");
const { getEmailConfig, isProductionEnvironment } = require("./emailConfig");
const SmtpProvider = require("./providers/smtpProvider");
const ResendProvider = require("./providers/resendProvider");

module.exports = {
  EmailService,
  defaultEmailService,
  sendEmail,
  sendOtpEmail,
  getEmailConfig,
  isProductionEnvironment,
  DEFAULT_SENDER,
  SmtpProvider,
  ResendProvider,
};
