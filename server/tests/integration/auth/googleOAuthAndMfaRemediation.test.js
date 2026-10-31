const request = require("supertest");
const { app } = require("../../../server");
const { clearDatabase } = require("../../helpers/dbHelper");
const { createTestUser } = require("../../helpers/authHelper");
const { createCsrfCredentials } = require("../../helpers/csrfHelper");
const User = require("../../../src/modules/users/models/user");

describe("Google OAuth & MFA Remediation Integration Tests", () => {
  const PREDEFINED_AVATAR =
    "https://res.cloudinary.com/dszvpb3q5/image/upload/v1743180239/ave3utbydiwk7bkmalxa.jpg";
  const GOOGLE_PHOTO_URL =
    "https://lh3.googleusercontent.com/a/ACg8ocRealGooglePhotoUrl123";

  beforeEach(async () => {
    await clearDatabase();
  });

  describe("Failure #1 & #2: Avatar operations on Google OAuth user without local password", () => {
    it("PATCH /api/auth/updateUserProfileImage/:email succeeds for Google OAuth user (no password, isNewUser: false)", async () => {
      const csrf = createCsrfCredentials();
      const { user, token } = await createTestUser({
        email: "oauth_avatar_test@example.com",
        password: "",
        isOAuthUser: true,
        isNewUser: false,
        isVerified: true,
        googlePhoto: GOOGLE_PHOTO_URL,
        profilePic: [{ secure_url: GOOGLE_PHOTO_URL, public_id: "" }],
      });

      const res = await request(app)
        .patch(`/api/auth/updateUserProfileImage/${user.email}`)
        .set("Cookie", [`token=${token}`, csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          profilePic: [{ secure_url: PREDEFINED_AVATAR, public_id: "" }],
          selectedAvatar: PREDEFINED_AVATAR,
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.profilePic[0].secure_url).toBe(PREDEFINED_AVATAR);
      expect(res.body.user.selectedAvatar).toBe(PREDEFINED_AVATAR);
      expect(res.body.user.googlePhoto).toBe(GOOGLE_PHOTO_URL);

      // Verify in MongoDB
      const dbUser = await User.findOne({ email: user.email });
      expect(dbUser.profilePic[0].secure_url).toBe(PREDEFINED_AVATAR);
      expect(dbUser.selectedAvatar).toBe(PREDEFINED_AVATAR);
      expect(dbUser.googlePhoto).toBe(GOOGLE_PHOTO_URL);
    });

    it("PATCH /api/auth/resetProfileImage/:email resets avatar for Google OAuth user without password validation failure", async () => {
      const csrf = createCsrfCredentials();
      const { user, token } = await createTestUser({
        email: "oauth_reset_test@example.com",
        password: "",
        isOAuthUser: true,
        isNewUser: false,
        isVerified: true,
        googlePhoto: GOOGLE_PHOTO_URL,
        profilePic: [{ secure_url: PREDEFINED_AVATAR, public_id: "" }],
      });

      const res = await request(app)
        .patch(`/api/auth/resetProfileImage/${user.email}`)
        .set("Cookie", [`token=${token}`, csrf.cookie])
        .set(csrf.headerName, csrf.headerValue);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.selectedAvatar).toBe("default");
      expect(res.body.user.googlePhoto).toBe(GOOGLE_PHOTO_URL);
    });
  });

  describe("Failure #3 & #4: 2FA Setup and Email OTP Enablement on Google OAuth user", () => {
    it("POST /api/auth/2fa/setup initiates 2FA successfully for Google OAuth user (no password)", async () => {
      const csrf = createCsrfCredentials();
      const { user, token } = await createTestUser({
        email: "oauth_2fa_setup@example.com",
        password: "",
        isOAuthUser: true,
        isNewUser: false,
        isVerified: true,
      });

      const res = await request(app)
        .post("/api/auth/2fa/setup")
        .set("Cookie", [`token=${token}`, csrf.cookie])
        .set(csrf.headerName, csrf.headerValue);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.qrCodeDataUrl).toBeDefined();
      expect(res.body.secret).toBeDefined();
      expect(typeof res.body.secret).toBe("string");

      // Verify temp secret persisted in MongoDB
      const dbUser = await User.findById(user._id).select("+twoFactorTempSecret");
      expect(dbUser.twoFactorTempSecret).toBeDefined();
      expect(dbUser.twoFactorEnabled).toBe(false);
    });

    it("POST /api/auth/2fa/email-otp/enable enables email OTP successfully for Google OAuth user (no password)", async () => {
      const csrf = createCsrfCredentials();
      const { user, token } = await createTestUser({
        email: "oauth_email_otp@example.com",
        password: "",
        isOAuthUser: true,
        isNewUser: false,
        isVerified: true,
      });

      const res = await request(app)
        .post("/api/auth/2fa/email-otp/enable")
        .set("Cookie", [`token=${token}`, csrf.cookie])
        .set(csrf.headerName, csrf.headerValue);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.emailOtpLoginEnabled).toBe(true);

      // Verify persisted in MongoDB
      const dbUser = await User.findById(user._id);
      expect(dbUser.emailOtpLoginEnabled).toBe(true);
    });

    it("POST /api/auth/2fa/email-otp/disable disables email OTP without requiring absent password for OAuth user", async () => {
      const csrf = createCsrfCredentials();
      const { user, token } = await createTestUser({
        email: "oauth_email_disable@example.com",
        password: "",
        isOAuthUser: true,
        isNewUser: false,
        isVerified: true,
        emailOtpLoginEnabled: true,
      });

      const res = await request(app)
        .post("/api/auth/2fa/email-otp/disable")
        .set("Cookie", [`token=${token}`, csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({});

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.emailOtpLoginEnabled).toBe(false);

      const dbUser = await User.findById(user._id);
      expect(dbUser.emailOtpLoginEnabled).toBe(false);
    });

    it("POST /api/auth/2fa/email-otp/disable requires and verifies password for normal password users", async () => {
      const csrf = createCsrfCredentials();
      const { user, token } = await createTestUser({
        email: "normal_email_disable@example.com",
        plainPassword: "ValidPassword123!",
        isOAuthUser: false,
        isNewUser: false,
        isVerified: true,
        emailOtpLoginEnabled: true,
      });

      // 1. Missing password
      const resNoPass = await request(app)
        .post("/api/auth/2fa/email-otp/disable")
        .set("Cookie", [`token=${token}`, csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({});

      expect(resNoPass.statusCode).toBe(400);

      // 2. Wrong password
      const resWrongPass = await request(app)
        .post("/api/auth/2fa/email-otp/disable")
        .set("Cookie", [`token=${token}`, csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({ password: "WrongPassword999!" });

      expect(resWrongPass.statusCode).toBe(401);

      // 3. Correct password
      const resCorrect = await request(app)
        .post("/api/auth/2fa/email-otp/disable")
        .set("Cookie", [`token=${token}`, csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({ password: "ValidPassword123!" });

      expect(resCorrect.statusCode).toBe(200);
      expect(resCorrect.body.emailOtpLoginEnabled).toBe(false);
    });
  });

  describe("Profile completion & verification persistence", () => {
    it("updateProfile marks isNewUser: false and isVerified: true for Google OAuth account completing address & phone", async () => {
      const csrf = createCsrfCredentials();
      const { user, token } = await createTestUser({
        email: "oauth_profile_comp@example.com",
        password: "",
        isOAuthUser: true,
        isNewUser: true,
        isVerified: false,
        googlePhoto: GOOGLE_PHOTO_URL,
      });

      const res = await request(app)
        .patch("/api/auth/user/updateProfile")
        .set("Cookie", [`token=${token}`, csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          name: user.name,
          email: user.email,
          phoneNo: "+12025550199",
          address: "123 Market Street, San Francisco, CA",
          city: "San Francisco",
          state: "California",
          country: "US",
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);

      const dbUser = await User.findById(user._id);
      expect(dbUser.isNewUser).toBe(false);
      expect(dbUser.isVerified).toBe(true);
      expect(dbUser.phoneNo).toBe("+12025550199");
      expect(dbUser.address).toBe("123 Market Street, San Francisco, CA");
    });
  });
});
