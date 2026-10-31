const crypto = require("crypto");
const mongoose = require("mongoose");
const Subscription = require("../models/subscription");
const Seller = require("../../sellers/accounts/models/seller");
const Product = require("../../products/models/productSchema");
const Payment = require("../../payments/models/Payment");
const {
  SUBSCRIPTION_PLANS,
  SUBSCRIPTION_STATUSES,
  BILLING_INTERVALS,
  DEFAULT_PLAN_ID,
  getPlan,
  getAllPlans,
  getPlanPricing,
} = require("../../../config/payments/subscriptionPlans");
const {
  callRazorpayCreateOrder,
  verifyCheckoutSignature,
  PaymentError,
} = require("../../payments/services/paymentService");

/**
 * Determines whether mock payment adapters are explicitly allowed.
 * Strictly forbidden in production (NODE_ENV === "production").
 */
function isMockPaymentAllowed() {
  if (process.env.NODE_ENV === "production") {
    return false;
  }
  return process.env.NODE_ENV === "test" || process.env.ALLOW_MOCK_PAYMENTS === "true";
}

/**
 * Returns the authoritative subscription, plan details, and live active listing usage for a seller.
 */
async function getSellerSubscriptionDetails(sellerId, sellerEmail) {
  const normalizedEmail = (sellerEmail || "").trim().toLowerCase();
  const query = {
    $or: [],
    status: { $in: ["active", "free", "cancelled"] },
  };

  if (sellerId && mongoose.isValidObjectId(sellerId)) {
    query.$or.push({ sellerId });
  }
  if (normalizedEmail) {
    query.$or.push({ userEmail: normalizedEmail });
  }

  let activeSub = null;
  if (query.$or.length > 0) {
    activeSub = await Subscription.findOne(query).sort({ createdAt: -1 });
  }

  const now = new Date();

  // If a paid subscription has expired (including period-end cancellations past endDate), update its status
  if (
    activeSub &&
    (activeSub.status === "active" || activeSub.status === "cancelled") &&
    activeSub.endDate &&
    activeSub.endDate < now
  ) {
    activeSub.status = "expired";
    await activeSub.save();
    activeSub = null;

    // Update seller cached status
    await Seller.updateOne(
      { $or: [{ _id: sellerId }, { email: normalizedEmail }] },
      { subscriptionPlan: "free", subscriptionStatus: "expired", subscriptionExpiresAt: null }
    );
  }

  // Count active listings created by this seller
  const activeListingsCount = await Product.countDocuments({
    email: normalizedEmail,
    status: "Active",
  });

  if (!activeSub || activeSub.status === "free") {
    const freePlan = getPlan("free");
    return {
      subscription: activeSub || {
        _id: null,
        planId: "free",
        planName: freePlan.name,
        status: "free",
        price: 0,
        amountPaise: 0,
        currency: "INR",
        billingInterval: "monthly",
        listingLimit: freePlan.listingLimit,
        startDate: null,
        endDate: null,
        autoRenew: false,
        isFreeTier: true,
        features: freePlan.features,
      },
      plan: freePlan,
      usage: {
        activeListings: activeListingsCount,
        maxListings: freePlan.listingLimit,
        remaining: Math.max(0, freePlan.listingLimit - activeListingsCount),
        isLimitReached: activeListingsCount >= freePlan.listingLimit,
      },
    };
  }

  const plan = getPlan(activeSub.planId) || getPlan("free");
  const listingLimit = activeSub.listingLimit || plan.listingLimit;

  return {
    subscription: activeSub,
    plan,
    usage: {
      activeListings: activeListingsCount,
      maxListings: listingLimit,
      remaining: Math.max(0, listingLimit - activeListingsCount),
      isLimitReached: activeListingsCount >= listingLimit,
    },
  };
}

/**
 * Checks whether a seller is entitled to create a new active listing.
 * Enforces plan-based listing quotas.
 */
