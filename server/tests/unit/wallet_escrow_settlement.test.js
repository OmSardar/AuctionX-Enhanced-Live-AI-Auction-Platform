/**
 * Stage 4 — Production-Grade Wallet-Backed Bidding, Escrow Reservation
 * and Automatic Auction Settlement Test Suite
 *
 * Implements authoritative tests for:
 * 1. Insufficient available balance rejected with INSUFFICIENT_AVAILABLE_BALANCE
 * 2. Outbid releases previous reservation back to available balance
 * 3. Winner settlement captures funds, marks order PAID via WALLET (no Razorpay payment)
 * 4. Same bidder increases bid (only additional reservation required)
 * 5. Cannot spend or withdraw reserved funds (RESERVED_FUNDS_LOCKED)
 * 6. Concurrent bids maintain consistent balance and reservations
 * 7. Cancelled auction releases all reservations
 * 8. Duplicate settlement is idempotent (no double capture)
 * 9. Failed settlement recovery flags reconciliation
 * 10. Wallet top-up credits balance once and increases availableBalance immediately
 * 11. Auction expiry race rejects bid without creating reservation
 * 12. Reconciliation service detects balance/reservation invariants
 */

const mongoose = require("mongoose");
const Product = require("../../src/modules/products/models/productSchema");
const Bid = require("../../src/modules/bidding/models/bidSchema");
const Order = require("../../src/modules/orders/models/orderSchema");
const User = require("../../src/modules/users/models/user");
const Transaction = require("../../src/modules/admin/finance/models/transaction");
const WalletReservation = require("../../src/modules/bidding/models/walletReservationSchema");
const Payment = require("../../src/modules/payments/models/Payment");
const { placeBid, BidError } = require("../../src/modules/bidding/services/bidService");
const walletService = require("../../src/modules/payments/services/walletService");
const { finalizeSingleAuction, repairOrphanOrder } = require("../../src/modules/auctions/services/lifecycleService");
const { runWalletReconciliation } = require("../../src/modules/payments/services/walletReconciliationService");
const { settleWalletTopup } = require("../../src/modules/payments/services/paymentService");
const { createTestUser } = require("../helpers/authHelper");

