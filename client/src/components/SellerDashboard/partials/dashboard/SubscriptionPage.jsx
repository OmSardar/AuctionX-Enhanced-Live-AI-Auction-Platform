import React, { useState, useEffect, useCallback } from "react";
import axiosWithAuth from "../../../../redux/slices/axiosWithAuth";
import PricingTable, { DEFAULT_PLANS } from "../../../SellerComponents/PricingTable/PricingTable";
import {
  CreditCard,
  ShieldCheck,
  Package,
  Calendar,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  RotateCcw,
  Sparkles,
  ArrowUpRight,
  TrendingUp,
} from "lucide-react";
import toast from "react-hot-toast";

/**
 * Loads Razorpay SDK script dynamically if not already present.
 */
function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (typeof window !== "undefined" && window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function SubscriptionPage() {
  const [loading, setLoading] = useState(true);
  const [subscriptionData, setSubscriptionData] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [billingInterval, setBillingInterval] = useState("monthly");
  const [loadingPlanId, setLoadingPlanId] = useState(null);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const [availablePlans, setAvailablePlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState(null);

  // Fetch authoritative subscription plans catalog
  const fetchPlans = useCallback(async () => {
    setPlansLoading(true);
    setPlansError(null);
    try {
      const res = await axiosWithAuth.get("/seller/subscriptions/plans");
      if (res.data && res.data.success && Array.isArray(res.data.plans) && res.data.plans.length > 0) {
        setAvailablePlans(res.data.plans);
      } else {
        throw new Error(res.data?.message || "Failed to load subscription plans");
      }
    } catch (err) {
      console.error("Error fetching subscription plans:", err);
      setPlansError(err.response?.data?.message || err.message || "Failed to load available plans");
    } finally {
      setPlansLoading(false);
    }
  }, []);

  // Fetch current subscription and usage
  const fetchSubscriptionData = useCallback(async () => {
    try {
      const res = await axiosWithAuth.get("/seller/subscriptions/current");
      if (res.data && res.data.success) {
        setSubscriptionData(res.data);
      }
    } catch (err) {
      console.error("Error fetching current subscription:", err);
      toast.error("Failed to load subscription details");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch billing & invoice history
  const fetchHistory = useCallback(async (page = 1) => {
    try {
      const res = await axiosWithAuth.get(`/seller/subscriptions/history?page=${page}&limit=5`);
      if (res.data && res.data.success) {
        setHistory(res.data.subscriptions || []);
        setHistoryTotal(res.data.totalPages || 1);
      }
    } catch (err) {
      console.error("Error fetching subscription history:", err);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
    fetchSubscriptionData();
    fetchHistory(currentPage);
  }, [fetchPlans, fetchSubscriptionData, fetchHistory, currentPage]);

  // Handle plan selection & checkout initiation
  const handleSelectPlan = async (planId, interval) => {
    setLoadingPlanId(planId);
    try {
      const res = await axiosWithAuth.post("/seller/subscriptions/checkout", {
        planId,
        billingInterval: interval || billingInterval,
      });

      if (!res.data || !res.data.success) {
        throw new Error(res.data?.message || "Failed to initiate checkout");
      }

      // If switched directly to Free tier
      if (res.data.isFree) {
        toast.success(res.data.message || "Switched to free Starter tier");
        await fetchSubscriptionData();
        await fetchHistory(1);
        setLoadingPlanId(null);
        return;
      }

      const { orderId, amount, currency, key, plan, allowMock, isTestAdapter } = res.data;

      // Attempt to load Razorpay
      const isScriptLoaded = await loadRazorpayScript();

      if (isScriptLoaded && window.Razorpay && key && !key.includes("placeholder")) {
        const options = {
          key,
          amount,
          currency: currency || "INR",
          name: "AuctionX Seller Membership",
          description: `Subscription to ${plan.name} (${interval})`,
          order_id: orderId,
          handler: async function (response) {
            try {
              toast.loading("Verifying payment...", { id: "verify-toast" });
              const verifyRes = await axiosWithAuth.post("/seller/subscriptions/verify", {
                razorpayOrderId: response.razorpay_order_id || orderId,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              });

              toast.dismiss("verify-toast");
              if (verifyRes.data && verifyRes.data.success) {
                toast.success(verifyRes.data.message || `Upgraded to ${plan.name}!`);
                await fetchSubscriptionData();
                await fetchHistory(1);
              } else {
                toast.error(verifyRes.data?.message || "Payment verification failed");
              }
            } catch (verErr) {
              toast.dismiss("verify-toast");
              console.error("Verification error:", verErr);
              toast.error(verErr.response?.data?.message || "Payment verification failed");
            }
          },
          theme: {
            color: "#C65D3A",
          },
        };

        const rzpInstance = new window.Razorpay(options);
        rzpInstance.on("payment.failed", function (failResp) {
          toast.error(failResp.error?.description || "Payment was not completed");
        });
        rzpInstance.open();
      } else if (allowMock && isTestAdapter) {
        // Fallback exclusively for local development or test mode when explicitly enabled by server
        toast.loading("Activating sandbox test subscription...", { id: "test-sub" });
        const mockPaymentId = `pay_mock_${Date.now()}`;
        const mockSig = `test_mock_sig_${orderId}`;

        const verifyRes = await axiosWithAuth.post("/seller/subscriptions/verify", {
          razorpayOrderId: orderId,
          razorpayPaymentId: mockPaymentId,
          razorpaySignature: mockSig,
        });

        toast.dismiss("test-sub");
        if (verifyRes.data && verifyRes.data.success) {
          toast.success(verifyRes.data.message || `Upgraded to ${plan.name}!`);
          await fetchSubscriptionData();
          await fetchHistory(1);
        } else {
          toast.error(verifyRes.data?.message || "Failed to activate test subscription");
        }
      } else {
        toast.error("Payment checkout could not be initialized. Please check your network or contact support.");
      }
    } catch (err) {
      console.error("Plan selection error:", err);
      toast.error(err.response?.data?.message || err.message || "Failed to start checkout");
    } finally {
      setLoadingPlanId(null);
    }
  };

  // Handle cancellation request
  const handleConfirmCancel = async () => {
    setCancelling(true);
    try {
      const res = await axiosWithAuth.post("/seller/subscriptions/cancel", {
        reason: cancelReason || "Cancelled via dashboard",
      });

      if (res.data && res.data.success) {
        toast.success(res.data.message || "Subscription cancellation scheduled");
        setCancelModalOpen(false);
        setCancelReason("");
        await fetchSubscriptionData();
        await fetchHistory(1);
      } else {
        toast.error(res.data?.message || "Failed to cancel subscription");
      }
    } catch (err) {
      console.error("Cancel error:", err);
      toast.error(err.response?.data?.message || "Failed to cancel subscription");
    } finally {
      setCancelling(false);
    }
  };

  // Helper status badge styles
  const getStatusBadge = (status) => {
    switch (String(status).toLowerCase()) {
      case "active":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800";
      case "free":
        return "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-300 dark:border-blue-800";
      case "cancelled":
        return "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-300 dark:border-amber-800";
      case "expired":
        return "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-300 dark:border-rose-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/60 dark:text-yellow-400 border border-yellow-300 dark:border-yellow-800";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border border-gray-300 dark:border-gray-700";
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium">Loading subscription details and quotas...</p>
      </div>
    );
  }

  const currentSub = subscriptionData?.subscription;
  const currentPlan =
    subscriptionData?.plan ||
    availablePlans.find((p) => p.id === (currentSub?.planId || "free")) ||
    DEFAULT_PLANS[0];
  const usage = subscriptionData?.usage || {
    activeListings: 0,
    maxListings: 3,
    remaining: 3,
    isLimitReached: false,
  };

  const usagePercent = Math.min(100, Math.round((usage.activeListings / (usage.maxListings || 1)) * 100));

  return (
    <div className="space-y-8 w-full max-w-7xl mx-auto pb-12">
      {/* Overview & Live Entitlement Banner */}
      <div className="bg-surface rounded-2xl border border-border shadow-warm-xs p-6 sm:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-border-subtle">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-2xl font-bold font-display text-foreground">
                Current Plan: {currentPlan.name}
              </h2>
              <span className={`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full ${getStatusBadge(currentSub?.status || "free")}`}>
                {currentSub?.status || "free"}
              </span>
              {currentSub?.cancelAtPeriodEnd && (
                <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2.5 py-0.5 rounded-md border border-amber-200 dark:border-amber-800">
                  Cancels at period end
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground max-w-xl">
              {currentPlan.description}
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-3">
            {currentSub && currentSub.status === "active" && !currentSub.cancelAtPeriodEnd && currentSub.planId !== "free" && (
              <button
                type="button"
                onClick={() => setCancelModalOpen(true)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900 transition-colors cursor-pointer"
              >
                Cancel Subscription
              </button>
            )}
            <a
              href="#plans-section"
              className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-primary hover:bg-primary-hover shadow-warm-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              Explore Upgrades <ArrowUpRight size={14} />
            </a>
          </div>
        </div>

        {/* Real-time Usage & Lifecycle Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-6">
          {/* Active Listings Gauge */}
          <div className="p-4 rounded-xl bg-surface-sunken border border-border-subtle flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span className="flex items-center gap-1.5 font-medium">
                  <Package size={14} className="text-primary" /> Listing Quota
                </span>
                <span className="font-bold text-foreground">
                  {usage.activeListings} / {usage.maxListings}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-border overflow-hidden mt-2">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    usagePercent >= 100
                      ? "bg-rose-500"
                      : usagePercent >= 80
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                  }`}
                  style={{ width: `${usagePercent}%` }}
                />
              </div>
            </div>
            <div className="text-[11px] text-muted-foreground mt-3 flex items-center justify-between">
              <span>{usage.remaining} listings remaining</span>
              {usage.isLimitReached && (
                <span className="text-rose-600 font-semibold flex items-center gap-0.5">
                  <AlertCircle size={10} /> Limit Full
                </span>
              )}
            </div>
          </div>

          {/* Billing Interval & Cost */}
          <div className="p-4 rounded-xl bg-surface-sunken border border-border-subtle flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span className="flex items-center gap-1.5 font-medium">
                <CreditCard size={14} className="text-primary" /> Billing Rate
              </span>
              <span className="font-bold text-foreground capitalize">
                {currentSub?.billingInterval || "Monthly"}
              </span>
            </div>
            <div className="text-2xl font-bold font-display text-foreground mt-1">
              ₹{currentSub ? (currentSub.amountPaise ? currentSub.amountPaise / 100 : currentSub.price) : 0}
              <span className="text-xs font-normal text-muted-foreground ml-1">
                /{currentSub?.billingInterval === "annual" ? "yr" : "mo"}
              </span>
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              {currentPlan.id === "free" ? "No recurring charges" : "Automated billing cycle"}
            </div>
          </div>

          {/* Current Period Start Date */}
          <div className="p-4 rounded-xl bg-surface-sunken border border-border-subtle flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span className="flex items-center gap-1.5 font-medium">
                <Calendar size={14} className="text-primary" /> Start Date
              </span>
            </div>
            <div className="text-lg font-bold text-foreground mt-1">
              {currentSub?.startDate
                ? new Date(currentSub.startDate).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : "Active"}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              Standard marketplace membership
            </div>
          </div>

          {/* Renewal / Expiry Date */}
          <div className="p-4 rounded-xl bg-surface-sunken border border-border-subtle flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span className="flex items-center gap-1.5 font-medium">
                <Clock size={14} className="text-primary" /> Renewal / Expiry
              </span>
            </div>
            <div className="text-lg font-bold text-foreground mt-1">
              {currentSub?.endDate
                ? new Date(currentSub.endDate).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : "Never Expires"}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              {currentSub?.cancelAtPeriodEnd
                ? "Downgrades to Starter after date"
                : "Prepaid term benefits (renew at period end)"}
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Plans Comparison & Upgrade Section */}
      <div id="plans-section" className="space-y-4">
        <div className="text-center max-w-xl mx-auto">
          <h3 className="text-2xl font-bold font-display text-foreground">
            Available Membership Tiers
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Upgrade anytime to unlock higher listing quotas, premium placement, and advanced telemetry.
          </p>
        </div>

        <PricingTable
          plans={availablePlans}
          loading={plansLoading}
          error={plansError}
          onRetry={fetchPlans}
          currentPlanId={currentPlan.id}
          billingInterval={billingInterval}
          onToggleInterval={setBillingInterval}
          onSelectPlan={handleSelectPlan}
          isDashboardView={true}
          loadingPlanId={loadingPlanId}
        />
      </div>

      {/* Subscription & Invoice History Ledger */}
      <div className="bg-surface rounded-2xl border border-border shadow-warm-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-border-subtle flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-primary" />
            <h4 className="font-bold text-foreground text-sm">
              Billing & Subscription History
            </h4>
          </div>
          <span className="text-xs text-muted-foreground">
            Authoritative Server Ledger
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-sunken text-muted-foreground uppercase tracking-wider font-semibold border-b border-border-subtle">
              <tr>
                <th className="px-6 py-3">Plan</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Amount</th>
                <th className="px-6 py-3">Interval</th>
                <th className="px-6 py-3">Period</th>
                <th className="px-6 py-3">Provider Order</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {history && history.length > 0 ? (
                history.map((record) => (
                  <tr key={record._id} className="hover:bg-surface-sunken/40 transition-colors">
                    <td className="px-6 py-4 font-semibold text-foreground">
                      {record.planName || record.planId}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${getStatusBadge(record.status)}`}>
                        {record.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-foreground">
                      ₹{record.amountPaise ? record.amountPaise / 100 : record.price}
                    </td>
                    <td className="px-6 py-4 capitalize text-muted-foreground">
                      {record.billingInterval || "monthly"}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {new Date(record.startDate).toLocaleDateString()} -{" "}
                      {new Date(record.endDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 font-mono text-[11px] text-muted-foreground">
                      {record.razorpayOrderId || "N/A (Free)"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedInvoice(record)}
                        className="px-3 py-1 rounded-lg text-xs font-medium text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-muted-foreground">
                    No past subscription or invoice transactions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {historyTotal > 1 && (
          <div className="px-6 py-3 border-t border-border-subtle flex items-center justify-between text-xs text-muted-foreground">
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1 rounded-md border border-border disabled:opacity-50 cursor-pointer"
            >
              Previous
            </button>
            <span>
              Page {currentPage} of {historyTotal}
            </span>
            <button
              disabled={currentPage >= historyTotal}
              onClick={() => setCurrentPage((p) => Math.min(historyTotal, p + 1))}
              className="px-3 py-1 rounded-md border border-border disabled:opacity-50 cursor-pointer"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Cancellation Confirmation Modal */}
      {cancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-surface rounded-2xl border border-border p-6 max-w-md w-full shadow-warm-lg space-y-4">
            <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
              <AlertCircle size={24} />
              <h4 className="text-lg font-bold font-display text-foreground">
                Cancel Membership Renewal?
              </h4>
            </div>

            <p className="text-xs sm:text-sm text-muted-foreground">
              Your subscription will remain active until the end of your billing cycle on{" "}
              <strong>
                {currentSub?.endDate ? new Date(currentSub.endDate).toLocaleDateString() : "period end"}
              </strong>
              . After that date, your store will revert to the Starter Free Tier (3 active listings limit).
            </p>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Feedback / Cancellation Reason (Optional)
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Let us know how we can improve..."
                className="w-full p-2.5 rounded-xl border border-border bg-surface-sunken text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                rows="3"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={cancelling}
                onClick={() => setCancelModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-foreground hover:bg-surface-sunken transition-colors cursor-pointer"
              >
                Keep Subscription
              </button>
              <button
                type="button"
                disabled={cancelling}
                onClick={handleConfirmCancel}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 transition-colors shadow-xs cursor-pointer"
              >
                {cancelling ? "Processing..." : "Confirm Cancellation"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Details Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-surface rounded-2xl border border-border p-6 max-w-md w-full shadow-warm-lg space-y-4">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <h4 className="text-base font-bold font-display text-foreground flex items-center gap-2">
                <FileText size={18} className="text-primary" /> Invoice & Receipt Details
              </h4>
              <button
                type="button"
                onClick={() => setSelectedInvoice(null)}
                className="text-muted-foreground hover:text-foreground text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-border-subtle">
                <span className="text-muted-foreground">Invoice Reference:</span>
                <span className="font-mono font-medium text-foreground">{selectedInvoice._id}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border-subtle">
                <span className="text-muted-foreground">Membership Tier:</span>
                <span className="font-bold text-foreground">{selectedInvoice.planName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border-subtle">
                <span className="text-muted-foreground">Amount Paid:</span>
                <span className="font-bold text-foreground">
                  ₹{selectedInvoice.amountPaise ? selectedInvoice.amountPaise / 100 : selectedInvoice.price}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-border-subtle">
                <span className="text-muted-foreground">Billing Interval:</span>
                <span className="capitalize text-foreground">{selectedInvoice.billingInterval || "monthly"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border-subtle">
                <span className="text-muted-foreground">Payment Provider Order:</span>
                <span className="font-mono text-foreground">{selectedInvoice.razorpayOrderId || "Internal Free Activation"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border-subtle">
                <span className="text-muted-foreground">Payment ID:</span>
                <span className="font-mono text-foreground">{selectedInvoice.razorpayPaymentId || "None"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border-subtle">
                <span className="text-muted-foreground">Valid Period:</span>
                <span className="text-foreground">
                  {new Date(selectedInvoice.startDate).toLocaleDateString()} — {new Date(selectedInvoice.endDate).toLocaleDateString()}
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-3">
              <button
                type="button"
                onClick={() => setSelectedInvoice(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-foreground bg-surface-sunken hover:bg-surface transition-colors cursor-pointer"
              >
                Close Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
