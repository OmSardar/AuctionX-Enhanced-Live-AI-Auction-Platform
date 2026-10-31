const request = require("supertest");
const { app } = require("../../../server");
const { clearDatabase } = require("../../helpers/dbHelper");
const { createTestUser, createTestSeller } = require("../../helpers/authHelper");
const { createCsrfCredentials } = require("../../helpers/csrfHelper");
const User = require("../../../src/modules/users/models/user");
const { generateTotpUri, generateBase32Secret, generateTotp } = require("../../../src/infrastructure/security/totpService");

describe("Provider-Aware Account Security Integration Tests (OAuth vs Password Accounts)", () => {
  const GOOGLE_PHOTO_URL = "https://lh3.googleusercontent.com/a/ACg8ocRealGooglePhotoUrl123";

  beforeEach(async () => {
    await clearDatabase();
  });

  describe("Criterion 1: Google-only user account (authoritative flags & hidden password settings)", () => {
    it("returns hasPassword: false and isOAuthUser: true from authenticated checkAuth and profile API", async () => {
      const csrf = createCsrfCredentials();
      const { user, token } = await createTestUser({
        email: "google_only_user@example.com",
        password: "",
        isOAuthUser: true,
        isNewUser: false,
        isVerified: true,
        googlePhoto: GOOGLE_PHOTO_URL,
      });

      // 1. Check session auth
      const checkRes = await request(app)
        .get("/api/auth/check")
        .set("Cookie", [`token=${token}`, csrf.cookie])
        .set(csrf.headerName, csrf.headerValue);

      expect(checkRes.statusCode).toBe(200);
      expect(checkRes.body.authenticated).toBe(true);
      expect(checkRes.body.user.hasPassword).toBe(false);
      expect(checkRes.body.user.isOAuthUser).toBe(true);
      expect(checkRes.body.user.password).toBeUndefined();

      // 2. Check profile API
      const profileRes = await request(app)
        .get(`/api/auth/user/user/${user.email}`)
        .set("Cookie", [`token=${token}`, csrf.cookie])
        .set(csrf.headerName, csrf.headerValue);

      expect(profileRes.statusCode).toBe(200);
      expect(profileRes.body.hasPassword).toBe(false);
      expect(profileRes.body.isOAuthUser).toBe(true);
      expect(profileRes.body.password).toBeUndefined();
    });
  });

  describe("Criterion 2: Local-password user account (controls remain available)", () => {
    it("returns hasPassword: true and isOAuthUser: false for local-password accounts", async () => {
      const csrf = createCsrfCredentials();
      const { user, token } = await createTestUser({
        email: "password_user@example.com",
        plainPassword: "SecurePassword123!",
        isOAuthUser: false,
        isNewUser: false,
        isVerified: true,
      });

      const checkRes = await request(app)
        .get("/api/auth/check")
        .set("Cookie", [`token=${token}`, csrf.cookie])
        .set(csrf.headerName, csrf.headerValue);

      expect(checkRes.statusCode).toBe(200);
      expect(checkRes.body.authenticated).toBe(true);
      expect(checkRes.body.user.hasPassword).toBe(true);
      expect(checkRes.body.user.isOAuthUser).toBe(false);
      expect(checkRes.body.user.password).toBeUndefined();

      const profileRes = await request(app)
        .get(`/api/auth/user/user/${user.email}`)
        .set("Cookie", [`token=${token}`, csrf.cookie])
        .set(csrf.headerName, csrf.headerValue);

      expect(profileRes.statusCode).toBe(200);
      expect(profileRes.body.hasPassword).toBe(true);
      expect(profileRes.body.isOAuthUser).toBe(false);
      expect(profileRes.body.password).toBeUndefined();
    });
  });

  describe("Criterion 3: Hybrid account supporting both Google and password", () => {
    it("returns hasPassword: true and isOAuthUser: true, preserving password controls", async () => {
      const csrf = createCsrfCredentials();
      const { user, token } = await createTestUser({
        email: "hybrid_user@example.com",
        plainPassword: "HybridPassword123!",
        isOAuthUser: true,
        isNewUser: false,
        isVerified: true,
        googlePhoto: GOOGLE_PHOTO_URL,
      });

      const checkRes = await request(app)
        .get("/api/auth/check")
        .set("Cookie", [`token=${token}`, csrf.cookie])
        .set(csrf.headerName, csrf.headerValue);

      expect(checkRes.statusCode).toBe(200);
      expect(checkRes.body.authenticated).toBe(true);
      expect(checkRes.body.user.hasPassword).toBe(true);
      expect(checkRes.body.user.isOAuthUser).toBe(true);
      expect(checkRes.body.user.password).toBeUndefined();

      // Normal password login continues to work for hybrid accounts
      const loginRes = await request(app)
        .post("/api/auth/login")
        .set("Cookie", csrf.cookie)
        .set(csrf.headerName, csrf.headerValue)
        .send({
          email: "hybrid_user@example.com",
          password: "HybridPassword123!",
        });

      expect(loginRes.statusCode).toBe(200);
      expect(loginRes.body.success).toBe(true);
      expect(loginRes.body.user.hasPassword).toBe(true);
      expect(loginRes.body.user.isOAuthUser).toBe(true);
    });
  });

  describe("Criterion 4: Google-only seller account (password controls hidden)", () => {
    it("returns hasPassword: false and isOAuthUser: true for seller checkAuth and profile API", async () => {
      const csrf = createCsrfCredentials();
      const { seller, token } = await createTestSeller({
        email: "google_only_seller@example.com",
        password: "",
        isOAuthUser: true,
        isNewUser: false,
        isVerified: true,
        googlePhoto: GOOGLE_PHOTO_URL,
      });

      const checkRes = await request(app)
        .get("/api/auth/seller/check")
        .set("Cookie", [`token=${token}`, csrf.cookie])
        .set(csrf.headerName, csrf.headerValue);

      expect(checkRes.statusCode).toBe(200);
      expect(checkRes.body.authenticated).toBe(true);
      expect(checkRes.body.user.hasPassword).toBe(false);
      expect(checkRes.body.user.isOAuthUser).toBe(true);
      expect(checkRes.body.user.password).toBeUndefined();

      const profileRes = await request(app)
        .get(`/api/auth/seller/user/${seller.email}`)
        .set("Cookie", [`token=${token}`, csrf.cookie])
        .set(csrf.headerName, csrf.headerValue);

      expect(profileRes.statusCode).toBe(200);
      expect(profileRes.body.hasPassword).toBe(false);
      expect(profileRes.body.isOAuthUser).toBe(true);
      expect(profileRes.body.password).toBeUndefined();
    });
  });

  describe("Criterion 5: Local-password seller account (password controls available)", () => {
    it("returns hasPassword: true and isOAuthUser: false for local-password seller", async () => {
      const csrf = createCsrfCredentials();
      const { seller, token } = await createTestSeller({
        email: "password_seller@example.com",
        plainPassword: "SellerPassword123!",
        isOAuthUser: false,
        isNewUser: false,
        isVerified: true,
      });

      const checkRes = await request(app)
        .get("/api/auth/seller/check")
        .set("Cookie", [`token=${token}`, csrf.cookie])
        .set(csrf.headerName, csrf.headerValue);

      expect(checkRes.statusCode).toBe(200);
      expect(checkRes.body.authenticated).toBe(true);
      expect(checkRes.body.user.hasPassword).toBe(true);
      expect(checkRes.body.user.isOAuthUser).toBe(false);
      expect(checkRes.body.user.password).toBeUndefined();
    });
  });

  describe("Criterion 6: Google-only account attempts password login (clear guidance, no auth)", () => {
    it("returns HTTP 400 with GOOGLE_AUTH_ONLY code and guidance for regular user without setting session", async () => {
      const csrf = createCsrfCredentials();
      await createTestUser({
        email: "google_login_guidance@example.com",
        password: "",
        isOAuthUser: true,
        isNewUser: false,
        isVerified: true,
        googlePhoto: GOOGLE_PHOTO_URL,
      });

      const res = await request(app)
        .post("/api/auth/login")
        .set("Cookie", csrf.cookie)
        .set(csrf.headerName, csrf.headerValue)
        .send({
          email: "google_login_guidance@example.com",
          password: "AnyPasswordAttempt123!",
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe("GOOGLE_AUTH_ONLY");
      expect(res.body.message).toBe(
        "This account uses Google sign-in and does not have a password set. Please continue with Google to access your account."
      );
      // Ensure no auth cookie was issued
      const cookies = res.headers["set-cookie"] || [];
      const tokenCookie = cookies.find((c) => c.startsWith("token="));
      expect(!tokenCookie || tokenCookie.includes("token=;")).toBe(true);
    });

    it("returns HTTP 400 with GOOGLE_AUTH_ONLY code and guidance for seller without setting session", async () => {
      const csrf = createCsrfCredentials();
      await createTestSeller({
        email: "google_seller_guidance@example.com",
        password: "",
        isOAuthUser: true,
        isNewUser: false,
        isVerified: true,
        googlePhoto: GOOGLE_PHOTO_URL,
      });

      const res = await request(app)
        .post("/api/auth/seller/login")
        .set("Cookie", csrf.cookie)
        .set(csrf.headerName, csrf.headerValue)
        .send({
          email: "google_seller_guidance@example.com",
          password: "AnyPasswordAttempt123!",
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe("GOOGLE_AUTH_ONLY");
      expect(res.body.message).toBe(
        "This account uses Google sign-in and does not have a password set. Please continue with Google to access your account."
      );
    });
  });

  describe("Criterion 7: Generic invalid credentials (safe error behavior)", () => {
    it("returns generic 401 Invalid credentials for non-existent account without account enumeration", async () => {
      const csrf = createCsrfCredentials();
      const res = await request(app)
        .post("/api/auth/login")
        .set("Cookie", csrf.cookie)
        .set(csrf.headerName, csrf.headerValue)
        .send({
          email: "nonexistent_user@example.com",
          password: "SomePassword123!",
        });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Invalid credentials");
      expect(res.body.code).toBeUndefined();
    });

    it("returns generic 401 Invalid credentials for wrong password on password-enabled account", async () => {
      const csrf = createCsrfCredentials();
      await createTestUser({
        email: "existing_password_user@example.com",
        plainPassword: "CorrectPassword123!",
        isOAuthUser: false,
      });

      const res = await request(app)
        .post("/api/auth/login")
        .set("Cookie", csrf.cookie)
        .set(csrf.headerName, csrf.headerValue)
        .send({
          email: "existing_password_user@example.com",
          password: "WrongPassword999!",
        });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Invalid credentials");
      expect(res.body.code).toBeUndefined();
    });
  });

  describe("Criterion 8: Authenticator 2FA settings usable for Google-only users", () => {
    it("allows Google-only user to enroll, get 2FA status, and disable 2FA without requiring a password", async () => {
      const csrf = createCsrfCredentials();
      const { user, token } = await createTestUser({
        email: "oauth_2fa_policy@example.com",
        password: "",
        isOAuthUser: true,
        isNewUser: false,
        isVerified: true,
        googlePhoto: GOOGLE_PHOTO_URL,
      });

      // 1. Setup 2FA
      const setupRes = await request(app)
        .post("/api/auth/2fa/setup")
        .set("Cookie", [`token=${token}`, csrf.cookie])
        .set(csrf.headerName, csrf.headerValue);

      expect(setupRes.statusCode).toBe(200);
      expect(setupRes.body.success).toBe(true);
      expect(setupRes.body.secret).toBeDefined();

      // 2. Confirm 2FA
      const { otp } = generateTotp(setupRes.body.secret);

      const confirmRes = await request(app)
        .post("/api/auth/2fa/confirm")
        .set("Cookie", [`token=${token}`, csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({ code: otp });

      expect(confirmRes.statusCode).toBe(200);
      expect(confirmRes.body.success).toBe(true);

      // 3. Status check returns 2FA enabled with provider flags
      const statusRes = await request(app)
        .get("/api/auth/2fa/status")
        .set("Cookie", [`token=${token}`, csrf.cookie])
        .set(csrf.headerName, csrf.headerValue);

      expect(statusRes.statusCode).toBe(200);
      expect(statusRes.body.twoFactorEnabled).toBe(true);
      expect(statusRes.body.hasPassword).toBe(false);
      expect(statusRes.body.isOAuthUser).toBe(true);

      // 4. Disable 2FA without password (using recovery code)
      const recoveryCode = confirmRes.body.recoveryCodes[0];

      const disableRes = await request(app)
        .post("/api/auth/2fa/disable")
        .set("Cookie", [`token=${token}`, csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({ recoveryCode });

      expect(disableRes.statusCode).toBe(200);
      expect(disableRes.body.success).toBe(true);

      const dbUser = await User.findById(user._id);
      expect(dbUser.twoFactorEnabled).toBe(false);
    });
  });

  describe("Criterion 9: Provider data cannot be forged and password change is blocked on server", () => {
    it("blocks direct password update attempt for accounts without a local password", async () => {
      const csrf = createCsrfCredentials();
      const { user, token } = await createTestUser({
        email: "oauth_pw_blocked@example.com",
        password: "",
        isOAuthUser: true,
        isNewUser: false,
        isVerified: true,
        googlePhoto: GOOGLE_PHOTO_URL,
      });

      const res = await request(app)
        .patch("/api/auth/user/update-password")
        .set("Cookie", [`token=${token}`, csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          currentPassword: "SomePassword123!",
          newPassword: "BrandNewPassword123!",
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("Password management is unavailable for Google sign-in accounts.");

      // Verify password remained unset in DB
      const dbUser = await User.findById(user._id);
      expect(dbUser.password).toBeFalsy();
    });
  });
});
