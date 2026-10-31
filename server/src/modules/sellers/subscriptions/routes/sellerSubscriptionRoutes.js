const express = require("express");
const router = express.Router();
const sellerSubscriptionController = require("../controllers/sellerSubscriptionController");
const { protectSellerRoute } = require("../../accounts/middleware/authSellerMiddleware");

// Public / Seller: Get available subscription plans
router.get("/plans", sellerSubscriptionController.getPlans);

// Authenticated Seller: Get current active plan & listing usage
router.get("/current", protectSellerRoute, sellerSubscriptionController.getCurrentSubscription);

// Authenticated Seller: Get billing & subscription history
router.get("/history", protectSellerRoute, sellerSubscriptionController.getSubscriptionHistory);

// Authenticated Seller: Initiate checkout (order creation)
router.post("/checkout", protectSellerRoute, sellerSubscriptionController.createCheckout);

// Authenticated Seller: Verify payment signature & authoritatively activate
router.post("/verify", protectSellerRoute, sellerSubscriptionController.verifyPayment);

// Authenticated Seller: Cancel subscription at period end
router.post("/cancel", protectSellerRoute, sellerSubscriptionController.cancelCurrentSubscription);

// Webhook endpoint (public with signature verification)
router.post("/webhook", sellerSubscriptionController.handleWebhook);

module.exports = router;
