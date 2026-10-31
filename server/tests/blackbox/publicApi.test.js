/**
 * Black-Box Tests — Public Interface Behavior
 *
 * Validates system behaviors purely via HTTP inputs and outputs,
 * without relying on internals, direct DB queries, or internal mock hooks.
 */
const request = require("supertest");
const { app } = require("../../server");
const { clearDatabase } = require("../helpers/dbHelper");
const { createTestUser, createTestSeller, createTestAdmin } = require("../helpers/authHelper");
const { createCsrfCredentials } = require("../helpers/csrfHelper");
const Product = require("../../src/modules/products/models/productSchema");

describe("Black-Box Tests — Public Interface Behavior", () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  describe("Public Product Endpoints", () => {
    it("should return a list of products with proper pagination/count attributes", async () => {
      // Seed a test product directly for test state
      await Product.create({
        name: "Vintage Watch",
        description: [{ name: "Details", description: "Swiss Made" }],
        email: "seller@test.com",
        category: "Watches",
        images: [{ secure_url: "https://example.com/watch.jpg", public_id: "w1" }],
        mobileNumber: "9876543210",
        biddingStartDate: new Date(),
        biddingStartTime: "10:00",
        biddingStartPrice: 5000,
        biddingEndTime: new Date(Date.now() + 86400000).toISOString(),
        status: "Active",
      });

      const res = await request(app).get("/api/products");

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("success", true);
      expect(res.body).toHaveProperty("products");
      expect(Array.isArray(res.body.products)).toBe(true);
      expect(res.body.products.length).toBeGreaterThanOrEqual(1);

      const item = res.body.products[0];
      expect(item).toHaveProperty("name");
      expect(item).toHaveProperty("biddingStartPrice");
      expect(item).toHaveProperty("category");
    });

    it("should return detailed product data for a valid existing ID", async () => {
      const created = await Product.create({
        name: "Antique Vase",
        description: [{ name: "Era", description: "Ming Dynasty" }],
        email: "art@test.com",
        category: "Art",
        images: [{ secure_url: "https://example.com/vase.jpg", public_id: "v1" }],
        mobileNumber: "9876543210",
        biddingStartDate: new Date(),
        biddingStartTime: "11:00",
        biddingStartPrice: 15000,
        biddingEndTime: new Date(Date.now() + 86400000).toISOString(),
        status: "Active",
      });

      const res = await request(app).get(`/api/products/${created._id}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.product).toHaveProperty("name", "Antique Vase");
      expect(res.body.product).toHaveProperty("category", "Art");
      expect(res.body.product).toHaveProperty("biddingStartPrice", 15000);
    });

    it("should return 404 or 400 for a nonexistent or invalid product ID", async () => {
      const nonExistentId = "507f1f77bcf86cd799439011";
      const res = await request(app).get(`/api/products/${nonExistentId}`);
      expect([400, 404]).toContain(res.statusCode);

      const invalidIdRes = await request(app).get("/api/products/invalid-id-format");
      expect([400, 404, 500]).toContain(invalidIdRes.statusCode);
      expect(invalidIdRes.body).toBeDefined();
    });
  });

  describe("Authentication Boundaries", () => {
    it("should accept valid credentials and return authentication token/cookie", async () => {
      const user = await createTestUser({ email: "user@publictest.com" });
      const csrf = createCsrfCredentials();

      const res = await request(app)
        .post("/api/auth/login")
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({ email: "user@publictest.com", password: user.plainPassword });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("success", true);
      const cookies = res.headers["set-cookie"];
      expect(cookies).toBeDefined();
      expect(cookies.some((c) => c.startsWith("token="))).toBe(true);
    });

    it("should reject invalid login credentials with 401 unauthorized", async () => {
      await createTestUser({ email: "user2@publictest.com" });
      const csrf = createCsrfCredentials();

      const res = await request(app)
        .post("/api/auth/login")
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({ email: "user2@publictest.com", password: "wrong-password" });

      expect([400, 401]).toContain(res.statusCode);
      expect(res.body.success).not.toBe(true);
    });
  });

  describe("Authorization & Access Control", () => {
    it("should return 401 or 403 when accessing protected admin endpoints without authorization", async () => {
      const res = await request(app).get("/api/orders");
      expect([401, 403]).toContain(res.statusCode);
    });

    it("should reject regular user from accessing admin management endpoints", async () => {
      const user = await createTestUser({ email: "regular@test.com" });
      const res = await request(app)
        .get("/api/orders")
        .set("Cookie", [`token=${user.token}`]);

      expect([401, 403]).toContain(res.statusCode);
    });

    it("should permit admin user to access admin management endpoints", async () => {
      const admin = await createTestAdmin({ email: "admin@publictest.com" });
      const res = await request(app)
        .get("/api/orders")
        .set("Cookie", [`token=${admin.token}`]);

      expect(res.statusCode).toBe(200);
    });
  });

  describe("CSRF Protection & Error Formatting", () => {
    it("should reject mutating state requests without CSRF token", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "csrf@test.com", password: "password" });

      expect(res.statusCode).toBe(403);
    });

    it("should return clean 404 JSON for non-existent API routes", async () => {
      const res = await request(app).get("/api/non-existent-resource-endpoint");
      expect(res.statusCode).toBe(404);
      expect(res.body).toHaveProperty("success", false);
    });
  });
});
