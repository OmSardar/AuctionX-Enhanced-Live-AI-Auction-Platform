const request = require("supertest");
const { app } = require("../../../server");
const { createTestUser } = require("../../helpers/authHelper");
const { createCsrfCredentials } = require("../../helpers/csrfHelper");
const { generateTotp } = require("../../../src/infrastructure/security/totpService");
const User = require("../../../src/modules/users/models/user");

describe("Two-Factor Authentication (2FA) Integration Tests", () => {
  let testUser;
  let testToken;
  let plainPassword;
  let csrf;

  beforeAll(async () => {
    const userRes = await createTestUser({
      name: "2FA Test User",
      email: `2fatest_${Date.now()}@example.com`,
      plainPassword: "SecurePassword123!",
    });
    testUser = userRes.user;
    testToken = userRes.token;
    plainPassword = userRes.plainPassword;
  });

  beforeEach(() => {
    csrf = createCsrfCredentials();
  });

  afterAll(async () => {
    if (testUser) {
      await User.deleteOne({ _id: testUser._id });
    }
  });

  describe("GET /api/auth/2fa/status", () => {
    it("should reject unauthenticated request with 401", async () => {
      const res = await request(app).get("/api/auth/2fa/status");
      expect(res.statusCode).toBe(401);
    });

    it("should return false for user without 2FA enabled", async () => {
      const res = await request(app)
        .get("/api/auth/2fa/status")
        .set("Cookie", [`token=${testToken}`])
        .set("Authorization", `Bearer ${testToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.twoFactorEnabled).toBe(false);
    });
  });

  describe("2FA Setup & Enrollment Flow", () => {
    let setupSecret;
    let recoveryCodes;

    it("POST /api/auth/2fa/setup initiates enrollment with QR code and secret", async () => {
      const res = await request(app)
        .post("/api/auth/2fa/setup")
        .set("Cookie", [csrf.cookie, `token=${testToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .set("Authorization", `Bearer ${testToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.qrCode).toMatch(/^data:image\/png;base64,/);
      expect(res.body.secret).toBeDefined();
      expect(res.body.secret.length).toBe(32);

      setupSecret = res.body.secret;

      // Verify temp secret is stored encrypted in database, but 2FA is NOT yet enabled
      const userInDb = await User.findById(testUser._id).select("+twoFactorTempSecret");
      expect(userInDb.twoFactorEnabled).toBe(false);
      expect(userInDb.twoFactorTempSecret).toBeDefined();
      expect(userInDb.twoFactorTempSecret).not.toBe(setupSecret); // Must be encrypted!
    });

    it("POST /api/auth/2fa/confirm rejects invalid TOTP code", async () => {
      const res = await request(app)
        .post("/api/auth/2fa/confirm")
        .set("Cookie", [csrf.cookie, `token=${testToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .set("Authorization", `Bearer ${testToken}`)
        .send({ code: "000000" });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Invalid verification code/i);

      // Verify still not enabled
      const userInDb = await User.findById(testUser._id);
      expect(userInDb.twoFactorEnabled).toBe(false);
    });

    it("POST /api/auth/2fa/confirm enables 2FA with valid code and returns recovery codes", async () => {
      const { otp } = generateTotp(setupSecret);

      const res = await request(app)
        .post("/api/auth/2fa/confirm")
        .set("Cookie", [csrf.cookie, `token=${testToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .set("Authorization", `Bearer ${testToken}`)
        .send({ code: otp });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.recoveryCodes).toHaveLength(8);
      recoveryCodes = res.body.recoveryCodes;

      // Verify enabled in database
      const userInDb = await User.findById(testUser._id).select("+twoFactorSecret +twoFactorRecoveryCodes");
      expect(userInDb.twoFactorEnabled).toBe(true);
      expect(userInDb.twoFactorSecret).toBeDefined();
      expect(userInDb.twoFactorTempSecret).toBeUndefined(); // Cleared
      expect(userInDb.twoFactorRecoveryCodes).toHaveLength(8);
      expect(userInDb.twoFactorRecoveryCodes[0].used).toBe(false);
    });

    it("GET /api/auth/2fa/status now reports twoFactorEnabled: true", async () => {
      const res = await request(app)
        .get("/api/auth/2fa/status")
        .set("Cookie", [`token=${testToken}`])
        .set("Authorization", `Bearer ${testToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.twoFactorEnabled).toBe(true);
      expect(res.body.confirmedAt).toBeDefined();
    });

    describe("Login Challenge with 2FA Active", () => {
      let mfaToken;

      it("POST /api/auth/login requires 2FA and withholds full token", async () => {
        const res = await request(app)
          .post("/api/auth/login")
          .set("Cookie", [csrf.cookie])
          .set(csrf.headerName, csrf.headerValue)
          .send({
            email: testUser.email,
            password: plainPassword,
          });

        expect(res.statusCode).toBe(200);
        expect(res.body.mfaRequired).toBe(true);
        expect(res.body.mfaToken).toBeDefined();
        // Crucial security check: auth token cookie MUST NOT be set
        expect(res.headers["set-cookie"]).toBeUndefined();

        mfaToken = res.body.mfaToken;
      });

      it("POST /api/auth/2fa/verify-login rejects invalid 6-digit code", async () => {
        const res = await request(app)
          .post("/api/auth/2fa/verify-login")
          .set("Cookie", [csrf.cookie])
          .set(csrf.headerName, csrf.headerValue)
          .send({
            mfaToken,
            code: "999999",
          });

        expect(res.statusCode).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/Invalid verification code/i);
      });

      it("POST /api/auth/2fa/verify-login rejects replayed code from setup", async () => {
        const { otp } = generateTotp(setupSecret);
        const res = await request(app)
          .post("/api/auth/2fa/verify-login")
          .set("Cookie", [csrf.cookie])
          .set(csrf.headerName, csrf.headerValue)
          .send({
            mfaToken,
            code: otp,
          });

        expect(res.statusCode).toBe(400);
        expect(res.body.message).toMatch(/already been used/i);
      });

      it("POST /api/auth/2fa/verify-login completes login with valid fresh TOTP code", async () => {
        // Use +30s step (valid within ±1 drift window, not replayed)
        const { otp } = generateTotp(setupSecret, Math.floor(Date.now() / 1000) + 30);

        const res = await request(app)
          .post("/api/auth/2fa/verify-login")
          .set("Cookie", [csrf.cookie])
          .set(csrf.headerName, csrf.headerValue)
          .send({
            mfaToken,
            code: otp,
          });

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.user.email).toBe(testUser.email);
        // Authenticated cookie MUST be issued now
        expect(res.headers["set-cookie"]).toBeDefined();
        const cookieStr = res.headers["set-cookie"].join(";");
        expect(cookieStr).toContain("token=");
      });

      it("POST /api/auth/2fa/verify-login works with a single-use recovery code and invalidates it", async () => {
        // Step 1: Login to get fresh mfaToken
        const loginRes = await request(app)
          .post("/api/auth/login")
          .set("Cookie", [csrf.cookie])
          .set(csrf.headerName, csrf.headerValue)
          .send({
            email: testUser.email,
            password: plainPassword,
          });

        const freshMfaToken = loginRes.body.mfaToken;
        const codeToUse = recoveryCodes[0];

        // Step 2: Verify login using recovery code
        const verifyRes = await request(app)
          .post("/api/auth/2fa/verify-login")
          .set("Cookie", [csrf.cookie])
          .set(csrf.headerName, csrf.headerValue)
          .send({
            mfaToken: freshMfaToken,
            recoveryCode: codeToUse,
          });

        expect(verifyRes.statusCode).toBe(200);
        expect(verifyRes.body.success).toBe(true);

        // Step 3: Attempting to reuse the same recovery code must fail
        const loginRes2 = await request(app)
          .post("/api/auth/login")
          .set("Cookie", [csrf.cookie])
          .set(csrf.headerName, csrf.headerValue)
          .send({
            email: testUser.email,
            password: plainPassword,
          });

        const reuseRes = await request(app)
          .post("/api/auth/2fa/verify-login")
          .set("Cookie", [csrf.cookie])
          .set(csrf.headerName, csrf.headerValue)
          .send({
            mfaToken: loginRes2.body.mfaToken,
            recoveryCode: codeToUse,
          });

        expect(reuseRes.statusCode).toBe(400);
        expect(reuseRes.body.message).toMatch(/Invalid or already used recovery code/i);
      });
    });

    describe("2FA Disablement Flow", () => {
      it("POST /api/auth/2fa/disable rejects incorrect password", async () => {
        const { otp } = generateTotp(setupSecret);

        const res = await request(app)
          .post("/api/auth/2fa/disable")
          .set("Cookie", [csrf.cookie, `token=${testToken}`])
          .set(csrf.headerName, csrf.headerValue)
          .set("Authorization", `Bearer ${testToken}`)
          .send({
            password: "WrongPassword!",
            code: otp,
          });

        expect(res.statusCode).toBe(401);
        expect(res.body.message).toMatch(/Incorrect password/i);
      });

      it("POST /api/auth/2fa/disable successfully disables 2FA with valid credentials", async () => {
        // Use an unused recovery code to disable 2FA cleanly
        const recoveryCode = recoveryCodes[1];

        const res = await request(app)
          .post("/api/auth/2fa/disable")
          .set("Cookie", [csrf.cookie, `token=${testToken}`])
          .set(csrf.headerName, csrf.headerValue)
          .set("Authorization", `Bearer ${testToken}`)
          .send({
            password: plainPassword,
            code: recoveryCode,
          });

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toMatch(/disabled/i);

        // Verify status in DB
        const userInDb = await User.findById(testUser._id);
        expect(userInDb.twoFactorEnabled).toBe(false);
      });

      it("POST /api/auth/login now logs in directly without 2FA challenge", async () => {
        const res = await request(app)
          .post("/api/auth/login")
          .set("Cookie", [csrf.cookie])
          .set(csrf.headerName, csrf.headerValue)
          .send({
            email: testUser.email,
            password: plainPassword,
          });

        expect(res.statusCode).toBe(200);
        expect(res.body.mfaRequired).toBeUndefined();
        expect(res.body.user).toBeDefined();
        expect(res.headers["set-cookie"]).toBeDefined();
      });
    });
  });
});
