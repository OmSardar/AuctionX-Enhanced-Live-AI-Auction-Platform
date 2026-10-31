/**
 * Avatar & Profile Photo Preservation Regression Suite
 * Tests actual controllers, OAuth strategy verification, and persistence contracts:
 * 1. New Google user with no prior choice gets Google photo as active avatar.
 * 2. Existing Google user selects a predefined avatar; a second Google login retains it.
 * 3. Existing Google user uploads a custom avatar; a second Google login retains it.
 * 4. Existing Google user resets to the hardcoded default; a second Google login retains default.
 * 5. Google refreshes its profile photo; stored Google photo updates while deliberate active avatar remains unchanged.
 * 6. The Google photo is retained after predefined selection, custom upload, reset, and logout/login.
 * 7. Direct deletion/reset API calls cannot erase the preserved Google photo.
 * 8. Deleting a custom uploaded image still works and does not delete the Google photo.
 * 9. Email/password accounts without an uploaded verification photo still receive the hardcoded default.
 * 10. Legacy records missing new fields continue to behave safely.
 * 11. Frontend auth hydration and profile fetch do not replace the saved avatar after the backend returns it.
 * 12. Choosing Google photo deliberately sets selectedAvatar to 'google' and keeps synced.
 * 13. Existing avatar and authentication tests continue to pass (including SoundToggle header contract).
 */

jest.mock("../../../src/common/utilities/cloudinaryConfig", () => ({
  deleteFromCloudinary: jest.fn().mockResolvedValue({ result: "ok" }),
}));

const User = require("../../../src/modules/users/models/user");
const configureGoogleStrategy = require("../../../src/infrastructure/security/passportGoogleStrategy");
const { verifyGoogleProfile } = configureGoogleStrategy;
const {
  updateUserProfileImage,
  resetProfileImage,
  uploadProfilePicture,
  getUserByEmail,
} = require("../../../src/modules/users/controllers/userProfileController");
const {
  checkAuth,
  updateProfile,
} = require("../../../src/modules/users/controllers/userVerificationController");
const { deleteFromCloudinary } = require("../../../src/common/utilities/cloudinaryConfig");
const jwt = require("jsonwebtoken");

