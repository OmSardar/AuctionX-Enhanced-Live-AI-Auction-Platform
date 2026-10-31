const {
  getAllPlans,
  getPlan,
} = require("../../../../config/payments/subscriptionPlans");
const {
  getSellerSubscriptionDetails,
  initiateSubscriptionCheckout,
  verifyAndActivateSubscription,
  cancelSubscription,
  getSellerSubscriptionHistory,
  handleSubscriptionWebhook,
} = require("../../../subscriptions/services/subscriptionService");

/**
 * GET /api/seller/subscriptions/plans
 * Returns all configured seller subscription plans.
 */
exports.getPlans = async (req, res) => {
  try {
    const plans = getAllPlans();
    return res.status(200).json({
      success: true,
      plans,
    });
  } catch (error) {
    console.error("Error fetching subscription plans:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch subscription plans",
      error: error.message,
    });
  }
};

/**
 * GET /api/seller/subscriptions/current
 * Retrieves the authenticated seller's current plan and active listing usage.
 */
exports.getCurrentSubscription = async (req, res) => {
  try {
    const seller = req.seller || req.user;
    if (!seller) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Seller authentication required",
      });
    }

    // Role check: seller or admin only
    const isSeller = seller.role === "seller" || seller.isSeller;
    const isAdmin = seller.role === "admin" || seller.role === "super-admin";
    if (!isSeller && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Access denied: Seller privileges required",
      });
    }

    const details = await getSellerSubscriptionDetails(seller._id, seller.email);
    return res.status(200).json({
      success: true,
      ...details,
    });
  } catch (error) {
    console.error("Error fetching current subscription:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve current subscription status",
      error: error.message,
    });
  }
};

/**
 * GET /api/seller/subscriptions/history
 * Retrieves paginated subscription billing history for the authenticated seller.
 */
exports.getSubscriptionHistory = async (req, res) => {
  try {
    const seller = req.seller || req.user;
    if (!seller) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Seller authentication required",
      });
    }

    const isSeller = seller.role === "seller" || seller.isSeller;
    const isAdmin = seller.role === "admin" || seller.role === "super-admin";
    if (!isSeller && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Access denied: Seller privileges required",
      });
    }

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;

    const history = await getSellerSubscriptionHistory(seller._id, seller.email, page, limit);
    return res.status(200).json({
      success: true,
      ...history,
    });
  } catch (error) {
    console.error("Error fetching subscription history:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch subscription history",
      error: error.message,
    });
  }
};

/**
 * POST /api/seller/subscriptions/checkout
 * Initiates checkout for a new subscription or plan upgrade.
 */
exports.createCheckout = async (req, res) => {
  try {
    const seller = req.seller || req.user;
    if (!seller) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Seller authentication required",
      });
    }

    const isSeller = seller.role === "seller" || seller.isSeller;
    const isAdmin = seller.role === "admin" || seller.role === "super-admin";
    if (!isSeller && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Access denied: Seller privileges required",
      });
    }

    // Check suspension
    if (seller.status === "Suspended") {
      return res.status(403).json({
        success: false,
        message: "Account suspended: Subscription checkout is blocked",
        suspended: true,
      });
    }

    const { planId, billingInterval } = req.body;
    if (!planId) {
      return res.status(400).json({
        success: false,
        message: "Plan ID is required",
      });
    }

    const checkout = await initiateSubscriptionCheckout({
      seller,
      planId,
      billingInterval: billingInterval || "monthly",
    });

    return res.status(200).json(checkout);
  } catch (error) {
    console.error("Subscription checkout error:", error);
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to initiate subscription checkout",
      code: error.code || "CHECKOUT_ERROR",
    });
  }
};

/**
 * POST /api/seller/subscriptions/verify
 * Authoritatively verifies payment signature and activates the subscription.
 */
exports.verifyPayment = async (req, res) => {
  try {
    const seller = req.seller || req.user;
    if (!seller) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Seller authentication required",
      });
    }

    const isSeller = seller.role === "seller" || seller.isSeller;
    const isAdmin = seller.role === "admin" || seller.role === "super-admin";
    if (!isSeller && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Access denied: Seller privileges required",
      });
    }

    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({
        success: false,
        message: "Missing required payment verification parameters",
      });
    }

    const result = await verifyAndActivateSubscription({
      seller,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("Subscription verification error:", error);
    const statusCode = error.statusCode || 400;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Payment signature verification failed",
      code: error.code || "VERIFICATION_ERROR",
    });
  }
};

/**
 * POST /api/seller/subscriptions/cancel
 * Cancels recurring billing at the end of the current billing cycle.
 */
exports.cancelCurrentSubscription = async (req, res) => {
  try {
    const seller = req.seller || req.user;
    if (!seller) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Seller authentication required",
      });
    }

    const isSeller = seller.role === "seller" || seller.isSeller;
    const isAdmin = seller.role === "admin" || seller.role === "super-admin";
    if (!isSeller && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Access denied: Seller privileges required",
      });
    }

    const { reason } = req.body;
    const result = await cancelSubscription({
      seller,
      reason: reason || "Seller requested cancellation via dashboard",
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("Subscription cancellation error:", error);
    const statusCode = error.statusCode || 400;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to cancel subscription",
      code: error.code || "CANCELLATION_ERROR",
    });
  }
};

/**
 * POST /api/seller/subscriptions/webhook
 * Webhook handler for external Razorpay subscription events.
 */
exports.handleWebhook = async (req, res) => {
  try {
    const signature = req.headers["x-razorpay-signature"];
    const event = req.body;
    const rawBody = req.rawBody || JSON.stringify(req.body);

    const result = await handleSubscriptionWebhook({
      event,
      signature,
      rawBody,
    });

    return res.status(200).json({ received: true, ...result });
  } catch (error) {
    console.error("Webhook processing error:", error);
    const statusCode = error.statusCode || 400;
    return res.status(statusCode).json({
      success: false,
      message: error.message,
    });
  }
};
