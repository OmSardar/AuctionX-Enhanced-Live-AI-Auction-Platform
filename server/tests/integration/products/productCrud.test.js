const request = require("supertest");
const { app } = require("../../../server");
const Product = require("../../../src/modules/products/models/productSchema");
const { clearDatabase } = require("../../helpers/dbHelper");
const { createTestUser } = require("../../helpers/authHelper");
const { createCsrfCredentials } = require("../../helpers/csrfHelper");

describe("Product CRUD Integration Tests", () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  async function createFixtureProduct(ownerEmail, overrides = {}) {
    return await Product.create({
      name: "Vintage Camera",
      description: [{ name: "Condition", description: "Mint" }],
      email: ownerEmail,
      category: "Electronics",
      images: [
        {
          secure_url: "https://example.com/cam.jpg",
          public_id: "cam_123",
        },
      ],
      mobileNumber: "9876543210",
      biddingStartDate: new Date(),
      biddingStartTime: "10:00",
      biddingStartPrice: 1500,
      biddingEndTime: new Date(Date.now() + 86400000).toISOString(),
      status: "Active",
      ...overrides,
    });
  }

  describe("GET /api/products", () => {
    it("should fetch all products", async () => {
      await createFixtureProduct("seller1@example.com", { name: "Item A" });
      await createFixtureProduct("seller2@example.com", { name: "Item B" });

      const res = await request(app).get("/api/products");

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(2);
      expect(res.body.products).toHaveLength(2);
    });
  });

  describe("GET /api/products/:id", () => {
    it("should return product by id", async () => {
      const product = await createFixtureProduct("seller1@example.com");

      const res = await request(app).get(`/api/products/${product._id}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.product._id.toString()).toBe(product._id.toString());
      expect(res.body.product.name).toBe("Vintage Camera");
    });

    it("should return 404 for non-existent product", async () => {
      const fakeId = "507f1f77bcf86cd799439011";
      const res = await request(app).get(`/api/products/${fakeId}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe("GET /api/products/category/:category", () => {
    it("should return products matching category", async () => {
      await createFixtureProduct("seller1@example.com", { category: "Art", status: "Active" });
      await createFixtureProduct("seller2@example.com", { category: "Watches", status: "Active" });

      const res = await request(app).get("/api/products/category/Art");

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].category).toBe("Art");
    });

    it("should return 404 when no products found in category", async () => {
      const res = await request(app).get("/api/products/category/NonExistentCategory");

      expect(res.statusCode).toBe(404);
    });
  });

  describe("PATCH /api/products/statuspatch/:id", () => {
    it("should update product status when caller is owner", async () => {
      const csrf = createCsrfCredentials();
      const { user, token } = await createTestUser({ email: "owner@example.com" });
      const product = await createFixtureProduct(user.email, { status: "Active" });

      const res = await request(app)
        .patch(`/api/products/statuspatch/${product._id}`)
        .set("Cookie", [csrf.cookie, `token=${token}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ status: "Closed" });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.product.status).toBe("Closed");
    });

    it("should reject status update with 403 when caller is not the owner", async () => {
      const csrf = createCsrfCredentials();
      const owner = await createTestUser({ email: "realowner@example.com" });
      const nonOwner = await createTestUser({ email: "intruder@example.com" });
      const product = await createFixtureProduct(owner.user.email, { status: "Active" });

      const res = await request(app)
        .patch(`/api/products/statuspatch/${product._id}`)
        .set("Cookie", [csrf.cookie, `token=${nonOwner.token}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ status: "Closed" });

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Forbidden/i);
    });

    it("should return 400 when status is invalid", async () => {
      const csrf = createCsrfCredentials();
      const { user, token } = await createTestUser({ email: "owner@example.com" });
      const product = await createFixtureProduct(user.email);

      const res = await request(app)
        .patch(`/api/products/statuspatch/${product._id}`)
        .set("Cookie", [csrf.cookie, `token=${token}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ status: "Archived" });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe("DELETE /api/products/:id", () => {
    it("should forbid deletion if caller is not the owner or admin", async () => {
      const csrf = createCsrfCredentials();
      const owner = await createTestUser({ email: "productowner@example.com" });
      const attacker = await createTestUser({ email: "attacker@example.com" });
      const product = await createFixtureProduct(owner.user.email);

      const res = await request(app)
        .delete(`/api/products/${product._id}`)
        .set("Cookie", [csrf.cookie, `token=${attacker.token}`])
        .set(csrf.headerName, csrf.headerValue);

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });
});
