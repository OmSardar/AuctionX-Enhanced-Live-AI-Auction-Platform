const request = require("supertest");
const { app } = require("../../../server");
const Order = require("../../../src/modules/orders/models/orderSchema");
const { clearDatabase } = require("../../helpers/dbHelper");
const { createTestUser, createTestAdmin } = require("../../helpers/authHelper");
const { createCsrfCredentials } = require("../../helpers/csrfHelper");

describe("Order Flow Integration Tests", () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  describe("POST /api/orders", () => {
    it("should create an order for authenticated buyer", async () => {
      const csrf = createCsrfCredentials();
      const { user, token } = await createTestUser({ email: "buyer@example.com" });

      const orderData = {
        title: "Rare Coin",
        sellerEmail: "coinseller@example.com",
        category: "Collectibles",
        images: [{ secure_url: "https://example.com/coin.jpg", public_id: "coin_1" }],
        biddingStartPrice: 500,
        highestBid: 800,
        phoneNo: "9876543210",
        address: "789 Collector Way",
      };

      const res = await request(app)
        .post("/api/orders")
        .set("Cookie", [csrf.cookie, `token=${token}`])
        .set(csrf.headerName, csrf.headerValue)
        .send(orderData);

      expect(res.statusCode).toBe(201);
      expect(res.body.title).toBe("Rare Coin");
      expect(res.body.userEmail).toBe(user.email);
    });

    it("should reject order creation if unauthenticated", async () => {
      const csrf = createCsrfCredentials();

      const res = await request(app)
        .post("/api/orders")
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({ title: "Unauthenticated Order" });

      expect(res.statusCode).toBe(401);
    });
  });

  describe("GET /api/orders/:id", () => {
    it("should allow buyer to view their own order", async () => {
      const buyer = await createTestUser({ email: "orderbuyer@example.com" });
      const order = await Order.create({
        title: "Antique Watch",
        name: buyer.user.name,
        userEmail: buyer.user.email,
        sellerEmail: "seller@example.com",
        category: "Watches",
        images: [{ secure_url: "https://example.com/watch.jpg", public_id: "w_1" }],
        biddingStartPrice: 1000,
        phoneNo: "9876543210",
        address: "Street 1",
      });

      const res = await request(app)
        .get(`/api/orders/${order._id}`)
        .set("Cookie", [`token=${buyer.token}`]);

      expect(res.statusCode).toBe(200);
      expect(res.body._id.toString()).toBe(order._id.toString());
    });

    it("should forbid unauthorized third-party user from viewing the order", async () => {
      const buyer = await createTestUser({ email: "buyer1@example.com" });
      const stranger = await createTestUser({ email: "stranger@example.com" });

      const order = await Order.create({
        title: "Antique Watch",
        name: buyer.user.name,
        userEmail: buyer.user.email,
        sellerEmail: "seller@example.com",
        category: "Watches",
        images: [{ secure_url: "https://example.com/watch.jpg", public_id: "w_1" }],
        biddingStartPrice: 1000,
        phoneNo: "9876543210",
        address: "Street 1",
      });

      const res = await request(app)
        .get(`/api/orders/${order._id}`)
        .set("Cookie", [`token=${stranger.token}`]);

      expect(res.statusCode).toBe(403);
      expect(res.body.error).toMatch(/Forbidden/i);
    });
  });

  describe("GET /api/orders (Admin only)", () => {
    it("should allow admin to view all orders", async () => {
      const { admin, token } = await createTestAdmin();

      const res = await request(app)
        .get("/api/orders")
        .set("Cookie", [`adminToken=${token}`]);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it("should reject non-admin users from viewing all orders", async () => {
      const { user, token } = await createTestUser();

      const res = await request(app)
        .get("/api/orders")
        .set("Cookie", [`token=${token}`]);

      expect(res.statusCode).toBe(403);
    });
  });
});
