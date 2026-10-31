const paymentService = require("../services/paymentService");
const Order = require("../../orders/models/orderSchema");
const Payment = require("../models/Payment");
const { logger } = require("../../../infrastructure/logging/loggerMiddleware");
const { recordAuthoritativeInteraction } = require("../../../infrastructure/messaging/recommendationTrackingService");

/**
 * Initiates Razorpay payment order for an Auction X order.
 * POST /api/payment/create-order
 */
exports.createPaymentOrder = async (req, res) => {
  try {
    const orderId = req.body?.orderId;
    const type = req.body?.type;

    // Delegate to wallet top-up if type is WALLET_TOPUP or orderId is omitted but amount is provided
    if (type === "WALLET_TOPUP" || (!orderId && req.body?.amount !== undefined)) {
      return exports.createWalletPaymentOrder(req, res);
    }

    const idempotencyKey =
      req.body?.idempotencyKey ||
      req.headers["idempotency-key"] ||
      req.headers["x-idempotency-key"] ||
      null;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        code: "MISSING_ORDER_ID",
        message: "Order identifier is required",
      });
    }

    const result = await paymentService.initiateOrderPayment({
      orderId,
      user: req.user,
      idempotencyKey,
      now: new Date(),
    });

    return res.status(200).json(result);
  } catch (err) {
    const statusCode = err.statusCode || 500;
    if (logger) {
      logger.error(`[PaymentController] createPaymentOrder failed: ${err.message}`, {
        code: err.code,
      });
    }
    return res.status(statusCode).json({
      success: false,
      code: err.code || "PAYMENT_INITIATION_ERROR",
      message: err.message,
      details: err.details,
    });
  }
};

/**
 * Initiates Razorpay payment order for wallet top-up / add funds.
 * POST /api/payment/wallet/create-order
 */
exports.createWalletPaymentOrder = async (req, res) => {
  try {
    const amount = req.body?.amount;
    const idempotencyKey =
      req.body?.idempotencyKey ||
      req.headers["idempotency-key"] ||
      req.headers["x-idempotency-key"] ||
      null;

    if (amount === undefined || amount === null || isNaN(amount) || Number(amount) <= 0) {
      return res.status(400).json({
        success: false,
        code: "INVALID_AMOUNT",
        message: "A valid positive amount is required to add funds",
      });
    }

    const result = await paymentService.initiateWalletTopup({
      amountRupees: Number(amount),
      user: req.user,
      idempotencyKey,
      now: new Date(),
    });

    return res.status(200).json(result);
  } catch (err) {
    const statusCode = err.statusCode || 500;
    if (logger) {
      logger.error(`[PaymentController] createWalletPaymentOrder failed: ${err.message}`, {
        code: err.code,
      });
    }
    return res.status(statusCode).json({
      success: false,
      code: err.code || "PAYMENT_INITIATION_ERROR",
      message: err.message,
      details: err.details,
    });
  }
};

/**
 * Verifies Razorpay checkout response and settles the order.
 * POST /api/payment/verify
 */
exports.verifyPayment = async (req, res) => {
  try {
    const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature, type } = req.body;

    // Delegate to wallet top-up verification if type is WALLET_TOPUP or orderId is omitted
    if (type === "WALLET_TOPUP" || (!orderId && (req.body?.paymentId || razorpayOrderId))) {
      return exports.verifyWalletPayment(req, res);
    }

    if (!orderId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({
        success: false,
        code: "MISSING_PAYMENT_CREDENTIALS",
        message: "Missing required payment verification details (orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature)",
      });
    }

    const io = req.app.get("io") || null;
    const result = await paymentService.verifyCheckoutPayment({
      orderId,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      user: req.user,
      now: new Date(),
      io,
    });

    // Record authoritative purchase interaction for recommendation engine (non-blocking)
    try {
      const purchasedPid = result.order?.productId || result.order?.product;
      const buyerEmail = req.user?.email || result.order?.buyerEmail;
      if (purchasedPid && buyerEmail) {
        recordAuthoritativeInteraction({
          email: buyerEmail,
          productId: purchasedPid,
          interactionType: "purchase",
          eventId: `purchase:${result.order?._id || orderId}`,
        }).catch(() => {});
      }
    } catch (_) {}

    return res.status(200).json({
      success: true,
      message: result.alreadyPaid ? "Payment already recorded" : "Payment verified and order fulfilled",
      status: result.status,
      order: result.order,
    });
  } catch (err) {
    const statusCode = err.statusCode || 400;
    if (logger) {
      logger.warn(`[PaymentController] verifyPayment failed: ${err.message}`, {
        code: err.code,
      });
    }
    return res.status(statusCode).json({
      success: false,
      code: err.code || "PAYMENT_VERIFICATION_FAILED",
      message: err.message,
      details: err.details,
    });
  }
};

/**
 * Handles incoming Razorpay server-to-server webhook notifications.
 * POST /api/payment/webhook & POST /api/webhooks/razorpay
 */
