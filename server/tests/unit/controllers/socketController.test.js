/**
 * White-Box Tests — Socket Controller Unit Tests
 *
 * Tests the socket controller's internal validation branches:
 * - Authentication gating
 * - Parameter validation (NaN, <=0, missing)
 * - Status check (Closed/Active)
 * - Minimum increment logic (currentPrice + 200)
 * - Auction expiry checks
 */
const { server, io } = require("../../../server");
const Product = require("../../../src/modules/products/models/productSchema");
const { clearDatabase } = require("../../helpers/dbHelper");
const { createTestUser } = require("../../helpers/authHelper");
const { createSocketClient } = require("../../helpers/socketHelper");

describe("White-Box Tests — Socket Controller", () => {
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

  it("should reject bid from unauthenticated socket connection", async () => {
    const client = await getConnectedClient(null);

    const errorPromise = new Promise((resolve) => {
      client.on("error", resolve);
    });

    client.emit("placeBid", {
      productId: "507f1f77bcf86cd799439011",
      currentBid: 1000,
    });

    const error = await errorPromise;
    expect(error.message).toBe("Authentication required to place a bid");
  });

  it("should reject bid with missing productId", async () => {
    const user = await createTestUser({ email: "bidder1@test.com" });
    const client = await getConnectedClient(user.token);

    const errorPromise = new Promise((resolve) => {
      client.on("error", resolve);
    });

    client.emit("placeBid", { currentBid: 1000 });

    const error = await errorPromise;
    expect(error.message).toMatch(/Invalid bid data/i);
  });

  it("should reject bid with negative or non-numeric amount", async () => {
    const user = await createTestUser({ email: "bidder2@test.com" });
    const client = await getConnectedClient(user.token);

    const errorPromise = new Promise((resolve) => {
      client.on("error", resolve);
    });

    client.emit("placeBid", {
      productId: "507f1f77bcf86cd799439011",
      currentBid: -50,
    });

    const error = await errorPromise;
    expect(error.message).toMatch(/positive/i);
  });

  it("should reject bid on non-existent product", async () => {
    const user = await createTestUser({ email: "bidder3@test.com" });
    const client = await getConnectedClient(user.token);

    const errorPromise = new Promise((resolve) => {
      client.on("error", resolve);
    });

    client.emit("placeBid", {
      productId: "507f1f77bcf86cd799439011",
      currentBid: 5000,
    });

    const error = await errorPromise;
    expect(error.message).toBe("Product not found");
  });

  it("should reject bid when product status is not Active", async () => {
    const user = await createTestUser({ email: "bidder4@test.com" });
    const product = await Product.create({
      name: "Closed Item",
      description: [{ name: "d", description: "desc" }],
      email: "seller@test.com",
      category: "Art",
      images: [{ secure_url: "img.jpg", public_id: "p1" }],
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
      status: "Closed",
    });

    const client = await getConnectedClient(user.token);

    const errorPromise = new Promise((resolve) => {
      client.on("error", resolve);
    });

    client.emit("placeBid", {
      productId: product._id.toString(),
      currentBid: 2000,
    });

    const error = await errorPromise;
    expect(error.message).toMatch(/Bidding has ended|not active/i);
  });

  it("should reject bid below minimum increment (currentPrice + 200)", async () => {
    const user = await createTestUser({ email: "bidder5@test.com" });
    const product = await Product.create({
      name: "Increment Test Item",
      description: [{ name: "d", description: "desc" }],
      email: "seller@test.com",
      category: "Art",
      images: [{ secure_url: "img.jpg", public_id: "p1" }],
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
      bidCount: 1,
      minIncrement: 200,
      status: "Active",
    });

    const client = await getConnectedClient(user.token);

    const errorPromise = new Promise((resolve) => {
      client.on("error", resolve);
    });

    // Valid must be >= 1200, so 1100 should fail
    client.emit("placeBid", {
      productId: product._id.toString(),
      currentBid: 1100,
    });

    const error = await errorPromise;
    expect(error.message).toContain("Bid must be at least ₹1200");
  });

  it("should reject bid when auction time has expired", async () => {
    const user = await createTestUser({ email: "bidder6@test.com" });
    const product = await Product.create({
      name: "Expired Time Item",
      description: [{ name: "d", description: "desc" }],
      email: "seller@test.com",
      category: "Art",
      images: [{ secure_url: "img.jpg", public_id: "p1" }],
      mobileNumber: "9876543210",
      biddingStartDate: new Date(Date.now() - 86400000),
      biddingStartTime: "00:00",
      biddingStartPrice: 1000,
      biddingEndDate: new Date(Date.now() - 10000),
      biddingEndTime: "00:00",
      startTime: new Date(Date.now() - 86400000),
      endTime: new Date(Date.now() - 10000),
      startingPrice: 1000,
      currentPrice: 1000,
      status: "Active",
    });

    const client = await getConnectedClient(user.token);

    const errorPromise = new Promise((resolve) => {
      client.on("error", resolve);
    });

    client.emit("placeBid", {
      productId: product._id.toString(),
      currentBid: 1500,
    });

    const error = await errorPromise;
    expect(error.message).toMatch(/bidding time has passed|auction ended|Bidding period has ended/i);
  });
});
