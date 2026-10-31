// Mock external email dispatch (RFC compliance & no real emails in tests)
jest.mock("../../../src/common/utilities/emailSender", () =>
  jest.fn().mockImplementation(() => Promise.resolve({ success: true }))
);

const request = require("supertest");
const { app } = require("../../../server");
const { createTestUser } = require("../../helpers/authHelper");
const { createCsrfCredentials } = require("../../helpers/csrfHelper");
const { generateTotp, generateBase32Secret, encryptSecret } = require("../../../src/infrastructure/security/totpService");
const User = require("../../../src/modules/users/models/user");
const Otp = require("../../../src/modules/users/models/otp");
const jwt = require("jsonwebtoken");

describe("Comprehensive Dual 2FA & Authentication State Machine Integration Tests", () => {
  let standardUser;
  let standardToken;
  let standardPassword;

  let totpUser;
  let totpToken;
  let totpPassword;
  let totpSecret;

  let emailOtpUser;
  let emailOtpToken;
  let emailOtpPassword;

  let dualMfaUser;
  let dualMfaToken;
  let dualMfaPassword;
  let dualMfaTotpSecret;

  let adminUser;
  let adminToken;
  let adminPassword;

  let csrf;

  beforeAll(async () => {
    // 1. Standard user (neither MFA factor enabled)
    standardPassword = "StandardUser123!";
    const stdRes = await createTestUser({
      name: "Standard User",
      email: `standard_${Date.now()}@example.com`,
      plainPassword: standardPassword,
      isVerified: true,
      isNewUser: false,
    });
    standardUser = stdRes.user;
    standardToken = stdRes.token;

    // 2. TOTP-only user
    totpPassword = "TotpPassword123!";
    totpSecret = generateBase32Secret(20);
    const totpRes = await createTestUser({
      name: "TOTP Only User",
      email: `totponly_${Date.now()}@example.com`,
      plainPassword: totpPassword,
      isVerified: true,
      isNewUser: false,
    });
    totpUser = totpRes.user;
    totpToken = totpRes.token;
    await User.findByIdAndUpdate(totpUser._id, {
      twoFactorEnabled: true,
      twoFactorSecret: encryptSecret(totpSecret),
      twoFactorConfirmedAt: new Date(),
    });

    // 3. Email-OTP-only user
    emailOtpPassword = "EmailOtpPassword123!";
    const emailRes = await createTestUser({
      name: "Email OTP Only User",
      email: `emailotponly_${Date.now()}@example.com`,
      plainPassword: emailOtpPassword,
      isVerified: true,
      isNewUser: false,
    });
    emailOtpUser = emailRes.user;
    emailOtpToken = emailRes.token;
    await User.findByIdAndUpdate(emailOtpUser._id, {
      emailOtpLoginEnabled: true,
    });

    // 4. Dual MFA user (both TOTP and Email OTP enabled)
    dualMfaPassword = "DualMfaPassword123!";
    dualMfaTotpSecret = generateBase32Secret(20);
    const dualRes = await createTestUser({
      name: "Dual MFA User",
      email: `dualmfa_${Date.now()}@example.com`,
      plainPassword: dualMfaPassword,
      isVerified: true,
      isNewUser: false,
    });
    dualMfaUser = dualRes.user;
    dualMfaToken = dualRes.token;
    await User.findByIdAndUpdate(dualMfaUser._id, {
      twoFactorEnabled: true,
      twoFactorSecret: encryptSecret(dualMfaTotpSecret),
      twoFactorConfirmedAt: new Date(),
      emailOtpLoginEnabled: true,
    });

    // 5. Admin user
    adminPassword = "AdminPassword123!";
    const adminRes = await createTestUser({
      name: "Admin User",
      email: `admin_${Date.now()}@example.com`,
      plainPassword: adminPassword,
      role: "admin",
      isVerified: true,
      isNewUser: false,
    });
    adminUser = adminRes.user;
    adminToken = adminRes.token;
  });

  beforeEach(() => {
    csrf = createCsrfCredentials();
  });

  afterAll(async () => {
    const ids = [
      standardUser?._id,
      totpUser?._id,
      emailOtpUser?._id,
      dualMfaUser?._id,
      adminUser?._id,
    ].filter(Boolean);

    await User.deleteMany({ _id: { $in: ids } });
    await Otp.deleteMany({
      email: {
        $in: [
          standardUser?.email,
          totpUser?.email,
          emailOtpUser?.email,
          dualMfaUser?.email,
          adminUser?.email,
        ].filter(Boolean),
      },
    });
  });

  // =========================================================================
  // 1. Password Login Scenarios
  // =========================================================================
  describe("Password Login Flow & Factor Combinations", () => {
    it("Scenario A: Neither factor enabled -> logs in directly with session cookie", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          email: standardUser.email,
          password: standardPassword,
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.mfaRequired).toBeUndefined();
      expect(res.body.user).toBeDefined();
      expect(res.headers["set-cookie"]).toBeDefined();
      expect(res.headers["set-cookie"].some((c) => c.startsWith("token="))).toBe(true);
    });

    it("Scenario B: TOTP enabled only -> returns stage AWAITING_TOTP", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          email: totpUser.email,
          password: totpPassword,
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.mfaRequired).toBe(true);
      expect(res.body.stage).toBe("AWAITING_TOTP");
      expect(res.body.challengeToken).toBeDefined();
      expect(res.body.requiresTotp).toBe(true);
      expect(res.body.requiresEmailOtp).toBe(false);

      // Verify no session cookie issued yet
      const cookies = res.headers["set-cookie"] || [];
      expect(cookies.some((c) => c.startsWith("token="))).toBe(false);

      // Verify challenge token cannot access protected endpoints
      const protectedRes = await request(app)
        .get("/api/auth/2fa/status")
        .set("Cookie", [`token=${res.body.challengeToken}`])
        .set("Authorization", `Bearer ${res.body.challengeToken}`);
      expect(protectedRes.statusCode).toBe(401);
      expect(protectedRes.body.message).toMatch(/Incomplete authentication challenge/i);
    });

    it("Scenario C: Email OTP enabled only -> returns stage AWAITING_EMAIL_OTP and saves OTP", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          email: emailOtpUser.email,
          password: emailOtpPassword,
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.mfaRequired).toBe(true);
      expect(res.body.stage).toBe("AWAITING_EMAIL_OTP");
      expect(res.body.challengeToken).toBeDefined();
      expect(res.body.requiresTotp).toBe(false);
      expect(res.body.requiresEmailOtp).toBe(true);

      // Verify OTP was stored in Otp collection
      const storedOtp = await Otp.findOne({ email: emailOtpUser.email });
      expect(storedOtp).toBeDefined();
      expect(typeof storedOtp.otp).toBe("number");

      // Verify completing email OTP challenge issues final session
      const verifyRes = await request(app)
        .post("/api/auth/2fa/verify-email-otp")
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          challengeToken: res.body.challengeToken,
          otp: storedOtp.otp.toString(),
        });

      expect(verifyRes.statusCode).toBe(200);
      expect(verifyRes.body.success).toBe(true);
      expect(verifyRes.headers["set-cookie"].some((c) => c.startsWith("token="))).toBe(true);

      // Verify OTP is invalidated immediately
      const postOtp = await Otp.findOne({ email: emailOtpUser.email });
      expect(postOtp).toBeNull();
    });

    it("Scenario D: Both factors enabled -> enforces TOTP first, then Email OTP in strict order", async () => {
      // 1. Initial login -> returns AWAITING_TOTP
      const loginRes = await request(app)
        .post("/api/auth/login")
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          email: dualMfaUser.email,
          password: dualMfaPassword,
        });

      expect(loginRes.statusCode).toBe(200);
      expect(loginRes.body.stage).toBe("AWAITING_TOTP");
      expect(loginRes.body.requiresTotp).toBe(true);
      expect(loginRes.body.requiresEmailOtp).toBe(true);
      const stage1Token = loginRes.body.challengeToken;

      // 2. Attempting to skip TOTP and call verify-email-otp must be REJECTED (401)
      const bypassRes = await request(app)
        .post("/api/auth/2fa/verify-email-otp")
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          challengeToken: stage1Token,
          otp: "123456",
        });
      expect(bypassRes.statusCode).toBe(401);
      expect(bypassRes.body.message).toMatch(/Invalid authentication stage/i);

      // 3. Verify TOTP with invalid code -> REJECTED (400)
      const invalidTotpRes = await request(app)
        .post("/api/auth/2fa/verify-login")
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          challengeToken: stage1Token,
          code: "000000",
        });
      expect(invalidTotpRes.statusCode).toBe(400);

      // 4. Verify TOTP with valid code -> Transitions to AWAITING_EMAIL_OTP
      const { otp: validTotpCode } = generateTotp(dualMfaTotpSecret);
      const totpVerifyRes = await request(app)
        .post("/api/auth/2fa/verify-login")
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          challengeToken: stage1Token,
          code: validTotpCode,
        });

      expect(totpVerifyRes.statusCode).toBe(200);
      expect(totpVerifyRes.body.success).toBe(true);
      expect(totpVerifyRes.body.stage).toBe("AWAITING_EMAIL_OTP");
      expect(totpVerifyRes.body.challengeToken).toBeDefined();

      // No final session token yet!
      const stage2Cookies = totpVerifyRes.headers["set-cookie"] || [];
      expect(stage2Cookies.some((c) => c.startsWith("token="))).toBe(false);

      const stage2Token = totpVerifyRes.body.challengeToken;

      // 5. Verify email OTP step
      const dualOtp = await Otp.findOne({ email: dualMfaUser.email });
      expect(dualOtp).toBeDefined();

      const finalRes = await request(app)
        .post("/api/auth/2fa/verify-email-otp")
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          challengeToken: stage2Token,
          otp: dualOtp.otp.toString(),
        });

      expect(finalRes.statusCode).toBe(200);
      expect(finalRes.body.success).toBe(true);
      expect(finalRes.body.user).toBeDefined();
      expect(finalRes.headers["set-cookie"].some((c) => c.startsWith("token="))).toBe(true);
    });

    it("Replay Attack Protection: Prevents replaying an expired/used TOTP code", async () => {
      // Login to get fresh challenge token
      const loginRes = await request(app)
        .post("/api/auth/login")
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          email: totpUser.email,
          password: totpPassword,
        });

      const { otp: validCode } = generateTotp(totpSecret);

      // First verification succeeds
      const firstRes = await request(app)
        .post("/api/auth/2fa/verify-login")
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          challengeToken: loginRes.body.challengeToken,
          code: validCode,
        });
      expect(firstRes.statusCode).toBe(200);

      // Replayed attempt with same code and new challenge token within same time step is rejected
      const loginRes2 = await request(app)
        .post("/api/auth/login")
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          email: totpUser.email,
          password: totpPassword,
        });

      const replayRes = await request(app)
        .post("/api/auth/2fa/verify-login")
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          challengeToken: loginRes2.body.challengeToken,
          code: validCode,
        });

      expect(replayRes.statusCode).toBe(400);
      expect(replayRes.body.message).toMatch(/already been used/i);
    });
  });

  // =========================================================================
  // 2. Settings UI & Management Endpoints
  // =========================================================================
  describe("Account Settings Factor Enable/Disable Integrity", () => {
    it("Enables Email OTP for a user via POST /api/auth/2fa/email-otp/enable", async () => {
      const res = await request(app)
        .post("/api/auth/2fa/email-otp/enable")
        .set("Cookie", [csrf.cookie, `token=${standardToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .set("Authorization", `Bearer ${standardToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.emailOtpLoginEnabled).toBe(true);

      const userInDb = await User.findById(standardUser._id);
      expect(userInDb.emailOtpLoginEnabled).toBe(true);
    });

    it("Rejects disabling Email OTP without valid password", async () => {
      const res = await request(app)
        .post("/api/auth/2fa/email-otp/disable")
        .set("Cookie", [csrf.cookie, `token=${standardToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .set("Authorization", `Bearer ${standardToken}`)
        .send({ password: "WrongPassword!" });

      expect(res.statusCode).toBe(401);
      expect(res.body.message).toMatch(/Incorrect password/i);
    });

    it("Disables Email OTP with valid password without touching TOTP", async () => {
      const res = await request(app)
        .post("/api/auth/2fa/email-otp/disable")
        .set("Cookie", [csrf.cookie, `token=${standardToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .set("Authorization", `Bearer ${standardToken}`)
        .send({ password: standardPassword });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.emailOtpLoginEnabled).toBe(false);

      const userInDb = await User.findById(standardUser._id);
      expect(userInDb.emailOtpLoginEnabled).toBe(false);
      expect(userInDb.twoFactorEnabled).toBe(false); // TOTP untouched
    });
  });

  // =========================================================================
  // 3. Admin MFA Enforcement & RBAC Security
  // =========================================================================
  describe("Admin MFA & Authorization Enforcement", () => {
    it("Enforces 2FA on admin login when twoFactorEnabled is active", async () => {
      // Enable 2FA on admin
      const adminTotpSecret = generateBase32Secret(20);
      await User.findByIdAndUpdate(adminUser._id, {
        twoFactorEnabled: true,
        twoFactorSecret: encryptSecret(adminTotpSecret),
        twoFactorConfirmedAt: new Date(),
      });

      const res = await request(app)
        .post("/api/auth/login")
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          email: adminUser.email,
          password: adminPassword,
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.mfaRequired).toBe(true);
      expect(res.body.stage).toBe("AWAITING_TOTP");

      // Verify admin route cannot be accessed using the challenge token
      const bypassAdminRes = await request(app)
        .get("/api/team/admin")
        .set("Cookie", [`token=${res.body.challengeToken}`])
        .set("Authorization", `Bearer ${res.body.challengeToken}`);

      expect(bypassAdminRes.statusCode).toBe(401);
    });

    it("Standard non-admin users cannot access admin endpoints", async () => {
      const res = await request(app)
        .get("/api/team/admin")
        .set("Cookie", [`token=${standardToken}`])
        .set("Authorization", `Bearer ${standardToken}`);

      expect(res.statusCode).toBe(403);
    });
  });

  // =========================================================================
  // 4. Registration & Profile Verification Regression Protection
  // =========================================================================
  describe("Registration & Profile Verification Regression", () => {
    it("Already-verified users are not forced into profile verification loop", async () => {
      const checkRes = await request(app)
        .get("/api/auth/check")
        .set("Cookie", [`token=${standardToken}`]);

      expect(checkRes.statusCode).toBe(200);
      expect(checkRes.body.authenticated).toBe(true);
      expect(checkRes.body.user.isVerified).toBe(true);
      expect(checkRes.body.user.isNewUser).toBe(false);
    });

    it("Logout clears session token cookie cleanly", async () => {
      const res = await request(app)
        .post("/api/auth/logout")
        .set("Cookie", [csrf.cookie, `token=${standardToken}`])
        .set(csrf.headerName, csrf.headerValue);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.headers["set-cookie"]).toBeDefined();
    });
  });
});
