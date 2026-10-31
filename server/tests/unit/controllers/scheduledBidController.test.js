const mongoose = require("mongoose");
const scheduledBidController = require("../../../src/modules/bidding/controllers/scheduledBidController");
const { executeDueScheduledBids } = require("../../../src/modules/auctions/services/lifecycleService");
const ScheduledBid = require("../../../src/modules/bidding/models/scheduledBid");
const Product = require("../../../src/modules/products/models/productSchema");
const User = require("../../../src/modules/users/models/user");
const { clearDatabase } = require("../../helpers/dbHelper");

function createMockResponse() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe("ScheduledBid Controller & Lifecycle Unit Tests", () => {
  let user;
  let seller;
  let product;

  beforeEach(async () => {
    await clearDatabase();

    user = await User.create({
      name: "Bidder Bob",
      email: "bob@example.com",
      password: "password123",
      role: "user",
    });

    seller = await User.create({
      name: "Seller Sally",
      email: "sally@example.com",
      password: "password123",
      role: "user",
    });

    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    product = await Product.create({
      name: "Vintage Camera",
      description: [{ name: "Condition", description: "Pristine vintage condition" }],
      mobileNumber: "9876543210",
      category: "Collectibles",
      email: seller.email,
      startingPrice: 500,
      biddingStartPrice: 500,
      currentPrice: 500,
      tempamount: 500,
      bidCount: 0,
      minIncrement: 50,
      status: "Active",
      startTime: now,
      endTime: tomorrow,
      biddingStartDate: now.toISOString().split("T")[0],
      biddingEndDate: tomorrow.toISOString().split("T")[0],
      biddingStartTime: "10:00",
      biddingEndTime: tomorrow.toISOString(),
      images: [{ secure_url: "https://example.com/camera.jpg", public_id: "cam1" }],
    });
  });

  describe("createScheduledBid", () => {
    it("should return 401 if unauthenticated", async () => {
      const req = { body: { productId: product._id, amount: 600 } };
      const res = createMockResponse();

      await scheduledBidController.createScheduledBid(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: "UNAUTHORIZED" })
      );
    });

    it("should return 400 if productId is missing", async () => {
      const req = { user, body: { amount: 600 } };
      const res = createMockResponse();

      await scheduledBidController.createScheduledBid(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: "MISSING_PRODUCT_ID" })
      );
    });

    it("should return 400 if amount is negative or invalid", async () => {
      const req = { user, body: { productId: product._id, amount: -10 } };
      const res = createMockResponse();

      await scheduledBidController.createScheduledBid(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: "INVALID_AMOUNT" })
      );
    });

    it("should return 403 if user attempts to schedule bid on their own listing", async () => {
      const req = { user: seller, body: { productId: product._id, amount: 600 } };
      const res = createMockResponse();

      await scheduledBidController.createScheduledBid(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: "SELF_BIDDING_FORBIDDEN" })
      );
    });

    it("should return 400 if scheduled target time exceeds auction end time", async () => {
      const pastEnd = new Date(Date.now() + 48 * 60 * 60 * 1000);
      const req = {
        user,
        body: {
          productId: product._id,
          amount: 600,
          targetTime: pastEnd.toISOString(),
        },
      };
      const res = createMockResponse();

      await scheduledBidController.createScheduledBid(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: "TARGET_TIME_EXCEEDS_AUCTION" })
      );
    });

    it("should return 400 if bid amount is below minimum required", async () => {
      // product starting price is 500, bid 400 is below minimum
      const req = {
        user,
        body: {
          productId: product._id,
          amount: 400,
        },
      };
      const res = createMockResponse();

      await scheduledBidController.createScheduledBid(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: "AMOUNT_BELOW_MINIMUM" })
      );
    });

    it("should successfully create a pending scheduled bid with valid parameters", async () => {
      const targetTime = new Date(Date.now() + 2 * 60 * 60 * 1000);
      const req = {
        user,
        body: {
          productId: product._id,
          amount: 650,
          targetTime: targetTime.toISOString(),
          idempotencyKey: "test_key_1",
        },
      };
      const res = createMockResponse();

      await scheduledBidController.createScheduledBid(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          scheduledBid: expect.objectContaining({
            amount: 650,
            status: "PENDING",
            idempotencyKey: "test_key_1",
          }),
        })
      );

      const saved = await ScheduledBid.findOne({ idempotencyKey: "test_key_1" });
      expect(saved).not.toBeNull();
      expect(saved.amount).toBe(650);
    });

    it("should return existing bid when called with duplicate idempotencyKey", async () => {
      const targetTime = new Date(Date.now() + 2 * 60 * 60 * 1000);
      const req = {
        user,
        body: {
          productId: product._id,
          amount: 650,
          targetTime: targetTime.toISOString(),
          idempotencyKey: "idemp_dup_1",
        },
      };
      const res1 = createMockResponse();
      await scheduledBidController.createScheduledBid(req, res1, jest.fn());
      expect(res1.status).toHaveBeenCalledWith(201);

      const res2 = createMockResponse();
      await scheduledBidController.createScheduledBid(req, res2, jest.fn());
      expect(res2.status).toHaveBeenCalledWith(200);
      expect(res2.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Scheduled bid retrieved (idempotent)",
        })
      );
    });
  });

  describe("getUserScheduledBids", () => {
    it("should return all scheduled bids for user", async () => {
      await ScheduledBid.create({
        productId: product._id,
        userId: user._id,
        userEmail: user.email,
        userName: user.name,
        amount: 700,
        targetTime: new Date(Date.now() + 10000),
        status: "PENDING",
      });

      const req = { user };
      const res = createMockResponse();

      await scheduledBidController.getUserScheduledBids(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          count: 1,
        })
      );
    });
  });

  describe("cancelScheduledBid", () => {
    it("should cancel a PENDING scheduled bid", async () => {
      const sched = await ScheduledBid.create({
        productId: product._id,
        userId: user._id,
        userEmail: user.email,
        userName: user.name,
        amount: 750,
        targetTime: new Date(Date.now() + 10000),
        status: "PENDING",
      });

      const req = { user, params: { id: sched._id.toString() } };
      const res = createMockResponse();

      await scheduledBidController.cancelScheduledBid(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(200);
      const updated = await ScheduledBid.findById(sched._id);
      expect(updated.status).toBe("CANCELLED");
    });

    it("should reject cancellation of non-PENDING bid", async () => {
      const sched = await ScheduledBid.create({
        productId: product._id,
        userId: user._id,
        userEmail: user.email,
        userName: user.name,
        amount: 800,
        targetTime: new Date(Date.now() - 10000),
        status: "EXECUTED",
      });

      const req = { user, params: { id: sched._id.toString() } };
      const res = createMockResponse();

      await scheduledBidController.cancelScheduledBid(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: "CANNOT_CANCEL" })
      );
    });
  });

  describe("executeDueScheduledBids (Lifecycle Worker)", () => {
    it("should execute due scheduled bids when target time is reached", async () => {
      const dueTime = new Date(Date.now() - 5000);
      const sched = await ScheduledBid.create({
        productId: product._id,
        userId: user._id,
        userEmail: user.email,
        userName: user.name,
        amount: 600,
        targetTime: dueTime,
        status: "PENDING",
      });

      const result = await executeDueScheduledBids({ now: new Date() });

      expect(result.processedCount).toBe(1);
      expect(result.executedCount).toBe(1);

      const updatedSched = await ScheduledBid.findById(sched._id);
      expect(updatedSched.status).toBe("EXECUTED");
      expect(updatedSched.executedBidId).not.toBeNull();

      const updatedProduct = await Product.findById(product._id);
      expect(updatedProduct.currentPrice).toBe(600);
      expect(updatedProduct.bidCount).toBe(1);
    });

    it("should mark scheduled bid as FAILED if auction concluded", async () => {
      // Set product to Closed
      await Product.updateOne({ _id: product._id }, { $set: { status: "Closed" } });

      const dueTime = new Date(Date.now() - 5000);
      const sched = await ScheduledBid.create({
        productId: product._id,
        userId: user._id,
        userEmail: user.email,
        userName: user.name,
        amount: 600,
        targetTime: dueTime,
        status: "PENDING",
      });

      const result = await executeDueScheduledBids({ now: new Date() });

      expect(result.processedCount).toBe(1);
      expect(result.failedCount).toBe(1);

      const updatedSched = await ScheduledBid.findById(sched._id);
      expect(updatedSched.status).toBe("FAILED");
      expect(updatedSched.failureReason).toContain("Auction is not active");
    });
  });
});
