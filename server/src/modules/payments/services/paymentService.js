const crypto = require("crypto");
const axios = require("axios");
const mongoose = require("mongoose");
const Order = require("../../orders/models/orderSchema");
const Product = require("../../products/models/productSchema");
const Payment = require("../models/Payment");
const WebhookEvent = require("../models/WebhookEvent");
const UserModel = require("../../users/models/user");
const Transaction = require("../../admin/finance/models/transaction");
const { logger } = require("../../../infrastructure/logging/loggerMiddleware");

/**
 * Custom Error for Payment Operations
 */
class PaymentError extends Error {
  constructor(message, statusCode = 400, code = "PAYMENT_ERROR", details = {}) {
    super(message);
    this.name = "PaymentError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

// Injected provider client for deterministic automated testing
let customProviderClient = null;

/**
 * Injects a mock provider client for testing.
 * @param {Object|null} client - Must implement { createOrder: Function, fetchOrder: Function, fetchPayment: Function }
 */
function setProviderClient(client) {
  if (process.env.NODE_ENV === "production") {
    throw new PaymentError("Cannot inject mock provider client in production mode", 403, "PRODUCTION_GUARD");
  }
  customProviderClient = client;
}

/**
 * Resets provider client to official Razorpay REST integration.
 */
function resetProviderClient() {
  customProviderClient = null;
}

/**
 * Calls Razorpay REST API to create an order.
 * Uses HTTP Basic Auth (key_id:key_secret).
 *
 * @param {Object} orderData
 * @param {number} orderData.amount - Amount in paise
 * @param {string} orderData.currency - "INR"
 * @param {string} orderData.receipt - Unique internal receipt/order identifier
 * @param {Object} [orderData.notes]
 * @returns {Promise<Object>} Razorpay Order response
 */
async function callRazorpayCreateOrder({ amount, currency = "INR", receipt, notes = {} }) {
  if (customProviderClient && typeof customProviderClient.createOrder === "function") {
    return customProviderClient.createOrder({ amount, currency, receipt, notes });
  }

  let keyId = (process.env.RAZORPAY_KEY_ID || "").trim();
  let keySecret = (process.env.RAZORPAY_KEY_SECRET || "").trim();

  // Self-healing in non-test runtime: if empty strings were injected by container/process managers, load from .env
  if (process.env.NODE_ENV !== "test" && (!keyId || !keySecret)) {
    try {
      const dotenv = require("dotenv");
      const path = require("path");
      dotenv.config({ path: path.resolve(__dirname, "../../../../../server/.env"), override: true });
      dotenv.config({ path: path.resolve(__dirname, "../../../../../../.env"), override: true });
      keyId = (process.env.RAZORPAY_KEY_ID || "").trim();
      keySecret = (process.env.RAZORPAY_KEY_SECRET || "").trim();
    } catch (_) {}
  }

  if (!keyId || !keySecret) {
    const missing = [];
    if (!keyId) missing.push("RAZORPAY_KEY_ID");
    if (!keySecret) missing.push("RAZORPAY_KEY_SECRET");
    const actionMsg = `Payment gateway credentials are not configured. Missing environment variable(s): ${missing.join(", ")}.`;
    if (logger) {
      logger.error(`[PaymentService] ${actionMsg}`);
    }
    throw new PaymentError(
      "Payment gateway credentials are not configured",
      503,
      "GATEWAY_NOT_CONFIGURED",
      {
        missing,
        hint: `Please configure ${missing.join(" and ")} in your server environment (.env).`,
      }
    );
  }

  const authHeader = `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;

  try {
    const response = await axios.post(
      "https://api.razorpay.com/v1/orders",
      {
        amount,
        currency,
        receipt,
        notes,
      },
      {
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );
    return response.data;
  } catch (err) {
    const errorDetails = err.response?.data?.error || {};
    const errMsg = errorDetails.description || err.message;
    if (logger) {
      logger.error(`[PaymentService] Provider order creation error: ${errMsg}`);
    }
    throw new PaymentError(
      `Razorpay order creation failed: ${errMsg}`,
      502,
      "PROVIDER_API_ERROR",
      { providerError: errorDetails }
    );
  }
}

/**
 * Cryptographically verifies Razorpay checkout response signature.
 * Uses constant-time comparison to prevent timing attacks.
 *
 * @param {Object} params
 * @param {string} params.razorpayOrderId
 * @param {string} params.razorpayPaymentId
 * @param {string} params.razorpaySignature
 * @param {string} [params.secret]
 * @returns {boolean}
 */
function verifyCheckoutSignature({
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
  secret = process.env.RAZORPAY_KEY_SECRET,
}) {
  if (!secret) {
    if (logger) {
      logger.error("[PaymentService] Cannot verify checkout signature: RAZORPAY_KEY_SECRET is not configured");
    }
    return false;
  }
  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    return false;
  }

  const payload = `${razorpayOrderId}|${razorpayPaymentId}`;
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  try {
    const expectedBuffer = Buffer.from(expectedSignature, "utf8");
    const receivedBuffer = Buffer.from(razorpaySignature, "utf8");
    if (expectedBuffer.length !== receivedBuffer.length) {
      return false;
    }
    return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
  } catch {
    return false;
  }
}

/**
 * Cryptographically verifies Razorpay webhook HMAC-SHA256 signature against exact raw bytes.
 * Uses constant-time comparison.
 *
 * @param {Object} params
 * @param {Buffer|string} params.rawBody
 * @param {string} params.signature
 * @param {string} [params.secret]
 * @returns {boolean}
 */
function verifyWebhookSignature({
  rawBody,
  signature,
  secret = process.env.RAZORPAY_WEBHOOK_SECRET,
}) {
  if (!secret) {
    if (logger) {
      logger.error("[PaymentService] Cannot verify webhook signature: RAZORPAY_WEBHOOK_SECRET is not configured");
    }
    return false;
  }
  if (!rawBody || !signature) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  try {
    const expectedBuffer = Buffer.from(expectedSignature, "utf8");
    const receivedBuffer = Buffer.from(signature, "utf8");
    if (expectedBuffer.length !== receivedBuffer.length) {
      return false;
    }
    return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
  } catch {
    return false;
  }
}

/**
 * Server-authoritative Razorpay payment order initiation.
 * Verifies winning bidder identity, order eligibility, and deadline; computes payable amount strictly
 * from persisted authoritative order price.
 *
 * @param {Object} params
 * @param {string|ObjectId} params.orderId - Internal Order ObjectId
 * @param {Object} params.user - Authenticated user ({ _id, email, name })
 * @param {string} [params.idempotencyKey] - Optional idempotency key
 * @param {Date} [params.now] - Parameterized timestamp for testing
 * @returns {Promise<Object>} Client checkout configuration
 */
async function initiateOrderPayment({
  orderId,
  user,
  idempotencyKey = null,
  now = new Date(),
}) {
  const queryTime = now instanceof Date ? now : new Date(now);

  if (!user || !user._id || !user.email) {
    throw new PaymentError("Authentication required to initiate payment", 401, "UNAUTHORIZED");
  }

  if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
    throw new PaymentError("Invalid order identifier", 400, "INVALID_ORDER_ID");
  }

  const order = await Order.findById(orderId);
  if (!order) {
    throw new PaymentError("Order not found", 404, "ORDER_NOT_FOUND");
  }

  // 1. Authorization: Only the winning bidder associated with the Order may initiate payment
  const isWinnerId =
    order.winnerId && order.winnerId.toString() === user._id.toString();
  const isWinnerEmail =
    order.userEmail &&
    user.email &&
    order.userEmail.trim().toLowerCase() === user.email.trim().toLowerCase();

  if (!isWinnerId && !isWinnerEmail) {
    throw new PaymentError(
      "You are not authorized to pay for this order. Only the winning bidder may complete checkout.",
      403,
      "UNAUTHORIZED_PAYER"
    );
  }

  // 2. Check Order Status
  if (order.status === "PAID") {
    throw new PaymentError("This order has already been paid", 400, "ORDER_ALREADY_PAID");
  }

  if (order.status === "CANCELLED" || order.status === "REFUNDED") {
    throw new PaymentError(
      `Cannot pay for order with status ${order.status}`,
      400,
      "INVALID_ORDER_STATUS"
    );
  }

  // 3. Strict Dispute Hold Check: Block payment checkout initiation while dispute hold is active
  if (order.isDisputeHoldActive) {
    throw new PaymentError(
      "Payment initiation is temporarily held pending dispute investigation.",
      400,
      "PAYMENT_HELD_FOR_DISPUTE",
      { paymentDeadline: order.paymentDeadline ? order.paymentDeadline.toISOString() : null, isDisputeHoldActive: true }
    );
  }

  // 4. Strict 24-Hour Payment Deadline Check
  if (order.paymentDeadline && queryTime.getTime() >= order.paymentDeadline.getTime()) {
    // Transition order to EXPIRED if not already done
    if (order.status !== "EXPIRED") {
      await Order.updateOne(
        { _id: order._id, status: "PENDING" },
        { $set: { status: "EXPIRED" } }
      );
    }
    throw new PaymentError(
      "Payment deadline has passed (24-hour limit exceeded). This order has expired.",
      400,
      "PAYMENT_DEADLINE_EXPIRED",
      { paymentDeadline: order.paymentDeadline.toISOString() }
    );
  }

  // 4. Derive Authoritative Amount (strictly from DB, never client-provided)
  const payableRupees = Number(order.finalPrice !== undefined ? order.finalPrice : order.highestBid);
  if (!Number.isFinite(payableRupees) || payableRupees <= 0) {
    throw new PaymentError(
      "Authoritative order amount is invalid or zero",
      500,
      "INVALID_ORDER_AMOUNT"
    );
  }

  // Integer minor units: paise for INR
  const amountPaise = Math.round(payableRupees * 100);

  // 5. Idempotent Reuse: Check if an active Payment record already exists for this order/key
  const sanitizedKey = idempotencyKey ? String(idempotencyKey).trim() : null;
  if (sanitizedKey) {
    const existingPayment = await Payment.findOne({
      idempotencyKey: sanitizedKey,
    });

    if (existingPayment) {
      if (existingPayment.orderId && existingPayment.orderId.toString() !== order._id.toString()) {
        throw new PaymentError("Idempotency key collision with different order", 409, "IDEMPOTENCY_CONFLICT");
      }
      if (existingPayment.status === "CAPTURED") {
        throw new PaymentError("This payment attempt has already succeeded", 400, "ALREADY_CAPTURED");
      }
      if (existingPayment.userId && existingPayment.userId.toString() !== user._id.toString()) {
        throw new PaymentError("Idempotency key collision with another user", 409, "IDEMPOTENCY_CONFLICT");
      }
      if (existingPayment.amount && existingPayment.amount !== amountPaise) {
        throw new PaymentError("Idempotency key reused with different amount", 409, "IDEMPOTENCY_CONFLICT");
      }
      if (existingPayment.razorpayOrderId) {
        // Return existing provider order details idempotently
        return {
          success: true,
          orderId: order._id.toString(),
          paymentId: existingPayment._id.toString(),
          razorpayOrderId: existingPayment.razorpayOrderId,
          amount: existingPayment.amount,
          currency: existingPayment.currency,
          keyId: process.env.RAZORPAY_KEY_ID || "rzp_test_public_key",
          title: order.title,
          customer: {
            name: order.name,
            email: order.userEmail,
            contact: order.phoneNo,
          },
          paymentDeadline: order.paymentDeadline ? order.paymentDeadline.toISOString() : null,
          isDuplicate: true,
        };
      }
    }
  }

  // 6. Create Razorpay Order via REST API
  const receiptId = `rcpt_${order._id.toString().slice(-8)}_${sanitizedKey ? sanitizedKey.slice(0, 8) : ((order.paymentAttempts || 0) + 1)}`;
  const providerOrder = await callRazorpayCreateOrder({
    amount: amountPaise,
    currency: "INR",
    receipt: receiptId,
    notes: {
      orderId: order._id.toString(),
      productId: order.productId ? order.productId.toString() : "",
      winnerEmail: order.userEmail,
    },
  });

  // 7. Persist Internal Payment Record with concurrent idempotency race recovery
  let paymentRecord;
  try {
    paymentRecord = await Payment.create({
      orderId: order._id,
      productId: order.productId,
      userId: user._id,
      userEmail: user.email,
      amount: amountPaise,
      currency: "INR",
      status: "INITIATED",
      razorpayOrderId: providerOrder.id,
      idempotencyKey: sanitizedKey,
    });
  } catch (createErr) {
    if (createErr.code === 11000 && sanitizedKey) {
      // Concurrent request with same idempotencyKey created record first
      const winningPayment = await Payment.findOne({
        idempotencyKey: sanitizedKey,
      });
      if (winningPayment) {
        if (winningPayment.orderId && winningPayment.orderId.toString() !== order._id.toString()) {
          throw new PaymentError("Idempotency key collision with different order", 409, "IDEMPOTENCY_CONFLICT");
        }
        if (winningPayment.userId && winningPayment.userId.toString() !== user._id.toString()) {
          throw new PaymentError("Idempotency key collision with another user", 409, "IDEMPOTENCY_CONFLICT");
        }
        if (winningPayment.amount && winningPayment.amount !== amountPaise) {
          throw new PaymentError("Idempotency key reused with different amount", 409, "IDEMPOTENCY_CONFLICT");
        }
        if (winningPayment.razorpayOrderId) {
          return {
            success: true,
            orderId: order._id.toString(),
            paymentId: winningPayment._id.toString(),
            razorpayOrderId: winningPayment.razorpayOrderId,
            amount: winningPayment.amount,
            currency: winningPayment.currency,
            keyId: process.env.RAZORPAY_KEY_ID || "rzp_test_public_key",
            title: order.title,
            customer: {
              name: order.name,
              email: order.userEmail,
              contact: order.phoneNo,
            },
            paymentDeadline: order.paymentDeadline ? order.paymentDeadline.toISOString() : null,
            isDuplicate: true,
          };
        }
      }
    }
    throw createErr;
  }

  // Link payment attempt to order
  await Order.updateOne(
    { _id: order._id },
    {
      $set: {
        paymentId: paymentRecord._id,
        razorpayOrderId: providerOrder.id,
      },
      $inc: { paymentAttempts: 1 },
    }
  );

  return {
    success: true,
    orderId: order._id.toString(),
    paymentId: paymentRecord._id.toString(),
    razorpayOrderId: providerOrder.id,
    amount: amountPaise,
    currency: "INR",
    keyId: process.env.RAZORPAY_KEY_ID || "rzp_test_public_key",
    title: order.title,
    customer: {
      name: order.name,
      email: order.userEmail,
      contact: order.phoneNo,
    },
    paymentDeadline: order.paymentDeadline ? order.paymentDeadline.toISOString() : null,
    isDuplicate: false,
  };
}

/**
 * Core settlement engine: fulfills order and product upon cryptographic confirmation of payment.
 * Idempotent, safe under concurrent calls (checkout verify vs webhook).
 *
 * @param {Object} params
 * @param {string|ObjectId} params.orderId
 * @param {string} params.razorpayOrderId
 * @param {string} params.razorpayPaymentId
 * @param {number} params.amountPaise
 * @param {string} params.verifiedVia - "CHECKOUT_VERIFICATION" | "WEBHOOK" | "MANUAL_RECONCILIATION"
 * @param {Date} [params.now]
 * @param {Object} [params.io] - Optional Socket.IO instance
 * @returns {Promise<Object>} Fulfillment result
 */
async function settleOrderPayment({
  orderId,
  razorpayOrderId,
  razorpayPaymentId,
  amountPaise,
  verifiedVia,
  now = new Date(),
  io = null,
}) {
  const queryTime = now instanceof Date ? now : new Date(now);

  const order = await Order.findById(orderId);
  if (!order) {
    throw new PaymentError("Order not found during settlement", 404, "ORDER_NOT_FOUND");
  }

  // 1. Idempotency Check: Order already PAID
  if (order.status === "PAID") {
    const isSamePayment =
      (order.razorpayPaymentId && order.razorpayPaymentId === razorpayPaymentId) ||
      (order.razorpayOrderId && razorpayOrderId && order.razorpayOrderId === razorpayOrderId);

    if (isSamePayment) {
      // Self-healing convergence for partial crash: Ensure Product is SETTLED and Payment is CAPTURED
      if (order.productId) {
        await Product.updateOne(
          { _id: order.productId, status: { $ne: "SETTLED" } },
          { $set: { status: "SETTLED" } }
        );
      }
      if (razorpayPaymentId) {
        await Payment.updateOne(
          { razorpayPaymentId, status: { $ne: "CAPTURED" } },
          { $set: { status: "CAPTURED", verifiedVia, verifiedAt: queryTime } }
        );
      }

      return {
        success: true,
        alreadyPaid: true,
        status: "PAID",
        order,
      };
    }

    // SECOND DISTINCT PAYMENT FOR ALREADY-PAID ORDER!
    // PRESERVE BOTH RECORDS AND QUARANTINE SECONDARY PAYMENT FOR OPERATIONAL REFUND.
    const duplicateErrorMsg = `Excess payment charge: Order ${order._id} was already fulfilled with payment ${order.razorpayPaymentId}. Secondary payment ${razorpayPaymentId} (order ${razorpayOrderId}) requires operational review or refund.`;
    if (logger) {
      logger.error(`[PaymentService] ${duplicateErrorMsg}`);
    }

    let duplicatePayment = await Payment.findOne({
      $or: [
        { razorpayPaymentId },
        { razorpayOrderId: razorpayOrderId || "__none__" },
      ],
    });

    if (duplicatePayment) {
      duplicatePayment.status = "REQUIRES_RECONCILIATION";
      duplicatePayment.razorpayPaymentId = razorpayPaymentId;
      duplicatePayment.reconciliationNotes = duplicateErrorMsg;
      duplicatePayment.verifiedVia = verifiedVia;
      duplicatePayment.verifiedAt = queryTime;
      await duplicatePayment.save();
    } else {
      duplicatePayment = await Payment.create({
        orderId: order._id,
        productId: order.productId,
        userId: order.winnerId || null,
        userEmail: order.userEmail,
        amount: amountPaise,
        currency: "INR",
        status: "REQUIRES_RECONCILIATION",
        razorpayOrderId,
        razorpayPaymentId,
        verifiedVia,
        verifiedAt: queryTime,
        reconciliationNotes: duplicateErrorMsg,
      });
    }

    return {
      success: false,
      duplicateCharge: true,
      alreadyPaid: true,
      code: "DUPLICATE_PAYMENT_EXCESS_CHARGE",
      message: duplicateErrorMsg,
      order,
      payment: duplicatePayment,
    };
  }

  // 2. Validate Amount (Paise) Matches Order Authoritative Final Price
  const expectedPaise = Math.round(Number(order.finalPrice !== undefined ? order.finalPrice : order.highestBid) * 100);
  if (amountPaise !== undefined && Math.abs(expectedPaise - amountPaise) > 0) {
    const errorMsg = `Amount mismatch: expected ₹${expectedPaise / 100} (${expectedPaise} paise) but provider reported ${amountPaise} paise`;
    if (logger) logger.error(`[PaymentService] ${errorMsg}`);

    await Payment.updateMany(
      { razorpayOrderId },
      {
        $set: {
          status: "REQUIRES_RECONCILIATION",
          reconciliationNotes: errorMsg,
        },
      }
    );

    throw new PaymentError(
      "Payment amount does not match authoritative order final price",
      400,
      "AMOUNT_MISMATCH",
      { expectedPaise, receivedPaise: amountPaise }
    );
  }

  // 3. Late Payment Check (Payment captured after 24-hour deadline expired)
  // When an order is under active dispute hold, deadline expiration is suspended.
  // Payments arriving while isDisputeHoldActive = true are NOT treated as expired unless status was already EXPIRED before the hold.
  const isPastDeadline = order.paymentDeadline && queryTime.getTime() > order.paymentDeadline.getTime();
  if (order.status === "EXPIRED" || (!order.isDisputeHoldActive && isPastDeadline)) {
    const errorMsg = `Late payment captured after 24h deadline expired (deadline: ${order.paymentDeadline?.toISOString()})`;
    if (logger) logger.warn(`[PaymentService] ${errorMsg}`);

    // Do NOT silently fulfill without manual operator review. Flag for reconciliation.
    await Payment.updateMany(
      { razorpayOrderId },
      {
        $set: {
          status: "REQUIRES_RECONCILIATION",
          reconciliationNotes: errorMsg,
          razorpayPaymentId,
          verifiedVia,
          verifiedAt: queryTime,
        },
      }
    );

    throw new PaymentError(
      "Payment arrived after the 24-hour deadline expired. Quarantined for operational reconciliation.",
      400,
      "LATE_PAYMENT_QUARANTINED",
      { orderId: order._id.toString(), paymentDeadline: order.paymentDeadline?.toISOString() }
    );
  }

  // 4. Atomic Transition on Order: Only one worker can transition from 'PENDING' to 'PAID'
  const updatedOrder = await Order.findOneAndUpdate(
    {
      _id: order._id,
      status: "PENDING",
    },
    {
      $set: {
        status: "PAID",
        razorpayPaymentId,
        razorpayOrderId,
        paidAt: queryTime,
      },
    },
    { new: true }
  );

  if (!updatedOrder) {
    // Concurrently marked as PAID by racing webhook / verification call
    const refreshed = await Order.findById(order._id);
    return {
      success: true,
      alreadyPaid: true,
      status: refreshed.status,
      order: refreshed,
    };
  }

  // 5. Atomic Transition on Product: Transition ENDED -> SETTLED
  if (order.productId) {
    await Product.findOneAndUpdate(
      {
        _id: order.productId,
        status: { $in: ["ENDED", "LIVE", "Active"] },
      },
      {
        $set: {
          status: "SETTLED",
        },
      }
    );
  }

  // 6. Transition Payment Record to CAPTURED
  const paymentFilter = razorpayOrderId
    ? { razorpayOrderId }
    : razorpayPaymentId
    ? { razorpayPaymentId }
    : { orderId: order._id, status: "INITIATED" };

  await Payment.findOneAndUpdate(
    paymentFilter,
    {
      $set: {
        status: "CAPTURED",
        razorpayPaymentId,
        razorpayOrderId,
        verifiedVia,
        verifiedAt: queryTime,
      },
    },
    { new: true }
  );

  if (logger) {
    logger.info(
      `[PaymentService] Order ${order._id} successfully paid and settled via ${verifiedVia}. PaymentId: ${razorpayPaymentId}`
    );
  }

  // 6.5 Enqueue Durable Authoritative Purchase Telemetry (Outbox Pattern)
  try {
    const buyerEmail = updatedOrder.userEmail || updatedOrder.buyerEmail || order.userEmail;
    const purchasedPid = updatedOrder.productId || updatedOrder.product || order.productId;
    if (buyerEmail && purchasedPid) {
      const { enqueueAuthoritativeEvent } = require("../../../infrastructure/messaging/recommendationTrackingService");
      enqueueAuthoritativeEvent({
        email: buyerEmail,
        productId: purchasedPid.toString(),
        interactionType: "purchase",
        eventId: `purchase:${updatedOrder._id}`,
      }).catch((err) => {
        if (logger) logger.warn(`[PaymentService] Non-blocking purchase outbox enqueue notice: ${err.message}`);
      });
    }
  } catch (trackErr) {
    if (logger) logger.warn(`[PaymentService] Failed to enqueue purchase telemetry: ${trackErr.message}`);
  }

  // 7. Real-Time Broadcast after DB persistence
  if (io) {
    try {
      const payload = {
        orderId: order._id.toString(),
        productId: order.productId ? order.productId.toString() : null,
        status: "PAID",
        paidAt: queryTime.toISOString(),
      };
      io.to(order._id.toString()).emit("orderPaid", payload);
      if (order.productId) {
        io.to(order.productId.toString()).emit("auctionSettled", payload);
      }
    } catch (emitErr) {
      if (logger) logger.warn(`[PaymentService] Socket emit error on order payment: ${emitErr.message}`);
    }
  }

  return {
    success: true,
    alreadyPaid: false,
    status: "PAID",
    order: updatedOrder,
  };
}

/**
 * Verifies Razorpay checkout response submitted by frontend modal and settles order.
 *
 * @param {Object} params
 * @param {string|ObjectId} params.orderId
 * @param {string} params.razorpayOrderId
 * @param {string} params.razorpayPaymentId
 * @param {string} params.razorpaySignature
 * @param {Object} params.user
 * @param {Date} [params.now]
 * @param {Object} [params.io]
 * @returns {Promise<Object>}
 */
async function verifyCheckoutPayment({
  orderId,
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
  user,
  now = new Date(),
  io = null,
}) {
  if (!user || !user._id) {
    throw new PaymentError("Authentication required for payment verification", 401, "UNAUTHORIZED");
  }

  if (!orderId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    throw new PaymentError(
      "Missing required payment verification parameters",
      400,
      "MISSING_VERIFICATION_PARAMS"
    );
  }

  // 1. Verify Cryptographic Signature
  const isValidSig = verifyCheckoutSignature({
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
  });

  if (!isValidSig) {
    if (logger) {
      logger.warn(`[PaymentService] Invalid checkout signature on order ${orderId}`);
    }
    throw new PaymentError("Payment signature verification failed", 400, "INVALID_SIGNATURE");
  }

  // 2. Load and verify internal order
  const order = await Order.findById(orderId);
  if (!order) {
    throw new PaymentError("Order not found", 404, "ORDER_NOT_FOUND");
  }

  // Authorization check: Caller must be the winning buyer
  const isWinnerId =
    order.winnerId && order.winnerId.toString() === user._id.toString();
  const isWinnerEmail =
    order.userEmail &&
    user.email &&
    order.userEmail.trim().toLowerCase() === user.email.trim().toLowerCase();

  if (!isWinnerId && !isWinnerEmail) {
    throw new PaymentError(
      "You are not authorized to verify this order",
      403,
      "UNAUTHORIZED_PAYER"
    );
  }

  // Check matching razorpayOrderId to prevent cross-order parameter injection
  if (order.razorpayOrderId && order.razorpayOrderId !== razorpayOrderId) {
    throw new PaymentError(
      "Provider order identifier mismatch",
      400,
      "ORDER_ID_MISMATCH",
      { expected: order.razorpayOrderId, received: razorpayOrderId }
    );
  }

  // Provider-side status confirmation if provider client supports fetchPayment
  if (customProviderClient && typeof customProviderClient.fetchPayment === "function") {
    const providerPayment = await customProviderClient.fetchPayment(razorpayPaymentId);
    if (providerPayment) {
      if (providerPayment.status !== "captured" && providerPayment.status !== "authorized") {
        throw new PaymentError(
          `Provider payment is not in a captured state (status: ${providerPayment.status})`,
          400,
          "PAYMENT_NOT_CAPTURED"
        );
      }
      if (providerPayment.order_id && providerPayment.order_id !== razorpayOrderId) {
        throw new PaymentError(
          "Provider payment entity is associated with a different provider order ID",
          400,
          "ORDER_ID_MISMATCH"
        );
      }
    }
  }

  // 3. Execute Settlement
  const settlement = await settleOrderPayment({
    orderId: order._id,
    razorpayOrderId,
    razorpayPaymentId,
    amountPaise: Math.round(Number(order.finalPrice || order.highestBid) * 100),
    verifiedVia: "CHECKOUT_VERIFICATION",
    now,
    io,
  });

  return settlement;
}

/**
 * Initiates an authoritative Razorpay order for wallet top-up / add funds.
 *
 * @param {Object} params
 * @param {number} params.amountRupees - Amount in INR (must be positive number)
 * @param {Object} params.user - Authenticated user ({ _id, email, name })
 * @param {string} [params.idempotencyKey] - Optional client idempotency key
 * @param {Date} [params.now]
 * @returns {Promise<Object>} Client checkout configuration
 */
async function initiateWalletTopup({
  amountRupees,
  user,
  idempotencyKey = null,
  now = new Date(),
}) {
  const queryTime = now instanceof Date ? now : new Date(now);

  if (!user || !user._id || !user.email) {
    throw new PaymentError("Authentication required to add funds", 401, "UNAUTHORIZED");
  }

  const parsedAmount = Number(amountRupees);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    throw new PaymentError("Amount must be a positive number", 400, "INVALID_AMOUNT");
  }

  // Integer minor units: paise for INR
  const amountPaise = Math.round(parsedAmount * 100);
  if (amountPaise < 100) {
    throw new PaymentError("Minimum amount to add is ₹1.00", 400, "AMOUNT_TOO_LOW");
  }

  // Idempotency Check
  const sanitizedKey = idempotencyKey ? String(idempotencyKey).trim() : null;
  if (sanitizedKey) {
    const existingPayment = await Payment.findOne({
      idempotencyKey: sanitizedKey,
    });

    if (existingPayment) {
      if (existingPayment.userId && existingPayment.userId.toString() !== user._id.toString()) {
        throw new PaymentError("Idempotency key collision with another user", 409, "IDEMPOTENCY_CONFLICT");
      }
      if (existingPayment.amount && existingPayment.amount !== amountPaise) {
        throw new PaymentError("Idempotency key reused with different amount", 409, "IDEMPOTENCY_CONFLICT");
      }
      if (existingPayment.status === "CAPTURED") {
        return {
          success: true,
          paymentId: existingPayment._id.toString(),
          razorpayOrderId: existingPayment.razorpayOrderId,
          amount: existingPayment.amount,
          currency: existingPayment.currency,
          keyId: process.env.RAZORPAY_KEY_ID || "rzp_test_public_key",
          alreadyCaptured: true,
          isDuplicate: true,
        };
      }
      if (existingPayment.razorpayOrderId) {
        return {
          success: true,
          paymentId: existingPayment._id.toString(),
          razorpayOrderId: existingPayment.razorpayOrderId,
          amount: existingPayment.amount,
          currency: existingPayment.currency,
          keyId: process.env.RAZORPAY_KEY_ID || "rzp_test_public_key",
          isDuplicate: true,
        };
      }
    }
  }

  // Create Razorpay Order via REST API
  const receiptId = `rcpt_wallet_${user._id.toString().slice(-6)}_${Date.now().toString().slice(-6)}`;
  const providerOrder = await callRazorpayCreateOrder({
    amount: amountPaise,
    currency: "INR",
    receipt: receiptId,
    notes: {
      type: "WALLET_TOPUP",
      userId: user._id.toString(),
      userEmail: user.email,
    },
  });

  // Persist internal Payment record
  let paymentRecord;
  try {
    paymentRecord = await Payment.create({
      userId: user._id,
      userEmail: user.email,
      amount: amountPaise,
      currency: "INR",
      type: "WALLET_TOPUP",
      status: "INITIATED",
      razorpayOrderId: providerOrder.id,
      idempotencyKey: sanitizedKey,
    });
  } catch (createErr) {
    if (createErr.code === 11000 && sanitizedKey) {
      const winning = await Payment.findOne({ idempotencyKey: sanitizedKey });
      if (winning) {
        if (winning.userId && winning.userId.toString() !== user._id.toString()) {
          throw new PaymentError("Idempotency key collision with another user", 409, "IDEMPOTENCY_CONFLICT");
        }
        if (winning.amount && winning.amount !== amountPaise) {
          throw new PaymentError("Idempotency key reused with different amount", 409, "IDEMPOTENCY_CONFLICT");
        }
        return {
          success: true,
          paymentId: winning._id.toString(),
          razorpayOrderId: winning.razorpayOrderId,
          amount: winning.amount,
          currency: winning.currency,
          keyId: process.env.RAZORPAY_KEY_ID || "rzp_test_public_key",
          isDuplicate: true,
        };
      }
    }
    throw createErr;
  }

  return {
    success: true,
    paymentId: paymentRecord._id.toString(),
    razorpayOrderId: providerOrder.id,
    amount: amountPaise,
    currency: "INR",
    keyId: process.env.RAZORPAY_KEY_ID || "rzp_test_public_key",
    isDuplicate: false,
  };
}

/**
 * Authoritative wallet credit engine upon verified Razorpay payment.
 * Safe under concurrent calls and duplicate webhooks/callbacks.
 *
 * @param {Object} params
 * @param {string|ObjectId} [params.paymentId]
 * @param {string} [params.razorpayOrderId]
 * @param {string} params.razorpayPaymentId
 * @param {number} [params.amountPaise]
 * @param {string} params.verifiedVia - "CHECKOUT_VERIFICATION" | "WEBHOOK" | "MANUAL_RECONCILIATION"
 * @param {Date} [params.now]
 * @param {Object} [params.io]
 * @returns {Promise<Object>} Settlement result
 */
async function settleWalletTopup({
  paymentId,
  razorpayOrderId,
  razorpayPaymentId,
  amountPaise,
  verifiedVia,
  now = new Date(),
  io = null,
}) {
  const queryTime = now instanceof Date ? now : new Date(now);

  let payment;
  if (paymentId) {
    payment = await Payment.findById(paymentId);
  } else if (razorpayOrderId) {
    payment = await Payment.findOne({ razorpayOrderId });
  } else if (razorpayPaymentId) {
    payment = await Payment.findOne({ razorpayPaymentId });
  }

  if (!payment) {
    throw new PaymentError("Wallet payment record not found", 404, "PAYMENT_NOT_FOUND");
  }

  const paymentIdStr = payment._id.toString();
  const creditedRupees = payment.amount / 100;

  // Status check: FAILED payments must NEVER be settled or credited
  if (payment.status === "FAILED") {
    const existingTxn = await Transaction.findOne({ paymentId: payment._id });
    if (existingTxn || payment.walletCredited === true) {
      throw new PaymentError(
        "Contradictory payment state: Payment is marked FAILED but settlement artifacts exist. Blocked for audit review.",
        409,
        "CONTRADICTORY_PAYMENT_STATE"
      );
    }
    throw new PaymentError(
      `Cannot settle payment with status FAILED (reason: ${payment.failureReason || "unspecified"})`,
      400,
      "INVALID_PAYMENT_STATUS"
    );
  }

  // 1. Permanent Durable Idempotency Check:
  // Has this payment ALREADY been recorded in the permanent ledger or confirmed captured?
  const existingTxn = await Transaction.findOne({ paymentId: payment._id });
  const isPermanentlySettled = Boolean(existingTxn) || payment.walletCredited === true;

  if (isPermanentlySettled) {
    // Self-healing: if Transaction exists but wallet was NOT credited before crash
    const currentUser = await UserModel.findById(payment.userId);
    const wasAlreadyCredited =
      Boolean(currentUser?.creditedPayments && currentUser.creditedPayments.includes(paymentIdStr)) ||
      payment.walletCredited === true ||
      (payment.status === "CAPTURED" && Boolean(existingTxn));

    if (!wasAlreadyCredited) {
      await UserModel.updateOne(
        { _id: payment.userId, creditedPayments: { $ne: paymentIdStr } },
        {
          $inc: { amount: creditedRupees },
          $addToSet: { creditedPayments: paymentIdStr },
        }
      );
    } else if (!currentUser?.creditedPayments || !currentUser.creditedPayments.includes(paymentIdStr)) {
      // Self-heal historical record: ensure paymentId is permanently marked in creditedPayments
      await UserModel.updateOne(
        { _id: payment.userId },
        { $addToSet: { creditedPayments: paymentIdStr } }
      );
    }

    // Ensure Payment record is synchronized to CAPTURED status
    let synchronizedPayment = payment;
    if (payment.status !== "CAPTURED" || !payment.walletCredited) {
      synchronizedPayment = await Payment.findByIdAndUpdate(
        payment._id,
        {
          $set: {
            status: "CAPTURED",
            walletCredited: true,
            ledgerRecorded: true,
            transactionId: existingTxn?._id || payment.transactionId,
            settlementLockedUntil: null,
            settlementToken: null,
            failureReason: null,
            reconciliationNotes: null,
          },
        },
        { new: true }
      );
    }

    const user = await UserModel.findById(payment.userId);
    return {
      success: true,
      alreadyPaid: true,
      status: "CAPTURED",
      walletBalance: user ? user.amount : 0,
      creditedAmount: creditedRupees,
      payment: synchronizedPayment,
    };
  }

  // 2. Validate Amount (Paise) Matches Order Authoritative Amount
  if (amountPaise !== undefined && Math.abs(payment.amount - amountPaise) > 0) {
    const errorMsg = `Amount mismatch: expected ₹${payment.amount / 100} (${payment.amount} paise) but provider reported ${amountPaise} paise`;
    if (logger) logger.error(`[PaymentService] ${errorMsg}`);

    payment.status = "REQUIRES_RECONCILIATION";
    payment.reconciliationNotes = errorMsg;
    payment.razorpayPaymentId = razorpayPaymentId;
    await payment.save();

    throw new PaymentError(
      "Amount mismatch: Payment amount does not match authoritative order amount",
      400,
      "AMOUNT_MISMATCH",
      { expectedPaise: payment.amount, receivedPaise: amountPaise }
    );
  }

  // 3. Coordination Step: Atomically claim exclusive settlement lease with Fencing Token
  // Prevents concurrent workers from executing wallet balance mutations or duplicate transaction writes.
  const LOCK_DURATION_MS = 10000;
  const mySettlementToken = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex");
  let acquiredPayment = null;
  const leaseStartTime = Date.now();
  const MAX_LEASE_WAIT_MS = 3000;

  while (Date.now() - leaseStartTime < MAX_LEASE_WAIT_MS) {
    // Re-check permanent ledger and payment state in case another worker just finished
    const checkTxn = await Transaction.findOne({ paymentId: payment._id });
    const checkPayment = await Payment.findById(payment._id);
    if (checkTxn || checkPayment?.walletCredited === true) {
      const user = await UserModel.findById(payment.userId);
      return {
        success: true,
        alreadyPaid: true,
        status: "CAPTURED",
        walletBalance: user ? user.amount : 0,
        creditedAmount: creditedRupees,
        payment: checkPayment,
      };
    }

    acquiredPayment = await Payment.findOneAndUpdate(
      {
        _id: payment._id,
        walletCredited: { $ne: true },
        $or: [
          { settlementLockedUntil: null },
          { settlementLockedUntil: { $exists: false } },
          { settlementLockedUntil: { $lte: new Date() } },
        ],
      },
      {
        $set: {
          settlementLockedUntil: new Date(Date.now() + LOCK_DURATION_MS),
          settlementToken: mySettlementToken,
          status: "PENDING_VERIFICATION",
          razorpayPaymentId,
          ...(razorpayOrderId ? { razorpayOrderId } : {}),
          verifiedVia,
          verifiedAt: queryTime,
        },
        $inc: {
          settlementLeaseVersion: 1,
        },
      },
      { new: true }
    );

    if (acquiredPayment) {
      break;
    }

    // Another worker holds the settlement lock. Wait briefly before retrying.
    await new Promise((resolve) => setTimeout(resolve, 30));
  }

  if (!acquiredPayment) {
    const finalCheckTxn = await Transaction.findOne({ paymentId: payment._id });
    const finalCheckPayment = await Payment.findById(payment._id);
    if (finalCheckTxn || finalCheckPayment?.walletCredited === true) {
      const user = await UserModel.findById(payment.userId);
      return {
        success: true,
        alreadyPaid: true,
        status: "CAPTURED",
        walletBalance: user ? user.amount : 0,
        creditedAmount: creditedRupees,
        payment: finalCheckPayment,
      };
    }
    throw new PaymentError("Concurrent settlement in progress. Please retry.", 409, "CONCURRENT_SETTLEMENT");
  }

  payment = acquiredPayment;

  try {
    // 4. Fencing Check: Verify lease is still active and was not stolen while acquiring
    const activeLease = await Payment.findOne({
      _id: payment._id,
      settlementToken: mySettlementToken,
      settlementLockedUntil: { $gt: new Date() },
    });

    if (!activeLease) {
      // Lease expired or superseded by another worker. Fencing abort to prevent double credit.
      const refreshedUser = await UserModel.findById(payment.userId);
      const refreshedPayment = await Payment.findById(payment._id);
      return {
        success: true,
        alreadyPaid: true,
        status: refreshedPayment?.status || "CAPTURED",
        walletBalance: refreshedUser ? refreshedUser.amount : 0,
        creditedAmount: creditedRupees,
        payment: refreshedPayment,
      };
    }

    // 5. Ensure user.amount exists and is a valid number before atomic operation
    await UserModel.updateOne(
      { _id: payment.userId, $or: [{ amount: null }, { amount: { $exists: false } }] },
      { $set: { amount: 0 } }
    );

    // Check if user has an uncommitted in-flight credit from a previous crashed attempt
    const currentUser = await UserModel.findById(payment.userId);
    const wasAlreadyCreditedInUser = Boolean(
      currentUser?.creditedPayments && currentUser.creditedPayments.includes(paymentIdStr)
    );

    let wasCreditedNow = false;
    if (!wasAlreadyCreditedInUser && !payment.walletCredited) {
      // Single-document atomic mutation:
      // Coordinates wallet balance increment AND permanent creditedPayments claim.
      // If creditedPayments already includes paymentIdStr, condition fails atomically and 0 documents are modified.
      try {
        const creditResult = await UserModel.updateOne(
          {
            _id: payment.userId,
            creditedPayments: { $ne: paymentIdStr },
          },
          {
            $inc: { amount: creditedRupees },
            $addToSet: { creditedPayments: paymentIdStr },
          }
        );
        wasCreditedNow = creditResult.modifiedCount === 1;
      } catch (atomicUpdateErr) {
        // Ambiguous write handling:
        // A network timeout, socket hangup, or connection reset may have occurred AFTER MongoDB committed the write.
        // Re-read authoritative User document before deciding how to proceed.
        let verifiedUser = null;
        try {
          verifiedUser = await UserModel.findById(payment.userId);
        } catch (readErr) {
          // Database remains unavailable; cannot determine outcome. Never guess.
          throw atomicUpdateErr;
        }

        if (verifiedUser?.creditedPayments && verifiedUser.creditedPayments.includes(paymentIdStr)) {
          // Write actually committed on database before the network/driver error!
          // Permanent marker exists: DO NOT increment balance again.
          wasCreditedNow = false;
          if (logger) {
            logger.info(
              `[PaymentService] Disambiguated timeout: wallet credit for payment ${paymentIdStr} committed before connection reset`
            );
          }
        } else {
          // Marker is absent: write did not commit.
          // Do not guess or execute un-guarded writes; rethrow to leave payment in recoverable reconciliation state.
          throw atomicUpdateErr;
        }
      }
    }

    const user = await UserModel.findById(payment.userId);
    if (!user) {
      throw new Error(`User ${payment.userId} not found during wallet credit`);
    }

    if (wasCreditedNow && logger) {
      logger.info(
        `[PaymentService] Wallet credited with ₹${creditedRupees} for user ${payment.userEmail} via ${verifiedVia}. New balance: ₹${user.amount}`
      );
    }

    // 6. Durable Transaction Ledger Write with unique paymentId index protection
    let txn = await Transaction.findOne({ paymentId: payment._id });
    if (!txn) {
      try {
        txn = await Transaction.create({
          paymentId: payment._id,
          userEmail: payment.userEmail,
          name: user.name || "User",
          type: "deposit",
          amount: creditedRupees,
          date: queryTime,
        });
      } catch (txnErr) {
        if (txnErr.code === 11000) {
          // Unique-index collision! Another worker created the transaction concurrently.
          // In sound standalone MongoDB design, we NEVER blindly decrement user balance,
          // because doing so reverses legitimate credit if the completing worker relied on this credit.
          txn = await Transaction.findOne({ paymentId: payment._id });
        } else {
          throw txnErr;
        }
      }
    }

    // 7. Confirm Durable Settlement on Payment Document & Release Settlement Lease
    // Fenced with settlementToken: only the worker whose lease token is active can finalize!
    const finalPayment = await Payment.findOneAndUpdate(
      {
        _id: payment._id,
        settlementToken: mySettlementToken,
      },
      {
        $set: {
          status: "CAPTURED",
          razorpayPaymentId,
          ...(razorpayOrderId ? { razorpayOrderId } : {}),
          verifiedVia,
          verifiedAt: queryTime,
          walletCredited: true,
          walletCreditedAt: queryTime,
          ledgerRecorded: true,
          ledgerRecordedAt: queryTime,
          transactionId: txn?._id,
          settlementLockedUntil: null,
          settlementToken: null,
          failureReason: null,
          reconciliationNotes: null,
        },
      },
      { new: true }
    );

    // 8. Lease Check & Reconciliation Return:
    if (!finalPayment) {
      // Lease was superseded right before finalization.
      // Another worker finalized or claimed the payment. We do not decrement balance,
      // as the wallet credit was already performed legitimately and at-most-once.
      const refreshedUser = await UserModel.findById(payment.userId);
      const refreshedPayment = await Payment.findById(payment._id);
      return {
        success: true,
        alreadyPaid: true,
        status: refreshedPayment?.status || "CAPTURED",
        walletBalance: refreshedUser ? refreshedUser.amount : 0,
        creditedAmount: creditedRupees,
        payment: refreshedPayment,
      };
    }

    // 9. Real-Time Broadcast
    if (io) {
      try {
        io.to(payment.userId.toString()).emit("walletUpdated", {
          walletBalance: user.amount,
          creditedAmount: creditedRupees,
          paymentId: payment._id.toString(),
        });
      } catch (emitErr) {
        if (logger) logger.warn(`[PaymentService] Socket emit error on wallet update: ${emitErr.message}`);
      }
    }

    const isAlreadyPaid = wasAlreadyCreditedInUser || !wasCreditedNow;

    return {
      success: true,
      alreadyPaid: isAlreadyPaid,
      status: "CAPTURED",
      walletBalance: user.amount,
      creditedAmount: creditedRupees,
      payment: finalPayment,
    };
  } catch (dbErr) {
    if (logger) {
      logger.error(`[PaymentService] Failed to credit wallet in database: ${dbErr.message}`);
    }

    // Quarantine payment for reconciliation and release settlement lock
    try {
      await Payment.updateOne(
        { _id: payment._id },
        {
          $set: {
            status: "REQUIRES_RECONCILIATION",
            reconciliationNotes: `Failed to credit wallet in database: ${dbErr.message}`,
            razorpayPaymentId,
            verifiedVia,
            verifiedAt: queryTime,
            settlementLockedUntil: null,
            settlementToken: null,
          },
        }
      );
    } catch (quarantineErr) {
      if (logger) {
        logger.error(`[PaymentService] Failed to quarantine payment during catch: ${quarantineErr.message}`);
      }
    }

    throw new PaymentError(
      "Payment verified, but failed to update wallet balance in database. Quarantined for reconciliation.",
      500,
      "WALLET_UPDATE_FAILED",
      { paymentId: payment._id.toString(), razorpayPaymentId, recoverable: true }
    );
  }
}

/**
 * Verifies Razorpay checkout signature for wallet top-up and settles wallet credit.
 *
 * @param {Object} params
 * @param {string|ObjectId} [params.paymentId]
 * @param {string} params.razorpayOrderId
 * @param {string} params.razorpayPaymentId
 * @param {string} params.razorpaySignature
 * @param {Object} params.user
 * @param {Date} [params.now]
 * @param {Object} [params.io]
 * @returns {Promise<Object>}
 */
async function verifyWalletCheckoutPayment({
  paymentId,
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
  user,
  now = new Date(),
  io = null,
}) {
  if (!user || !user._id) {
    throw new PaymentError("Authentication required for payment verification", 401, "UNAUTHORIZED");
  }

  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    throw new PaymentError(
      "Missing required payment verification parameters",
      400,
      "MISSING_VERIFICATION_PARAMS"
    );
  }

  // 1. Cryptographic Signature Verification
  const isValidSig = verifyCheckoutSignature({
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
  });

  if (!isValidSig) {
    if (logger) {
      logger.warn(`[PaymentService] Invalid checkout signature on wallet payment: ${razorpayOrderId}`);
    }
    throw new PaymentError("Payment signature verification failed", 400, "INVALID_SIGNATURE");
  }

  // 2. Load and verify internal Payment record
  let payment;
  if (paymentId && mongoose.Types.ObjectId.isValid(paymentId)) {
    payment = await Payment.findById(paymentId);
  } else {
    payment = await Payment.findOne({ razorpayOrderId });
  }

  if (!payment) {
    throw new PaymentError("Payment record not found", 404, "PAYMENT_NOT_FOUND");
  }

  // Authorization check: Caller must be the user who initiated the payment
  if (payment.userId && payment.userId.toString() !== user._id.toString()) {
    throw new PaymentError(
      "You are not authorized to verify this payment",
      403,
      "UNAUTHORIZED_PAYER"
    );
  }

  // Check matching razorpayOrderId
  if (payment.razorpayOrderId && payment.razorpayOrderId !== razorpayOrderId) {
    throw new PaymentError(
      "Provider order identifier mismatch",
      400,
      "ORDER_ID_MISMATCH",
      { expected: payment.razorpayOrderId, received: razorpayOrderId }
    );
  }

  // Provider-side status confirmation if mock or client implements fetchPayment
  if (customProviderClient && typeof customProviderClient.fetchPayment === "function") {
    const providerPayment = await customProviderClient.fetchPayment(razorpayPaymentId);
    if (providerPayment) {
      if (providerPayment.status !== "captured" && providerPayment.status !== "authorized") {
        throw new PaymentError(
          `Provider payment is not in a captured state (status: ${providerPayment.status})`,
          400,
          "PAYMENT_NOT_CAPTURED"
        );
      }
      if (providerPayment.order_id && providerPayment.order_id !== razorpayOrderId) {
        throw new PaymentError(
          "Provider payment entity is associated with a different provider order ID",
          400,
          "ORDER_ID_MISMATCH"
        );
      }
    }
  }

  // 3. Execute Authoritative Wallet Settlement
  return await settleWalletTopup({
    paymentId: payment._id,
    razorpayOrderId,
    razorpayPaymentId,
    amountPaise: payment.amount,
    verifiedVia: "CHECKOUT_VERIFICATION",
    now,
    io,
  });
}

/**
 * Reconciles a wallet payment that was quarantined in REQUIRES_RECONCILIATION.
 *
 * @param {Object} params
 * @param {string|ObjectId} params.paymentId
 * @param {Date} [params.now]
 * @returns {Promise<Object>}
 */
async function reconcileWalletPayment({ paymentId, now = new Date() }) {
  const queryTime = now instanceof Date ? now : new Date(now);

  const payment = await Payment.findById(paymentId);
  if (!payment) {
    throw new PaymentError("Payment record not found", 404, "PAYMENT_NOT_FOUND");
  }

  const paymentIdStr = payment._id.toString();

  // Status check: FAILED payments must NEVER be reconciled or settled
  if (payment.status === "FAILED") {
    const existingTxn = await Transaction.findOne({ paymentId: payment._id });
    if (existingTxn || payment.walletCredited === true) {
      throw new PaymentError(
        "Contradictory payment state: Payment is marked FAILED but settlement artifacts exist. Blocked for audit review.",
        409,
        "CONTRADICTORY_PAYMENT_STATE"
      );
    }
    throw new PaymentError(
      `Cannot reconcile payment with status FAILED`,
      400,
      "INVALID_PAYMENT_STATUS"
    );
  }

  const reconcilableStatuses = ["REQUIRES_RECONCILIATION", "INITIATED", "PENDING_VERIFICATION", "CAPTURED"];
  if (!reconcilableStatuses.includes(payment.status)) {
    throw new PaymentError(
      `Cannot reconcile payment with status ${payment.status}`,
      400,
      "INVALID_PAYMENT_STATUS"
    );
  }

  // Check permanent ledger and payment status
  const existingTxn = await Transaction.findOne({ paymentId: payment._id });
  const isPermanentlySettled = Boolean(existingTxn) || payment.walletCredited === true;

  if (isPermanentlySettled) {
    const user = await UserModel.findById(payment.userId);
    const wasAlreadyCredited =
      Boolean(user?.creditedPayments && user.creditedPayments.includes(paymentIdStr)) ||
      payment.walletCredited === true ||
      (payment.status === "CAPTURED" && Boolean(existingTxn));

    if (!wasAlreadyCredited) {
      await UserModel.updateOne(
        { _id: payment.userId, creditedPayments: { $ne: paymentIdStr } },
        {
          $inc: { amount: payment.amount / 100 },
          $addToSet: { creditedPayments: paymentIdStr },
        }
      );
    } else if (!user?.creditedPayments || !user.creditedPayments.includes(paymentIdStr)) {
      // Self-heal historical record: ensure paymentId is permanently marked in creditedPayments
      await UserModel.updateOne(
        { _id: payment.userId },
        { $addToSet: { creditedPayments: paymentIdStr } }
      );
    }

    if (payment.status !== "CAPTURED" || !payment.walletCredited) {
      await Payment.updateOne(
        { _id: payment._id },
        {
          $set: {
            status: "CAPTURED",
            walletCredited: true,
            ledgerRecorded: true,
            transactionId: existingTxn?._id || payment.transactionId,
            settlementLockedUntil: null,
            settlementToken: null,
            failureReason: null,
            reconciliationNotes: null,
          },
        }
      );
    }
    const finalUser = await UserModel.findById(payment.userId);
    return {
      success: true,
      alreadyPaid: true,
      status: "CAPTURED",
      walletBalance: finalUser ? finalUser.amount : 0,
    };
  }

  return await settleWalletTopup({
    paymentId: payment._id,
    razorpayOrderId: payment.razorpayOrderId,
    razorpayPaymentId: payment.razorpayPaymentId || `pay_recon_${Date.now()}`,
    amountPaise: payment.amount,
    verifiedVia: "MANUAL_RECONCILIATION",
    now: queryTime,
  });
}

/**
 * Ingests and processes Razorpay webhook payloads with raw-body HMAC-SHA256 verification
 * and durable idempotency ledgering.
 *
 * @param {Object} params
 * @param {Buffer|string} params.rawBody - Raw request bytes
 * @param {string} params.signature - Header 'x-razorpay-signature'
 * @param {Date} [params.now]
 * @param {Object} [params.io]
 * @returns {Promise<Object>}
 */
async function processWebhook({
  rawBody,
  signature,
  now = new Date(),
  io = null,
}) {
  const queryTime = now instanceof Date ? now : new Date(now);

  if (!rawBody || !signature) {
    throw new PaymentError(
      "Raw request body and signature header are required for webhook processing",
      400,
      "MISSING_WEBHOOK_PAYLOAD"
    );
  }

  // 1. Verify Webhook Cryptographic Signature
  const isValid = verifyWebhookSignature({ rawBody, signature });
  if (!isValid) {
    if (logger) {
      logger.warn("[PaymentService] Webhook signature verification failed");
    }
    throw new PaymentError("Invalid webhook signature", 400, "INVALID_WEBHOOK_SIGNATURE");
  }

  // 2. Parse Webhook Event JSON
  let event;
  try {
    const rawString = Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : String(rawBody);
    event = JSON.parse(rawString);
  } catch (parseErr) {
    throw new PaymentError("Malformed webhook JSON payload", 400, "MALFORMED_WEBHOOK_JSON");
  }

  const eventId = event.id;
  const eventType = event.event;

  if (!eventId || !eventType) {
    throw new PaymentError("Missing event id or event type in webhook", 400, "INVALID_WEBHOOK_EVENT");
  }

  // 3. Durable Idempotency Enforcement via WebhookEvent collection
  let myLeaseVersion = 1;
  try {
    const created = await WebhookEvent.create({
      eventId,
      eventType,
      entityId: event.payload?.payment?.entity?.id || event.payload?.order?.entity?.id || null,
      providerOrderId: event.payload?.payment?.entity?.order_id || event.payload?.order?.entity?.id || null,
      processingStatus: "PENDING",
      leaseExpiresAt: new Date(queryTime.getTime() + 10000),
      leaseVersion: 1,
      payload: event,
    });
    myLeaseVersion = created.leaseVersion || 1;
  } catch (dbErr) {
    if (dbErr.code === 11000) {
      const existingRecord = await WebhookEvent.findOne({ eventId });
      if (existingRecord) {
        if (existingRecord.processingStatus === "PROCESSED") {
          if (logger) {
            logger.info(`[PaymentService] Duplicate webhook event ${eventId} ignored safely`);
          }
          return {
            success: true,
            duplicate: true,
            eventId,
            message: "Webhook event already processed",
          };
        }
        if (existingRecord.processingStatus === "PENDING") {
          // Check if previous worker crashed or hung (lease expired)
          const leaseCutoff = new Date(queryTime.getTime() - 5000);
          const acquired = await WebhookEvent.findOneAndUpdate(
            {
              eventId,
              processingStatus: "PENDING",
              $or: [
                { leaseExpiresAt: { $lte: queryTime } },
                { leaseExpiresAt: null },
                { updatedAt: { $lte: leaseCutoff } },
              ],
            },
            {
              $set: {
                leaseExpiresAt: new Date(queryTime.getTime() + 10000),
                updatedAt: queryTime,
              },
              $inc: {
                leaseVersion: 1,
              },
            },
            { new: true }
          );
          if (!acquired) {
            // Actively being processed by a concurrent worker
            return {
              success: true,
              duplicate: true,
              inFlight: true,
              eventId,
              message: "Webhook event currently in-flight",
            };
          }
          myLeaseVersion = acquired.leaseVersion || 2;
          if (logger) {
            logger.warn(`[PaymentService] Resuming processing of crashed/stalled webhook event ${eventId} (leaseVersion ${myLeaseVersion})`);
          }
        } else {
          return {
            success: true,
            duplicate: true,
            eventId,
            status: existingRecord.processingStatus,
          };
        }
      }
    } else {
      throw dbErr;
    }
  }

  // Fenced WebhookEvent status updater: zombie workers with expired/bumped leases cannot overwrite
  const updateEventStatus = async (status, { error = null, processedAt = null } = {}) => {
    return await WebhookEvent.updateOne(
      {
        eventId,
        processingStatus: "PENDING",
        $or: [
          { leaseVersion: myLeaseVersion },
          { leaseVersion: { $exists: false } },
        ],
      },
      {
        $set: {
          processingStatus: status,
          ...(error !== null ? { error } : {}),
          ...(processedAt !== null ? { processedAt } : {}),
        },
      }
    );
  };

  // 4. Process Event Type
  try {
    switch (eventType) {
      case "payment.captured":
      case "order.paid": {
        const paymentEntity = event.payload?.payment?.entity;
        const razorpayOrderId = paymentEntity?.order_id || event.payload?.order?.entity?.id;
        const razorpayPaymentId = paymentEntity?.id;
        const amountPaise = paymentEntity?.amount || event.payload?.order?.entity?.amount;

        if (!razorpayOrderId) {
          await updateEventStatus("IGNORED", { error: "Missing razorpayOrderId in payload" });
          return { success: true, processed: false, reason: "MISSING_ORDER_ID" };
        }

        // Find internal Order by razorpayOrderId or through Payment link
        let order = await Order.findOne({ razorpayOrderId });
        let paymentRecord = null;
        if (!order) {
          paymentRecord = await Payment.findOne({ razorpayOrderId });
          if (paymentRecord && paymentRecord.orderId) {
            order = await Order.findById(paymentRecord.orderId);
          }
        }

        // Handle WALLET_TOPUP webhook settlement
        if (!order && paymentRecord && paymentRecord.type === "WALLET_TOPUP") {
          await settleWalletTopup({
            paymentId: paymentRecord._id,
            razorpayOrderId,
            razorpayPaymentId: razorpayPaymentId || `pay_wh_${Date.now()}`,
            amountPaise,
            verifiedVia: "WEBHOOK",
            now: queryTime,
            io,
          });
          await updateEventStatus("PROCESSED", { processedAt: queryTime });
          break;
        }

        if (!order) {
          await updateEventStatus("IGNORED", { error: "No matching internal order found" });
          return { success: true, processed: false, reason: "UNKNOWN_ORDER" };
        }

        // Execute Settlement
        await settleOrderPayment({
          orderId: order._id,
          razorpayOrderId,
          razorpayPaymentId: razorpayPaymentId || `pay_wh_${Date.now()}`,
          amountPaise,
          verifiedVia: "WEBHOOK",
          now: queryTime,
          io,
        });

        await updateEventStatus("PROCESSED", { processedAt: queryTime });
        break;
      }

      case "payment.failed": {
        const paymentEntity = event.payload?.payment?.entity;
        const razorpayOrderId = paymentEntity?.order_id;
        const errorDesc = paymentEntity?.error_description || "Payment failed at gateway";

        if (razorpayOrderId) {
          // Out-of-order protection: Do not downgrade an order or payment that is already PAID/CAPTURED
          const order = await Order.findOne({ razorpayOrderId });
          if (order && order.status !== "PAID") {
            await Payment.updateMany(
              { razorpayOrderId, status: { $ne: "CAPTURED" } },
              { $set: { status: "FAILED", failureReason: errorDesc } }
            );
          } else if (!order) {
            await Payment.updateMany(
              { razorpayOrderId, status: { $ne: "CAPTURED" } },
              { $set: { status: "FAILED", failureReason: errorDesc } }
            );
          }
        }

        await updateEventStatus("PROCESSED", { processedAt: queryTime });
        break;
      }

      case "refund.created":
      case "refund.processed": {
        const refundEntity = event.payload?.refund?.entity;
        const razorpayPaymentId = refundEntity?.payment_id;

        if (razorpayPaymentId) {
          await Payment.updateMany(
            { razorpayPaymentId },
            { $set: { status: "REFUNDED", reconciliationNotes: `Refund processed: ${refundEntity?.id}` } }
          );
          const payment = await Payment.findOne({ razorpayPaymentId });
          if (payment) {
            await Order.updateOne(
              { _id: payment.orderId, status: "PAID" },
              { $set: { status: "REFUNDED" } }
            );
          }
        }

        await updateEventStatus("PROCESSED", { processedAt: queryTime });
        break;
      }

      default: {
        // Unknown or unsupported event type: mark ignored safely
        await updateEventStatus("IGNORED", { error: `Unsupported event type: ${eventType}` });
        break;
      }
    }

    return {
      success: true,
      processed: true,
      eventId,
      eventType,
    };
  } catch (err) {
    await updateEventStatus("FAILED", { error: err.message });
    throw err;
  }
}

/**
 * Reconciles any expired orders or pending payments that have exceeded the 24h deadline.
 * Also self-heals partial failures between Order and Product/Payment.
 *
 * @param {Object} options
 * @param {Date} [options.now]
 * @returns {Promise<Object>} { expiredOrdersCount, stalePaymentsCount, healedProductsCount }
 */
async function reconcilePaymentStates({ now = new Date() } = {}) {
  const queryTime = now instanceof Date ? now : new Date(now);

  // 1. Transition overdue PENDING orders to EXPIRED (orders under active dispute hold are shielded)
  const expiredResult = await Order.updateMany(
    {
      status: "PENDING",
      paymentDeadline: { $lte: queryTime },
      isDisputeHoldActive: { $ne: true },
    },
    {
      $set: { status: "EXPIRED" },
    }
  );

  // 2. Transition stale INITIATED payments past 2 hours to EXPIRED
  const twoHoursAgo = new Date(queryTime.getTime() - 2 * 60 * 60 * 1000);
  const stalePaymentResult = await Payment.updateMany(
    {
      status: "INITIATED",
      createdAt: { $lte: twoHoursAgo },
    },
    {
      $set: { status: "EXPIRED", failureReason: "Payment attempt timed out without checkout completion" },
    }
  );

  // 3. Heal partial state inconsistencies (e.g. crash between Order PAID and Product SETTLED)
  const paidOrders = await Order.find({ status: "PAID", productId: { $ne: null } }).select("productId");
  let healedProductsCount = 0;
  for (const o of paidOrders) {
    const healRes = await Product.updateOne(
      { _id: o.productId, status: { $ne: "SETTLED" } },
      { $set: { status: "SETTLED" } }
    );
    if (healRes.modifiedCount > 0) healedProductsCount++;
  }

  return {
    expiredOrdersCount: expiredResult.modifiedCount || 0,
    stalePaymentsCount: stalePaymentResult.modifiedCount || 0,
    healedProductsCount,
  };
}

module.exports = {
  PaymentError,
  setProviderClient,
  resetProviderClient,
  callRazorpayCreateOrder,
  verifyCheckoutSignature,
  verifyWebhookSignature,
  initiateOrderPayment,
  verifyCheckoutPayment,
  settleOrderPayment,
  initiateWalletTopup,
  settleWalletTopup,
  verifyWalletCheckoutPayment,
  reconcileWalletPayment,
  processWebhook,
  reconcilePaymentStates,
};