async function checkSellerListingEntitlement(sellerEmail) {
  const normalizedEmail = (sellerEmail || "").trim().toLowerCase();
  const subDetails = await getSellerSubscriptionDetails(null, normalizedEmail);
  const { usage, plan } = subDetails;

  if (usage.isLimitReached) {
    return {
      allowed: false,
      currentCount: usage.activeListings,
      limit: usage.maxListings,
      planName: plan.name,
      message: `Active listing limit reached for your ${plan.name} plan (${usage.activeListings}/${usage.maxListings} listings). Upgrade your membership to create more active auctions.`,
    };
  }

  return {
    allowed: true,
    currentCount: usage.activeListings,
    limit: usage.maxListings,
    planName: plan.name,
  };
}

/**
 * Initiates checkout for a seller subscription.
 * Generates an authoritative Razorpay order or handles direct free plan activation.
 */
async function initiateSubscriptionCheckout({ seller, planId, billingInterval = "monthly" }) {
  if (!seller) {
    throw new PaymentError("Seller context is required for subscription checkout", 401, "UNAUTHORIZED");
  }

  const normalizedPlanId = String(planId || "").toLowerCase().trim();
  const targetPlan = getPlan(normalizedPlanId);

  if (!targetPlan) {
    throw new PaymentError(`Unknown or invalid subscription plan: ${planId}`, 400, "INVALID_PLAN");
  }

  const normalizedInterval = billingInterval === "annual" ? "annual" : "monthly";

  // Handle Free Tier switch directly
  if (targetPlan.id === "free") {
    const existing = await Subscription.findOne({
      $or: [{ sellerId: seller._id }, { userEmail: seller.email }],
      status: "active",
    });

    if (existing) {
      existing.cancelAtPeriodEnd = true;
      existing.cancellationReason = "Downgraded to free plan";
      await existing.save();
    }

    const freeSub = await Subscription.create({
      planId: "free",
      planName: targetPlan.name,
      billingInterval: "monthly",
      userEmail: seller.email,
      sellerId: seller._id,
      status: "free",
      price: 0,
      amountPaise: 0,
      currency: "INR",
      listingLimit: targetPlan.listingLimit,
      startDate: new Date(),
      endDate: new Date(Date.now() + 3650 * 24 * 60 * 60 * 1000), // 10 years free
      features: targetPlan.features,
    });

    await Seller.updateOne(
      { _id: seller._id },
      { subscriptionPlan: "free", subscriptionStatus: "free", subscriptionExpiresAt: null }
    );

    return {
      success: true,
      isFree: true,
      message: "Switched to free Starter plan",
      subscription: freeSub,
    };
  }

  // Calculate authoritative price from server config
  const pricing = getPlanPricing(targetPlan.id, normalizedInterval);
  if (!pricing || pricing.amountPaise <= 0) {
    throw new PaymentError("Invalid plan pricing configuration", 500, "CONFIG_ERROR");
  }

  const receipt = `sub_${seller._id.toString().slice(-6)}_${Date.now()}`;
  const notes = {
    sellerId: seller._id.toString(),
    sellerEmail: seller.email,
    planId: targetPlan.id,
    billingInterval: normalizedInterval,
    type: "SELLER_SUBSCRIPTION",
  };

  let razorpayOrder;
  try {
    razorpayOrder = await callRazorpayCreateOrder({
      amount: pricing.amountPaise,
      currency: "INR",
      receipt,
      notes,
    });
  } catch (err) {
    // Only permit deterministic mock test adapter when explicitly allowed outside production
    if (isMockPaymentAllowed()) {
      const mockOrderId = `order_sub_test_${crypto.randomBytes(8).toString("hex")}`;
      razorpayOrder = {
        id: mockOrderId,
        amount: pricing.amountPaise,
        currency: "INR",
        receipt,
        status: "created",
        isTestAdapter: true,
      };
    } else {
      throw new PaymentError(
        "Payment gateway unavailable. Live gateway credentials must be configured.",
        503,
        "GATEWAY_UNAVAILABLE",
        { originalError: err.message }
      );
    }
  }

  // Create pending subscription record in DB
  const pendingSub = await Subscription.create({
    planId: targetPlan.id,
    planName: targetPlan.name,
    billingInterval: normalizedInterval,
    userEmail: seller.email,
    sellerId: seller._id,
    status: "pending",
    price: pricing.amountPaise / 100,
    amountPaise: pricing.amountPaise,
    currency: "INR",
    listingLimit: targetPlan.listingLimit,
    startDate: new Date(),
    endDate: new Date(Date.now() + (normalizedInterval === "annual" ? 365 : 30) * 24 * 60 * 60 * 1000),
    razorpayOrderId: razorpayOrder.id,
    features: targetPlan.features,
    metadata: {
      notes,
      receipt,
    },
  });

  const keyId = process.env.RAZORPAY_KEY_ID;
  if (!keyId && !isMockPaymentAllowed()) {
    throw new PaymentError("Payment gateway key is not configured.", 503, "GATEWAY_UNAVAILABLE");
  }

  return {
    success: true,
    isFree: false,
    orderId: razorpayOrder.id,
    amount: pricing.amountPaise,
    currency: "INR",
    key: keyId || (isMockPaymentAllowed() ? "rzp_test_mockKeyId" : null),
    subscriptionId: pendingSub._id,
    isTestAdapter: Boolean(razorpayOrder.isTestAdapter && isMockPaymentAllowed()),
    allowMock: isMockPaymentAllowed(),
    plan: {
      id: targetPlan.id,
      name: targetPlan.name,
      interval: normalizedInterval,
      displayPrice: pricing.displayPrice,
      listingLimit: targetPlan.listingLimit,
    },
  };
}