exports.handleWebhook = async (req, res) => {
  try {
    const rawBody = req.rawBody;
    const signature = req.headers["x-razorpay-signature"];

    if (!rawBody || !Buffer.isBuffer(rawBody)) {
      return res.status(400).json({
        success: false,
        code: "RAW_BODY_MISSING",
        message: "Webhook raw request body buffer was not captured",
      });
    }

    if (!signature) {
      return res.status(400).json({
        success: false,
        code: "MISSING_SIGNATURE",
        message: "Missing x-razorpay-signature header",
      });
    }

    const io = req.app.get("io") || null;
    const result = await paymentService.processWebhook({
      rawBody,
      signature,
      now: new Date(),
      io,
    });

    return res.status(200).json(result);
  } catch (err) {
    // Only genuine client validation errors (e.g., bad signature, malformed JSON) return 400.
    // Transient or database errors must return 500 so Razorpay webhook scheduler retries safely.
    const statusCode = (err.statusCode && err.statusCode < 500) ? err.statusCode : 500;
    if (logger) {
      logger.error(`[PaymentController] handleWebhook error: ${err.message}`, {
        statusCode,
        code: err.code,
      });
    }
    return res.status(statusCode).json({
      success: false,
      code: err.code || "WEBHOOK_PROCESSING_FAILED",
      message: err.message,
    });
  }
};

/**
 * Retrieves payment status and history for an order.
 * GET /api/payment/order/:orderId
 */
exports.getPaymentStatus = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        code: "ORDER_NOT_FOUND",
        message: "Order not found",
      });
    }

    // Authorization: User must be buyer, seller, or admin
    const isBuyer =
      (order.winnerId && order.winnerId.toString() === req.user._id.toString()) ||
      (order.userEmail && req.user.email && order.userEmail === req.user.email);
    const isSeller = order.sellerEmail && req.user.email && order.sellerEmail === req.user.email;
    const isAdmin = req.user.role === "admin";

    if (!isBuyer && !isSeller && !isAdmin) {
      return res.status(403).json({
        success: false,
        code: "FORBIDDEN",
        message: "Unauthorized to view payment status for this order",
      });
    }

    const payments = await Payment.find({ orderId }).sort({ createdAt: -1 }).lean();

    return res.status(200).json({
      success: true,
      orderId: order._id,
      orderStatus: order.status,
      paymentDeadline: order.paymentDeadline,
      finalPrice: order.finalPrice,
      highestBid: order.highestBid,
      paidAt: order.paidAt,
      paymentAttempts: order.paymentAttempts,
      payments,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      code: "SERVER_ERROR",
      message: err.message,
    });
  }
};

/**
 * Verifies Razorpay checkout response for wallet top-up and credits user balance.
 * POST /api/payment/wallet/verify
 */
exports.verifyWalletPayment = async (req, res) => {
  try {
    const { paymentId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({
        success: false,
        code: "MISSING_PAYMENT_CREDENTIALS",
        message: "Missing required payment verification details (razorpayOrderId, razorpayPaymentId, razorpaySignature)",
      });
    }

    const io = req.app.get("io") || null;
    const result = await paymentService.verifyWalletCheckoutPayment({
      paymentId,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      user: req.user,
      now: new Date(),
      io,
    });

    return res.status(200).json({
      success: true,
      message: result.alreadyPaid ? "Payment already credited" : "Payment verified and wallet credited successfully",
      status: result.status,
      walletBalance: result.walletBalance,
      creditedAmount: result.creditedAmount,
      paymentId: result.payment?._id || paymentId,
    });
  } catch (err) {
    const statusCode = err.statusCode || 400;
    if (logger) {
      logger.warn(`[PaymentController] verifyWalletPayment failed: ${err.message}`, {
        code: err.code,
      });
    }
    return res.status(statusCode).json({
      success: false,
      code: err.code || "PAYMENT_VERIFICATION_FAILED",
      message: err.message,
      details: err.details,
    });
  }
};

/**
 * Retrieves payment status for a wallet top-up attempt.
 * GET /api/payment/wallet/:paymentId
 */
exports.getWalletPaymentStatus = async (req, res) => {
  try {
    const { paymentId } = req.params;

    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({
        success: false,
        code: "PAYMENT_NOT_FOUND",
        message: "Payment record not found",
      });
    }

    // Authorization: User must be the owner of the payment attempt or an admin
    const isOwner = payment.userId && payment.userId.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        code: "FORBIDDEN",
        message: "Unauthorized to view payment status",
      });
    }

    return res.status(200).json({
      success: true,
      paymentId: payment._id,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      type: payment.type,
      razorpayOrderId: payment.razorpayOrderId,
      razorpayPaymentId: payment.razorpayPaymentId,
      verifiedVia: payment.verifiedVia,
      verifiedAt: payment.verifiedAt,
      createdAt: payment.createdAt,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      code: "SERVER_ERROR",
      message: err.message,
    });
  }
};

