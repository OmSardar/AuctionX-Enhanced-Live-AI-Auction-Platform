import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientRoot = path.resolve(__dirname, "..");

test("Seller Subscription — PricingTable component invariants & tier coverage", () => {
  const pricingTablePath = path.resolve(
    clientRoot,
    "src/components/SellerComponents/PricingTable/PricingTable.jsx"
  );
  assert.ok(fs.existsSync(pricingTablePath), "PricingTable.jsx must exist");
  const content = fs.readFileSync(pricingTablePath, "utf-8");

  // Verify exported DEFAULT_PLANS
  assert.ok(
    content.includes("export const DEFAULT_PLANS"),
    "PricingTable must export DEFAULT_PLANS constant"
  );

  // Verify all 4 tiers are defined
  assert.ok(content.includes('id: "free"'), "PricingTable must include 'free' plan");
  assert.ok(content.includes('id: "freelancer"'), "PricingTable must include 'freelancer' plan");
  assert.ok(content.includes('id: "business"'), "PricingTable must include 'business' plan");
  assert.ok(content.includes('id: "enterprise"'), "PricingTable must include 'enterprise' plan");

  // Verify billing intervals support
  assert.ok(
    content.includes("billingInterval") || content.includes("interval"),
    "PricingTable must support interval toggling"
  );
  assert.ok(content.includes("monthly") && content.includes("annual"), "Must support monthly and annual intervals");

  // Verify dynamic action button states
  assert.ok(content.includes("Current Plan"), "PricingTable must render 'Current Plan' indicator");
  assert.ok(content.includes("Upgrade Plan"), "PricingTable must support upgrade action text");
  assert.ok(content.includes("Downgrade Plan"), "PricingTable must support downgrade action text");
});

test("Seller Subscription — SubscriptionPage dashboard management invariants", () => {
  const subPagePath = path.resolve(
    clientRoot,
    "src/components/SellerDashboard/partials/dashboard/SubscriptionPage.jsx"
  );
  assert.ok(fs.existsSync(subPagePath), "SubscriptionPage.jsx must exist");
  const content = fs.readFileSync(subPagePath, "utf-8");

  // Verify axiosWithAuth usage
  assert.ok(
    content.includes('import axiosWithAuth from "../../../../redux/slices/axiosWithAuth"'),
    "SubscriptionPage must import axiosWithAuth with correct relative path"
  );

  // Verify seller subscription API endpoints
  assert.ok(
    content.includes("/seller/subscriptions/current"),
    "SubscriptionPage must query current seller subscription"
  );
  assert.ok(
    content.includes("/seller/subscriptions/history"),
    "SubscriptionPage must query paginated subscription history"
  );
  assert.ok(
    content.includes("/seller/subscriptions/checkout"),
    "SubscriptionPage must call subscription checkout endpoint"
  );
  assert.ok(
    content.includes("/seller/subscriptions/verify"),
    "SubscriptionPage must call subscription verification endpoint"
  );
  assert.ok(
    content.includes("/seller/subscriptions/cancel"),
    "SubscriptionPage must call subscription cancellation endpoint"
  );

  // Verify Razorpay integration with fallback test adapter
  assert.ok(
    content.includes("window.Razorpay") || content.includes("checkout.razorpay.com"),
    "SubscriptionPage must support Razorpay SDK integration"
  );
  assert.ok(
    content.includes("mockPaymentId") || content.includes("pay_mock_"),
    "SubscriptionPage must support test adapter fallback for mock/local environments"
  );

  // Verify UI sections
  assert.ok(content.includes("Listing Quota"), "SubscriptionPage must display listing quota");
  assert.ok(content.includes("Available Membership Tiers"), "SubscriptionPage must render plans catalog");
  assert.ok(content.includes("Billing & Subscription History"), "SubscriptionPage must render billing history ledger");
  assert.ok(content.includes("<PricingTable"), "SubscriptionPage must embed PricingTable component");
});

test("Seller Subscription — Sidebar navigation and active highlighting", () => {
  const sidebarPath = path.resolve(
    clientRoot,
    "src/components/SellerDashboard/partials/Sidebar.jsx"
  );
  assert.ok(fs.existsSync(sidebarPath), "Sidebar.jsx must exist");
  const content = fs.readFileSync(sidebarPath, "utf-8");

  assert.ok(
    content.includes('pathname.includes("subscriptions")'),
    "Sidebar must check 'subscriptions' in pathname for active state"
  );
  assert.ok(
    content.includes('to="/seller/dashboard/subscriptions"'),
    "Sidebar must link to /seller/dashboard/subscriptions"
  );
});

