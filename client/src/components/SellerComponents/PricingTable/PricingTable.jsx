import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Check, Sparkles, Shield, Zap, ArrowRight, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import axiosWithAuth from "../../../redux/slices/axiosWithAuth";

export const DEFAULT_PLANS = [
  {
    id: "free",
    title: "Starter",
    badge: "Free Tier",
    monthlyPrice: "₹0",
    annualPrice: "₹0",
    period: { monthly: "/mo", annual: "/yr" },
    savingsText: "Free forever",
    description: "Ideal for new sellers exploring the AuctionX marketplace with basic listing limits.",
    listingLimit: 3,
    storage: "500MB storage",
    features: [
      "Up to 3 active auction listings",
      "Standard marketplace discovery",
      "Basic seller dashboard",
      "Community forum access",
      "Standard transaction processing",
    ],
    headerGradient: "from-gray-600 to-gray-800 dark:from-gray-700 dark:to-gray-900",
    buttonBg: "bg-surface border border-border text-foreground hover:bg-canvas-subtle",
    isPopular: false,
    tier: 0,
  },
  {
    id: "freelancer",
    title: "Freelancer",
    badge: "Growing Store",
    monthlyPrice: "₹799",
    annualPrice: "₹7,990",
    period: { monthly: "/mo", annual: "/yr" },
    savingsText: "Save ₹1,598/yr (17% off)",
    description: "Designed for independent artisans and boutique sellers seeking room to grow.",
    listingLimit: 15,
    storage: "1GB media storage",
    features: [
      "Up to 15 active auction listings",
      "1GB media and asset storage",
      "Standard seller support (24h response)",
      "Enhanced storefront badge",
      "Standard bidder messaging",
    ],
    headerGradient: "from-accent-dark to-primary-700",
    buttonBg: "bg-surface border border-primary text-primary hover:bg-primary/10",
    isPopular: false,
    tier: 1,
  },
  {
    id: "business",
    title: "Business",
    badge: "Most Popular",
    monthlyPrice: "₹2,999",
    annualPrice: "₹29,990",
    period: { monthly: "/mo", annual: "/yr" },
    savingsText: "Save ₹5,998/yr (17% off)",
    description: "Our most popular plan for established merchants demanding high visibility and priority tools.",
    listingLimit: 50,
    storage: "5GB media storage",
    features: [
      "Up to 50 active auction listings",
      "5GB media and asset storage",
      "Featured auction listings & badge",
      "Priority seller support (4h response)",
      "Advanced real-time sales telemetry",
      "Custom auction scheduled duration",
    ],
    headerGradient: "from-primary-600 via-primary to-accent-dark",
    buttonBg: "bg-primary text-white hover:bg-primary-hover shadow-warm-xs",
    isPopular: true,
    tier: 2,
  },
  {
    id: "enterprise",
    title: "Enterprise",
    badge: "Scale & Power",
    monthlyPrice: "₹9,999",
    annualPrice: "₹99,990",
    period: { monthly: "/mo", annual: "/yr" },
    savingsText: "Save ₹19,998/yr (17% off)",
    description: "Comprehensive storefront operations with dedicated management and maximum listing allowances.",
    listingLimit: 500,
    storage: "20GB media storage",
    features: [
      "Up to 500 active auction listings",
      "20GB media and asset storage",
      "Dedicated account manager",
      "Custom branded storefront options",
      "Priority catalog indexing & placement",
      "Full GraphQL analytics telemetry",
      "24/7 dedicated escalation support",
    ],
    headerGradient: "from-espresso to-primary-950",
    buttonBg: "bg-espresso hover:bg-espresso-dark text-white shadow-warm-xs",
    isPopular: false,
    tier: 3,
  },
];

/**
 * Validates that an API plan payload complies with authoritative pricing contract.
 */
