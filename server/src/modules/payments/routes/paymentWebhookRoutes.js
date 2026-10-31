/**
 * Payment & Webhook Routes
 * Exposes server-authoritative Razorpay order creation, checkout verification,
 * status lookups, and raw-body webhook ingestion.
 */

const express = require("express");
const paymentRouter = express.Router();
const paymentController = require("../controllers/paymentController");
const authUserMiddleware = require("../../users/middleware/authUserMiddleware");
const { validateObjectId } = require("../../../infrastructure/security/validationMiddleware");

// Client order initiation (authenticated winner only)
paymentRouter.post(
  "/create-order",
  authUserMiddleware,
  paymentController.createPaymentOrder
);

// Client checkout signature verification (authenticated)
paymentRouter.post(
  "/verify",
  authUserMiddleware,
  paymentController.verifyPayment
);

// Order payment status lookup (authenticated buyer, seller, or admin)
paymentRouter.get(
  "/order/:orderId",
  validateObjectId("orderId"),
  authUserMiddleware,
  paymentController.getPaymentStatus
);

// Wallet top-up order initiation (authenticated user)
paymentRouter.post(
  "/wallet/create-order",
  authUserMiddleware,
  paymentController.createWalletPaymentOrder
);

// Wallet top-up verification (authenticated user)
paymentRouter.post(
  "/wallet/verify",
  authUserMiddleware,
  paymentController.verifyWalletPayment
);

// Wallet payment status lookup (authenticated user)
paymentRouter.get(
  "/wallet/:paymentId",
  validateObjectId("paymentId"),
  authUserMiddleware,
  paymentController.getWalletPaymentStatus
);

/**
 * POST /api/payment/webhook & POST /api/webhooks/razorpay
 * Webhook ingestion endpoint.
 */
paymentRouter.post("/webhook", (req, res, next) => {
  // Confirm that raw body was captured by middleware infrastructure
  if (!req.rawBody || !Buffer.isBuffer(req.rawBody)) {
    return res.status(400).json({
      success: false,
      code: "RAW_BODY_MISSING",
      message: "Webhook infrastructure error: Raw request body buffer was not captured",
    });
  }

  const signature = req.headers["x-razorpay-signature"];

  // If signature header is omitted (e.g., probe or preliminary check), return 501 confirmation
  if (!signature) {
    return res.status(501).json({
      success: false,
      code: "WEBHOOK_STAGE_4_PREREQUISITE",
      message: "Payment webhook endpoint infrastructure is ready. Signature verification requires x-razorpay-signature header.",
      rawBytesReceived: req.rawBody.length,
    });
  }

  // Full cryptographic verification and event handling
  return paymentController.handleWebhook(req, res, next);
});

module.exports = paymentRouter;
