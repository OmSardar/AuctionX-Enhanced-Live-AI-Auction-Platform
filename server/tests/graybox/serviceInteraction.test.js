/**
 * Gray-Box Tests — Cross-Service & Component Interactions
 *
 * Validates interactions across subsystems:
 * - Express proxy → FastAPI Recommendation Service integration
 * - JWT authentication → Role-based authorization chain across models
 * - Auction lifecycle states → Real-time socket event acceptance/rejection
 */
const request = require("supertest");
const axios = require("axios");
const { app, server } = require("../../server");
const Product = require("../../src/modules/products/models/productSchema");
const { clearDatabase } = require("../helpers/dbHelper");
const { createTestUser, createTestSeller, createTestAdmin } = require("../helpers/authHelper");
const { createCsrfCredentials } = require("../helpers/csrfHelper");
const { createSocketClient } = require("../helpers/socketHelper");

describe("Gray-Box Tests — Service & Subsystem Interactions", () => {
  let testServer;
  let activeClients = [];

  beforeAll((done) => {
    testServer = server.listen(0, done);
  });

  afterAll((done) => {
    activeClients.forEach((c) => c.connected && c.disconnect());
    testServer.close(done);
  });

  beforeEach(async () => {
    await clearDatabase();
    activeClients.forEach((c) => c.connected && c.disconnect());
    activeClients = [];
    jest.restoreAllMocks();
  });

  describe("API Proxy → Recommendation Service Integration", () => {
    it("should correctly forward query parameters to FastAPI and return recommendation payload", async () => {
      const mockResult = {
        recommendations: [
          { productId: "prod_gray_1", title: "Smart Watch", score: 0.92 },
          { productId: "prod_gray_2", title: "Camera Lens", score: 0.85 },
        ],
      };

      jest.spyOn(axios, "get").mockResolvedValue({
        status: 200,
        data: mockResult,
      });

      const jwt = require("jsonwebtoken");
      const token = jwt.sign({ email: "alice@example.com" }, process.env.JWT_SECRET || "test_jwt_secret");

      const res = await request(app)
        .get("/api/recommendations/alice%40example.com?count=2")
        .set("Authorization", `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(mockResult);
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining("/api/recommendations/alice%40example.com"),
        expect.objectContaining({ params: { count: "2" }, timeout: 5000 })
      );
    });

    it("should translate recommendation service 404 into well-structured client response", async () => {
      jest.spyOn(axios, "get").mockRejectedValue({
        response: {
          status: 404,
          data: { error: "User history not found" },
        },
      });

      const jwt = require("jsonwebtoken");
      const token = jwt.sign({ email: "nonexistent@example.com" }, process.env.JWT_SECRET || "test_jwt_secret");

      const res = await request(app)
        .get("/api/recommendations/nonexistent%40example.com")
        .set("Authorization", `Bearer ${token}`);

      expect(res.statusCode).toBe(404);
      expect(res.body).toHaveProperty("error", "User history not found");
    });
  });

  describe("Auth Token → Role Authorization Escalation Prevention", () => {
    it("should prevent regular user token from accessing admin orders endpoint", async () => {
      const user = await createTestUser({ email: "regular_user@test.com" });

      const res = await request(app)
        .get("/api/orders")
        .set("Cookie", [`token=${user.token}`]);

      expect([401, 403]).toContain(res.statusCode);
    });

    it("should allow admin token to access protected admin resources", async () => {
      const admin = await createTestAdmin({ email: "superadmin@test.com" });

      const res = await request(app)
        .get("/api/orders")
        .set("Cookie", [`token=${admin.token}`]);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe("Auction Lifecycle State → Real-time Socket Gating", () => {
    it("should allow bids on Active auction and immediately reject on Closed auction", async () => {
      const bidder = await createTestUser({ email: "graybidder@test.com" });

      const activeProduct = await Product.create({
        name: "Active Antique",
        description: [{ name: "Info", description: "Mint" }],
        email: "seller@test.com",
        category: "Art",
        images: [{ secure_url: "https://example.com/art.jpg", public_id: "a1" }],
        mobileNumber: "9876543210",
        biddingStartDate: new Date(Date.now() - 3600000),
        biddingStartTime: "00:00",
        biddingStartPrice: 1000,
        biddingEndDate: new Date(Date.now() + 86400000),
        biddingEndTime: "23:59",
        startTime: new Date(Date.now() - 3600000),
        endTime: new Date(Date.now() + 86400000),
        startingPrice: 1000,
        currentPrice: 1000,
        status: "Active",
      });

      const client = createSocketClient(testServer, bidder.token);
      activeClients.push(client);

      await new Promise((resolve) => client.on("connect", resolve));

      client.emit("joinProductRoom", activeProduct._id.toString());
      await new Promise((r) => setTimeout(r, 50));

      // 1. Bid on active product should succeed
      const acceptedPromise = new Promise((resolve) => {
        client.on("productData", resolve);
      });

      client.emit("placeBid", {
        productId: activeProduct._id.toString(),
        currentBid: 1500,
        bidderName: "Gray Bidder",
      });

      const accepted = await acceptedPromise;
      expect(accepted.currentBid).toBe(1500);

      // 2. Transition product status to Closed
      await Product.findByIdAndUpdate(activeProduct._id, { status: "Closed" });

      // 3. Subsequent bid should be rejected
      const rejectedPromise = new Promise((resolve) => {
        client.on("error", resolve);
      });

      client.emit("placeBid", {
        productId: activeProduct._id.toString(),
        currentBid: 2000,
        bidderName: "Gray Bidder",
      });

      const error = await rejectedPromise;
      expect(error.message).toMatch(/Bidding has ended/i);
    });
  });
});
