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
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");
const { app } = require("../../../server");
const { createTestAdmin } = require("../../helpers/authHelper");
const { createCsrfCredentials } = require("../../helpers/csrfHelper");
const Banner = require("../../../src/modules/admin/tasks/models/banner");
const Admin = require("../../../src/modules/admin/authentication/models/admin");

describe("Media / File Upload Integration & Cloudinary Boundary Tests", () => {
  let adminToken;
  let testAdmin;
  let csrf;
  let validJpgBuffer;
  let validPngBuffer;

  beforeAll(async () => {
    csrf = createCsrfCredentials();
    const adminObj = await createTestAdmin();
    testAdmin = adminObj.admin;
    adminToken = adminObj.token;

    validJpgBuffer = await sharp({
      create: { width: 50, height: 50, channels: 3, background: { r: 200, g: 100, b: 50 } },
    })
      .jpeg()
      .toBuffer();

    validPngBuffer = await sharp({
      create: { width: 50, height: 50, channels: 3, background: { r: 50, g: 150, b: 200 } },
    })
      .png()
      .toBuffer();
  });

  afterAll(async () => {
    await Banner.deleteMany({});
    if (testAdmin) {
      await Admin.findByIdAndDelete(testAdmin._id);
    }
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should successfully upload a valid image and create banner with Cloudinary metadata", async () => {
    cloudinary.v2.uploader.upload.mockResolvedValue({
      secure_url: "https://res.cloudinary.com/test/image/upload/v12345/test_banner.jpg",
      public_id: "banners/test_banner_123",
    });

    const res = await request(app)
      .post("/api/banners")
      .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
      .set("x-csrf-token", csrf.token)
      .field("title", "Promotional Summer Banner")
      .field("description", "Save up to 50%")
      .field("position", "top")
      .field("isActive", "true")
      .attach("image", validJpgBuffer, {
        filename: "test_banner.jpg",
        contentType: "image/jpeg",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.imageUrl).toContain("test_banner.jpg");
    expect(res.body.data.imagePublicId).toBe("banners/test_banner_123");
    expect(cloudinary.v2.uploader.upload).toHaveBeenCalled();
  });

  it("should reject disallowed file types (e.g. .txt or .exe)", async () => {
    const textBuffer = Buffer.from("this is a malicious script or text file");

    const res = await request(app)
      .post("/api/banners")
      .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
      .set("x-csrf-token", csrf.token)
      .field("title", "Invalid File Type Banner")
      .attach("image", textBuffer, {
        filename: "exploit.txt",
        contentType: "text/plain",
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain("Invalid file type");
  });

  it("should handle Cloudinary upload failure gracefully and return 500", async () => {
    cloudinary.v2.uploader.upload.mockRejectedValue(
      new Error("Cloudinary connection timeout")
    );

    const res = await request(app)
      .post("/api/banners")
      .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
      .set("x-csrf-token", csrf.token)
      .field("title", "Network Failure Banner")
      .attach("image", validPngBuffer, {
        filename: "fail.png",
        contentType: "image/png",
      });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Image upload to Cloudinary failed.");
  });

  it("should return 400 when required banner image is missing from request", async () => {
    const res = await request(app)
      .post("/api/banners")
      .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
      .set("x-csrf-token", csrf.token)
      .field("title", "Banner Without Image")
      .field("position", "bottom");

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Banner image is required");
  });

  it("should reject unauthenticated upload requests", async () => {
    const fakeJpgBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);

    const res = await request(app)
      .post("/api/banners")
      .set("Cookie", csrf.cookie)
      .set("x-csrf-token", csrf.token)
      .field("title", "Unauthorized Banner")
      .attach("image", fakeJpgBuffer, {
        filename: "test.jpg",
        contentType: "image/jpeg",
      });

    expect(res.status).toBe(401);
  });
});
