const express = require("express");
const router = express.Router();
const subscriptionController = require("../controllers/adminSubscriptionController");
const adminAuthMiddleware = require("../../authentication/middleware/authAdminMiddleware");
const { check } = require("express-validator");

// Enforce admin authentication on subscription routes
router.use(adminAuthMiddleware);

// @route   GET /api/subscriptions
// @desc    Get all subscriptions
// @access  Private/Admin
router.get("/", subscriptionController.getSubscriptions);

// @route   GET /api/subscriptions/plans
// @desc    Get configured subscription plans with live subscriber counts
// @access  Private/Admin
router.get("/plans", subscriptionController.getPlans);

// @route   GET /api/subscriptions/:id
// @desc    Get single subscription
// @access  Private/Admin or Subscription Owner
router.get("/:id", subscriptionController.getSubscription);

// @route   POST /api/subscriptions
// @desc    Create new subscription
// @access  Private/Admin
router.post(
  "/",
  [
    check("planName", "Plan name is required").not().isEmpty(),
    check("userEmail", "Please include a valid email").isEmail(),
    check("status", "Status is required").not().isEmpty(),
    check("endDate", "End date is required").not().isEmpty(),
    check("price", "Price must be a positive number").isFloat({ min: 0 }),
    check("userId", "User ID is required").not().isEmpty(),
  ],
  subscriptionController.createSubscription
);

// @route   PUT /api/subscriptions/:id
// @desc    Update subscription
// @access  Private/Admin or Subscription Owner
router.put("/:id", subscriptionController.updateSubscription);

// @route   PUT /api/subscriptions/:id/cancel
// @desc    Cancel subscription
// @access  Private/Admin or Subscription Owner
router.put("/:id/cancel", subscriptionController.cancelSubscription);

// @route   DELETE /api/subscriptions/:id
// @desc    Delete subscription
// @access  Private/Admin
router.delete("/:id", subscriptionController.deleteSubscription);

module.exports = router;
