/**
 * Server-controlled authoritative configuration for AuctionX seller subscription plans.
 * All prices are defined in integer minor currency units (paise for INR).
 */

const SUBSCRIPTION_STATUSES = {
  FREE: "free",
  PENDING: "pending",
  ACTIVE: "active",
  CANCELLED: "cancelled",
  EXPIRED: "expired",
  PAST_DUE: "past_due",
  FAILED: "failed",
};

const BILLING_INTERVALS = {
  MONTHLY: "monthly",
  ANNUAL: "annual",
};

const SUBSCRIPTION_PLANS = {
  free: {
    id: "free",
    name: "Starter",
    description: "Ideal for new sellers exploring the AuctionX marketplace with basic listing limits.",
    tier: 0,
    isPopular: false,
    listingLimit: 3,
    storageGb: 0.5,
    analyticsLevel: "basic",
    prices: {
      monthly: {
        currency: "INR",
        amountPaise: 0,
        displayPrice: "₹0",
        period: "/mo",
      },
      annual: {
        currency: "INR",
        amountPaise: 0,
        displayPrice: "₹0",
        period: "/yr",
        savingsText: "Free forever",
      },
    },
    features: [
      "Up to 3 active auction listings",
      "Standard marketplace discovery",
      "Basic seller dashboard",
      "Community forum access",
      "Standard transaction processing",
    ],
  },
  freelancer: {
    id: "freelancer",
    name: "Freelancer",
    description: "Designed for independent artisans and boutique sellers seeking room to grow.",
    tier: 1,
    isPopular: false,
    listingLimit: 15,
    storageGb: 1,
    analyticsLevel: "intermediate",
    prices: {
      monthly: {
        currency: "INR",
        amountPaise: 79900, // ₹799.00
        displayPrice: "₹799",
        period: "/mo",
      },
      annual: {
        currency: "INR",
        amountPaise: 799000, // ₹7,990.00 (2 months free)
        displayPrice: "₹7,990",
        period: "/yr",
        savingsText: "Save ₹1,598/yr (~17%)",
      },
    },
    features: [
      "Up to 15 active auction listings",
      "1GB media and asset storage",
      "Standard seller support (24h response)",
      "Enhanced storefront badge",
      "Standard bidder messaging",
    ],
  },
  business: {
    id: "business",
    name: "Business",
    description: "Our most popular plan for established merchants demanding high visibility and priority tools.",
    tier: 2,
    isPopular: true,
    listingLimit: 50,
    storageGb: 5,
    analyticsLevel: "advanced",
    prices: {
      monthly: {
        currency: "INR",
        amountPaise: 299900, // ₹2,999.00
        displayPrice: "₹2,999",
        period: "/mo",
      },
      annual: {
        currency: "INR",
        amountPaise: 2999000, // ₹29,990.00 (2 months free)
        displayPrice: "₹29,990",
        period: "/yr",
        savingsText: "Save ₹5,998/yr (~17%)",
      },
    },
    features: [
      "Up to 50 active auction listings",
      "5GB media and asset storage",
      "Featured auction listings & badge",
      "Priority seller support (4h response)",
      "Advanced real-time sales telemetry",
      "Custom auction scheduled duration",
    ],
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    description: "Comprehensive storefront operations with dedicated management and maximum listing allowances.",
    tier: 3,
    isPopular: false,
    listingLimit: 500,
    storageGb: 20,
    analyticsLevel: "dedicated",
    prices: {
      monthly: {
        currency: "INR",
        amountPaise: 999900, // ₹9,999.00
        displayPrice: "₹9,999",
        period: "/mo",
      },
      annual: {
        currency: "INR",
        amountPaise: 9999000, // ₹99,990.00 (2 months free)
        displayPrice: "₹99,990",
        period: "/yr",
        savingsText: "Save ₹19,998/yr (~17%)",
      },
    },
    features: [
      "Up to 500 active auction listings",
      "20GB media and asset storage",
      "Dedicated account manager",
      "Custom branded storefront options",
      "Priority catalog indexing & placement",
      "Full GraphQL analytics telemetry",
      "24/7 dedicated escalation support",
    ],
  },
};

const DEFAULT_PLAN_ID = "free";

function getPlan(planId) {
  if (!planId) return SUBSCRIPTION_PLANS[DEFAULT_PLAN_ID];
  const normalizedId = String(planId).toLowerCase().trim();
  return SUBSCRIPTION_PLANS[normalizedId] || null;
}

function getAllPlans() {
  return Object.values(SUBSCRIPTION_PLANS);
}

function getPlanPricing(planId, interval = "monthly") {
  const plan = getPlan(planId);
  if (!plan) return null;
  const normalizedInterval = interval === "annual" ? "annual" : "monthly";
  return {
    planId: plan.id,
    name: plan.name,
    interval: normalizedInterval,
    listingLimit: plan.listingLimit,
    ...plan.prices[normalizedInterval],
  };
}

module.exports = {
  SUBSCRIPTION_PLANS,
  SUBSCRIPTION_STATUSES,
  BILLING_INTERVALS,
  DEFAULT_PLAN_ID,
  getPlan,
  getAllPlans,
  getPlanPricing,
};
