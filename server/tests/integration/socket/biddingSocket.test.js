const http = require("http");
const { app, server, io } = require("../../../server");
const Product = require("../../../src/modules/products/models/productSchema");
const { clearDatabase } = require("../../helpers/dbHelper");
const { createTestUser } = require("../../helpers/authHelper");
const { createSocketClient } = require("../../helpers/socketHelper");

describe("Socket.IO Bidding Integration Tests", () => {
  let testServer;
  let activeClients = [];

  beforeAll((done) => {
    // Start test server on random port
    testServer = server.listen(0, () => {
      done();
    });
  });

  afterAll((done) => {
    activeClients.forEach((client) => {
      if (client.connected) client.disconnect();
    });
    testServer.close(done);
  });

  beforeEach(async () => {
    await clearDatabase();
    activeClients.forEach((client) => {
      if (client.connected) client.disconnect();
    });
    activeClients = [];
  });

  function getConnectedClient(token = null) {
    const client = createSocketClient(testServer, token);
    activeClients.push(client);
    return new Promise((resolve, reject) => {
      client.on("connect", () => resolve(client));
      client.on("connect_error", (err) => reject(err));
    });
  }

  async function createActiveProduct(overrides = {}) {
    return await Product.create({
      name: "Auction Watch",
      description: [{ name: "Condition", description: "New" }],
      email: "seller@example.com",
      category: "Jewelry",
      images: [{ secure_url: "https://example.com/watch.jpg", public_id: "w_1" }],
      mobileNumber: "9876543210",
      biddingStartDate: new Date(Date.now() - 3600000),
      biddingStartTime: "00:00",
      biddingStartPrice: 1000,
      biddingEndDate: new Date(Date.now() + 3600000),
      biddingEndTime: "23:59",
      startTime: new Date(Date.now() - 3600000),
      endTime: new Date(Date.now() + 3600000),
      startingPrice: 1000,
      currentPrice: 1000,
      status: "Active",
      ...overrides,
    });
  }

  it("should allow client to join product room and receive productData", async () => {
    const product = await createActiveProduct();
    const client = await getConnectedClient();

    const productDataPromise = new Promise((resolve) => {
      client.on("productData", (data) => resolve(data));
    });

    client.emit("joinProductRoom", product._id.toString());

    const data = await productDataPromise;
    expect(data.productId).toBe(product._id.toString());
    expect(data.currentBid).toBe(1000);
  });

  it("should reject placeBid from unauthenticated socket", async () => {
    const product = await createActiveProduct();
    const unauthClient = await getConnectedClient(null);

    const errorPromise = new Promise((resolve) => {
      unauthClient.on("error", (err) => resolve(err));
    });

    unauthClient.emit("placeBid", {
      productId: product._id.toString(),
      currentBid: 1500,
      bidderName: "Anonymous",
    });

    const error = await errorPromise;
    expect(error.message).toMatch(/Authentication required/i);
  });

  it("should reject bid if amount is less than minimum increment (currentBid + 200)", async () => {
    const { token } = await createTestUser();
    const product = await createActiveProduct({
      biddingStartPrice: 1000,
      startingPrice: 1000,
      currentPrice: 1000,
      bidCount: 1,
      minIncrement: 200,
    });
    const authClient = await getConnectedClient(token);

    const errorPromise = new Promise((resolve) => {
      authClient.on("error", (err) => resolve(err));
    });

    authClient.emit("placeBid", {
      productId: product._id.toString(),
      currentBid: 1100, // Needs to be at least 1200
      bidderName: "Bidder 1",
    });

    const error = await errorPromise;
    expect(error.message).toMatch(/Bid must be at least ₹1200/i);
  });

  it("should reject bid if auction time has expired", async () => {
    const { token } = await createTestUser();
    const expiredProduct = await createActiveProduct({
      biddingStartPrice: 1000,
      startingPrice: 1000,
      currentPrice: 1000,
      biddingEndDate: new Date(Date.now() - 60000),
      biddingEndTime: "00:00",
      endTime: new Date(Date.now() - 60000),
    });
    const authClient = await getConnectedClient(token);

    const errorPromise = new Promise((resolve) => {
      authClient.on("error", (err) => resolve(err));
    });

    authClient.emit("placeBid", {
      productId: expiredProduct._id.toString(),
      currentBid: 2000,
      bidderName: "Late Bidder",
    });

    const error = await errorPromise;
    expect(error.message).toMatch(/bidding time has passed|auction ended|Bidding period has ended/i);
  });

  it("should successfully accept valid bid, update database, and broadcast to room", async () => {
    const { user, token } = await createTestUser({ email: "validbidder@example.com" });
    const product = await createActiveProduct({ biddingStartPrice: 1000 });

    const client1 = await getConnectedClient(token);
    const client2 = await getConnectedClient(null);

    // Both clients join the room
    client1.emit("joinProductRoom", product._id.toString());
    client2.emit("joinProductRoom", product._id.toString());

    // Client2 listens for the broadcast
    const broadcastPromise = new Promise((resolve) => {
      client2.on("productData", (data) => {
        if (data.currentBid === 1500) {
          resolve(data);
        }
      });
    });

    // Client1 places a valid bid
    client1.emit("placeBid", {
      productId: product._id.toString(),
      currentBid: 1500,
      bidderName: user.name,
    });

    const broadcastData = await broadcastPromise;
    expect(broadcastData.currentBid).toBe(1500);
    expect(broadcastData.bidderName).toBe(user.name);

    // Verify database was updated
    const updated = await Product.findById(product._id);
    expect(updated.currentPrice).toBe(1500);
    expect(updated.tempuseremail).toBe(user.email);
    expect(updated.tempamount).toBe(1500);
  });
});
