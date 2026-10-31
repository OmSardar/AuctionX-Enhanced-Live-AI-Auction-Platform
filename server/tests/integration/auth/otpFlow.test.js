const request = require("supertest");
const { app } = require("../../../server");
const Otp = require("../../../src/modules/users/models/otp");
const UserModel = require("../../../src/modules/users/models/user");
const { clearDatabase } = require("../../helpers/dbHelper");
const { createTestUser } = require("../../helpers/authHelper");
const { createCsrfCredentials } = require("../../helpers/csrfHelper");
const nodemailer = require("nodemailer");

describe("OTP Verification Flow Integration Tests", () => {
  let sendMailMock;

  beforeEach(async () => {
    await clearDatabase();
    sendMailMock = jest.fn().mockResolvedValue({ messageId: "test-mail-id" });
    jest.spyOn(nodemailer, "createTransport").mockReturnValue({
      sendMail: sendMailMock,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("POST /api/auth/send-otp", () => {
    it("should generate a 6-digit OTP and save it in database", async () => {
      const csrf = createCsrfCredentials();
      const email = "otpuser@example.com";
      await createTestUser({ email, isVerified: false });

      const res = await request(app)
        .post("/api/auth/send-otp")
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({ email });

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toMatch(/OTP sent successfully/i);

      // Verify OTP stored in MongoDB
      const otpRecord = await Otp.findOne({ email });
      expect(otpRecord).toBeDefined();
      expect(otpRecord.otp).toBeGreaterThanOrEqual(100000);
      expect(otpRecord.otp).toBeLessThanOrEqual(999999);
    });

    it("should return 400 if email is missing", async () => {
      const csrf = createCsrfCredentials();

      const res = await request(app)
        .post("/api/auth/send-otp")
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({});

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/Email is required/i);
    });
  });

  describe("POST /api/auth/verify-otp", () => {
    it("should verify valid OTP, set user isVerified to true, and purge OTP record", async () => {
      const csrf = createCsrfCredentials();
      const email = "verifyuser@example.com";
      await createTestUser({ email, isVerified: false });

      await Otp.create({
        email,
        otp: 654321,
        createdAt: new Date(),
      });

      const res = await request(app)
        .post("/api/auth/verify-otp")
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({ email, otp: 654321 });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.isVerified).toBe(true);

      // Check User is updated
      const updatedUser = await UserModel.findOne({ email });
      expect(updatedUser.isVerified).toBe(true);

      // Check OTP document is purged
      const deletedOtp = await Otp.findOne({ email });
      expect(deletedOtp).toBeNull();
    });

    it("should reject incorrect OTP with 400", async () => {
      const csrf = createCsrfCredentials();
      const email = "wrongotp@example.com";
      await createTestUser({ email, isVerified: false });

      await Otp.create({
        email,
        otp: 112233,
        createdAt: new Date(),
      });

      const res = await request(app)
        .post("/api/auth/verify-otp")
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({ email, otp: 999999 });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/Invalid OTP/i);
    });

    it("should reject expired OTP (>10 minutes) with 400", async () => {
      const csrf = createCsrfCredentials();
      const email = "expiredotp@example.com";
      await createTestUser({ email, isVerified: false });

      const elevenMinutesAgo = new Date(Date.now() - 11 * 60 * 1000);
      await Otp.create({
        email,
        otp: 445566,
        createdAt: elevenMinutesAgo,
      });

      const res = await request(app)
        .post("/api/auth/verify-otp")
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({ email, otp: 445566 });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/expired/i);
    });
  });

  describe("POST /api/auth/resend-otp", () => {
    it("should regenerate OTP and return success", async () => {
      const csrf = createCsrfCredentials();
      const email = "resenduser@example.com";
      await createTestUser({ email, isVerified: false });

      await Otp.create({
        email,
        otp: 111111,
        createdAt: new Date(),
      });

      const res = await request(app)
        .post("/api/auth/resend-otp")
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({ email });

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toMatch(/OTP resent successfully/i);
    });
  });
});