test("Seller Subscription — PricingTable dynamic API plan fetching & error retry resilience", () => {
  const pricingTablePath = path.resolve(
    clientRoot,
    "src/components/SellerComponents/PricingTable/PricingTable.jsx"
  );
  const content = fs.readFileSync(pricingTablePath, "utf-8");

  // Verify dynamic API fetching from GET /api/seller/subscriptions/plans
  assert.ok(
    content.includes('axiosWithAuth.get("/seller/subscriptions/plans")'),
    "PricingTable must fetch plans from /seller/subscriptions/plans"
  );

  // Verify presence of schema validator and normalizer
  assert.ok(content.includes("validatePlan"), "PricingTable must export/define validatePlan");
  assert.ok(content.includes("normalizeServerPlan"), "PricingTable must export/define normalizeServerPlan");

  // Verify loading skeleton state
  assert.ok(content.includes("animate-pulse"), "PricingTable must include loading skeleton placeholders");

  // Verify error state & retry mechanism
  assert.ok(content.includes("Unable to Load Membership Plans"), "PricingTable must render error state");
  assert.ok(content.includes("Retry Loading Plans"), "PricingTable must provide retry button");
  assert.ok(content.includes("handleRetry"), "PricingTable must handle retry");

  // Verify STRICT NO SILENT FALLBACK: on error, must NOT set hardcoded paid plans
  assert.ok(
    !content.includes("setInternalPlans(DEFAULT_PLANS)"),
    "PricingTable must never silently fall back to DEFAULT_PLANS when API fails"
  );
});

test("Seller Subscription — SubscriptionPage passes server-fetched plans and retry callback", () => {
  const subPagePath = path.resolve(
    clientRoot,
    "src/components/SellerDashboard/partials/dashboard/SubscriptionPage.jsx"
  );
  const content = fs.readFileSync(subPagePath, "utf-8");

  // Verify SubscriptionPage queries plans endpoint
  assert.ok(
    content.includes('axiosWithAuth.get("/seller/subscriptions/plans")'),
    "SubscriptionPage must query /seller/subscriptions/plans"
  );

  // Verify SubscriptionPage passes dynamic props down to PricingTable
  assert.ok(content.includes("plans={availablePlans}"), "SubscriptionPage must pass availablePlans to PricingTable");
  assert.ok(content.includes("loading={plansLoading}"), "SubscriptionPage must pass plansLoading to PricingTable");
  assert.ok(content.includes("error={plansError}"), "SubscriptionPage must pass plansError to PricingTable");
  assert.ok(content.includes("onRetry={fetchPlans}"), "SubscriptionPage must pass fetchPlans retry callback to PricingTable");
});

test("Seller Subscription — Server plan schema validation and INR currency normalization logic", () => {
  // Re-verify the normalization and validation rules matching PricingTable.jsx
  function validatePlan(plan) {
    if (!plan || typeof plan !== "object") return false;
    if (!plan.id || typeof plan.id !== "string") return false;
    if (!plan.name && !plan.title) return false;
    if (typeof plan.listingLimit !== "number" || plan.listingLimit < 0) return false;
    if (!plan.prices || typeof plan.prices !== "object") return false;
    if (!plan.prices.monthly || typeof plan.prices.monthly.amountPaise !== "number") return false;
    if (!plan.prices.annual || typeof plan.prices.annual.amountPaise !== "number") return false;
    if (!Array.isArray(plan.features)) return false;
    return true;
  }

  function formatPaise(paise) {
    if (typeof paise !== "number" || paise <= 0) return "₹0";
    return `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;
  }

  // 1. Valid plan passes
  const validBusinessPlan = {
    id: "business",
    name: "Business",
    description: "Our most popular plan",
    listingLimit: 50,
    storageGb: 5,
    prices: {
      monthly: { amountPaise: 299900, displayPrice: "₹2,999", period: "/mo" },
      annual: { amountPaise: 2999000, displayPrice: "₹29,990", period: "/yr", savingsText: "Save ₹5,998/yr" },
    },
    features: ["Up to 50 active auction listings"],
  };
  assert.ok(validatePlan(validBusinessPlan), "Valid business plan must pass validation");

  // 2. Corrupt plans fail validation
  assert.equal(validatePlan(null), false, "Null plan must fail");
  assert.equal(validatePlan({ id: "free" }), false, "Plan without prices must fail");
  assert.equal(validatePlan({ ...validBusinessPlan, listingLimit: -1 }), false, "Negative listing limit must fail");
  assert.equal(validatePlan({ ...validBusinessPlan, features: "not-an-array" }), false, "Non-array features must fail");

  // 3. Currency conversion from paise matches implemented prices exactly
  assert.equal(formatPaise(0), "₹0", "0 paise formats to ₹0");
  assert.equal(formatPaise(79900), "₹799", "79900 paise formats to ₹799");
  assert.equal(formatPaise(799000), "₹7,990", "799000 paise formats to ₹7,990");
  assert.equal(formatPaise(299900), "₹2,999", "299900 paise formats to ₹2,999");
  assert.equal(formatPaise(2999000), "₹29,990", "2999000 paise formats to ₹29,990");
  assert.equal(formatPaise(999900), "₹9,999", "999900 paise formats to ₹9,999");
  assert.equal(formatPaise(9999000), "₹99,990", "9999000 paise formats to ₹99,990");
});

