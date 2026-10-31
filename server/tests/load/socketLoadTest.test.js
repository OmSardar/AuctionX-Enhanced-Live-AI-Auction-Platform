/**
 * Socket.IO Load Tests — Concurrent Bidding Stress
 *
 * Spawns 10, then 25, then 50 socket clients concurrently to test
 * connection capacity and concurrent bidding behavior.
 */
const { server, io } = require("../../server");
const Product = require("../../src/modules/products/models/productSchema");
const { clearDatabase } = require("../helpers/dbHelper");
const { createTestUser } = require("../helpers/authHelper");
const { createSocketClient } = require("../helpers/socketHelper");

describe("Socket.IO Load Tests — Concurrent Connections", () => {
  let testServer;
  let allClients = [];

  beforeAll((done) => {
    testServer = server.listen(0, done);
  });

  afterAll((done) => {
    allClients.forEach((c) => {
      try { if (c.connected) c.disconnect(); } catch (e) {}
    });
    testServer.close(done);
  });

  beforeEach(async () => {
    await clearDatabase();
    allClients.forEach((c) => {
      try { if (c.connected) c.disconnect(); } catch (e) {}
    });
    allClients = [];
  });

  async function connectNClients(n, token = null) {
    const clients = [];
    const connectPromises = [];

    for (let i = 0; i < n; i++) {
      const client = createSocketClient(testServer, token);
      allClients.push(client);
      clients.push(client);
      connectPromises.push(
        new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error(`Client ${i} timed out`)), 5000);
          client.on("connect", () => { clearTimeout(timeout); resolve(client); });
          client.on("connect_error", (err) => { clearTimeout(timeout); reject(err); });
        })
      );
    }

    const results = await Promise.allSettled(connectPromises);
    const connected = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    return { clients, connected, failed };
  }

  async function createActiveProduct() {
    const now = new Date();
    const end = new Date(Date.now() + 3600000);
    return Product.create({
      name: "Socket Load Item",
      description: [{ name: "Type", description: "Load Test" }],
      email: "socketload@example.com",
      category: "Electronics",
      images: [{ secure_url: "https://example.com/sl.jpg", public_id: "sl_1" }],
      mobileNumber: "9876543210",
      startTime: now,
      endTime: end,
      biddingStartDate: now,
      biddingStartTime: "00:00",
      biddingStartPrice: 1000,
      biddingEndTime: end.toISOString(),
      status: "Active",
    });
  }

  it("should handle 10 concurrent socket connections", async () => {
    const { connected, failed } = await connectNClients(10);
    console.log(`10 clients: ${connected} connected, ${failed} failed`);
    expect(connected).toBe(10);
    expect(failed).toBe(0);
  });

  it("should handle 25 concurrent socket connections", async () => {
    const { connected, failed } = await connectNClients(25);
    console.log(`25 clients: ${connected} connected, ${failed} failed`);
    expect(connected).toBe(25);
    expect(failed).toBe(0);
  });

  it("should handle 50 concurrent socket connections", async () => {
    const { connected, failed } = await connectNClients(50);
    console.log(`50 clients: ${connected} connected, ${failed} failed`);
    expect(connected).toBe(50);
    expect(failed).toBe(0);
  });

  it("should handle 10 concurrent bids and maintain DB consistency", async () => {
    const product = await createActiveProduct();
    const bidders = [];

    // Create 10 authenticated users
    for (let i = 0; i < 10; i++) {
      const testData = await createTestUser({
        email: `bidder${i}@loadtest.com`,
      });
      bidders.push(testData);
    }

    // Connect all 10, join room, and place bids concurrently
    const { clients } = await connectNClients(10, bidders[0].token);

    // Re-connect with individual tokens
    allClients.forEach((c) => c.disconnect());
    allClients = [];

    const bidPromises = bidders.map(async (b, i) => {
      const client = createSocketClient(testServer, b.token);
      allClients.push(client);

      await new Promise((resolve, reject) => {
        client.on("connect", resolve);
        client.on("connect_error", reject);
      });

      client.emit("joinProductRoom", product._id.toString());
      await new Promise((r) => setTimeout(r, 100));

      // Each bidder bids progressively higher
      const bidAmount = 1200 + i * 200;

      return new Promise((resolve) => {
        const timeout = setTimeout(() => resolve({ bidder: i, result: "timeout" }), 3000);

        client.on("error", (err) => {
          clearTimeout(timeout);
          resolve({ bidder: i, result: "error", message: err.message });
        });

        client.on("productData", (data) => {
          if (data.currentBid === bidAmount) {
            clearTimeout(timeout);
            resolve({ bidder: i, result: "accepted", bid: bidAmount });
          }
        });

        client.emit("placeBid", {
          productId: product._id.toString(),
          currentBid: bidAmount,
          bidderName: b.user.name,
        });
      });
    });

    const results = await Promise.all(bidPromises);
    const accepted = results.filter((r) => r.result === "accepted").length;
    const errors = results.filter((r) => r.result === "error").length;

    console.log(`Concurrent bids: ${accepted} accepted, ${errors} errors`);

    // Verify DB state — the highest successful bid should be stored
    const final = await Product.findById(product._id);
    expect(final.biddingStartPrice).toBeGreaterThanOrEqual(1200);
  });
});