export function validatePlan(plan) {
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

/**
 * Maps authoritative server plan schema to presentation tokens.
 */
export function normalizeServerPlan(rawPlan) {
  const tierThemes = {
    free: {
      badge: "Free Tier",
      headerGradient: "from-gray-600 to-gray-800 dark:from-gray-700 dark:to-gray-900",
      buttonBg: "bg-surface border border-border text-foreground hover:bg-canvas-subtle",
    },
    freelancer: {
      badge: "Growing Store",
      headerGradient: "from-accent-dark to-primary-700",
      buttonBg: "bg-surface border border-primary text-primary hover:bg-primary/10",
    },
    business: {
      badge: "Most Popular",
      headerGradient: "from-primary-600 via-primary to-accent-dark",
      buttonBg: "bg-primary text-white hover:bg-primary-hover shadow-warm-xs",
    },
    enterprise: {
      badge: "Scale & Power",
      headerGradient: "from-espresso to-primary-950",
      buttonBg: "bg-espresso hover:bg-espresso-dark text-white shadow-warm-xs",
    },
  };

  const id = String(rawPlan.id).toLowerCase();
  const theme = tierThemes[id] || {
    badge: rawPlan.badge || "Membership",
    headerGradient: "from-primary-600 via-primary to-accent-dark",
    buttonBg: "bg-primary text-white hover:bg-primary-hover shadow-warm-xs",
  };

  const formatPaise = (paise) => {
    if (typeof paise !== "number" || paise <= 0) return "₹0";
    return `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;
  };

  const monthlyDisplay =
    rawPlan.prices?.monthly?.displayPrice ||
    (rawPlan.prices?.monthly?.amountPaise !== undefined
      ? formatPaise(rawPlan.prices.monthly.amountPaise)
      : rawPlan.monthlyPrice || "₹0");

  const annualDisplay =
    rawPlan.prices?.annual?.displayPrice ||
    (rawPlan.prices?.annual?.amountPaise !== undefined
      ? formatPaise(rawPlan.prices.annual.amountPaise)
      : rawPlan.annualPrice || "₹0");

  const storageDisplay =
    rawPlan.storage ||
    (rawPlan.storageGb !== undefined
      ? rawPlan.storageGb >= 1
        ? `${rawPlan.storageGb}GB ${id === "free" ? "storage" : "media storage"}`
        : `${Math.round(rawPlan.storageGb * 1000)}MB storage`
      : "Standard storage");

  return {
    id,
    title: rawPlan.name || rawPlan.title,
    name: rawPlan.name || rawPlan.title,
    badge: rawPlan.badge || theme.badge,
    monthlyPrice: monthlyDisplay,
    annualPrice: annualDisplay,
    period: {
      monthly: rawPlan.prices?.monthly?.period || "/mo",
      annual: rawPlan.prices?.annual?.period || "/yr",
    },
    savingsText:
      rawPlan.prices?.annual?.savingsText ||
      rawPlan.savingsText ||
      (id === "free" ? "Free forever" : ""),
    description: rawPlan.description || "",
    listingLimit: rawPlan.listingLimit,
    storage: storageDisplay,
    features: Array.isArray(rawPlan.features) ? rawPlan.features : [],
    headerGradient: rawPlan.headerGradient || theme.headerGradient,
    buttonBg: rawPlan.buttonBg || theme.buttonBg,
    isPopular: Boolean(rawPlan.isPopular),
    tier: typeof rawPlan.tier === "number" ? rawPlan.tier : 0,
    prices: rawPlan.prices,
  };
}

export default function PricingTable({
  plans: propPlans = null,
  loading: propLoading = null,
  error: propError = null,
  onRetry = null,
  currentPlanId = null,
  billingInterval: propInterval = null,
  onToggleInterval = null,
  onSelectPlan = null,
  isDashboardView = false,
  loadingPlanId = null,
}) {
  const [internalPlans, setInternalPlans] = useState([]);
  const [internalLoading, setInternalLoading] = useState(propPlans === null);
  const [internalError, setInternalError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  const [internalInterval, setInternalInterval] = useState("monthly");
  const activeInterval = propInterval || internalInterval;

  // Auto-fetch authoritative plans when parent does not supply them
  useEffect(() => {
    if (propPlans !== null && propPlans !== undefined) {
      return;
    }

    let isMounted = true;
    const fetchPlans = async () => {
      setInternalLoading(true);
      setInternalError(null);
      try {
        const res = await axiosWithAuth.get("/seller/subscriptions/plans");
        if (!isMounted) return;

        if (
          res.data &&
          res.data.success &&
          Array.isArray(res.data.plans) &&
          res.data.plans.length > 0
        ) {
          const allValid = res.data.plans.every(validatePlan);
          if (!allValid) {
            throw new Error("One or more subscription plans failed schema validation");
          }
          setInternalPlans(res.data.plans.map(normalizeServerPlan));
        } else {
          throw new Error(res.data?.message || "Invalid plans payload from server");
        }
      } catch (err) {
        if (!isMounted) return;
        setInternalError(
          err.response?.data?.message ||
            err.message ||
            "Unable to load subscription plans from server."
        );
      } finally {
        if (isMounted) {
          setInternalLoading(false);
        }
      }
    };

    fetchPlans();
    return () => {
      isMounted = false;
    };
  }, [propPlans, retryCount]);

  const handleIntervalToggle = (val) => {
    if (onToggleInterval) {
      onToggleInterval(val);
    } else {
      setInternalInterval(val);
    }
  };

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    } else {
      setRetryCount((c) => c + 1);
    }
  };

  // Determine effective display state
  const rawPlans = propPlans !== null && propPlans !== undefined ? propPlans : internalPlans;
  const isLoading =
    propLoading !== null && propLoading !== undefined
      ? propLoading
      : propPlans === null
      ? internalLoading
      : false;
  const error =
    propError !== null && propError !== undefined
      ? propError
      : propPlans === null
      ? internalError
      : null;

  const displayPlans = Array.isArray(rawPlans) && rawPlans.length > 0
    ? rawPlans.map(normalizeServerPlan)
    : [];

  const currentTier = displayPlans.find((p) => p.id === currentPlanId)?.tier ?? -1;

  const getButtonText = (plan) => {
    if (loadingPlanId === plan.id) {
      return (
        <span className="flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Processing...
        </span>
      );
    }
    if (currentPlanId === plan.id) {
      return "Current Plan";
    }
    if (currentPlanId) {
      if (plan.tier > currentTier) {
        return "Upgrade Plan";
      }
      if (plan.tier < currentTier) {
        return plan.id === "free" ? "Downgrade to Free" : "Downgrade Plan";
      }
    }
    return plan.id === "free" ? "Start Free" : "Choose Plan";
  };

  const isCurrent = (planId) => currentPlanId === planId;

  return (
    <div
      className={`flex flex-col justify-center items-center w-full ${
        isDashboardView
          ? "py-4"
          : "min-h-screen px-4 sm:px-6 py-16 bg-canvas text-foreground"
      }`}
    >
      {/* Header section (shown when not in dashboard view) */}
      {!isDashboardView && (
        <div className="text-center mb-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider mb-3">
            <Sparkles size={14} /> Tiered Seller Membership
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold font-display tracking-tight text-foreground mb-4">
            Seller Membership Plans
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg">
            Choose the plan that fits your storefront size and boosts your auction revenue with verified listing quotas.
          </p>
        </div>
      )}

      {/* Monthly / Annual Billing Toggle */}
      <div className="flex items-center justify-center mb-10">
        <div className="flex items-center p-1 bg-surface-sunken dark:bg-gray-800 rounded-full border border-border shadow-xs">
          <button
            type="button"
            onClick={() => handleIntervalToggle("monthly")}
            className={`px-5 py-2 text-xs sm:text-sm font-semibold rounded-full transition-all duration-200 cursor-pointer ${
              activeInterval === "monthly"
                ? "bg-primary text-white shadow-warm-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Monthly Billing
          </button>
          <button
            type="button"
            onClick={() => handleIntervalToggle("annual")}
            className={`px-5 py-2 text-xs sm:text-sm font-semibold rounded-full transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
              activeInterval === "annual"
                ? "bg-primary text-white shadow-warm-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Annual Billing
            <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-accent-light dark:bg-accent-dark/40 text-accent-dark dark:text-accent-light">
              2 Mos Free
            </span>
          </button>
        </div>
      </div>

      {/* Loading Skeleton State */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full max-w-7xl items-stretch animate-pulse">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-border bg-surface overflow-hidden flex flex-col h-[520px]"
            >
              <div className="h-28 bg-surface-sunken dark:bg-gray-800" />
              <div className="p-6 space-y-4 flex-1">
                <div className="h-4 bg-surface-sunken dark:bg-gray-800 rounded w-3/4" />
                <div className="h-4 bg-surface-sunken dark:bg-gray-800 rounded w-1/2" />
                <div className="space-y-2 pt-4">
                  <div className="h-3 bg-surface-sunken dark:bg-gray-800 rounded w-full" />
                  <div className="h-3 bg-surface-sunken dark:bg-gray-800 rounded w-5/6" />
                  <div className="h-3 bg-surface-sunken dark:bg-gray-800 rounded w-4/6" />
                </div>
              </div>
              <div className="p-6">
                <div className="h-10 bg-surface-sunken dark:bg-gray-800 rounded-xl w-full" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error & Retry State — Strictly NO silent fallback to stale paid prices */}
      {!isLoading && error && (
        <div className="flex flex-col items-center justify-center p-8 text-center bg-surface rounded-2xl border border-rose-200 dark:border-rose-900/50 my-6 max-w-xl mx-auto shadow-warm-xs">
          <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-3">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-foreground mb-1">
            Unable to Load Membership Plans
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground mb-4 max-w-md">
            {typeof error === "string"
              ? error
              : "We could not fetch authoritative subscription pricing. Please check your network or try again."}
          </p>
          <button
            type="button"
            onClick={handleRetry}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-primary hover:bg-primary-hover transition-colors shadow-warm-xs cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry Loading Plans
          </button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && displayPlans.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">No subscription plans are currently available.</p>
          <button
            type="button"
            onClick={handleRetry}
            className="mt-3 px-4 py-2 rounded-xl text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 transition-colors cursor-pointer"
          >
            Refresh Plans
          </button>
        </div>
      )}

      {/* Authoritative Live Plans Grid */}
      {!isLoading && !error && displayPlans.length > 0 && (
        <motion.main
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full max-w-7xl items-stretch"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          {displayPlans.map((option) => {
            const isThisPlanCurrent = isCurrent(option.id);
            const price = activeInterval === "annual" ? option.annualPrice : option.monthlyPrice;
            const period = option.period[activeInterval];

            return (
              <motion.article
                key={option.id}
                className={`relative rounded-2xl overflow-hidden border transition-all duration-300 flex flex-col justify-between ${
                  isThisPlanCurrent
                    ? "bg-surface border-emerald-500 ring-2 ring-emerald-500/30 shadow-warm-md"
                    : option.isPopular
                    ? "bg-surface border-primary shadow-warm-lg scale-[1.02] z-10"
                    : "bg-surface border-border shadow-warm-xs hover:shadow-warm-md"
                }`}
                whileHover={{ y: -4 }}
              >
                {/* Popular / Active Badge */}
                {isThisPlanCurrent ? (
                  <div className="absolute top-0 right-0 bg-emerald-600 text-white text-[11px] font-bold uppercase tracking-wider py-1.5 px-3 rounded-bl-xl z-20 shadow-xs flex items-center gap-1">
                    <Check size={12} /> Active Plan
                  </div>
                ) : option.isPopular ? (
                  <div className="absolute top-0 right-0 bg-primary text-white text-[11px] font-bold uppercase tracking-wider py-1.5 px-3 rounded-bl-xl z-20 shadow-warm-xs flex items-center gap-1">
                    <Zap size={12} /> Popular
                  </div>
                ) : null}

                {/* Content Layer */}
                <div className="flex flex-col h-full">
                  {/* Header Section */}
                  <div className={`bg-gradient-to-r ${option.headerGradient} p-6 text-center text-white`}>
                    <p className="text-3xl sm:text-4xl font-bold font-display">
                      {price}
                      <span className="text-sm font-medium opacity-80">{period}</span>
                    </p>
                    <h3 className="uppercase font-bold tracking-wider text-sm mt-2 opacity-95">
                      {option.title}
                    </h3>
                    <div className="mt-2 text-xs font-medium text-white/80">
                      {activeInterval === "annual" ? option.savingsText : `${option.listingLimit} Active Listings`}
                    </div>
                  </div>

                  {/* Quota Highlights */}
                  <div className="px-6 pt-5 pb-2 border-b border-border-subtle bg-surface-raised/40">
                    <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                      <span>Listing Allowance:</span>
                      <span className="font-bold text-foreground">{option.listingLimit} active auctions</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground font-medium mt-1.5">
                      <span>Storage:</span>
                      <span className="font-bold text-foreground">{option.storage}</span>
                    </div>
                  </div>

                  {/* Feature List */}
                  <ul className="mt-5 mb-6 space-y-3 text-xs sm:text-sm text-foreground-secondary px-6 flex-1">
                    {option.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2.5">
                        <span className="flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold text-[10px] shrink-0 mt-0.5">
                          ✓
                        </span>
                        <span className="leading-tight">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Selection Button */}
                  <div className="flex justify-center pb-6 px-6 mt-auto">
                    <button
                      type="button"
                      disabled={isThisPlanCurrent || loadingPlanId === option.id}
                      onClick={() => onSelectPlan && onSelectPlan(option.id, activeInterval)}
                      className={`w-full py-3 px-4 rounded-xl font-semibold text-xs tracking-wider uppercase transition-all duration-200 cursor-pointer ${
                        isThisPlanCurrent
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 cursor-default"
                          : option.buttonBg
                      } disabled:opacity-75 disabled:cursor-not-allowed`}
                    >
                      {getButtonText(option)}
                    </button>
                  </div>
                </div>
              </motion.article>
            );
          })}
        </motion.main>
      )}
    </div>
  );
}