/**
 * Authoritatively verifies payment signature and activates the seller subscription.
 */
async function verifyAndActivateSubscription({
  seller,
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
}) {
  if (!seller) {
    throw new PaymentError("Seller context is required", 401, "UNAUTHORIZED");
  }

  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    throw new PaymentError(
      "Missing required payment verification parameters (order ID, payment ID, signature)",
      400,
      "MISSING_PARAMETERS"
    );
  }

  // Find the matching pending subscription
  const pendingSub = await Subscription.findOne({ razorpayOrderId });
  if (!pendingSub) {
    throw new PaymentError("Pending subscription order not found", 404, "ORDER_NOT_FOUND");
  }

  // Enforce IDOR protection: seller must own this pending subscription
  if (
    pendingSub.userEmail.toLowerCase() !== seller.email.toLowerCase() &&
    String(pendingSub.sellerId) !== String(seller._id)
  ) {
    throw new PaymentError("Forbidden: Unauthorized subscription access attempt", 403, "FORBIDDEN");
  }

  // Already active subscription idempotency
  if (pendingSub.status === "active") {
    return {
      success: true,
      message: "Subscription is already active",
      subscription: pendingSub,
      isIdempotent: true,
    };
  }

  // Cryptographic signature & mock bypass protection
  const isMockSig = String(razorpaySignature || "").startsWith("test_mock_sig_");
  const isMockPay = String(razorpayPaymentId || "").startsWith("pay_mock_");
  if ((isMockSig || isMockPay) && !isMockPaymentAllowed()) {
    throw new PaymentError(
      "Mock payments and mock signatures are strictly prohibited in production mode",
      403,
      "MOCK_PAYMENT_PROHIBITED"
    );
  }

  // Payment ID reuse prevention across subscriptions
  const existingPaymentReuse = await Subscription.findOne({
    razorpayPaymentId,
    status: { $in: ["active", "cancelled"] },
    _id: { $ne: pendingSub._id },
  });
  if (existingPaymentReuse) {
    throw new PaymentError(
      "Payment ID has already been utilized for another subscription",
      409,
      "PAYMENT_REUSED"
    );
  }

  // Cryptographic signature check
  let isValidSignature = false;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (keySecret) {
    isValidSignature = verifyCheckoutSignature({
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      secret: keySecret,
    });
  }

  // Fallback signature check only allowed when isMockPaymentAllowed()
  if (!isValidSignature && isMockPaymentAllowed()) {
    const testSecret = "mock_razorpay_secret_32chars_test_key";
    isValidSignature = verifyCheckoutSignature({
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      secret: testSecret,
    });

    if (!isValidSignature && isMockSig) {
      isValidSignature = true;
    }
  }

  if (!isValidSignature) {
    pendingSub.status = "failed";
    await pendingSub.save();
    throw new PaymentError("Cryptographic payment signature verification failed", 400, "INVALID_SIGNATURE");
  }

  // Calculate activation dates
  const plan = getPlan(pendingSub.planId) || getPlan("free");
  const startDate = new Date();
  const durationDays = pendingSub.billingInterval === "annual" ? 365 : 30;
  const endDate = new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000);

  // Authoritatively activate subscription atomically to prevent concurrent double-activation
  const activatedSub = await Subscription.findOneAndUpdate(
    { _id: pendingSub._id, status: "pending" },
    {
      $set: {
        status: "active",
        razorpayPaymentId,
        razorpaySignature,
        startDate,
        endDate,
        listingLimit: plan.listingLimit,
        features: plan.features,
      },
    },
    { new: true }
  );

  if (!activatedSub) {
    const current = await Subscription.findById(pendingSub._id);
    if (current && current.status === "active") {
      return {
        success: true,
        message: "Subscription is already active",
        subscription: current,
        isIdempotent: true,
      };
    }
    throw new PaymentError("Subscription activation failed: state conflict", 409, "STATE_CONFLICT");
  }

  // Cancel any older active subscriptions for this seller
  await Subscription.updateMany(
    {
      _id: { $ne: activatedSub._id },
      $or: [{ sellerId: seller._id }, { userEmail: seller.email }],
      status: "active",
    },
    {
      $set: { status: "cancelled", cancelledAt: new Date(), cancellationReason: "Superceded by upgraded plan" },
    }
  );

  // Update seller cached status
  await Seller.updateOne(
    { _id: seller._id },
    {
      subscriptionPlan: plan.id,
      subscriptionStatus: "active",
      subscriptionExpiresAt: endDate,
    }
  );

  // Record audit Payment ledger entry
  try {
    await Payment.create({
      type: "SELLER_SUBSCRIPTION",
      userId: seller._id,
      userEmail: seller.email,
      amount: activatedSub.amountPaise || activatedSub.price * 100,
      currency: activatedSub.currency || "INR",
      status: "CAPTURED",
      razorpayOrderId,
      razorpayPaymentId,
      verifiedVia: "CHECKOUT_VERIFICATION",
      verifiedAt: new Date(),
    });
  } catch (paymentErr) {
    console.error("Non-fatal: Failed to log Payment ledger for subscription:", paymentErr.message);
  }

  return {
    success: true,
    message: `Successfully upgraded to ${plan.name} membership!`,
    subscription: activatedSub,
  };
}

