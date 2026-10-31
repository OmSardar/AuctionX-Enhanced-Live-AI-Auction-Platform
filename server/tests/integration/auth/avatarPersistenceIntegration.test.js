const request = require("supertest");
const { app } = require("../../../server");
const { clearDatabase } = require("../../helpers/dbHelper");
const { createTestUser } = require("../../helpers/authHelper");
const { createCsrfCredentials } = require("../../helpers/csrfHelper");
const User = require("../../../src/modules/users/models/user");

describe("Avatar Persistence and Data-Flow Integration Tests", () => {
  const PREDEFINED_AVATAR =
    "https://res.cloudinary.com/dszvpb3q5/image/upload/v1743180239/ave3utbydiwk7bkmalxa.jpg";
  const GOOGLE_PHOTO_URL =
    "https://lh3.googleusercontent.com/a/ACg8ocRealGooglePhotoUrl123";
  const DEFAULT_AVATAR =
    "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";

  beforeEach(async () => {
    await clearDatabase();
  });

  describe("PATCH /api/auth/updateUserProfileImage/:email - Real Persistence", () => {
    it("should persist predefined avatar selection and preserve googlePhoto in MongoDB", async () => {
      const csrf = createCsrfCredentials();
      const { user, token } = await createTestUser({
        email: "googleuser@example.com",
        googlePhoto: GOOGLE_PHOTO_URL,
        profilePic: [{ secure_url: GOOGLE_PHOTO_URL, public_id: "" }],
        selectedAvatar: "",
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
      expect(res.body.user).toBeDefined();
      expect(res.body.user.profilePic[0].secure_url).toBe(PREDEFINED_AVATAR);
      expect(res.body.user.selectedAvatar).toBe(PREDEFINED_AVATAR);
      expect(res.body.user.googlePhoto).toBe(GOOGLE_PHOTO_URL);

      // Verify in MongoDB directly
      const dbUser = await User.findOne({ email: user.email });
      expect(dbUser.profilePic[0].secure_url).toBe(PREDEFINED_AVATAR);
      expect(dbUser.selectedAvatar).toBe(PREDEFINED_AVATAR);
      expect(dbUser.googlePhoto).toBe(GOOGLE_PHOTO_URL);
    });

    it("should allow choosing Google photo explicitly without erasing preserved googlePhoto", async () => {
      const csrf = createCsrfCredentials();
      const { user, token } = await createTestUser({
        email: "googleuser2@example.com",
        googlePhoto: GOOGLE_PHOTO_URL,
        profilePic: [{ secure_url: PREDEFINED_AVATAR, public_id: "" }],
        selectedAvatar: PREDEFINED_AVATAR,
      });

      const res = await request(app)
        .patch(`/api/auth/updateUserProfileImage/${user.email}`)
        .set("Cookie", [`token=${token}`, csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          profilePic: [{ secure_url: GOOGLE_PHOTO_URL, public_id: "" }],
          selectedAvatar: "google",
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.profilePic[0].secure_url).toBe(GOOGLE_PHOTO_URL);
      expect(res.body.user.selectedAvatar).toBe("google");
      expect(res.body.user.googlePhoto).toBe(GOOGLE_PHOTO_URL);

      const dbUser = await User.findOne({ email: user.email });
      expect(dbUser.profilePic[0].secure_url).toBe(GOOGLE_PHOTO_URL);
      expect(dbUser.selectedAvatar).toBe("google");
      expect(dbUser.googlePhoto).toBe(GOOGLE_PHOTO_URL);
    });
  });

  describe("PATCH /api/auth/resetProfileImage/:email - Real Persistence", () => {
    it("should reset avatar to default in MongoDB while retaining googlePhoto intact", async () => {
      const csrf = createCsrfCredentials();
      const { user, token } = await createTestUser({
        email: "googleuser3@example.com",
        googlePhoto: GOOGLE_PHOTO_URL,
        profilePic: [{ secure_url: PREDEFINED_AVATAR, public_id: "" }],
        selectedAvatar: PREDEFINED_AVATAR,
      });

      const res = await request(app)
        .patch(`/api/auth/resetProfileImage/${user.email}`)
        .set("Cookie", [`token=${token}`, csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({});

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.profilePic[0].secure_url).toBe(DEFAULT_AVATAR);
      expect(res.body.user.selectedAvatar).toBe("default");
      expect(res.body.user.googlePhoto).toBe(GOOGLE_PHOTO_URL);

      const dbUser = await User.findOne({ email: user.email });
      expect(dbUser.profilePic[0].secure_url).toBe(DEFAULT_AVATAR);
      expect(dbUser.selectedAvatar).toBe("default");
      expect(dbUser.googlePhoto).toBe(GOOGLE_PHOTO_URL);
    });
  });

  describe("Auth Verification and Login Endpoints Return Avatar Metadata", () => {
    it("POST /api/auth/login returns googlePhoto and selectedAvatar in user payload", async () => {
      const csrf = createCsrfCredentials();
      const { user, plainPassword } = await createTestUser({
        email: "loginavatar@example.com",
        plainPassword: "Password123!",
        googlePhoto: GOOGLE_PHOTO_URL,
        profilePic: [{ secure_url: PREDEFINED_AVATAR, public_id: "" }],
        selectedAvatar: PREDEFINED_AVATAR,
      });

      const res = await request(app)
        .post("/api/auth/login")
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          email: user.email,
          password: plainPassword,
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.googlePhoto).toBe(GOOGLE_PHOTO_URL);
      expect(res.body.user.selectedAvatar).toBe(PREDEFINED_AVATAR);
      expect(res.body.user.profilePic[0].secure_url).toBe(PREDEFINED_AVATAR);
    });

    it("GET /api/auth/check returns googlePhoto and selectedAvatar in authenticated user payload", async () => {
      const { user, token } = await createTestUser({
        email: "checkavatar@example.com",
        googlePhoto: GOOGLE_PHOTO_URL,
        profilePic: [{ secure_url: PREDEFINED_AVATAR, public_id: "" }],
        selectedAvatar: PREDEFINED_AVATAR,
      });

      const res = await request(app)
        .get("/api/auth/check")
        .set("Cookie", [`token=${token}`]);

      expect(res.statusCode).toBe(200);
      expect(res.body.authenticated).toBe(true);
      expect(res.body.user.googlePhoto).toBe(GOOGLE_PHOTO_URL);
      expect(res.body.user.selectedAvatar).toBe(PREDEFINED_AVATAR);
      expect(res.body.user.profilePic[0].secure_url).toBe(PREDEFINED_AVATAR);
    });

    it("GET /api/auth/user/:email returns full user document with avatar fields", async () => {
      const { user, token } = await createTestUser({
        email: "getuser@example.com",
        googlePhoto: GOOGLE_PHOTO_URL,
        profilePic: [{ secure_url: PREDEFINED_AVATAR, public_id: "" }],
        selectedAvatar: PREDEFINED_AVATAR,
      });

      const res = await request(app)
        .get(`/api/auth/user/${user.email}`)
        .set("Cookie", [`token=${token}`]);

      expect(res.statusCode).toBe(200);
      expect(res.body.googlePhoto).toBe(GOOGLE_PHOTO_URL);
      expect(res.body.selectedAvatar).toBe(PREDEFINED_AVATAR);
      expect(res.body.profilePic[0].secure_url).toBe(PREDEFINED_AVATAR);
    });

    it("PATCH /api/auth/verify-user returns googlePhoto and selectedAvatar in payload", async () => {
      const csrf = createCsrfCredentials();
      const { user } = await createTestUser({
        email: "verifieduser@example.com",
        googlePhoto: GOOGLE_PHOTO_URL,
        profilePic: [{ secure_url: PREDEFINED_AVATAR, public_id: "" }],
        selectedAvatar: PREDEFINED_AVATAR,
        isVerified: true,
      });

      const res = await request(app)
        .patch("/api/auth/verify-user")
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({ email: user.email });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.googlePhoto).toBe(GOOGLE_PHOTO_URL);
      expect(res.body.user.selectedAvatar).toBe(PREDEFINED_AVATAR);
      expect(res.body.user.profilePic[0].secure_url).toBe(PREDEFINED_AVATAR);
    });
  });

  describe("Google Photo Immutability and IDOR Protection", () => {
    it("should prevent unauthorized users from updating another user's avatar (IDOR)", async () => {
      const csrf = createCsrfCredentials();
      const victim = await createTestUser({
        email: "victim@example.com",
        profilePic: [{ secure_url: DEFAULT_AVATAR, public_id: "" }],
      });
      const attacker = await createTestUser({
        email: "attacker@example.com",
      });

      const res = await request(app)
        .patch(`/api/auth/updateUserProfileImage/${victim.user.email}`)
        .set("Cookie", [`token=${attacker.token}`, csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          profilePic: [{ secure_url: PREDEFINED_AVATAR, public_id: "" }],
          selectedAvatar: PREDEFINED_AVATAR,
        });

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);

      // Victim avatar unchanged
      const victimDb = await User.findOne({ email: victim.user.email });
      expect(victimDb.profilePic[0].secure_url).toBe(DEFAULT_AVATAR);
    });

    it("should preserve googlePhoto even if update payload does not include it", async () => {
      const csrf = createCsrfCredentials();
      const { user, token } = await createTestUser({
        email: "preservegoogle@example.com",
        googlePhoto: GOOGLE_PHOTO_URL,
        profilePic: [{ secure_url: GOOGLE_PHOTO_URL, public_id: "" }],
        selectedAvatar: "google",
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
      const updatedUser = await User.findOne({ email: user.email });
      expect(updatedUser.googlePhoto).toBe(GOOGLE_PHOTO_URL);
      expect(updatedUser.selectedAvatar).toBe(PREDEFINED_AVATAR);
      expect(updatedUser.profilePic[0].secure_url).toBe(PREDEFINED_AVATAR);
    });
  });
});
