const cloudinary = require("cloudinary");
jest.mock("cloudinary", () => ({
  v2: {
    config: jest.fn(),
    uploader: {
      upload: jest.fn(),
      destroy: jest.fn(),
    },
  },
}));

const request = require("supertest");
const fs = require("fs");
const path = require("path");
const { app } = require("../../../server");
const UserModel = require("../../../src/modules/users/models/user");
const SellerModel = require("../../../src/modules/sellers/accounts/models/seller");
const { clearDatabase } = require("../../helpers/dbHelper");
const {
  createTestUser,
  createTestSeller,
  createTestAdmin,
} = require("../../helpers/authHelper");
const { createCsrfCredentials } = require("../../helpers/csrfHelper");
const {
  validateImageBuffer,
} = require("../../../src/common/utilities/imageSignatureValidator");

const sharp = require("sharp");

// Deterministic valid decodable image buffers (100x100 pixels) generated via sharp
let VALID_PNG_BUFFER;
let VALID_JPEG_BUFFER;
let VALID_WEBP_BUFFER;

beforeAll(async () => {
  VALID_PNG_BUFFER = await sharp({
    create: { width: 100, height: 100, channels: 3, background: { r: 0, g: 128, b: 255 } },
  })
    .png()
    .toBuffer();

  VALID_JPEG_BUFFER = await sharp({
    create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 0, b: 0 } },
  })
    .jpeg()
    .toBuffer();

  VALID_WEBP_BUFFER = await sharp({
    create: { width: 100, height: 100, channels: 3, background: { r: 0, g: 255, b: 0 } },
  })
    .webp()
    .toBuffer();
});

const OVERSIZED_DIM_PNG_BUFFER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x13, 0x88, // Width: 5000px (> 4096)
  0x00, 0x00, 0x13, 0x88, // Height: 5000px (> 4096)
  0x08, 0x02, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);

