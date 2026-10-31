const request = require("supertest");
const { app } = require("../../../server");
const Product = require("../../../src/modules/products/models/productSchema");
const Order = require("../../../src/modules/orders/models/orderSchema");
const { clearDatabase } = require("../../helpers/dbHelper");
const { createTestUser, createTestSeller } = require("../../helpers/authHelper");
const { createCsrfCredentials } = require("../../helpers/csrfHelper");

describe("IDOR & Authorization Boundary Integration Tests", () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  describe("Profile IDOR Protection", () => {
    it("should prevent User A from updating User B's profile", async () => {
      const csrf = createCsrfCredentials();
      const userA = await createTestUser({ email: "usera@example.com" });
      const userB = await createTestUser({ email: "userb@example.com" });

      const res = await request(app)
        .patch(`/api/auth/updateUserProfile/${userB.user.email}`)
        .set("Cookie", [csrf.cookie, `token=${userA.token}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ name: "Hacked Name" });

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Forbidden: You can only modify your own profile/i);
    });

    it("should allow User A to update their own profile", async () => {
      const csrf = createCsrfCredentials();
      const userA = await createTestUser({ email: "usera@example.com" });

      const res = await request(app)
        .patch(`/api/auth/updateUserProfile/${userA.user.email}`)
        .set("Cookie", [csrf.cookie, `token=${userA.token}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ address: "New Address 101" });

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toMatch(/Profile updated successfully/i);
      expect(res.body.user.address).toBe("New Address 101");
    });

    it("should reject unauthenticated request to update seller profile with 401", async () => {
      const csrf = createCsrfCredentials();
      const seller = await createTestSeller({ email: "seller_test@example.com" });

      const res = await request(app)
        .patch(`/api/auth/seller/updateUserProfile/${seller.seller.email}`)
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({ address: "Unauthenticated Update" });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("should prevent Seller A from updating Seller B's profile via seller routes", async () => {
      const csrf = createCsrfCredentials();
      const sellerA = await createTestSeller({ email: "sellera@example.com" });
      const sellerB = await createTestSeller({ email: "sellerb@example.com" });

      const res = await request(app)
        .patch(`/api/auth/seller/updateUserProfile/${sellerB.seller.email}`)
        .set("Cookie", [csrf.cookie, `token=${sellerA.token}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ address: "Malicious Address" });

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Forbidden: You can only modify your own profile/i);
    });

    it("should allow Seller A to update their own profile via seller routes", async () => {
      const csrf = createCsrfCredentials();
      const sellerA = await createTestSeller({ email: "sellera@example.com" });

      const res = await request(app)
        .patch(`/api/auth/seller/updateUserProfile/${sellerA.seller.email}`)
        .set("Cookie", [csrf.cookie, `token=${sellerA.token}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ address: "Updated Seller Warehouse 404" });

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toMatch(/Profile updated successfully/i);
    });
  });

  describe("Order Access IDOR Protection", () => {
    it("should prevent User A from fetching User B's order list", async () => {
      const userA = await createTestUser({ email: "usera@example.com" });
      const userB = await createTestUser({ email: "userb@example.com" });

      const res = await request(app)
        .get(`/api/orders/user/${userB.user.email}`)
        .set("Cookie", [`token=${userA.token}`]);

      expect(res.statusCode).toBe(403);
      expect(res.body.message).toMatch(/Forbidden/i);
    });

    it("should prevent User A from viewing User B's single order by ID", async () => {
      const userA = await createTestUser({ email: "usera@example.com" });
      const userB = await createTestUser({ email: "userb@example.com" });

      const order = await Order.create({
        title: "Private Item",
        name: userB.user.name,
        userEmail: userB.user.email,
        sellerEmail: "seller@example.com",
        category: "Art",
        images: [{ secure_url: "https://example.com/art.jpg", public_id: "art_1" }],
        biddingStartPrice: 1000,
        phoneNo: "9876543210",
        address: "Secret St 1",
      });

      const res = await request(app)
        .get(`/api/orders/${order._id}`)
        .set("Cookie", [`token=${userA.token}`]);

      expect(res.statusCode).toBe(403);
      expect(res.body.error).toMatch(/Forbidden/i);
    });
  });

  describe("Product Modification IDOR Protection", () => {
    it("should prevent non-owner from modifying product status", async () => {
      const csrf = createCsrfCredentials();
      const owner = await createTestUser({ email: "owner@example.com" });
      const intruder = await createTestUser({ email: "intruder@example.com" });

      const product = await Product.create({
        name: "Valuable Painting",
        description: [{ name: "Details", description: "Original" }],
        email: owner.user.email,
        category: "Art",
        images: [{ secure_url: "https://example.com/art.jpg", public_id: "art_1" }],
        mobileNumber: "9876543210",
        biddingStartDate: new Date(),
        biddingStartTime: "10:00",
        biddingStartPrice: 10000,
        biddingEndTime: new Date(Date.now() + 3600000).toISOString(),
        status: "Active",
      });

      const res = await request(app)
        .patch(`/api/products/statuspatch/${product._id}`)
        .set("Cookie", [csrf.cookie, `token=${intruder.token}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ status: "Closed" });

      expect(res.statusCode).toBe(403);
      expect(res.body.message).toMatch(/Forbidden/i);
    });
  });

  describe("Privilege Escalation Protection", () => {
    it("should prevent regular user from accessing Admin seller routes", async () => {
      const user = await createTestUser({ role: "user" });

      const res = await request(app)
        .get("/api/sellers")
        .set("Cookie", [`token=${user.token}`]);

      expect(res.statusCode).toBe(403);
    });

    it("should prevent regular user from accessing Admin event routes", async () => {
      const user = await createTestUser({ role: "user" });

      const res = await request(app)
        .get("/api/events")
        .set("Cookie", [`token=${user.token}`]);

      expect(res.statusCode).toBe(403);
    });
  });
});