describe("Stage 4 — Wallet-Backed Bidding, Escrow & Settlement Suite", () => {
  let seller;
  let bidderA;
  let bidderB;

  beforeAll(async () => {
    await Bid.init();
    await Product.init();
    await Order.init();
    await WalletReservation.init();
    await Transaction.init();
    await Payment.init();

    const sellerFixture = await createTestUser({
      email: "escrow_seller@test.com",
      name: "Escrow Seller",
    });

    const bidderAFixture = await createTestUser({
      email: "escrow_bidder_a@test.com",
      name: "Escrow Bidder A",
    });

    const bidderBFixture = await createTestUser({
      email: "escrow_bidder_b@test.com",
      name: "Escrow Bidder B",
    });

    seller = sellerFixture.user;
    bidderA = bidderAFixture.user;
    bidderB = bidderBFixture.user;
  });

  beforeEach(async () => {
    // Reset balances for clean test execution
    await User.updateOne(
      { _id: bidderA._id },
      { $set: { amount: 5000, reservedAmount: 0 } }
    );
    await User.updateOne(
      { _id: bidderB._id },
      { $set: { amount: 5000, reservedAmount: 0 } }
    );
  });

  afterAll(async () => {
    await Product.deleteMany({ email: seller.email });
    await User.deleteMany({
      _id: { $in: [seller._id, bidderA._id, bidderB._id] },
    });
  });

  async function createLiveAuctionProduct(overrides = {}) {
    const now = new Date();
    const startTime = overrides.startTime || new Date(now.getTime() - 60 * 1000);
    const originalEndTime = overrides.originalEndTime || new Date(now.getTime() + 60 * 60 * 1000);
    const endTime = overrides.endTime || originalEndTime;
    const startingPrice = overrides.startingPrice !== undefined ? overrides.startingPrice : 500;
    const currentPrice = overrides.currentPrice !== undefined ? overrides.currentPrice : startingPrice;

    return Product.create({
      name: overrides.name || "Wallet Escrow Test Product",
      category: "Electronics",
      description: [{ name: "Condition", description: "Mint" }],
      email: overrides.email || seller.email,
      mobileNumber: "9876543210",
      images: [{ secure_url: "https://example.com/item.jpg", public_id: "item_1" }],
      biddingStartDate: startTime,
      biddingStartTime: startTime.toISOString(),
      biddingEndTime: endTime.toISOString(),
      biddingStartPrice: startingPrice,
      startingPrice,
      currentPrice,
      bidCount: overrides.bidCount !== undefined ? overrides.bidCount : 0,
      minIncrement: overrides.minIncrement !== undefined ? overrides.minIncrement : 50,
      startTime,
      originalEndTime,
      endTime,
      maxExtensionDeadline:
        overrides.maxExtensionDeadline || new Date(originalEndTime.getTime() + 15 * 60 * 1000),
      antiSnipeCount: overrides.antiSnipeCount || 0,
      status: overrides.status || "Active",
      ...overrides,
    });
  }

  // ---------------------------------------------------------------------------
  // 1. Insufficient Available Balance Rejected
  // ---------------------------------------------------------------------------
  test("1. Rejects bid when available wallet balance is insufficient", async () => {
    // Set bidderA: totalBalance=500, reservedAmount=400 -> available=100
    await User.updateOne(
      { _id: bidderA._id },
      { $set: { amount: 500, reservedAmount: 400 } }
    );

    const product = await createLiveAuctionProduct({ startingPrice: 200, currentPrice: 200 });

    // Attempt ₹200 bid: requires ₹200 available balance, but only ₹100 is available
    await expect(
      placeBid({
        productId: product._id.toString(),
        bidder: bidderA,
        amount: 200,
      })
    ).rejects.toThrow(BidError);

    try {
      await placeBid({
        productId: product._id.toString(),
        bidder: bidderA,
        amount: 200,
      });
    } catch (err) {
      expect(err.statusCode).toBe(400);
      expect(err.code).toBe("INSUFFICIENT_AVAILABLE_BALANCE");
    }

    // Verify balance untouched
    const freshUser = await User.findById(bidderA._id);
    expect(freshUser.amount).toBe(500);
    expect(freshUser.reservedAmount).toBe(400);

    // Verify no reservation created
    const reservation = await WalletReservation.findOne({ productId: product._id });
    expect(reservation).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // 2. Outbid Releases Previous Reservation Back to Available Balance
  // ---------------------------------------------------------------------------
  test("2. Outbid releases previous reservation back to available balance", async () => {
    await User.updateOne({ _id: bidderA._id }, { $set: { amount: 2000, reservedAmount: 0 } });
    await User.updateOne({ _id: bidderB._id }, { $set: { amount: 2000, reservedAmount: 0 } });

    const product = await createLiveAuctionProduct({ startingPrice: 500, currentPrice: 500 });

    // Bidder A places opening bid of ₹500
    const bid1 = await placeBid({
      productId: product._id.toString(),
      bidder: bidderA,
      amount: 500,
    });
    expect(bid1.success).toBe(true);

    const userAAfterBid1 = await User.findById(bidderA._id);
    expect(userAAfterBid1.amount).toBe(2000);
    expect(userAAfterBid1.reservedAmount).toBe(500);

    const resA = await WalletReservation.findOne({ productId: product._id, status: "ACTIVE" });
    expect(resA).toBeTruthy();
    expect(resA.userId.toString()).toBe(bidderA._id.toString());
    expect(resA.amount).toBe(500);

    // Bidder B outbids with ₹600
    const bid2 = await placeBid({
      productId: product._id.toString(),
      bidder: bidderB,
      amount: 600,
    });
    expect(bid2.success).toBe(true);

    // Bidder A's reservation must be released back to available balance
    const userAAfterOutbid = await User.findById(bidderA._id);
    expect(userAAfterOutbid.amount).toBe(2000);
    expect(userAAfterOutbid.reservedAmount).toBe(0); // Released!

    // Bidder B has ₹600 reserved
    const userBAfterBid2 = await User.findById(bidderB._id);
    expect(userBAfterBid2.amount).toBe(2000);
    expect(userBAfterBid2.reservedAmount).toBe(600);

    // Active reservation is now Bidder B
    const activeRes = await WalletReservation.findOne({ productId: product._id, status: "ACTIVE" });
    expect(activeRes.userId.toString()).toBe(bidderB._id.toString());
    expect(activeRes.amount).toBe(600);

    // Prior reservation status is RELEASED
    const oldRes = await WalletReservation.findById(resA._id);
    expect(oldRes.status).toBe("RELEASED");

    // Ledger records release
    const releaseTx = await Transaction.findOne({
      userId: bidderA._id,
      type: "BID_RESERVATION_RELEASE",
      productId: product._id,
    });
    expect(releaseTx).toBeTruthy();
    expect(releaseTx.amount).toBe(500);
  });

  // ---------------------------------------------------------------------------
  // 3. Winner Settlement Captures Funds, Marks Order PAID via WALLET
  // ---------------------------------------------------------------------------
  test("3. Auction finalization captures winner reservation and marks order PAID via WALLET", async () => {
    await User.updateOne({ _id: bidderB._id }, { $set: { amount: 3000, reservedAmount: 0 } });

    const product = await createLiveAuctionProduct({ startingPrice: 1000, currentPrice: 1000 });

    // Bidder B bids ₹1000
    await placeBid({
      productId: product._id.toString(),
      bidder: bidderB,
      amount: 1000,
    });

    // Verify hold
    let userB = await User.findById(bidderB._id);
    expect(userB.amount).toBe(3000);
    expect(userB.reservedAmount).toBe(1000);

    // Set endTime to past so auction is expired for finalization
    const pastTime = new Date(Date.now() - 1000);
    await Product.updateOne({ _id: product._id }, { $set: { endTime: pastTime } });

    // Finalize auction
    const finalizeOutcome = await finalizeSingleAuction(product._id, { now: new Date() });
    expect(finalizeOutcome.success).toBe(true);
    expect(finalizeOutcome.order).toBeTruthy();
    expect(finalizeOutcome.order.status).toBe("PAID");
    expect(finalizeOutcome.order.paymentMethod).toBe("WALLET");

    // User B's funds are captured: totalAmount debited by 1000, reservedAmount debited by 1000
    userB = await User.findById(bidderB._id);
    expect(userB.amount).toBe(2000); // 3000 - 1000
    expect(userB.reservedAmount).toBe(0); // Hold released because captured!

    // Reservation status is CAPTURED
    const capturedRes = await WalletReservation.findOne({ productId: product._id });
    expect(capturedRes.status).toBe("CAPTURED");
    expect(capturedRes.orderId).toBeTruthy();

    // Order created as PAID via WALLET
    const order = await Order.findOne({ productId: product._id });
    expect(order).toBeTruthy();
    expect(order.status).toBe("PAID");
    expect(order.paymentMethod).toBe("WALLET");
    expect(order.walletSettled).toBe(true);

    // Ledger records capture
    const captureTx = await Transaction.findOne({
      userId: bidderB._id,
      type: "AUCTION_WIN_CAPTURE",
      productId: product._id,
    });
    expect(captureTx).toBeTruthy();
    expect(captureTx.amount).toBe(1000);
  });

  // ---------------------------------------------------------------------------
  // 4. Same Bidder Increases Bid (Only Additional Reservation Required)
  // ---------------------------------------------------------------------------
  test("4. Same bidder increasing bid only requires additional reservation", async () => {
    // Bidder A has 1000 total balance
    await User.updateOne({ _id: bidderA._id }, { $set: { amount: 1000, reservedAmount: 0 } });

    const product = await createLiveAuctionProduct({ startingPrice: 400, currentPrice: 400 });

    // Opening bid ₹400: reserves ₹400
    await placeBid({
      productId: product._id.toString(),
      bidder: bidderA,
      amount: 400,
    });

    let userA = await User.findById(bidderA._id);
    expect(userA.amount).toBe(1000);
    expect(userA.reservedAmount).toBe(400); // Available: 600

    // Same bidder increases bid to ₹700 (additional required: ₹300)
    // Available is 600 >= 300, so it must succeed!
    const increaseOutcome = await placeBid({
      productId: product._id.toString(),
      bidder: bidderA,
      amount: 700,
    });
    expect(increaseOutcome.success).toBe(true);

    userA = await User.findById(bidderA._id);
    expect(userA.amount).toBe(1000);
    expect(userA.reservedAmount).toBe(700); // Now 700 reserved, 300 available

    const activeRes = await WalletReservation.findOne({ productId: product._id, status: "ACTIVE" });
    expect(activeRes.amount).toBe(700);

    // Ledger records BID_RESERVATION_INCREASE with additional amount of ₹300
    const incTx = await Transaction.findOne({
      userId: bidderA._id,
      type: "BID_RESERVATION_INCREASE",
      productId: product._id,
    });
    expect(incTx).toBeTruthy();
    expect(incTx.amount).toBe(300);
  });

  // ---------------------------------------------------------------------------
  // 5. Cannot Spend or Withdraw Reserved Funds
  // ---------------------------------------------------------------------------
  test("5. Enforces invariant: cannot withdraw or spend reserved funds", async () => {
    // Bidder A has 1000 balance, 800 reserved (available 200)
    await User.updateOne({ _id: bidderA._id }, { $set: { amount: 1000, reservedAmount: 800 } });

    // Attempt to withdraw or reduce total balance to ₹500 via userPaymentController logic
    const { updateAmount } = require("../../src/modules/users/controllers/userPaymentController");
    const mockReq = {
      user: bidderA,
      body: { amount: 500 },
    };
    let responseStatus = null;
    let responseBody = null;
    const mockRes = {
      status(code) {
        responseStatus = code;
        return this;
      },
      json(data) {
        responseBody = data;
        return this;
      },
    };

    await updateAmount(mockReq, mockRes);
    expect(responseStatus).toBe(400);
    expect(responseBody.code).toBe("RESERVED_FUNDS_LOCKED");

    // Balance untouched
    const freshUser = await User.findById(bidderA._id);
    expect(freshUser.amount).toBe(1000);
    expect(freshUser.reservedAmount).toBe(800);
  });

  // ---------------------------------------------------------------------------
  // 6. Concurrent Bids Maintain Consistent Balance and Reservations
  // ---------------------------------------------------------------------------
  test("6. Concurrent bids maintain consistent balance and exactly one active reservation", async () => {
    await User.updateOne({ _id: bidderA._id }, { $set: { amount: 10000, reservedAmount: 0 } });
    await User.updateOne({ _id: bidderB._id }, { $set: { amount: 10000, reservedAmount: 0 } });

    const product = await createLiveAuctionProduct({ startingPrice: 500, currentPrice: 500 });

    // Simultaneous bids from Bidder A (₹600) and Bidder B (₹600)
    const results = await Promise.allSettled([
      placeBid({
        productId: product._id.toString(),
        bidder: bidderA,
        amount: 600,
      }),
      placeBid({
        productId: product._id.toString(),
        bidder: bidderB,
        amount: 600,
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    // Exactly one must win, exactly one must be rejected
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    // Exactly one active reservation exists on the product
    const activeReservations = await WalletReservation.find({
      productId: product._id,
      status: "ACTIVE",
    });
    expect(activeReservations.length).toBe(1);
    expect(activeReservations[0].amount).toBe(600);

    // Losing bidder must have 0 reservedAmount
    const winningUserId = activeReservations[0].userId.toString();
    const losingUserId = winningUserId === bidderA._id.toString() ? bidderB._id : bidderA._id;

    const losingUser = await User.findById(losingUserId);
    expect(losingUser.reservedAmount).toBe(0);
    expect(losingUser.amount).toBe(10000);

    const winningUser = await User.findById(winningUserId);
    expect(winningUser.reservedAmount).toBe(600);
    expect(winningUser.amount).toBe(10000);
  });

  // ---------------------------------------------------------------------------
  // 7. Cancelled Auction Releases All Reservations
  // ---------------------------------------------------------------------------
  test("7. Cancelled auction releases all active escrow reservations", async () => {
    await User.updateOne({ _id: bidderA._id }, { $set: { amount: 2000, reservedAmount: 0 } });

    const product = await createLiveAuctionProduct({ startingPrice: 500, currentPrice: 500 });

    await placeBid({
      productId: product._id.toString(),
      bidder: bidderA,
      amount: 500,
    });

    let userA = await User.findById(bidderA._id);
    expect(userA.reservedAmount).toBe(500);

    // Cancel auction / release all reservations
    const releasedCount = await walletService.releaseAllAuctionReservations(
      product._id,
      "AUCTION_CANCELLED_BY_ADMIN"
    );
    expect(releasedCount).toBe(1);

    userA = await User.findById(bidderA._id);
    expect(userA.reservedAmount).toBe(0); // Released back!
    expect(userA.amount).toBe(2000);

    const activeRes = await WalletReservation.find({ productId: product._id, status: "ACTIVE" });
    expect(activeRes.length).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // 8. Duplicate Settlement is Idempotent
  // ---------------------------------------------------------------------------
  test("8. Duplicate finalization is idempotent and does not capture funds twice", async () => {
    await User.updateOne({ _id: bidderB._id }, { $set: { amount: 3000, reservedAmount: 0 } });

    const product = await createLiveAuctionProduct({ startingPrice: 800, currentPrice: 800 });

    await placeBid({
      productId: product._id.toString(),
      bidder: bidderB,
      amount: 800,
    });

    // Set endTime to past so auction is expired for finalization
    const pastTime = new Date(Date.now() - 1000);
    await Product.updateOne({ _id: product._id }, { $set: { endTime: pastTime } });

    // First finalization
    const result1 = await finalizeSingleAuction(product._id, { now: new Date() });
    expect(result1.success).toBe(true);

    const userBAfterFirst = await User.findById(bidderB._id);
    expect(userBAfterFirst.amount).toBe(2200); // 3000 - 800

    // Second finalization attempt (e.g. scheduler retry or orphan repair)
    const result2 = await finalizeSingleAuction(product._id, { now: new Date() });
    expect(result2.success).toBe(true);

    const userBAfterSecond = await User.findById(bidderB._id);
    // MUST NOT double capture!
    expect(userBAfterSecond.amount).toBe(2200);
    expect(userBAfterSecond.reservedAmount).toBe(0);

    // Exactly one Order exists
    const orders = await Order.find({ productId: product._id });
    expect(orders.length).toBe(1);
    expect(orders[0].status).toBe("PAID");
  });

  // ---------------------------------------------------------------------------
  // 9. Failed Settlement Recovery Flags Reconciliation
  // ---------------------------------------------------------------------------
  test("9. Interrupted finalization without order can be safely healed without double debit", async () => {
    await User.updateOne({ _id: bidderB._id }, { $set: { amount: 3000, reservedAmount: 0 } });

    const product = await createLiveAuctionProduct({ startingPrice: 900, currentPrice: 900 });

    await placeBid({
      productId: product._id.toString(),
      bidder: bidderB,
      amount: 900,
    });

    // Simulate crash where Product was marked Sold, but Order creation crashed
    await Product.updateOne(
      { _id: product._id },
      { $set: { status: "Sold", paymentDeadline: new Date(Date.now() + 24 * 3600 * 1000) } }
    );

    // Call orphan repair
    const healedOrder = await repairOrphanOrder(product._id);
    expect(healedOrder).toBeTruthy();
    expect(healedOrder.status).toBe("PAID");
    expect(healedOrder.paymentMethod).toBe("WALLET");

    // Funds captured
    const userB = await User.findById(bidderB._id);
    expect(userB.amount).toBe(2100); // 3000 - 900
    expect(userB.reservedAmount).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // 10. Wallet Top-Up via Sandbox Credits Balance Once
  // ---------------------------------------------------------------------------
  test("10. Wallet top-up credits balance and increases available balance immediately", async () => {
    await User.updateOne({ _id: bidderA._id }, { $set: { amount: 1000, reservedAmount: 200 } });

    // Create a mock pending top-up Payment record
    const payment = await Payment.create({
      type: "WALLET_TOPUP",
      userId: bidderA._id,
      userEmail: bidderA.email,
      amount: 50000, // 500 INR in paise
      currency: "INR",
      status: "INITIATED",
      razorpayOrderId: "order_mock_topup_123",
      idempotencyKey: "topup_test_key_1",
    });

    // Settle wallet top-up
    const settlement = await settleWalletTopup({
      paymentId: payment._id,
      razorpayPaymentId: "pay_mock_123",
      amountPaise: 50000,
      verifiedVia: "SANDBOX_VERIFY",
    });

    expect(settlement.success).toBe(true);
    expect(settlement.creditedAmount).toBe(500);

    const userA = await User.findById(bidderA._id);
    expect(userA.amount).toBe(1500); // 1000 + 500
    expect(userA.reservedAmount).toBe(200);
    // availableBalance = 1500 - 200 = 1300

    const bal = await walletService.getWalletBalance(bidderA._id);
    expect(bal.totalBalance).toBe(1500);
    expect(bal.reservedBalance).toBe(200);
    expect(bal.availableBalance).toBe(1300);

    // Idempotent retry: settling again does not add funds again
    const retry = await settleWalletTopup({
      paymentId: payment._id,
      razorpayPaymentId: "pay_mock_123",
      amountPaise: 50000,
      verifiedVia: "SANDBOX_VERIFY",
    });
    expect(retry.alreadyPaid).toBe(true);

    const userAAfterRetry = await User.findById(bidderA._id);
    expect(userAAfterRetry.amount).toBe(1500);
  });

  // ---------------------------------------------------------------------------
  // 11. Auction Expiry Race
  // ---------------------------------------------------------------------------
  test("11. Bids submitted after auction expiration are rejected without touching reservations", async () => {
    await User.updateOne({ _id: bidderA._id }, { $set: { amount: 5000, reservedAmount: 0 } });

    const pastEndTime = new Date(Date.now() - 10000); // 10 seconds ago
    const product = await createLiveAuctionProduct({
      startingPrice: 500,
      currentPrice: 500,
      endTime: pastEndTime,
      biddingEndTime: pastEndTime.toISOString(),
    });

    await expect(
      placeBid({
        productId: product._id.toString(),
        bidder: bidderA,
        amount: 500,
      })
    ).rejects.toThrow(BidError);

    // User A reservedAmount remains 0
    const userA = await User.findById(bidderA._id);
    expect(userA.reservedAmount).toBe(0);
    expect(userA.amount).toBe(5000);

    // No active reservation created
    const res = await WalletReservation.findOne({ productId: product._id });
    expect(res).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // 12. Reconciliation Service Detects Balance & Escrow Invariants
  // ---------------------------------------------------------------------------
  test("12. Wallet reconciliation service verifies invariants and auto-repairs discrepancies", async () => {
    // Clean any leftover reservations from previous tests
    await WalletReservation.deleteMany({});
    await User.updateMany({}, { $set: { reservedAmount: 0 } });
    await Product.deleteMany({ email: seller.email });

    // 1. Healthy system test
    const cleanReport = await runWalletReconciliation({ autoRepair: false });
    if (!cleanReport.healthy) {
      console.log("cleanReport discrepancies:", JSON.stringify(cleanReport.discrepancies, null, 2));
    }
    expect(cleanReport.healthy).toBe(true);
    expect(cleanReport.summary.discrepancyCount).toBe(0);

    // 2. Introduce artificial discrepancy: user.reservedAmount = 999 without any active reservation
    await User.updateOne({ _id: bidderA._id }, { $set: { reservedAmount: 999 } });

    const brokenReport = await runWalletReconciliation({ autoRepair: false });
    expect(brokenReport.healthy).toBe(false);
    expect(brokenReport.discrepancies.length).toBeGreaterThan(0);

    const userDisc = brokenReport.discrepancies.find(
      (d) => d.userId === bidderA._id.toString() && d.type === "RESERVED_BALANCE_MISMATCH"
    );
    expect(userDisc).toBeTruthy();
    expect(userDisc.actualReserved).toBe(999);
    expect(userDisc.expectedReserved).toBe(0);

    // 3. Run auto-repair
    const repairedReport = await runWalletReconciliation({ autoRepair: true });
    expect(repairedReport.healthy).toBe(false); // was unhealthy during scan, but repaired

    // Check user document was auto-repaired
    const fixedUser = await User.findById(bidderA._id);
    expect(fixedUser.reservedAmount).toBe(0);

    // 4. Scan again: now perfectly healthy!
    const finalReport = await runWalletReconciliation({ autoRepair: false });
    expect(finalReport.healthy).toBe(true);
    expect(finalReport.discrepancies.length).toBe(0);
  });
});