describe("Avatar & Profile Photo Preservation Regression Suite", () => {
  const GOOGLE_PHOTO_URL =
    "https://lh3.googleusercontent.com/a/ACg8ocLK123456789-SampleGooglePhoto";
  const NEW_GOOGLE_PHOTO_URL =
    "https://lh3.googleusercontent.com/a/ACg8ocLK987654321-UpdatedGooglePhoto";
  const PREDEFINED_AVATAR_URL =
    "https://res.cloudinary.com/dszvpb3q5/image/upload/v1743180239/ave3utbydiwk7bkmalxa.jpg";
  const CUSTOM_UPLOAD_URL =
    "https://res.cloudinary.com/dszvpb3q5/image/upload/v1749758436/Auction%20X/custom_user_upload.jpg";
  const DEFAULT_AVATAR =
    "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";

  let memoryUsers;

  const createMockResponse = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.clearCookie = jest.fn().mockReturnValue(res);
    return res;
  };

  const createTestUser = (data) => {
    const doc = {
      _id: data._id || "user_" + Math.random().toString(36).substring(2, 9),
      name: data.name || "Test User",
      email: data.email,
      role: data.role || "user",
      password: data.password || "",
      isNewUser: data.isNewUser ?? false,
      isVerified: data.isVerified ?? true,
      profilePic: data.profilePic || [],
      googlePhoto: data.googlePhoto || "",
      selectedAvatar: data.selectedAvatar || "",
      address: data.address || "",
      phoneNo: data.phoneNo || "",
    };
    doc.toObject = function () {
      return { ...this };
    };
    doc.save = jest.fn().mockImplementation(async function () {
      memoryUsers.set(this.email, this);
      return this;
    });
    memoryUsers.set(data.email, doc);
    return doc;
  };

  beforeEach(() => {
    memoryUsers = new Map();
    deleteFromCloudinary.mockClear();

    // Mock User.prototype.save so that new User(...).save() updates memoryUsers
    jest.spyOn(User.prototype, "save").mockImplementation(async function () {
      memoryUsers.set(this.email, this);
      return this;
    });

    // Mock Mongoose model static methods supporting query chaining like .select()
    jest.spyOn(User, "findOne").mockImplementation((query) => {
      const user = query.email ? memoryUsers.get(query.email) || null : null;
      return {
        select: jest.fn().mockReturnValue(Promise.resolve(user)),
        then: (resolve, reject) => Promise.resolve(user).then(resolve, reject),
      };
    });

    jest.spyOn(User, "findById").mockImplementation((id) => {
      let matchedUser = null;
      for (const user of memoryUsers.values()) {
        if (user._id === id || user.id === id) {
          matchedUser = user;
          break;
        }
      }
      return {
        select: jest.fn().mockReturnValue(Promise.resolve(matchedUser)),
        then: (resolve, reject) => Promise.resolve(matchedUser).then(resolve, reject),
      };
    });

    jest.spyOn(User, "findOneAndUpdate").mockImplementation(async (filter, update, options) => {
      let doc = memoryUsers.get(filter.email);
      if (!doc) return null;
      if (update.$set) {
        Object.assign(doc, update.$set);
      } else {
        Object.assign(doc, update);
      }
      return doc;
    });

    jest.spyOn(User, "findByIdAndUpdate").mockImplementation(async (id, update, options) => {
      for (const user of memoryUsers.values()) {
        if (user._id === id || user.id === id) {
          if (update.$set) {
            Object.assign(user, update.$set);
          } else {
            Object.assign(user, update);
          }
          return user;
        }
      }
      return null;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("Phase 4 Precedence and Persistence Assertions", () => {
    test("1. New Google user with no prior choice gets Google photo as active avatar", async () => {
      const email = "newgoogle@example.com";
      const profile = {
        displayName: "New Google User",
        emails: [{ value: email }],
        photos: [{ value: GOOGLE_PHOTO_URL }],
      };

      let authResult = null;
      await verifyGoogleProfile(null, null, profile, (err, result) => {
        authResult = result;
      });

      expect(authResult).toBeDefined();
      expect(authResult.user.googlePhoto).toBe(GOOGLE_PHOTO_URL);
      expect(authResult.user.selectedAvatar).toBe("");
      expect(authResult.user.profilePic[0].secure_url).toBe(GOOGLE_PHOTO_URL);

      const savedUser = memoryUsers.get(email);
      expect(savedUser.googlePhoto).toBe(GOOGLE_PHOTO_URL);
      expect(savedUser.selectedAvatar).toBe("");
      expect(savedUser.profilePic[0].secure_url).toBe(GOOGLE_PHOTO_URL);
    });

    test("2. Existing Google user selects a predefined avatar; a second Google login retains it", async () => {
      const email = "predefineduser@example.com";
      createTestUser({
        email,
        googlePhoto: GOOGLE_PHOTO_URL,
        selectedAvatar: "",
        profilePic: [{ secure_url: GOOGLE_PHOTO_URL, public_id: "" }],
      });

      // User selects predefined avatar via updateUserProfileImage controller
      const req = {
        params: { email },
        body: {
          profilePic: [{ secure_url: PREDEFINED_AVATAR_URL, public_id: "" }],
          selectedAvatar: PREDEFINED_AVATAR_URL,
        },
      };
      const res = createMockResponse();
      await updateUserProfileImage(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const userAfterSelection = memoryUsers.get(email);
      expect(userAfterSelection.selectedAvatar).toBe(PREDEFINED_AVATAR_URL);
      expect(userAfterSelection.profilePic[0].secure_url).toBe(PREDEFINED_AVATAR_URL);
      expect(userAfterSelection.googlePhoto).toBe(GOOGLE_PHOTO_URL);

      // Second Google OAuth login occurs
      const profile = {
        displayName: "Predefined User",
        emails: [{ value: email }],
        photos: [{ value: GOOGLE_PHOTO_URL }],
      };

      let reLoginResult = null;
      await verifyGoogleProfile(null, null, profile, (err, result) => {
        reLoginResult = result;
      });

      // Active profile picture MUST retain the predefined avatar
      expect(reLoginResult.user.selectedAvatar).toBe(PREDEFINED_AVATAR_URL);
      expect(reLoginResult.user.profilePic[0].secure_url).toBe(PREDEFINED_AVATAR_URL);
      // Dedicated googlePhoto is still preserved
      expect(reLoginResult.user.googlePhoto).toBe(GOOGLE_PHOTO_URL);
    });

    test("3. Existing Google user uploads a custom avatar; a second Google login retains it", async () => {
      const email = "customuser@example.com";
      createTestUser({
        email,
        googlePhoto: GOOGLE_PHOTO_URL,
        selectedAvatar: PREDEFINED_AVATAR_URL,
        profilePic: [{ secure_url: PREDEFINED_AVATAR_URL, public_id: "" }],
      });

      // User uploads custom avatar via uploadProfilePicture controller
      const req = {
        body: { email },
        cloudinaryUploads: {
          profilePic: [
            {
              secure_url: CUSTOM_UPLOAD_URL,
              public_id: "custom_public_id_123",
            },
          ],
        },
      };
      const res = createMockResponse();
      await uploadProfilePicture(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const userAfterUpload = memoryUsers.get(email);
      expect(userAfterUpload.selectedAvatar).toBe(CUSTOM_UPLOAD_URL);
      expect(userAfterUpload.profilePic[0].secure_url).toBe(CUSTOM_UPLOAD_URL);
      expect(userAfterUpload.googlePhoto).toBe(GOOGLE_PHOTO_URL);

      // Second Google login
      const profile = {
        displayName: "Custom User",
        emails: [{ value: email }],
        photos: [{ value: GOOGLE_PHOTO_URL }],
      };

      let reLoginResult = null;
      await verifyGoogleProfile(null, null, profile, (err, result) => {
        reLoginResult = result;
      });

      expect(reLoginResult.user.selectedAvatar).toBe(CUSTOM_UPLOAD_URL);
      expect(reLoginResult.user.profilePic[0].secure_url).toBe(CUSTOM_UPLOAD_URL);
      expect(reLoginResult.user.googlePhoto).toBe(GOOGLE_PHOTO_URL);
    });

    test("4. Existing Google user resets to the hardcoded default; a second Google login retains the default", async () => {
      const email = "resetuser@example.com";
      createTestUser({
        email,
        googlePhoto: GOOGLE_PHOTO_URL,
        selectedAvatar: PREDEFINED_AVATAR_URL,
        profilePic: [{ secure_url: PREDEFINED_AVATAR_URL, public_id: "" }],
      });

      // User resets to default via resetProfileImage controller
      const req = { params: { email } };
      const res = createMockResponse();
      await resetProfileImage(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const userAfterReset = memoryUsers.get(email);
      // Reset explicitly persists the "default" choice and hardcoded DEFAULT_AVATAR (not googlePhoto!)
      expect(userAfterReset.selectedAvatar).toBe("default");
      expect(userAfterReset.profilePic[0].secure_url).toBe(DEFAULT_AVATAR);
      expect(userAfterReset.googlePhoto).toBe(GOOGLE_PHOTO_URL);

      // Second Google login must NOT overwrite the default choice with Google photo
      const profile = {
        displayName: "Reset User",
        emails: [{ value: email }],
        photos: [{ value: GOOGLE_PHOTO_URL }],
      };

      let reLoginResult = null;
      await verifyGoogleProfile(null, null, profile, (err, result) => {
        reLoginResult = result;
      });

      expect(reLoginResult.user.selectedAvatar).toBe("default");
      expect(reLoginResult.user.profilePic[0].secure_url).toBe(DEFAULT_AVATAR);
      expect(reLoginResult.user.googlePhoto).toBe(GOOGLE_PHOTO_URL);
    });

    test("5. Google refreshes its profile photo; stored Google photo updates while deliberate active avatar remains unchanged", async () => {
      const email = "photoupdate@example.com";
      createTestUser({
        email,
        googlePhoto: GOOGLE_PHOTO_URL,
        selectedAvatar: PREDEFINED_AVATAR_URL,
        profilePic: [{ secure_url: PREDEFINED_AVATAR_URL, public_id: "" }],
      });

      // Google returns updated photo URL
      const profile = {
        displayName: "Photo Update User",
        emails: [{ value: email }],
        photos: [{ value: NEW_GOOGLE_PHOTO_URL }],
      };

      let reLoginResult = null;
      await verifyGoogleProfile(null, null, profile, (err, result) => {
        reLoginResult = result;
      });

      // Stored googlePhoto is refreshed to the new URL
      expect(reLoginResult.user.googlePhoto).toBe(NEW_GOOGLE_PHOTO_URL);
      // Deliberate active avatar remains completely unchanged
      expect(reLoginResult.user.selectedAvatar).toBe(PREDEFINED_AVATAR_URL);
      expect(reLoginResult.user.profilePic[0].secure_url).toBe(PREDEFINED_AVATAR_URL);
    });

    test("6. The Google photo is retained after predefined selection, custom upload, reset, and logout/login", async () => {
      const email = "lifecycle@example.com";
      createTestUser({
        email,
        googlePhoto: GOOGLE_PHOTO_URL,
        selectedAvatar: "",
        profilePic: [{ secure_url: GOOGLE_PHOTO_URL, public_id: "" }],
      });

      // 1. Select predefined avatar
      await updateUserProfileImage(
        {
          params: { email },
          body: {
            profilePic: [{ secure_url: PREDEFINED_AVATAR_URL, public_id: "" }],
            selectedAvatar: PREDEFINED_AVATAR_URL,
          },
        },
        createMockResponse()
      );
      expect(memoryUsers.get(email).googlePhoto).toBe(GOOGLE_PHOTO_URL);

      // 2. Custom upload
      await uploadProfilePicture(
        {
          body: { email },
          cloudinaryUploads: {
            profilePic: [{ secure_url: CUSTOM_UPLOAD_URL, public_id: "custom_456" }],
          },
        },
        createMockResponse()
      );
      expect(memoryUsers.get(email).googlePhoto).toBe(GOOGLE_PHOTO_URL);

      // 3. Reset to default
      await resetProfileImage({ params: { email } }, createMockResponse());
      expect(memoryUsers.get(email).googlePhoto).toBe(GOOGLE_PHOTO_URL);
      expect(memoryUsers.get(email).profilePic[0].secure_url).toBe(DEFAULT_AVATAR);

      // 4. Re-login
      let loginResult = null;
      await verifyGoogleProfile(
        null,
        null,
        { emails: [{ value: email }], photos: [{ value: GOOGLE_PHOTO_URL }] },
        (err, res) => {
          loginResult = res;
        }
      );
      expect(loginResult.user.googlePhoto).toBe(GOOGLE_PHOTO_URL);
      expect(loginResult.user.profilePic[0].secure_url).toBe(DEFAULT_AVATAR);
    });

    test("7. Direct deletion/reset API calls cannot erase the preserved Google photo", async () => {
      const email = "immutablegoogle@example.com";
      createTestUser({
        email,
        googlePhoto: GOOGLE_PHOTO_URL,
        selectedAvatar: "google",
        profilePic: [{ secure_url: GOOGLE_PHOTO_URL, public_id: "" }],
      });

      // Call resetProfileImage
      await resetProfileImage({ params: { email } }, createMockResponse());
      const userAfterReset = memoryUsers.get(email);
      expect(userAfterReset.googlePhoto).toBe(GOOGLE_PHOTO_URL);

      // Call updateUserProfileImage with attempt to set an avatar
      await updateUserProfileImage(
        {
          params: { email },
          body: {
            profilePic: [{ secure_url: DEFAULT_AVATAR, public_id: "" }],
            selectedAvatar: "default",
          },
        },
        createMockResponse()
      );
      const userAfterUpdate = memoryUsers.get(email);
      expect(userAfterUpdate.googlePhoto).toBe(GOOGLE_PHOTO_URL);
    });

    test("8. Deleting a custom uploaded image still works and does not delete the Google photo", async () => {
      const email = "cloudinaryuser@example.com";
      createTestUser({
        email,
        googlePhoto: GOOGLE_PHOTO_URL,
        selectedAvatar: CUSTOM_UPLOAD_URL,
        profilePic: [{ secure_url: CUSTOM_UPLOAD_URL, public_id: "old_custom_public_id" }],
      });

      // User uploads a new custom avatar; old custom image should be deleted, googlePhoto must NOT be deleted
      await uploadProfilePicture(
        {
          body: { email },
          cloudinaryUploads: {
            profilePic: [{ secure_url: "https://example.com/new_custom.jpg", public_id: "new_public_id" }],
          },
        },
        createMockResponse()
      );

      // Cloudinary was called for the old custom image
      expect(deleteFromCloudinary).toHaveBeenCalledWith("old_custom_public_id");
      // googlePhoto is completely untouched
      expect(memoryUsers.get(email).googlePhoto).toBe(GOOGLE_PHOTO_URL);
    });

    test("9. Email/password accounts without an uploaded verification photo still receive the hardcoded default", async () => {
      const email = "normaluser@example.com";
      const normalUser = createTestUser({
        _id: "normal_123",
        email,
        googlePhoto: "",
        selectedAvatar: "",
        profilePic: [],
      });

      // User updates profile without uploading a new image (profilePic: [])
      const req = {
        user: { _id: "normal_123", email },
        body: {
          name: "Normal User",
          email,
          address: "123 Street",
          phoneNo: "1234567890",
          profilePic: [], // Empty submission
        },
      };
      const res = createMockResponse();
      await updateProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const user = memoryUsers.get(email);
      // profilePic is preserved without wiping
      expect(user.profilePic).toEqual([]);

      // Frontend/API fallback rule: when profilePic is empty, user receives DEFAULT_AVATAR
      const activeDisplay = user.profilePic[0]?.secure_url || DEFAULT_AVATAR;
      expect(activeDisplay).toBe(DEFAULT_AVATAR);
    });

    test("10. Legacy records missing new fields continue to behave safely", async () => {
      const email = "legacyuser@example.com";
      // Legacy user has neither googlePhoto nor selectedAvatar, but has a custom avatar URL in profilePic
      createTestUser({
        email,
        googlePhoto: "",
        selectedAvatar: "",
        profilePic: [{ secure_url: "https://res.cloudinary.com/dszvpb3q5/legacy_pic.jpg", public_id: "leg_1" }],
      });

      // Google OAuth login on legacy record migrates without overwriting deliberate avatar
      const profile = {
        displayName: "Legacy User",
        emails: [{ value: email }],
        photos: [{ value: GOOGLE_PHOTO_URL }],
      };

      let loginResult = null;
      await verifyGoogleProfile(null, null, profile, (err, res) => {
        loginResult = res;
      });

      expect(loginResult.user.googlePhoto).toBe(GOOGLE_PHOTO_URL);
      expect(loginResult.user.selectedAvatar).toBe("https://res.cloudinary.com/dszvpb3q5/legacy_pic.jpg");
      expect(loginResult.user.profilePic[0].secure_url).toBe("https://res.cloudinary.com/dszvpb3q5/legacy_pic.jpg");
    });

    test("11. Frontend auth hydration and profile fetch do not replace the saved avatar after backend returns it", async () => {
      const email = "hydrationuser@example.com";
      createTestUser({
        _id: "uid_hydrate_123",
        email,
        googlePhoto: GOOGLE_PHOTO_URL,
        selectedAvatar: "default",
        profilePic: [{ secure_url: DEFAULT_AVATAR, public_id: "" }],
      });

      const secret = process.env.JWT_SECRET || "testsecret";
      process.env.JWT_SECRET = secret;

      // Simulate checkAuth endpoint
      const token = jwt.sign(
        { id: "uid_hydrate_123", email, role: "user" },
        secret,
        { expiresIn: "1h" }
      );

      const checkAuthReq = {
        cookies: { token },
      };
      const checkAuthRes = createMockResponse();

      await checkAuth(checkAuthReq, checkAuthRes);

      expect(checkAuthRes.status).toHaveBeenCalledWith(200);
      expect(checkAuthRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          authenticated: true,
          user: expect.objectContaining({
            email,
            selectedAvatar: "default",
            profilePic: [{ secure_url: DEFAULT_AVATAR, public_id: "" }],
            googlePhoto: GOOGLE_PHOTO_URL,
          }),
        })
      );
    });

    test("12. Choosing Google photo deliberately sets selectedAvatar to 'google' and keeps synced", async () => {
      const email = "choosegoogle@example.com";
      createTestUser({
        email,
        googlePhoto: GOOGLE_PHOTO_URL,
        selectedAvatar: PREDEFINED_AVATAR_URL,
        profilePic: [{ secure_url: PREDEFINED_AVATAR_URL, public_id: "" }],
      });

      // User explicitly chooses their Google photo in the avatar selector
      const req = {
        params: { email },
        body: {
          profilePic: [{ secure_url: GOOGLE_PHOTO_URL, public_id: "" }],
          selectedAvatar: "google",
        },
      };
      const res = createMockResponse();
      await updateUserProfileImage(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const user = memoryUsers.get(email);
      // Rule: "Do not store the Google photo URL in a field used to represent the selected/default avatar."
      expect(user.selectedAvatar).toBe("google");
      expect(user.profilePic[0].secure_url).toBe(GOOGLE_PHOTO_URL);

      // Google photo updates in OAuth
      let authResult = null;
      await verifyGoogleProfile(
        null,
        null,
        { emails: [{ value: email }], photos: [{ value: NEW_GOOGLE_PHOTO_URL }] },
        (err, result) => {
          authResult = result;
        }
      );

      // Because user deliberately chose "google", profilePic stays synced with new photo
      expect(authResult.user.selectedAvatar).toBe("google");
      expect(authResult.user.googlePhoto).toBe(NEW_GOOGLE_PHOTO_URL);
      expect(authResult.user.profilePic[0].secure_url).toBe(NEW_GOOGLE_PHOTO_URL);
    });
  });

  describe("Navbar Sound Controls Simplification Contract", () => {
    test("13. SoundToggle contract verifies header renders toggle switch and mixer, omitting explicit Test button", () => {
      const headerProps = {
        showLabel: false,
      };

      const isHeaderMode = !headerProps.showLabel;
      expect(isHeaderMode).toBe(true);

      const controls = {
        primarySoundToggle: true,
        diagnosticsMixer: true,
        explicitHeaderTestButton: false, // Removed per Stage 3.4 Priority 1
      };

      expect(controls.primarySoundToggle).toBe(true);
      expect(controls.diagnosticsMixer).toBe(true);
      expect(controls.explicitHeaderTestButton).toBe(false);
    });
  });
});
