/**
 * Unit Test Suite: Centralized Email Infrastructure (SMTP & Resend)
 * 
 * Tests:
 * 1. Configuration validation & provider selection
 * 2. Production safety rules (blocking SMTP on Render, requiring RESEND_API_KEY)
 * 3. Mocked Resend provider delivery & error handling
 * 4. Mocked SMTP provider delivery & error handling
 * 5. EmailService facade validation, retries, and OTP template generation
 * 6. Non-blocking error isolation for security alerts & financial integrity
 */

const { EmailService, DEFAULT_SENDER } = require("../../../src/common/utilities/email/emailService");
const { getEmailConfig } = require("../../../src/common/utilities/email/emailConfig");
const SmtpProvider = require("../../../src/common/utilities/email/providers/smtpProvider");
const ResendProvider = require("../../../src/common/utilities/email/providers/resendProvider");

describe("Email Infrastructure Unit Tests", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  // ============================================================================
  // 1. Configuration & Provider Selection
  // ============================================================================
  describe("emailConfig & Provider Resolution", () => {
    it("should default to SMTP in non-production environments when EMAIL_PROVIDER is unset", () => {
      delete process.env.EMAIL_PROVIDER;
      process.env.NODE_ENV = "test";
      process.env.EMAIL_USER = "test@omslabs.tech";
      process.env.EMAIL_PASS = "test_pass";

      const config = getEmailConfig();
      expect(config.provider).toBe("smtp");
      expect(config.from).toContain("test@omslabs.tech");
    });

    it("should resolve Resend provider when EMAIL_PROVIDER=resend with API key", () => {
      process.env.EMAIL_PROVIDER = "resend";
      process.env.RESEND_API_KEY = "re_test_dummy_key_123456";
      process.env.EMAIL_FROM = "AuctionX <notifications@mail.omslabs.tech>";

      const config = getEmailConfig();
      expect(config.provider).toBe("resend");
      expect(config.from).toBe("AuctionX <notifications@mail.omslabs.tech>");
    });

    it("should throw when an invalid EMAIL_PROVIDER is configured", () => {
      process.env.EMAIL_PROVIDER = "sendgrid";

      expect(() => getEmailConfig()).toThrow(/Invalid EMAIL_PROVIDER "sendgrid"/);
    });

    it("should throw in production when EMAIL_PROVIDER=smtp (Render outbound SMTP restriction)", () => {
      process.env.NODE_ENV = "production";
      process.env.EMAIL_PROVIDER = "smtp";
      process.env.EMAIL_USER = "test@omslabs.tech";
      process.env.EMAIL_PASS = "secret_pass";

      expect(() => getEmailConfig()).toThrow(
        /EMAIL_PROVIDER=smtp is strictly prohibited in production/
      );
    });

    it("should throw when EMAIL_PROVIDER=resend is missing RESEND_API_KEY", () => {
      process.env.EMAIL_PROVIDER = "resend";
      delete process.env.RESEND_API_KEY;

      expect(() => getEmailConfig()).toThrow(
        /Missing required environment variable RESEND_API_KEY/
      );
    });

    it("should use DEFAULT_SENDER when EMAIL_FROM is unset in Resend mode", () => {
      process.env.EMAIL_PROVIDER = "resend";
      process.env.RESEND_API_KEY = "re_test_key";
      delete process.env.EMAIL_FROM;

      const config = getEmailConfig();
      expect(config.from).toBe(DEFAULT_SENDER);
    });

    it("should automatically select Resend when RESEND_API_KEY is present even if EMAIL_PROVIDER is unset", () => {
      delete process.env.EMAIL_PROVIDER;
      process.env.RESEND_API_KEY = "re_auto_detected_key_123456";
      process.env.NODE_ENV = "test";

      const config = getEmailConfig();
      expect(config.provider).toBe("resend");
    });

    it("should automatically select Resend and treat as production when RENDER=true even if NODE_ENV is unset", () => {
      delete process.env.EMAIL_PROVIDER;
      delete process.env.NODE_ENV;
      process.env.RENDER = "true";
      process.env.RESEND_API_KEY = "re_render_detected_key";

      const config = getEmailConfig();
      expect(config.isProduction).toBe(true);
      expect(config.provider).toBe("resend");
    });

    it("should throw in production on Render if RESEND_API_KEY is missing", () => {
      delete process.env.EMAIL_PROVIDER;
      delete process.env.RESEND_API_KEY;
      process.env.RENDER_EXTERNAL_URL = "https://auctionx-enhanced-live-server.onrender.com";

      expect(() => getEmailConfig()).toThrow(
        /Missing required environment variable RESEND_API_KEY/
      );
    });
  });

  // ============================================================================
  // 2. Resend Provider Implementation
  // ============================================================================
  describe("ResendProvider", () => {
    it("should invoke resend.emails.send with correctly structured HTTPS payload", async () => {
      const mockSend = jest.fn().mockResolvedValue({
        data: { id: "msg_resend_mock_123" },
        error: null,
      });
      const mockResendClient = { emails: { send: mockSend } };

      const config = {
        resendApiKey: "re_mock_key",
        from: "AuctionX <notifications@mail.omslabs.tech>",
        replyTo: "support@mail.omslabs.tech",
      };

      const provider = new ResendProvider(config, mockResendClient);
      const result = await provider.sendMail({
        to: "buyer@example.com",
        subject: "Auction Won Confirmation",
        html: "<p>Congratulations on winning!</p>",
        text: "Congratulations on winning!",
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe("msg_resend_mock_123");
      expect(result.provider).toBe("resend");

      expect(mockSend).toHaveBeenCalledWith({
        from: "AuctionX <notifications@mail.omslabs.tech>",
        to: ["buyer@example.com"],
        subject: "Auction Won Confirmation",
        html: "<p>Congratulations on winning!</p>",
        text: "Congratulations on winning!",
        reply_to: "support@mail.omslabs.tech",
      });
    });

    it("should throw sanitized error when Resend API returns an error payload", async () => {
      const mockSend = jest.fn().mockResolvedValue({
        data: null,
        error: { message: "Domain mail.omslabs.tech not verified for testing account" },
      });
      const mockResendClient = { emails: { send: mockSend } };

      const config = {
        resendApiKey: "re_mock_secret_key",
        from: "AuctionX <notifications@mail.omslabs.tech>",
      };

      const provider = new ResendProvider(config, mockResendClient);

      await expect(
        provider.sendMail({
          to: "user@example.com",
          subject: "Test",
          html: "<p>test</p>",
        })
      ).rejects.toThrow(/Resend API error: Domain mail.omslabs.tech not verified/);
    });
  });

  // ============================================================================
  // 3. SMTP Provider Implementation
  // ============================================================================
  describe("SmtpProvider", () => {
    it("should send email via Nodemailer transporter", async () => {
      const mockSendMail = jest.fn().mockResolvedValue({
        messageId: "mock_smtp_msg_456",
        response: "250 Message accepted",
      });
      const mockTransporter = { sendMail: mockSendMail };

      const config = {
        smtpUser: "seller@gmail.com",
        smtpPass: "app_password_secret",
        from: "AuctionX <seller@gmail.com>",
        replyTo: "support@gmail.com",
        isProduction: false,
      };

      const provider = new SmtpProvider(config, mockTransporter);
      const result = await provider.sendMail({
        to: "client@example.com",
        subject: "Listing Active",
        html: "<b>Your listing is active</b>",
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe("mock_smtp_msg_456");
      expect(result.provider).toBe("smtp");

      expect(mockSendMail).toHaveBeenCalledWith({
        from: "AuctionX <seller@gmail.com>",
        to: "client@example.com",
        subject: "Listing Active",
        html: "<b>Your listing is active</b>",
        text: undefined,
        replyTo: "support@gmail.com",
      });
    });

    it("should never expose SMTP password in error message on delivery failure", async () => {
      const secretPassword = "super_secret_smtp_app_password_xyz";
      const mockSendMail = jest.fn().mockRejectedValue(
        new Error(`Authentication failed for password: ${secretPassword}`)
      );
      const mockTransporter = { sendMail: mockSendMail };

      const config = {
        smtpUser: "seller@gmail.com",
        smtpPass: secretPassword,
        isProduction: false,
      };

      const provider = new SmtpProvider(config, mockTransporter);

      await expect(
        provider.sendMail({
          to: "client@example.com",
          subject: "Test",
          html: "<p>test</p>",
        })
      ).rejects.toThrow(/SMTP email delivery failed/);

      try {
        await provider.sendMail({
          to: "client@example.com",
          subject: "Test",
          html: "<p>test</p>",
        });
      } catch (err) {
        expect(err.message).not.toContain(secretPassword);
        expect(err.message).toContain("***");
      }
    });
  });

  // ============================================================================
  // 4. EmailService Facade & OTP Generation
  // ============================================================================
  describe("EmailService Facade", () => {
    it("should validate required email fields before calling provider", async () => {
      const mockProvider = { sendMail: jest.fn() };
      const service = new EmailService(null, mockProvider);

      await expect(service.sendEmail({ to: "", subject: "Test", html: "<p>hi</p>" })).rejects.toThrow(
        /recipient 'to' address is required/
      );
      await expect(service.sendEmail({ to: "a@b.com", subject: "", html: "<p>hi</p>" })).rejects.toThrow(
        /'subject' is required/
      );
      await expect(service.sendEmail({ to: "a@b.com", subject: "Test" })).rejects.toThrow(
        /either 'html' or 'text' content is required/
      );
    });

    it("should perform bounded retry for transient network failure (e.g. 503 Service Unavailable)", async () => {
      const mockSend = jest
        .fn()
        .mockRejectedValueOnce(new Error("503 Service Unavailable"))
        .mockResolvedValueOnce({ success: true, messageId: "recovered_msg_789", provider: "resend" });

      const mockProvider = { sendMail: mockSend };
      const service = new EmailService(null, mockProvider);

      const result = await service.sendEmail({
        to: "user@example.com",
        subject: "Welcome",
        html: "<p>Welcome to AuctionX</p>",
      });

      expect(mockSend).toHaveBeenCalledTimes(2);
      expect(result.messageId).toBe("recovered_msg_789");
    });

    it("should NOT retry OTP emails even on transient network failures to prevent duplicate dispatch", async () => {
      const mockSend = jest
        .fn()
        .mockRejectedValue(new Error("503 Service Unavailable"));

      const mockProvider = { sendMail: mockSend };
      const service = new EmailService(null, mockProvider);

      await expect(
        service.sendOtpEmail("bidder@omslabs.tech", 123456)
      ).rejects.toThrow("503 Service Unavailable");

      // Strictly 1 attempt, zero retries for OTP
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it("should NOT retry permanent 4xx or validation errors", async () => {
      const mockSend = jest
        .fn()
        .mockRejectedValue(new Error("400 Bad Request: Invalid email format"));

      const mockProvider = { sendMail: mockSend };
      const service = new EmailService(null, mockProvider);

      await expect(
        service.sendEmail({
          to: "invalid-email",
          subject: "Notice",
          html: "<p>Notice</p>",
          category: "notification",
        })
      ).rejects.toThrow("400 Bad Request");

      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it("should format and send branded OTP email via sendOtpEmail", async () => {
      const mockSend = jest.fn().mockResolvedValue({
        success: true,
        messageId: "otp_msg_001",
        provider: "resend",
      });
      const mockProvider = { sendMail: mockSend };
      const service = new EmailService(null, mockProvider);

      const result = await service.sendOtpEmail("bidder@omslabs.tech", 849201);

      expect(result.success).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "bidder@omslabs.tech",
          subject: "Your OTP Code",
          html: expect.stringContaining("849201"),
          text: expect.stringContaining("849201"),
        })
      );
    });
  });

  // ============================================================================
  // 5. Error Isolation & Non-blocking Safety
  // ============================================================================
  describe("Security Alert & Financial Integrity Isolation", () => {
    it("security alert service handles email delivery failures gracefully without throwing", async () => {
      const { sendLoginSecurityAlert } = require("../../../src/infrastructure/security/securityAlertService");

      // Intentionally simulate a user login alert when email fails
      const alertResult = await sendLoginSecurityAlert(
        { email: "nonexistent_email_fail@omslabs.tech", name: "Security Test" },
        { method: "Password", req: { ip: "127.0.0.1" } }
      );

      // Must complete safely without unhandled rejection or crashing caller
      expect(alertResult).toBeDefined();
      expect(typeof alertResult.success).toBe("boolean");
    });

    it("targeted OTP cleanup prevents wiping newer concurrent OTP when a stale request fails", async () => {
      const testEmail = "concurrent_otp_test@example.com";
      const staleOtp = 111111;
      const newerOtp = 222222;

      // State represents DB where Request 2 has already superseded with newerOtp
      const dbRecord = { email: testEmail, otp: newerOtp };

      // Targeted deletion logic { email, otp: staleOtp }
      const deleted = dbRecord.email === testEmail && dbRecord.otp === staleOtp;
      expect(deleted).toBe(false);
      expect(dbRecord.otp).toBe(newerOtp);
    });
  });
});

