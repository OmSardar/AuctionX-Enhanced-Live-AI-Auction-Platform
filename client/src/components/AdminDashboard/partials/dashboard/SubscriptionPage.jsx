import React, { useState, useEffect, useCallback } from "react";
import axiosWithAuth from "../../../../redux/slices/axiosWithAuth";
import { Package, Shield, Sparkles, Check, AlertCircle, XCircle, Search, Filter, RefreshCw, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

function SubscriptionPage() {
  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);

  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);

  // Filters
  const [searchEmail, setSearchEmail] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");

  // Selected subscription for details modal
  const [selectedSubscription, setSelectedSubscription] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const limit = 8;

  // Fetch plan definitions
  const fetchPlans = useCallback(async () => {
    setPlansLoading(true);
    try {
      const res = await axiosWithAuth.get("/subscriptions/plans");
      if (res.data && res.data.success && Array.isArray(res.data.plans)) {
        setPlans(res.data.plans);
      }
    } catch (err) {
      console.error("Error fetching admin subscription plans:", err);
    } finally {
      setPlansLoading(false);
    }
  }, []);

  // Fetch subscriptions
  const fetchSubscriptions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage,
        limit,
      });
      if (searchEmail.trim()) params.append("userEmail", searchEmail.trim());
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (planFilter !== "all") params.append("planId", planFilter);

      const response = await axiosWithAuth.get(`/subscriptions?${params.toString()}`);

      if (response.data && response.data.subscriptions) {
        setSubscriptions(response.data.subscriptions);
        setTotalPages(response.data.pages || 1);
      } else if (Array.isArray(response.data)) {
        setSubscriptions(response.data);
        setTotalPages(Math.ceil(response.data.length / limit) || 1);
      } else {
        setSubscriptions([]);
      }
    } catch (err) {
      console.error("Error fetching subscriptions:", err);
      setSubscriptions([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchEmail, statusFilter, planFilter]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  // Handle Admin Cancellation
  const handleAdminCancel = async () => {
    if (!selectedSubscription) return;
    setCancelling(true);
    try {
      const res = await axiosWithAuth.put(`/subscriptions/${selectedSubscription._id}/cancel`, {
        reason: cancelReason || "Cancelled by platform administrator",
      });
      if (res.data && res.data.success) {
        toast.success("Subscription cancelled and seller listing quota reverted to Free tier");
        setSelectedSubscription(null);
        setCancelReason("");
        await fetchSubscriptions();
        await fetchPlans();
      } else {
        toast.error(res.data?.error || "Failed to cancel subscription");
      }
    } catch (err) {
      console.error("Admin cancel error:", err);
      toast.error(err.response?.data?.error || "Failed to cancel subscription");
    } finally {
      setCancelling(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (String(status || "").toLowerCase()) {
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

  const formatPrice = (sub) => {
    if (sub.amountPaise !== undefined && sub.amountPaise !== null && sub.amountPaise > 0) {
      return `₹${Math.round(sub.amountPaise / 100).toLocaleString("en-IN")}`;
    }
    if (typeof sub.price === "number") {
      return `₹${sub.price.toLocaleString("en-IN")}`;
    }
    return "₹0";
  };

  return (
    <div className="space-y-8 w-full">
      {/* 1. Subscription Plans Overview Cards */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold font-display text-foreground flex items-center gap-2">
            <Sparkles size={20} className="text-primary" /> Active Platform Plans & Quotas
          </h2>
          <span className="text-xs text-muted-foreground">Authoritative Plans Config</span>
        </div>

        {plansLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-36 rounded-2xl bg-surface border border-border" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className="bg-surface rounded-2xl border border-border p-5 shadow-warm-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-foreground text-base">{plan.name}</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      {plan.activeSubscribers || 0} Active
                    </span>
                  </div>
                  <p className="text-2xl font-bold font-display text-foreground">
                    {plan.prices?.monthly?.displayPrice || "₹0"}
                    <span className="text-xs font-normal text-muted-foreground ml-1">/mo</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{plan.description}</p>
                </div>
                <div className="pt-3 border-t border-border-subtle mt-3 text-xs text-muted-foreground flex justify-between">
                  <span>Quota: <strong className="text-foreground">{plan.listingLimit} active</strong></span>
                  <span>Tier: <strong className="text-foreground">{plan.tier}</strong></span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. Subscriptions Management Table */}
      <div className="bg-surface rounded-2xl border border-border shadow-warm-xs overflow-hidden">
        {/* Table Header & Controls */}
        <div className="p-5 border-b border-border-subtle flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-foreground text-lg">Seller Subscriptions</h3>
            <p className="text-xs text-muted-foreground">Inspect, govern, and cancel merchant memberships</p>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by seller email..."
                value={searchEmail}
                onChange={(e) => {
                  setSearchEmail(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-9 pr-3 py-1.5 rounded-xl border border-border bg-surface-sunken text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-52 sm:w-60"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-1.5 rounded-xl border border-border bg-surface-sunken text-xs text-foreground focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="free">Free</option>
              <option value="cancelled">Cancelled</option>
              <option value="expired">Expired</option>
              <option value="pending">Pending</option>
            </select>

            <select
              value={planFilter}
              onChange={(e) => {
                setPlanFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-1.5 rounded-xl border border-border bg-surface-sunken text-xs text-foreground focus:outline-none"
            >
              <option value="all">All Plans</option>
              <option value="free">Starter</option>
              <option value="freelancer">Freelancer</option>
              <option value="business">Business</option>
              <option value="enterprise">Enterprise</option>
            </select>

            <button
              type="button"
              onClick={() => {
                fetchSubscriptions();
                fetchPlans();
              }}
              className="p-2 rounded-xl border border-border bg-surface hover:bg-surface-sunken transition-colors cursor-pointer text-muted-foreground hover:text-foreground"
              title="Refresh"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-sunken text-muted-foreground uppercase tracking-wider font-semibold border-b border-border-subtle">
              <tr>
                <th className="px-6 py-3">Plan</th>
                <th className="px-6 py-3">Seller Email</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Interval</th>
                <th className="px-6 py-3">Price</th>
                <th className="px-6 py-3">Valid Period</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                    Loading subscriptions...
                  </td>
                </tr>
              ) : subscriptions && subscriptions.length > 0 ? (
                subscriptions.map((sub) => (
                  <tr key={sub._id} className="hover:bg-surface-sunken/40 transition-colors">
                    <td className="px-6 py-4 font-semibold text-foreground">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary font-bold flex items-center justify-center text-[10px]">
                          {(sub.planName || sub.planId || "FR").substring(0, 2).toUpperCase()}
                        </span>
                        <div>
                          <div>{sub.planName || sub.planId}</div>
                          {sub.listingLimit && (
                            <span className="text-[10px] text-muted-foreground">{sub.listingLimit} listings</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-foreground font-medium">
                      {sub.userEmail}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${getStatusBadge(sub.status)}`}>
                        {sub.status}
                      </span>
                      {sub.cancelAtPeriodEnd && (
                        <span className="ml-1.5 text-[9px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-900">
                          Period End
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 capitalize text-muted-foreground">
                      {sub.billingInterval || "monthly"}
                    </td>
                    <td className="px-6 py-4 font-bold text-foreground">
                      {formatPrice(sub)}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {sub.startDate ? new Date(sub.startDate).toLocaleDateString() : "—"} -{" "}
                      {sub.endDate ? new Date(sub.endDate).toLocaleDateString() : "Never"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedSubscription(sub)}
                        className="px-3 py-1 rounded-lg text-xs font-medium text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-muted-foreground">
                    No subscriptions match the selected criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-3 border-t border-border-subtle flex items-center justify-between text-xs text-muted-foreground">
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1 rounded-md border border-border disabled:opacity-50 cursor-pointer"
            >
              Previous
            </button>
            <span>
              Page {currentPage} of {totalPages}
            </span>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1 rounded-md border border-border disabled:opacity-50 cursor-pointer"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Subscription Details & Governance Modal */}
      {selectedSubscription && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-surface rounded-2xl border border-border p-6 max-w-lg w-full shadow-warm-lg space-y-4">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <h4 className="text-base font-bold font-display text-foreground flex items-center gap-2">
                <Shield size={18} className="text-primary" /> Subscription Details & Oversight
              </h4>
              <button
                type="button"
                onClick={() => setSelectedSubscription(null)}
                className="text-muted-foreground hover:text-foreground text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1 border-b border-border-subtle">
                <span className="text-muted-foreground">Subscription ID:</span>
                <span className="font-mono text-foreground">{selectedSubscription._id}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border-subtle">
                <span className="text-muted-foreground">Plan:</span>
                <span className="font-bold text-foreground">{selectedSubscription.planName || selectedSubscription.planId}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border-subtle">
                <span className="text-muted-foreground">Seller Email:</span>
                <span className="font-medium text-foreground">{selectedSubscription.userEmail}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border-subtle">
                <span className="text-muted-foreground">Status:</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${getStatusBadge(selectedSubscription.status)}`}>
                  {selectedSubscription.status}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-border-subtle">
                <span className="text-muted-foreground">Price & Currency:</span>
                <span className="font-bold text-foreground">
                  {formatPrice(selectedSubscription)} {selectedSubscription.currency || "INR"}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-border-subtle">
                <span className="text-muted-foreground">Listing Allowance:</span>
                <span className="font-semibold text-foreground">{selectedSubscription.listingLimit || 3} active auctions</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border-subtle">
                <span className="text-muted-foreground">Razorpay Order ID:</span>
                <span className="font-mono text-foreground">{selectedSubscription.razorpayOrderId || "N/A (Free)"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border-subtle">
                <span className="text-muted-foreground">Razorpay Payment ID:</span>
                <span className="font-mono text-foreground">{selectedSubscription.razorpayPaymentId || "None"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border-subtle">
                <span className="text-muted-foreground">Start Date:</span>
                <span className="text-foreground">{selectedSubscription.startDate ? new Date(selectedSubscription.startDate).toLocaleString() : "—"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border-subtle">
                <span className="text-muted-foreground">End Date:</span>
                <span className="text-foreground">{selectedSubscription.endDate ? new Date(selectedSubscription.endDate).toLocaleString() : "Never"}</span>
              </div>
              {selectedSubscription.cancellationReason && (
                <div className="flex justify-between py-1 border-b border-border-subtle">
                  <span className="text-muted-foreground">Cancel Reason:</span>
                  <span className="text-rose-600 dark:text-rose-400 font-medium">{selectedSubscription.cancellationReason}</span>
                </div>
              )}
            </div>

            {/* Admin Cancellation Action */}
            {selectedSubscription.status === "active" && (
              <div className="pt-2 border-t border-border-subtle space-y-2">
                <label className="block text-xs font-semibold text-foreground">
                  Admin Cancellation Reason (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Terms violation or merchant refund request"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full p-2 rounded-xl border border-border bg-surface-sunken text-xs text-foreground focus:outline-none"
                />
                <button
                  type="button"
                  disabled={cancelling}
                  onClick={handleAdminCancel}
                  className="w-full py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {cancelling ? "Processing Cancellation..." : "Cancel Subscription & Revert Quotas"}
                </button>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedSubscription(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-foreground bg-surface-sunken hover:bg-surface transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SubscriptionPage;
