const request = require("supertest");
const { app } = require("../../../server");
const Product = require("../../../src/modules/products/models/productSchema");
const { clearDatabase } = require("../../helpers/dbHelper");
const { createTestUser } = require("../../helpers/authHelper");
const { createCsrfCredentials } = require("../../helpers/csrfHelper");

describe("Product Time Restriction Integration Regression Tests", () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  async function createProductWithTiming(ownerEmail, biddingEndTime) {
    return await Product.create({
      name: "Vintage Pocket Watch",
      description: [{ name: "Condition", description: "Excellent" }],
      email: ownerEmail,
      category: "Antiques",
      images: [{ secure_url: "https://example.com/watch.jpg", public_id: "w_1" }],
      mobileNumber: "9876543210",
      biddingStartDate: new Date(Date.now() - 3600000),
      biddingStartTime: "10:00",
      biddingStartPrice: 2000,
      biddingEndTime: biddingEndTime.toISOString(),
      status: "Active",
    });
  }

  describe("PUT /api/products/:id with checkTimeRestriction", () => {
    it("should reject update when bidding time has passed", async () => {
      const csrf = createCsrfCredentials();
      const { user, token } = await createTestUser();
      const pastTime = new Date(Date.now() - 120000); // 2 minutes ago
      const product = await createProductWithTiming(user.email, pastTime);

      const res = await request(app)
        .put(`/api/products/${product._id}`)
        .set("Cookie", [csrf.cookie, `token=${token}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ name: "Updated Pocket Watch" });

      expect(res.statusCode).toBe(403);
      expect(res.body.error).toBe("Operation not allowed, bidding time has passed.");
    });
  });

  describe("DELETE /api/products/:id with checkTimeRestriction", () => {
    it("should reject deletion when bidding time has passed", async () => {
      const csrf = createCsrfCredentials();
      const { user, token } = await createTestUser();
      const pastTime = new Date(Date.now() - 120000); // 2 minutes ago
      const product = await createProductWithTiming(user.email, pastTime);

      const res = await request(app)
        .delete(`/api/products/${product._id}`)
        .set("Cookie", [csrf.cookie, `token=${token}`])
        .set(csrf.headerName, csrf.headerValue);

      expect(res.statusCode).toBe(403);
      expect(res.body.error).toBe("Operation not allowed, bidding time has passed.");
    });

    it("should allow deletion when auction is still active", async () => {
      const csrf = createCsrfCredentials();
      const { user, token } = await createTestUser();
      const futureTime = new Date(Date.now() + 3600000); // 1 hour in future
      const product = await createProductWithTiming(user.email, futureTime);

      const res = await request(app)
        .delete(`/api/products/${product._id}`)
        .set("Cookie", [csrf.cookie, `token=${token}`])
        .set(csrf.headerName, csrf.headerValue);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);

      const deleted = await Product.findById(product._id);
      expect(deleted).toBeNull();
    });
  });
});
