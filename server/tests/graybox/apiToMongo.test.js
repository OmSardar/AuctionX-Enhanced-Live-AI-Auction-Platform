/**
 * Gray-Box Tests — API to MongoDB Architectural Verification
 *
 * Combines black-box HTTP/Socket calls with internal knowledge of MongoDB
 * schemas to verify data consistency, schema contracts, and persistence invariants.
 */
const request = require("supertest");
const jwt = require("jsonwebtoken");
const { app, server } = require("../../server");
const Product = require("../../src/modules/products/models/productSchema");
const Order = require("../../src/modules/orders/models/orderSchema");
const { clearDatabase } = require("../helpers/dbHelper");
const { createTestUser } = require("../helpers/authHelper");
const { createCsrfCredentials } = require("../helpers/csrfHelper");
const { createSocketClient } = require("../helpers/socketHelper");

describe("Gray-Box Tests — API to MongoDB Persistence", () => {
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

  it("should create order via API and confirm exact fields in MongoDB", async () => {
    const user = await createTestUser({ email: "buyer@graybox.com", name: "Gray Buyer" });
    const csrf = createCsrfCredentials();

    const orderData = {
      title: "Vintage Watch",
      sellerEmail: "seller@graybox.com",
      category: "Watches",
      images: [{ secure_url: "https://example.com/watch.jpg", public_id: "watch_1" }],
      biddingStartPrice: 10000,
      highestBid: 12000,
      phoneNo: "9876543210",
      address: "456 Graybox Blvd",
    };

    const res = await request(app)
      .post("/api/orders")
      .set("Cookie", [csrf.cookie, `token=${user.token}`])
      .set(csrf.headerName, csrf.headerValue)
      .send(orderData);

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty("_id");

    // Gray-box step: Query MongoDB directly to verify persistence invariants
    const dbOrder = await Order.findById(res.body._id);
    expect(dbOrder).not.toBeNull();
    expect(dbOrder.userEmail).toBe("buyer@graybox.com");
    expect(dbOrder.name).toBe("Gray Buyer");
    expect(dbOrder.sellerEmail).toBe("seller@graybox.com");
    expect(dbOrder.highestBid).toBe(12000);
  });

  it("should place bid via Socket.IO and verify MongoDB atomic updates", async () => {
    const bidder = await createTestUser({ email: "socketbidder@graybox.com", name: "Socket Bidder" });

    const product = await Product.create({
      name: "Auction Gold Coin",
      description: [{ name: "Metal", description: "Gold" }],
      email: "coinseller@graybox.com",
      category: "Collectibles",
      images: [{ secure_url: "https://example.com/coin.jpg", public_id: "coin1" }],
      mobileNumber: "9876543210",
      biddingStartDate: new Date(Date.now() - 3600000),
      biddingStartTime: "00:00",
      biddingStartPrice: 5000,
      biddingEndDate: new Date(Date.now() + 86400000),
      biddingEndTime: "23:59",
      startTime: new Date(Date.now() - 3600000),
      endTime: new Date(Date.now() + 86400000),
      startingPrice: 5000,
      currentPrice: 5000,
      status: "Active",
    });

    const client = createSocketClient(testServer, bidder.token);
    activeClients.push(client);

    await new Promise((resolve) => client.on("connect", resolve));

    client.emit("joinProductRoom", product._id.toString());
    await new Promise((r) => setTimeout(r, 100));

    const bidPlacedPromise = new Promise((resolve) => {
      client.on("productData", resolve);
    });

    client.emit("placeBid", {
      productId: product._id.toString(),
      currentBid: 5500,
      bidderName: "Socket Bidder",
    });

    await bidPlacedPromise;

    // Gray-box step: Verify directly in MongoDB that atomic fields are set
    const updated = await Product.findById(product._id);
    expect(updated.biddingStartPrice).toBe(5500);
    expect(updated.tempuseremail).toBe("socketbidder@graybox.com");
    expect(updated.tempamount).toBe(5500);
    expect(updated.tempname).toBe("Socket Bidder");
  });

  it("should authenticate and issue a JWT cookie with verifiable claims", async () => {
    const user = await createTestUser({ email: "jwtuser@graybox.com" });
    const csrf = createCsrfCredentials();

    const res = await request(app)
      .post("/api/auth/login")
      .set("Cookie", [csrf.cookie])
      .set(csrf.headerName, csrf.headerValue)
      .send({ email: "jwtuser@graybox.com", password: user.plainPassword });

    expect(res.statusCode).toBe(200);

    const cookies = res.headers["set-cookie"];
    const tokenCookie = cookies.find((c) => c.startsWith("token="));
    expect(tokenCookie).toBeDefined();

    // Gray-box step: Extract raw JWT from cookie and verify claims against secret
    const rawToken = tokenCookie.split(";")[0].replace("token=", "");
    const secret = process.env.JWT_SECRET;
    const decoded = jwt.verify(rawToken, secret);

    expect(decoded.email).toBe("jwtuser@graybox.com");
    expect(decoded).toHaveProperty("id");
    expect(decoded).toHaveProperty("exp");
  });
});