/**
 * Requests subscription cancellation at the end of the current billing period.
 */
async function cancelSubscription({ seller, reason = "Seller requested cancellation" }) {
  if (!seller) {
    throw new PaymentError("Seller context is required", 401, "UNAUTHORIZED");
  }

  const activeSub = await Subscription.findOne({
    $or: [{ sellerId: seller._id }, { userEmail: seller.email }],
    status: "active",
  }).sort({ createdAt: -1 });

  if (!activeSub || activeSub.planId === "free") {
    throw new PaymentError("No active paid subscription found to cancel", 400, "NO_ACTIVE_SUBSCRIPTION");
  }

  activeSub.cancelAtPeriodEnd = true;
  activeSub.cancelledAt = new Date();
  activeSub.cancellationReason = reason;
  await activeSub.save();

  return {
    success: true,
    message: "Your subscription will remain active until the end of the billing period and will not renew.",
    subscription: activeSub,
  };
}

/**
 * Retrieves paginated subscription and billing history for a seller.
 */
async function getSellerSubscriptionHistory(sellerId, sellerEmail, page = 1, limit = 10) {
  const normalizedEmail = (sellerEmail || "").trim().toLowerCase();
  const filter = {
    $or: [],
  };

  if (sellerId && mongoose.isValidObjectId(sellerId)) {
    filter.$or.push({ sellerId });
  }
  if (normalizedEmail) {
    filter.$or.push({ userEmail: normalizedEmail });
  }

  if (filter.$or.length === 0) {
    return { subscriptions: [], total: 0, page: 1, totalPages: 1 };
  }

  const skip = (Math.max(1, page) - 1) * limit;
  const [subscriptions, total] = await Promise.all([
    Subscription.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Subscription.countDocuments(filter),
  ]);

  return {
    subscriptions,
    total,
    page,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

/**
 * Idempotent Razorpay Webhook processor for subscription payment events.
 */
async function handleSubscriptionWebhook({ event, signature, rawBody }) {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET;

  if (process.env.NODE_ENV === "production") {
    if (!webhookSecret) {
      throw new PaymentError("Webhook verification secret is not configured on server", 500, "GATEWAY_SECRET_MISSING");
    }
    if (!signature) {
      throw new PaymentError("Webhook signature header is required", 401, "WEBHOOK_SIGNATURE_MISSING");
    }
  }

  if (webhookSecret && signature) {
    const rawPayload = Buffer.isBuffer(rawBody)
      ? rawBody
      : Buffer.from(typeof rawBody === "string" ? rawBody : JSON.stringify(event), "utf8");

    const expectedSig = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawPayload)
      .digest("hex");

    const expectedBuffer = Buffer.from(expectedSig);
    const receivedBuffer = Buffer.from(signature);

    if (
      expectedBuffer.length !== receivedBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
    ) {
      throw new PaymentError("Invalid webhook signature", 400, "INVALID_WEBHOOK_SIGNATURE");
    }
  }

  const eventType = event.event;
  const payload = event.payload?.payment?.entity || event.payload?.order?.entity;

  if (!payload) {
    return { success: true, processed: false, reason: "No target payload" };
  }

  const razorpayOrderId = payload.order_id || payload.id;
  if (!razorpayOrderId) {
    return { success: true, processed: false, reason: "No order ID found" };
  }

  const targetSub = await Subscription.findOne({ razorpayOrderId });
  if (!targetSub) {
    return { success: true, processed: false, reason: "No matching subscription found" };
  }

  if (targetSub.status === "active") {
    return { success: true, processed: true, message: "Subscription already active", isIdempotent: true };
  }

  if (eventType === "payment.captured" || eventType === "order.paid") {
    // Check payment ID reuse
    if (payload.id) {
      const reused = await Subscription.findOne({
        razorpayPaymentId: payload.id,
        status: { $in: ["active", "cancelled"] },
        _id: { $ne: targetSub._id },
      });
      if (reused) {
        return { success: true, processed: false, reason: "Payment ID already utilized" };
      }
    }

    const durationDays = targetSub.billingInterval === "annual" ? 365 : 30;
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000);

    const activatedWebhookSub = await Subscription.findOneAndUpdate(
      { _id: targetSub._id, status: "pending" },
      {
        $set: {
          status: "active",
          razorpayPaymentId: payload.id,
          startDate,
          endDate,
        },
      },
      { new: true }
    );

    if (!activatedWebhookSub) {
      return { success: true, processed: true, message: "Subscription already processed", isIdempotent: true };
    }

    await Seller.updateOne(
      { $or: [{ _id: targetSub.sellerId }, { email: targetSub.userEmail }] },
      { subscriptionPlan: targetSub.planId, subscriptionStatus: "active", subscriptionExpiresAt: endDate }
    );

    return { success: true, processed: true, subscription: activatedWebhookSub };
  }

  if (eventType === "payment.failed") {
    targetSub.status = "past_due";
    await targetSub.save();
    return { success: true, processed: true, status: "past_due" };
  }

  return { success: true, processed: false, reason: `Ignored event: ${eventType}` };
}

/**
 * Idempotently reconciles and marks expired subscriptions whose endDate has passed.
 * Reverts sellers to Starter Free tier.
 */
async function expireStaleSubscriptions() {
  const now = new Date();
  const expiredSubs = await Subscription.find({
    status: { $in: ["active", "cancelled"] },
    endDate: { $lt: now },
  });

  let expiredCount = 0;
  for (const sub of expiredSubs) {
    sub.status = "expired";
    await sub.save();

    await Seller.updateOne(
      { $or: [{ _id: sub.sellerId }, { email: sub.userEmail }] },
      {
        subscriptionPlan: "free",
        subscriptionStatus: "expired",
        subscriptionExpiresAt: null,
      }
    );
    expiredCount++;
  }

  return { success: true, expiredCount };
}

module.exports = {
  getSellerSubscriptionDetails,
  checkSellerListingEntitlement,
  initiateSubscriptionCheckout,
  verifyAndActivateSubscription,
  cancelSubscription,
  getSellerSubscriptionHistory,
  handleSubscriptionWebhook,
  expireStaleSubscriptions,
  isMockPaymentAllowed,
};
