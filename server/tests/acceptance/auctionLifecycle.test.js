/**
 * Acceptance Tests — Business Requirement Scenarios
 *
 * End-to-end acceptance scenarios validating major business requirements
 * via Supertest HTTP + Socket.IO client.
 */
const request = require("supertest");
const { app, server, io } = require("../../server");
const Product = require("../../src/modules/products/models/productSchema");
const Order = require("../../src/modules/orders/models/orderSchema");
const { clearDatabase } = require("../helpers/dbHelper");
const {
  createTestUser,
  createTestSeller,
  createTestAdmin,
} = require("../helpers/authHelper");
const { createCsrfCredentials } = require("../helpers/csrfHelper");
const { createSocketClient } = require("../helpers/socketHelper");

describe("Acceptance Tests — Auction Lifecycle", () => {
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
  });

  function getConnectedClient(token = null) {
    const client = createSocketClient(testServer, token);
    activeClients.push(client);
    return new Promise((resolve, reject) => {
      client.on("connect", () => resolve(client));
      client.on("connect_error", reject);
    });
  }

  async function createActiveProduct(email, overrides = {}) {
    const startTime = overrides.startTime || (overrides.biddingStartDate ? new Date(overrides.biddingStartDate) : new Date(Date.now() - 3600000));
    const endTime = overrides.endTime || (overrides.biddingEndTime ? new Date(overrides.biddingEndTime) : new Date(Date.now() + 3600000));
    return Product.create({
      name: "Acceptance Test Item",
      description: [{ name: "Condition", description: "New" }],
      email,
      category: "Electronics",
      images: [{ secure_url: "https://example.com/img.jpg", public_id: "img_1" }],
      mobileNumber: "9876543210",
      biddingStartDate: startTime,
      biddingStartTime: "00:00",
      biddingStartPrice: 1000,
      biddingEndTime: endTime.toISOString(),
      startTime,
      endTime,
      minIncrement: overrides.minIncrement !== undefined ? overrides.minIncrement : 200,
      status: "Active",
      ...overrides,
    });
  }

  // AC-1: User can register, login, and browse products
  it("AC-1: user can register, login, and browse products", async () => {
    const csrf = createCsrfCredentials();

    // Register
    const regRes = await request(app)
      .post("/api/auth/register")
      .set("Cookie", [csrf.cookie])
      .set(csrf.headerName, csrf.headerValue)
      .send({
        name: "Acceptance User",
        email: "ac1@example.com",
        password: "Password123!",
      });
    expect(regRes.statusCode).toBe(201);

    // Login
    const loginRes = await request(app)
      .post("/api/auth/login")
      .set("Cookie", [csrf.cookie])
      .set(csrf.headerName, csrf.headerValue)
      .send({ email: "ac1@example.com", password: "Password123!" });
    expect(loginRes.statusCode).toBe(200);

    // Browse products
    await createActiveProduct("seller@example.com", { name: "Widget" });
    const productsRes = await request(app).get("/api/products");
    expect(productsRes.statusCode).toBe(200);
    expect(productsRes.body.count).toBeGreaterThanOrEqual(1);
  });

  // AC-2: Seller can create a product listing (DB-seeded since upload is external)
  it("AC-2: seller creates a product listing visible in marketplace", async () => {
    const { seller } = await createTestSeller({ email: "acseller@example.com" });
    const product = await createActiveProduct(seller.email, {
      name: "Seller's Vintage Lamp",
    });

    const res = await request(app).get(`/api/products/${product._id}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.product.name).toBe("Seller's Vintage Lamp");
    expect(res.body.product.email).toBe(seller.email);
  });

  // AC-3: Valid bids are accepted and update price
  it("AC-3: valid bid is accepted and updates the product price", async () => {
    const { user, token } = await createTestUser({ email: "bidder@example.com" });
    const product = await createActiveProduct("seller@example.com", {
      biddingStartPrice: 1000,
    });

    const client = await getConnectedClient(token);

    const bidPromise = new Promise((resolve) => {
      client.on("productData", (data) => {
        if (data.currentBid === 1500) resolve(data);
      });
    });

    client.emit("joinProductRoom", product._id.toString());
    // Wait for initial productData before bidding
    await new Promise((r) => setTimeout(r, 200));

    client.emit("placeBid", {
      productId: product._id.toString(),
      currentBid: 1500,
      bidderName: user.name,
    });

    const data = await bidPromise;
    expect(data.currentBid).toBe(1500);

    const updated = await Product.findById(product._id);
    expect(updated.biddingStartPrice).toBe(1500);
  });

  // AC-4: Expired auctions reject bids
  it("AC-4: expired auction rejects bids with clear error", async () => {
    const { token } = await createTestUser();
    const expired = await createActiveProduct("seller@example.com", {
      biddingStartPrice: 1000,
      biddingEndTime: new Date(Date.now() - 60000).toISOString(),
    });

    const client = await getConnectedClient(token);

    const errorPromise = new Promise((resolve) => {
      client.on("error", resolve);
    });

    client.emit("placeBid", {
      productId: expired._id.toString(),
      currentBid: 2000,
      bidderName: "Late Bidder",
    });

    const error = await errorPromise;
    expect(error.message).toMatch(/ended/i);
  });

  // AC-5: Bid below minimum increment is rejected
  it("AC-5: bid below minimum increment is rejected", async () => {
    const { token } = await createTestUser();
    const product = await createActiveProduct("seller@example.com", {
      biddingStartPrice: 1000,
      currentPrice: 1000,
      bidCount: 1,
      minIncrement: 200,
    });

    const client = await getConnectedClient(token);

    const errorPromise = new Promise((resolve) => {
      client.on("error", resolve);
    });

    client.emit("placeBid", {
      productId: product._id.toString(),
      currentBid: 1100, // min is 1200 (1000 + 200)
      bidderName: "Low Bidder",
    });

    const error = await errorPromise;
    expect(error.message).toMatch(/at least/i);
  });

  // AC-6: Unauthenticated users cannot bid
  it("AC-6: unauthenticated user cannot place a bid", async () => {
    const product = await createActiveProduct("seller@example.com");
    const client = await getConnectedClient(null);

    const errorPromise = new Promise((resolve) => {
      client.on("error", resolve);
    });

    client.emit("placeBid", {
      productId: product._id.toString(),
      currentBid: 1500,
      bidderName: "Anonymous",
    });

    const error = await errorPromise;
    expect(error.message).toMatch(/authentication required/i);
  });

  // AC-7: Order can be created after auction
  it("AC-7: order can be created for a product", async () => {
    const csrf = createCsrfCredentials();
    const { user, token } = await createTestUser({ email: "orderer@example.com" });

    const res = await request(app)
      .post("/api/orders")
      .set("Cookie", [csrf.cookie, `token=${token}`])
      .set(csrf.headerName, csrf.headerValue)
      .send({
        title: "Won Auction Item",
        sellerEmail: "seller@example.com",
        category: "Art",
        images: [{ secure_url: "https://example.com/art.jpg", public_id: "art_1" }],
        biddingStartPrice: 1000,
        highestBid: 2500,
        phoneNo: "9876543210",
        address: "123 Winner St",
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.userEmail).toBe(user.email);
  });

  // AC-8: Only order owner can view their order
  it("AC-8: only order owner can view their order", async () => {
    const owner = await createTestUser({ email: "owner@example.com" });
    const stranger = await createTestUser({ email: "stranger2@example.com" });

    const order = await Order.create({
      title: "Private Order",
      name: owner.user.name,
      userEmail: owner.user.email,
      sellerEmail: "seller@example.com",
      category: "Jewelry",
      images: [{ secure_url: "https://example.com/j.jpg", public_id: "j_1" }],
      biddingStartPrice: 500,
      phoneNo: "9876543210",
      address: "456 Secure Ln",
    });

    // Owner can view
    const ownerRes = await request(app)
      .get(`/api/orders/${order._id}`)
      .set("Cookie", [`token=${owner.token}`]);
    expect(ownerRes.statusCode).toBe(200);

    // Stranger cannot
    const strangerRes = await request(app)
      .get(`/api/orders/${order._id}`)
      .set("Cookie", [`token=${stranger.token}`]);
    expect(strangerRes.statusCode).toBe(403);
  });

  // AC-9: Admin can view all orders
  it("AC-9: admin can view all orders", async () => {
    const { token } = await createTestAdmin();

    const res = await request(app)
      .get("/api/orders")
      .set("Cookie", [`adminToken=${token}`]);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  // AC-10: Admin routes reject non-admin users
  it("AC-10: admin routes reject non-admin users with 403", async () => {
    const { token } = await createTestUser();

    const res = await request(app)
      .get("/api/admin/sellers")
      .set("Cookie", [`token=${token}`]);

    expect([401, 403]).toContain(res.statusCode);
  });
});