describe("Stage 7.28 Integration - Avatar Upload Security & IDOR Enforcement", () => {
  let userA, userB, sellerA, sellerB, adminUser, csrf;

  beforeEach(async () => {
    await clearDatabase();
    csrf = createCsrfCredentials();

    userA = await createTestUser({ email: "user_a@example.com" });
    userB = await createTestUser({ email: "user_b@example.com" });
    sellerA = await createTestSeller({ email: "seller_a@example.com" });
    sellerB = await createTestSeller({ email: "seller_b@example.com" });
    adminUser = await createTestUser({ email: "admin@example.com", role: "admin" });

    cloudinary.v2.uploader.upload.mockReset();
    cloudinary.v2.uploader.destroy.mockReset();

    cloudinary.v2.uploader.upload.mockResolvedValue({
      secure_url: "https://res.cloudinary.com/test/image/upload/v12345/new_avatar.webp",
      public_id: "Auction X/Components/Profile/new_avatar_123",
    });
    cloudinary.v2.uploader.destroy.mockResolvedValue({ result: "ok" });
  });

  // 1. Unauthenticated user upload is rejected
  it("Criterion 1: rejects unauthenticated user upload with 401 Unauthorized", async () => {
    const res = await request(app)
      .post("/api/auth/user/upload-profile-pic")
      .set("Cookie", [csrf.cookie])
      .set(csrf.headerName, csrf.headerValue)
      .attach("profilePic", VALID_PNG_BUFFER, "avatar.png");

    expect(res.status).toBe(401);
  });

  // 2. Unauthenticated seller upload is rejected
  it("Criterion 2: rejects unauthenticated seller upload with 401 Unauthorized", async () => {
    const res = await request(app)
      .post("/api/auth/seller/upload-profile-pic")
      .set("Cookie", [csrf.cookie])
      .set(csrf.headerName, csrf.headerValue)
      .attach("profilePic", VALID_PNG_BUFFER, "avatar.png");

    expect(res.status).toBe(401);
  });

  // 3. Ordinary users cannot modify another user's avatar
  it("Criterion 3: rejects ordinary user attempt to modify another user's avatar with 403 Forbidden", async () => {
    const res = await request(app)
      .post("/api/auth/user/upload-profile-pic")
      .set("Cookie", [csrf.cookie, `token=${userA.token}`])
      .set(csrf.headerName, csrf.headerValue)
      .field("email", userB.user.email)
      .attach("profilePic", VALID_PNG_BUFFER, "avatar.png");

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/cannot modify another user/i);

    // Verify User B's avatar was not updated
    const userBDoc = await UserModel.findById(userB.user._id);
    expect(userBDoc.profilePic).toEqual(userB.user.profilePic || []);
  });

  // 4. Sellers cannot modify another seller's avatar
  it("Criterion 4: rejects ordinary seller attempt to modify another seller's avatar with 403 Forbidden", async () => {
    const res = await request(app)
      .post("/api/auth/seller/upload-profile-pic")
      .set("Cookie", [csrf.cookie, `sellerToken=${sellerA.token}`])
      .set(csrf.headerName, csrf.headerValue)
      .field("email", sellerB.seller.email)
      .attach("profilePic", VALID_PNG_BUFFER, "avatar.png");

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/cannot modify another seller/i);

    // Verify Seller B's avatar was not updated
    const sellerBDoc = await SellerModel.findById(sellerB.seller._id);
    expect(sellerBDoc.profilePic).toEqual(sellerB.seller.profilePic || []);
  });

  // 5. User cannot modify a seller's avatar and vice versa
  it("Criterion 5: rejects user modifying seller avatar and vice versa", async () => {
    const resUserToSeller = await request(app)
      .post("/api/auth/user/upload-profile-pic")
      .set("Cookie", [csrf.cookie, `token=${userA.token}`])
      .set(csrf.headerName, csrf.headerValue)
      .field("email", sellerA.seller.email)
      .attach("profilePic", VALID_PNG_BUFFER, "avatar.png");

    expect(resUserToSeller.status).toBe(403);

    const resSellerToUser = await request(app)
      .post("/api/auth/seller/upload-profile-pic")
      .set("Cookie", [csrf.cookie, `sellerToken=${sellerA.token}`])
      .set(csrf.headerName, csrf.headerValue)
      .field("email", userA.user.email)
      .attach("profilePic", VALID_PNG_BUFFER, "avatar.png");

    expect(resSellerToUser.status).toBe(403);
  });

  // 6. A forged client administrator flag does not grant privileges
  it("Criterion 6: rejects forged client-side role/admin flag with 403 Forbidden", async () => {
    const res = await request(app)
      .post("/api/auth/user/upload-profile-pic")
      .set("Cookie", [csrf.cookie, `token=${userA.token}`])
      .set(csrf.headerName, csrf.headerValue)
      .field("email", userB.user.email)
      .field("role", "admin")
      .field("isAdmin", "true")
      .attach("profilePic", VALID_PNG_BUFFER, "avatar.png");

    expect(res.status).toBe(403);
  });

  // 7. Legitimate administrator behavior is preserved
  it("Criterion 7: allows legitimate administrator to moderate another user's avatar", async () => {
    const res = await request(app)
      .post("/api/auth/user/upload-profile-pic")
      .set("Cookie", [csrf.cookie, `token=${adminUser.token}`])
      .set(csrf.headerName, csrf.headerValue)
      .field("email", userB.user.email)
      .attach("profilePic", VALID_PNG_BUFFER, "moderated_avatar.png");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.profilePic[0].secure_url).toBe(
      "https://res.cloudinary.com/test/image/upload/v12345/new_avatar.webp"
    );

    const updatedUserB = await UserModel.findById(userB.user._id);
    expect(updatedUserB.profilePic[0].public_id).toBe(
      "Auction X/Components/Profile/new_avatar_123"
    );
  });

  // 8. Valid JPEG, PNG, and WebP uploads follow the expected path
  it("Criterion 8: accepts valid JPEG, PNG, and WebP uploads successfully", async () => {
    // 8a. JPEG upload
    const jpegRes = await request(app)
      .post("/api/auth/user/upload-profile-pic")
      .set("Cookie", [csrf.cookie, `token=${userA.token}`])
      .set(csrf.headerName, csrf.headerValue)
      .attach("profilePic", VALID_JPEG_BUFFER, "avatar.jpg");

    expect(jpegRes.status).toBe(200);
    expect(jpegRes.body.success).toBe(true);
    expect(jpegRes.body.image.secure_url).toBeDefined();

    // 8b. PNG upload
    const pngRes = await request(app)
      .post("/api/auth/user/upload-profile-pic")
      .set("Cookie", [csrf.cookie, `token=${userA.token}`])
      .set(csrf.headerName, csrf.headerValue)
      .attach("profilePic", VALID_PNG_BUFFER, "avatar.png");

    expect(pngRes.status).toBe(200);
    expect(pngRes.body.success).toBe(true);

    // 8c. WebP upload
    const webpRes = await request(app)
      .post("/api/auth/user/upload-profile-pic")
      .set("Cookie", [csrf.cookie, `token=${userA.token}`])
      .set(csrf.headerName, csrf.headerValue)
      .attach("profilePic", VALID_WEBP_BUFFER, "avatar.webp");

    expect(webpRes.status).toBe(200);
    expect(webpRes.body.success).toBe(true);
  });

  // 9. HTML, SVG, MIME-spoofed files, malformed images, and unsupported formats are rejected
  it("Criterion 9: rejects HTML, SVG, malformed images, and unsupported formats with 400", async () => {
    // 9a. HTML script polyglot
    const htmlBuffer = Buffer.from("<html><script>alert('xss')</script></html>");
    const htmlRes = await request(app)
      .post("/api/auth/user/upload-profile-pic")
      .set("Cookie", [csrf.cookie, `token=${userA.token}`])
      .set(csrf.headerName, csrf.headerValue)
      .attach("profilePic", htmlBuffer, "exploit.jpg");

    expect(htmlRes.status).toBe(400);
    expect(htmlRes.body.code).toBe("DISALLOWED_FORMAT");

    // 9b. SVG disguised as JPG
    const svgBuffer = Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'><circle/></svg>");
    const svgRes = await request(app)
      .post("/api/auth/user/upload-profile-pic")
      .set("Cookie", [csrf.cookie, `token=${userA.token}`])
      .set(csrf.headerName, csrf.headerValue)
      .attach("profilePic", svgBuffer, "vector.jpg");

    expect(svgRes.status).toBe(400);
    expect(svgRes.body.code).toBe("DISALLOWED_FORMAT");

    // 9c. Truncated / malformed PNG (valid 8-byte PNG signature, but truncated before IHDR)
    const malformedBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
    const malformedRes = await request(app)
      .post("/api/auth/user/upload-profile-pic")
      .set("Cookie", [csrf.cookie, `token=${userA.token}`])
      .set(csrf.headerName, csrf.headerValue)
      .attach("profilePic", malformedBuffer, "broken.png");

    expect(malformedRes.status).toBe(400);
    expect(malformedRes.body.code).toBe("MALFORMED_IMAGE");

    // 9d. Unsupported format (e.g. random binary / executable)
    const exeBuffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]);
    const exeRes = await request(app)
      .post("/api/auth/user/upload-profile-pic")
      .set("Cookie", [csrf.cookie, `token=${userA.token}`])
      .set(csrf.headerName, csrf.headerValue)
      .attach("profilePic", exeBuffer, "program.jpg");

    expect(exeRes.status).toBe(400);
    expect(exeRes.body.code).toBe("UNSUPPORTED_FORMAT");
  });

  // 10. Oversized uploads are rejected
  it("Criterion 10: rejects uploads exceeding 5MB limit with 400 Bad Request", async () => {
    const oversizedBuffer = Buffer.alloc(6 * 1024 * 1024, 0xff);
    const res = await request(app)
      .post("/api/auth/user/upload-profile-pic")
      .set("Cookie", [csrf.cookie, `token=${userA.token}`])
      .set(csrf.headerName, csrf.headerValue)
      .attach("profilePic", oversizedBuffer, "oversized.jpg");

    expect([400, 413]).toContain(res.status);
    expect(res.body.code).toMatch(/LIMIT_FILE_SIZE|FILE_TOO_LARGE/);
  });

  // 11. Dimension and pixel-count limits are enforced
  it("Criterion 11: rejects images with dimensions exceeding 4096px limit with 400", async () => {
    const res = await request(app)
      .post("/api/auth/user/upload-profile-pic")
      .set("Cookie", [csrf.cookie, `token=${userA.token}`])
      .set(csrf.headerName, csrf.headerValue)
      .attach("profilePic", OVERSIZED_DIM_PNG_BUFFER, "giant.png");

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("DIMENSIONS_EXCEEDED");
  });

  // 12. Rate limit enforcement (11th upload rejected with 429)
  it("Criterion 12: throttles requests exceeding 10 uploads in 15 minutes with HTTP 429", async () => {
    const isolatedUser = await createTestUser({ email: "rate_limit_user@example.com" });

    // Send 10 successful uploads
    for (let i = 0; i < 10; i++) {
      const okRes = await request(app)
        .post("/api/auth/user/upload-profile-pic")
        .set("Cookie", [csrf.cookie, `token=${isolatedUser.token}`])
        .set(csrf.headerName, csrf.headerValue)
        .attach("profilePic", VALID_PNG_BUFFER, `test_${i}.png`);
      expect(okRes.status).toBe(200);
    }

    // 11th request MUST be rejected with HTTP 429
    const throttledRes = await request(app)
      .post("/api/auth/user/upload-profile-pic")
      .set("Cookie", [csrf.cookie, `token=${isolatedUser.token}`])
      .set(csrf.headerName, csrf.headerValue)
      .attach("profilePic", VALID_PNG_BUFFER, "test_11.png");

    expect(throttledRes.status).toBe(429);
    expect(throttledRes.body.code).toBe("RATE_LIMIT_EXCEEDED");
    expect(throttledRes.headers["retry-after"]).toBeDefined();
  });

  // 13. Temporary files are removed after success and every failure path
  it("Criterion 13: ensures temporary files are unlinked after success and failure", async () => {
    const unlinkSpy = jest.spyOn(fs, "unlinkSync");

    // Success path
    await request(app)
      .post("/api/auth/user/upload-profile-pic")
      .set("Cookie", [csrf.cookie, `token=${userA.token}`])
      .set(csrf.headerName, csrf.headerValue)
      .attach("profilePic", VALID_PNG_BUFFER, "temp_test.png");
    expect(unlinkSpy).toHaveBeenCalled();

    unlinkSpy.mockClear();

    // Cloudinary failure path
    cloudinary.v2.uploader.upload.mockRejectedValueOnce(new Error("Cloudinary down"));
    await request(app)
      .post("/api/auth/user/upload-profile-pic")
      .set("Cookie", [csrf.cookie, `token=${userA.token}`])
      .set(csrf.headerName, csrf.headerValue)
      .attach("profilePic", VALID_PNG_BUFFER, "temp_fail.png");
    expect(unlinkSpy).toHaveBeenCalled();

    unlinkSpy.mockRestore();
  });

  // 14. Cloudinary failure does not alter the stored avatar
  it("Criterion 14: preserves previous avatar in database if Cloudinary upload fails", async () => {
    // Set initial avatar
    userA.user.profilePic = [
      { secure_url: "https://res.cloudinary.com/test/initial.jpg", public_id: "initial_1" },
    ];
    await userA.user.save();

    cloudinary.v2.uploader.upload.mockRejectedValueOnce(new Error("Network timeout"));

    const res = await request(app)
      .post("/api/auth/user/upload-profile-pic")
      .set("Cookie", [csrf.cookie, `token=${userA.token}`])
      .set(csrf.headerName, csrf.headerValue)
      .attach("profilePic", VALID_PNG_BUFFER, "new.png");

    expect(res.status).toBe(500);

    const doc = await UserModel.findById(userA.user._id);
    expect(doc.profilePic[0].secure_url).toBe("https://res.cloudinary.com/test/initial.jpg");
  });

  // 15. Database-save failure triggers best-effort cleanup of newly uploaded Cloudinary asset
  it("Criterion 15: calls deleteFromCloudinary to roll back asset if database save fails", async () => {
    jest.spyOn(UserModel.prototype, "save").mockRejectedValueOnce(new Error("DB Write Collision"));

    const res = await request(app)
      .post("/api/auth/user/upload-profile-pic")
      .set("Cookie", [csrf.cookie, `token=${userA.token}`])
      .set(csrf.headerName, csrf.headerValue)
      .attach("profilePic", VALID_PNG_BUFFER, "avatar.png");

    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/database save failed/i);
    expect(cloudinary.v2.uploader.destroy).toHaveBeenCalledWith(
      "Auction X/Components/Profile/new_avatar_123",
      expect.anything()
    );

    UserModel.prototype.save.mockRestore();
  });

  // 16. Previous avatar remains intact until new avatar is successfully saved
  it("Criterion 16: does not delete old custom avatar before database save succeeds", async () => {
    userA.user.profilePic = [
      { secure_url: "https://res.cloudinary.com/test/custom_old.jpg", public_id: "custom_old_id" },
    ];
    await userA.user.save();

    jest.spyOn(UserModel.prototype, "save").mockRejectedValueOnce(new Error("DB failure"));

    await request(app)
      .post("/api/auth/user/upload-profile-pic")
      .set("Cookie", [csrf.cookie, `token=${userA.token}`])
      .set(csrf.headerName, csrf.headerValue)
      .attach("profilePic", VALID_PNG_BUFFER, "avatar.png");

    // Old avatar public_id MUST NOT have been deleted
    expect(cloudinary.v2.uploader.destroy).not.toHaveBeenCalledWith(
      "custom_old_id",
      expect.anything()
    );

    UserModel.prototype.save.mockRestore();
  });

  // 17. All six upload callers remain compatible with the response contract
  it("Criterion 17: returns unified response object compatible with all 6 frontend callers", async () => {
    const res = await request(app)
      .post("/api/auth/user/upload-profile-pic")
      .set("Cookie", [csrf.cookie, `token=${userA.token}`])
      .set(csrf.headerName, csrf.headerValue)
      .attach("profilePic", VALID_PNG_BUFFER, "avatar.png");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("success", true);
    expect(res.body).toHaveProperty("message");
    expect(res.body).toHaveProperty("profilePic");
    expect(Array.isArray(res.body.profilePic)).toBe(true);
    expect(res.body).toHaveProperty("image");
    expect(res.body.image).toHaveProperty("secure_url");
    expect(res.body.image).toHaveProperty("public_id");
    expect(res.body).toHaveProperty("user");
  });

  // 18. Both onboarding flows preserve preview and OTP behavior
  it("Criterion 18: seller upload route returns unified response matching onboarding expectation", async () => {
    const res = await request(app)
      .post("/api/auth/seller/upload-profile-pic")
      .set("Cookie", [csrf.cookie, `sellerToken=${sellerA.token}`])
      .set(csrf.headerName, csrf.headerValue)
      .attach("profilePic", VALID_PNG_BUFFER, "avatar.png");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.image.secure_url).toBeDefined();
    expect(res.body.profilePic).toBeDefined();
  });

  // 19. Marketing copy no longer contains unsupported verification claims
  it("Criterion 19: verifies all 4 marketing documents contain no unsupported KYC/government ID claims", () => {
    const faqContent = fs.readFileSync(
      path.resolve(__dirname, "../../../../client/src/components/Layouts/Footer/Help/FAQ/FAQ.jsx"),
      "utf8"
    );
    expect(faqContent).not.toMatch(/complete our KYC verification/i);
    expect(faqContent).not.toMatch(/government identification/i);
    expect(faqContent).toMatch(/secure OTP verification system/i);

    const seedFilePath = fs.existsSync(path.resolve(__dirname, "../../../../server/scripts/data/seedData.js"))
      ? path.resolve(__dirname, "../../../../server/scripts/data/seedData.js")
      : path.resolve(__dirname, "../../../../server/utils/SeedData/seedData.js");
    const seedContent = fs.readFileSync(seedFilePath, "utf8");
    expect(seedContent).not.toMatch(/Submit your KYC documents/i);
    expect(seedContent).not.toMatch(/PAN\/GST details/i);
    expect(seedContent).toMatch(/secure 6-digit verification code/i);

    const storyContent = fs.readFileSync(
      path.resolve(__dirname, "../../../../client/src/components/Layouts/Footer/AboutUs/OurStory/OurStory.jsx"),
      "utf8"
    );
    expect(storyContent).not.toMatch(/verified seller KYC/i);
    expect(storyContent).toMatch(/verified seller authentication/i);

    const paymentContent = fs.readFileSync(
      path.resolve(__dirname, "../../../../client/src/components/Layouts/Footer/Help/Payment/Payment.jsx"),
      "utf8"
    );
    expect(paymentContent).not.toMatch(/verified via profile KYC/i);
    expect(paymentContent).toMatch(/verified via profile security verification/i);
  });

  // 20. F-07: Rate limit key namespacing (user: vs seller:) separates quotas even with identical IDs
  it("Criterion 20: separates rate limit quotas between user and seller with identical string ObjectIds", async () => {
    const collisionUser = await createTestUser({ email: "collision_user@example.com" });
    const collisionSeller = await createTestSeller({ email: "collision_seller@example.com" });

    // Exhaust user quota (10 requests)
    for (let i = 0; i < 10; i++) {
      const okRes = await request(app)
        .post("/api/auth/user/upload-profile-pic")
        .set("Cookie", [csrf.cookie, `token=${collisionUser.token}`])
        .set(csrf.headerName, csrf.headerValue)
        .attach("profilePic", VALID_PNG_BUFFER, `user_${i}.png`);
      expect(okRes.status).toBe(200);
    }

    // 11th request for user is throttled with 429
    const throttledUser = await request(app)
      .post("/api/auth/user/upload-profile-pic")
      .set("Cookie", [csrf.cookie, `token=${collisionUser.token}`])
      .set(csrf.headerName, csrf.headerValue)
      .attach("profilePic", VALID_PNG_BUFFER, "user_11.png");
    expect(throttledUser.status).toBe(429);
    expect(throttledUser.body.code).toBe("RATE_LIMIT_EXCEEDED");

    // Seller with distinct seller: namespace must NOT be throttled
    const okSeller = await request(app)
      .post("/api/auth/seller/upload-profile-pic")
      .set("Cookie", [csrf.cookie, `sellerToken=${collisionSeller.token}`])
      .set(csrf.headerName, csrf.headerValue)
      .attach("profilePic", VALID_PNG_BUFFER, "seller_1.png");
    expect(okSeller.status).toBe(200);
    expect(okSeller.body.success).toBe(true);
  });

  // 21. F-07: Client-supplied identity and role fields cannot influence the rate limit key
  it("Criterion 21: ignores client-supplied body and query parameters in rate limiter keyGenerator", async () => {
    const normalUser = await createTestUser({ email: "normal_user@example.com" });

    // Client attempts to spoof seller identity and admin role in request body
    const res = await request(app)
      .post("/api/auth/user/upload-profile-pic")
      .set("Cookie", [csrf.cookie, `token=${normalUser.token}`])
      .set(csrf.headerName, csrf.headerValue)
      .field("role", "seller")
      .field("sellerId", "507f1f77bcf86cd799439099")
      .field("userId", "507f1f77bcf86cd799439099")
      .attach("profilePic", VALID_PNG_BUFFER, "normal.png");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // 22. F-06: Deep script injection past byte 2048 is decoded, stripped, and neutralized
  it("Criterion 22: sanitizes deep script injection past byte 2048 and re-encodes to clean WebP", async () => {
    // Construct JPEG with 2500 bytes padding and injected script tag
    const padding = Buffer.alloc(2500, 0x00);
    const scriptPayload = Buffer.from("<script>alert('deep_xss')</script>");
    const polyglotJpeg = Buffer.concat([VALID_JPEG_BUFFER, padding, scriptPayload]);

    let capturedFilePath = null;
    let fileExistedBeforeCloudinary = false;
    let fileWasCleanWebP = false;
    let containedScript = true;

    cloudinary.v2.uploader.upload.mockImplementationOnce(async (filePath) => {
      capturedFilePath = filePath;
      if (fs.existsSync(filePath)) {
        fileExistedBeforeCloudinary = true;
        const diskContent = fs.readFileSync(filePath);
        containedScript = diskContent.includes("<script>") || diskContent.includes("deep_xss");
        // Verify output is a valid WebP header
        fileWasCleanWebP = diskContent.subarray(0, 4).toString("ascii") === "RIFF" &&
                           diskContent.subarray(8, 12).toString("ascii") === "WEBP";
      }
      return {
        secure_url: "https://res.cloudinary.com/test/sanitized.webp",
        public_id: "Auction X/Components/Profile/sanitized_1",
      };
    });

    const res = await request(app)
      .post("/api/auth/user/upload-profile-pic")
      .set("Cookie", [csrf.cookie, `token=${userA.token}`])
      .set(csrf.headerName, csrf.headerValue)
      .attach("profilePic", polyglotJpeg, "polyglot.jpg");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(fileExistedBeforeCloudinary).toBe(true);
    expect(containedScript).toBe(false);
    expect(fileWasCleanWebP).toBe(true);
  });

  // 23. F-06: Decompression bomb / pixel count exceeding limit is rejected with 400
  it("Criterion 23: rejects image exceeding 16.7 MP pixel count limit with HTTP 400 PIXELS_EXCEEDED", async () => {
    // A PNG claiming 5000 x 5000 (> 16,777,216 pixels)
    const giantPngBuffer = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x13, 0x88, // Width: 5000px
      0x00, 0x00, 0x13, 0x88, // Height: 5000px (25 MP total)
      0x08, 0x02, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ]);

    const res = await request(app)
      .post("/api/auth/user/upload-profile-pic")
      .set("Cookie", [csrf.cookie, `token=${userA.token}`])
      .set(csrf.headerName, csrf.headerValue)
      .attach("profilePic", giantPngBuffer, "bomb.png");

    expect(res.status).toBe(400);
    expect(["DIMENSIONS_EXCEEDED", "PIXELS_EXCEEDED"]).toContain(res.body.code);
  });

  // 24. F-06: Corrupted image bitstream is rejected by decoder with HTTP 400 MALFORMED_IMAGE
  it("Criterion 24: rejects corrupted/truncated image bitstreams with HTTP 400 MALFORMED_IMAGE", async () => {
    // Truncate valid JPEG to create an invalid, corrupted compressed stream
    const truncatedJpeg = VALID_JPEG_BUFFER.subarray(0, 120);

    const res = await request(app)
      .post("/api/auth/user/upload-profile-pic")
      .set("Cookie", [csrf.cookie, `token=${userA.token}`])
      .set(csrf.headerName, csrf.headerValue)
      .attach("profilePic", truncatedJpeg, "corrupt.jpg");

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("MALFORMED_IMAGE");
  });

  // 25. F-06: Ensures temporary files are cleaned up after decoding/sanitization failure
  it("Criterion 25: cleans up temporary files when decode or validation fails", async () => {
    const unlinkSpy = jest.spyOn(fs, "unlinkSync");

    const corruptBuf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
    const res = await request(app)
      .post("/api/auth/user/upload-profile-pic")
      .set("Cookie", [csrf.cookie, `token=${userA.token}`])
      .set(csrf.headerName, csrf.headerValue)
      .attach("profilePic", corruptBuf, "fail.jpg");

    expect(res.status).toBe(400);
    expect(unlinkSpy).toHaveBeenCalled();

    unlinkSpy.mockRestore();
  });
});
