import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import axiosWithAuth from "../../../redux/slices/axiosWithAuth";
import { useSelector } from "react-redux";
import { toast } from "react-hot-toast";
import {
  FaGavel,
  FaSearch,
  FaFilter,
  FaClock,
  FaCheckCircle,
  FaTimesCircle,
  FaExclamationTriangle,
  FaSync,
  FaEye,
  FaShieldAlt,
  FaHistory,
  FaArrowLeft,
  FaMoneyBillWave,
  FaUserCheck,
  FaCalendarAlt,
  FaInfoCircle,
  FaChevronLeft,
  FaChevronRight,
  FaSortAmountDown,
  FaSortAmountUp,
  FaCheck,
  FaExclamationCircle,
} from "react-icons/fa";

import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Dialog } from "../../ui/Dialog";
import { Skeleton } from "../../ui/Skeleton";
import { EmptyState } from "../../ui/EmptyState";
import { cn, formatCurrency } from "../../../lib/utils";
import AdminDashboardShell from "../layouts/AdminDashboardShell";

const API_URL = import.meta.env.VITE_API_URL || "";
const DEFAULT_ITEM_IMAGE = "/lot-placeholder.svg";

const formatDateTime = (dateString) => {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "N/A";
  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const getLifecycleStatusBadgeVariant = (status) => {
  switch (status?.toUpperCase()) {
    case "LIVE":
    case "ACTIVE":
      return "success";
    case "SCHEDULED":
    case "DUE_FOR_LAUNCH":
      return "info";
    case "AWAITING_PAYMENT":
    case "AWAITING_FINALIZATION":
      return "warning";
    case "SETTLED":
      return "success";
    case "UNSOLD":
      return "neutral";
    case "CLOSED":
    case "ENDED":
      return "neutral";
    case "CANCELLED":
      return "destructive";
    default:
      return "neutral";
  }
};

const AdminAuctionsPage = () => {
  const auth = useSelector((state) => state.auth);
  const currentAdminRole = auth.role || auth.user?.role || "admin";

  // Navigation tab: 'directory' | 'lifecycle' | 'scheduledBids'
  const [activeTab, setActiveTab] = useState("directory");

  // Auctions directory state
  const [auctions, setAuctions] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });
  const [summary, setSummary] = useState({
    totalListings: 0,
    scheduledCount: 0,
    liveCount: 0,
    awaitingFinalizationCount: 0,
    awaitingPaymentCount: 0,
    settledCount: 0,
    unsoldCount: 0,
    endedCount: 0,
    reconciliationRequiredCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters for auctions directory
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [lifecycleFilter, setLifecycleFilter] = useState("ALL");
  const [moderationFilter, setModerationFilter] = useState("ALL");
  const [reconciliationOnly, setReconciliationOnly] = useState(false);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");

  // Single Auction Inspection Drawer / Modal
  const [selectedAuctionId, setSelectedAuctionId] = useState(null);
  const [detailAuction, setDetailAuction] = useState(null);
  const [detailBids, setDetailBids] = useState([]);
  const [bidsPagination, setBidsPagination] = useState({
    page: 1,
    limit: 15,
    total: 0,
    totalPages: 1,
  });
  const [detailTab, setDetailTab] = useState("overview"); // 'overview' | 'bids' | 'settlement' | 'audit'
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isLoadingBids, setIsLoadingBids] = useState(false);

  // Lifecycle Telemetry State
  const [telemetryData, setTelemetryData] = useState(null);
  const [isLoadingTelemetry, setIsLoadingTelemetry] = useState(false);

  // Scheduled Bids Tab State
  const [scheduledBids, setScheduledBids] = useState([]);
  const [schedPagination, setSchedPagination] = useState({
    page: 1,
    limit: 15,
    total: 0,
    totalPages: 1,
  });
  const [schedStatusFilter, setSchedStatusFilter] = useState("ALL");
  const [schedSearch, setSchedSearch] = useState("");
  const [debouncedSchedSearch, setDebouncedSchedSearch] = useState("");
  const [isLoadingSchedBids, setIsLoadingSchedBids] = useState(false);

  // Debounce search inputs
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPagination((prev) => ({ ...prev, page: 1 }));
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSchedSearch(schedSearch);
      setSchedPagination((prev) => ({ ...prev, page: 1 }));
    }, 350);
    return () => clearTimeout(timer);
  }, [schedSearch]);

  // Fetch Auctions Directory
  const fetchAuctions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        search: debouncedSearch || undefined,
        lifecycleStatus: lifecycleFilter !== "ALL" ? lifecycleFilter : undefined,
        moderationStatus: moderationFilter !== "ALL" ? moderationFilter : undefined,
        reconciliationOnly: reconciliationOnly ? "true" : undefined,
        sortBy,
        sortOrder,
      };

      const res = await axiosWithAuth.get(`${API_URL}/api/admin/auctions`, {
        params,
      });

      if (res.data && res.data.success) {
        setAuctions(res.data.auctions || []);
        setPagination((prev) => ({
          ...prev,
          total: res.data.pagination.total,
          totalPages: res.data.pagination.totalPages,
        }));
        if (res.data.summary) {
          setSummary(res.data.summary);
        }
      }
    } catch (err) {
      console.error("Error fetching auctions:", err);
      setError(
        err.response?.data?.message ||
          "Failed to load auction directory. Please check network and permissions."
      );
    } finally {
      setIsLoading(false);
    }
  }, [
    pagination.page,
    pagination.limit,
    debouncedSearch,
    lifecycleFilter,
    moderationFilter,
    reconciliationOnly,
    sortBy,
    sortOrder,
  ]);

  // Fetch Lifecycle Telemetry
  const fetchTelemetry = useCallback(async () => {
    setIsLoadingTelemetry(true);
    try {
      const res = await axiosWithAuth.get(`${API_URL}/api/admin/auctions/lifecycle/telemetry`);
      if (res.data && res.data.success) {
        setTelemetryData(res.data);
      }
    } catch (err) {
      console.error("Error fetching telemetry:", err);
      toast.error("Failed to load lifecycle telemetry console");
    } finally {
      setIsLoadingTelemetry(false);
    }
  }, []);

  // Fetch Scheduled Bids Directory
  const fetchScheduledBids = useCallback(async () => {
    setIsLoadingSchedBids(true);
    try {
      const params = {
        page: schedPagination.page,
        limit: schedPagination.limit,
        status: schedStatusFilter !== "ALL" ? schedStatusFilter : undefined,
        search: debouncedSchedSearch || undefined,
      };
      const res = await axiosWithAuth.get(`${API_URL}/api/admin/auctions/scheduled-bids`, {
        params,
      });
      if (res.data && res.data.success) {
        setScheduledBids(res.data.scheduledBids || []);
        setSchedPagination((prev) => ({
          ...prev,
          total: res.data.pagination.total,
          totalPages: res.data.pagination.totalPages,
        }));
      }
    } catch (err) {
      console.error("Error fetching scheduled bids:", err);
      toast.error("Failed to load scheduled bids queue");
    } finally {
      setIsLoadingSchedBids(false);
    }
  }, [
    schedPagination.page,
    schedPagination.limit,
    schedStatusFilter,
    debouncedSchedSearch,
  ]);

  // Fetch detail for inspection modal
  const fetchAuctionDetail = useCallback(async (id) => {
    setIsLoadingDetail(true);
    try {
      const res = await axiosWithAuth.get(`${API_URL}/api/admin/auctions/${id}`);
      if (res.data && res.data.success) {
        setDetailAuction(res.data.auction);
      }
    } catch (err) {
      console.error("Error fetching auction detail:", err);
      toast.error("Failed to retrieve complete auction details");
    } finally {
      setIsLoadingDetail(false);
    }
  }, []);

  // Fetch bids ledger for an auction
  const fetchAuctionBids = useCallback(
    async (id, page = 1) => {
      setIsLoadingBids(true);
      try {
        const res = await axiosWithAuth.get(`${API_URL}/api/admin/auctions/${id}/bids`, {
          params: { page, limit: bidsPagination.limit },
        });
        if (res.data && res.data.success) {
          setDetailBids(res.data.bids || []);
          setBidsPagination((prev) => ({
            ...prev,
            page: res.data.pagination.page,
            total: res.data.pagination.total,
            totalPages: res.data.pagination.totalPages,
          }));
        }
      } catch (err) {
        console.error("Error fetching bids ledger:", err);
      } finally {
        setIsLoadingBids(false);
      }
    },
    [bidsPagination.limit]
  );

  // Trigger data fetches when activeTab changes
  useEffect(() => {
    if (activeTab === "directory") {
      fetchAuctions();
    } else if (activeTab === "lifecycle") {
      fetchTelemetry();
    } else if (activeTab === "scheduledBids") {
      fetchScheduledBids();
    }
  }, [activeTab, fetchAuctions, fetchTelemetry, fetchScheduledBids]);

  // When inspection modal opens
  const handleOpenDetailModal = (auctionId) => {
    setSelectedAuctionId(auctionId);
    setDetailTab("overview");
    fetchAuctionDetail(auctionId);
    fetchAuctionBids(auctionId, 1);
  };

  const handleCloseDetailModal = () => {
    setSelectedAuctionId(null);
    setDetailAuction(null);
    setDetailBids([]);
  };

  return (
    <AdminDashboardShell>
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 font-sans">
        {/* Top Header & Breadcrumbs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
              <Link
                to="/admin/dashboard"
                className="hover:underline flex items-center gap-1 text-slate-400 hover:text-slate-200 transition-colors"
              >
                <FaArrowLeft className="text-[10px]" /> Dashboard
              </Link>
              <span>/</span>
              <span>Stage 4: Auction Operations</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
              <FaGavel className="text-action-primary text-2xl" /> Auction Operations & Lifecycle Visibility
            </h1>
            <p className="text-sm text-foreground-muted mt-1">
              Authoritative investigation console for monitoring live bidding rooms, scheduled start/end windows, anti-sniping extensions, and settlement tracking.
            </p>
          </div>

          {/* Quick Metrics Header Pill */}
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-status-success-bg text-status-success border border-status-success/30">
              <span className="w-2 h-2 rounded-full bg-status-success animate-pulse"></span>
              {summary.liveCount} Live Bidding
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-status-info-bg text-status-info border border-status-info/30">
              <FaClock className="text-[11px]" />
              {summary.scheduledCount} Scheduled
            </span>
            {summary.reconciliationRequiredCount > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-status-error-bg text-status-error border border-status-error/30">
                <FaExclamationTriangle className="text-[11px]" />
                {summary.reconciliationRequiredCount} Reconciliation Required
              </span>
            )}
          </div>
        </div>

        {/* Top Operational KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-surface border border-border-default/70 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-foreground-muted mb-1">
              <span className="text-xs uppercase font-medium">Live Auctions</span>
              <FaGavel className="text-status-success text-sm" />
            </div>
            <div className="text-2xl font-bold text-foreground">{summary.liveCount}</div>
            <div className="text-xs text-status-success mt-1 flex items-center gap-1">
              <span>●</span> Active bidding stream
            </div>
          </div>

          <div className="bg-surface border border-border-default/70 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-foreground-muted mb-1">
              <span className="text-xs uppercase font-medium">Scheduled</span>
              <FaCalendarAlt className="text-status-info text-sm" />
            </div>
            <div className="text-2xl font-bold text-foreground">{summary.scheduledCount}</div>
            <div className="text-xs text-foreground-muted mt-1">Awaiting scheduled start</div>
          </div>

          <div className="bg-surface border border-border-default/70 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-foreground-muted mb-1">
              <span className="text-xs uppercase font-medium">Awaiting Settlement</span>
              <FaMoneyBillWave className="text-brand-gold text-sm" />
            </div>
            <div className="text-2xl font-bold text-foreground">{summary.awaitingPaymentCount}</div>
            <div className="text-xs text-brand-gold mt-1">Winner obligation created</div>
          </div>

          <div className="bg-surface border border-border-default/70 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-foreground-muted mb-1">
              <span className="text-xs uppercase font-medium">Reconciliation</span>
              <FaExclamationTriangle
                className={cn(
                  "text-sm",
                  summary.reconciliationRequiredCount > 0 ? "text-status-error" : "text-foreground-muted"
                )}
              />
            </div>
            <div
              className={cn(
                "text-2xl font-bold",
                summary.reconciliationRequiredCount > 0 ? "text-status-error" : "text-foreground"
              )}
            >
              {summary.reconciliationRequiredCount}
            </div>
            <div className="text-xs text-foreground-muted mt-1">Double-fault exception queue</div>
          </div>
        </div>

        {/* Tab Navigation Controls */}
        <div className="flex border-b border-border-subtle space-x-2">
          <button
            onClick={() => setActiveTab("directory")}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all cursor-pointer",
              activeTab === "directory"
                ? "border-action-primary text-action-primary bg-action-primary/5 font-semibold"
                : "border-transparent text-foreground-muted hover:text-foreground hover:border-border-default"
            )}
          >
            <FaGavel className="text-xs" />
            Auctions Directory
            <span className="ml-1.5 px-2 py-0.5 rounded-full text-xs bg-surface-subtle text-foreground-secondary font-mono">
              {pagination.total || 0}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("lifecycle")}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all cursor-pointer",
              activeTab === "lifecycle"
                ? "border-action-primary text-action-primary bg-action-primary/5 font-semibold"
                : "border-transparent text-foreground-muted hover:text-foreground hover:border-border-default"
            )}
          >
            <FaClock className="text-xs" />
            Lifecycle Monitoring & Engine Health
            {summary.reconciliationRequiredCount > 0 && (
              <span className="ml-1.5 px-2 py-0.5 rounded-full text-xs bg-status-error-bg text-status-error border border-status-error/30">
                {summary.reconciliationRequiredCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("scheduledBids")}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all cursor-pointer",
              activeTab === "scheduledBids"
                ? "border-action-primary text-action-primary bg-action-primary/5 font-semibold"
                : "border-transparent text-foreground-muted hover:text-foreground hover:border-border-default"
            )}
          >
            <FaHistory className="text-xs" />
            Scheduled Bids Oversight
          </button>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* TAB 1: AUCTIONS DIRECTORY                                    */}
        {/* ------------------------------------------------------------- */}
        {activeTab === "directory" && (
          <div className="space-y-4">
            {/* Filter and Search Bar */}
            <div className="bg-surface border border-border-default/70 rounded-2xl p-4 shadow-xs space-y-3">
              <div className="flex flex-col md:flex-row gap-3">
                {/* Search */}
                <div className="relative flex-1">
                  <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground-muted text-sm" />
                  <input
                    type="text"
                    placeholder="Search by title, seller email, category, or auction ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-surface-subtle border border-border-default rounded-xl text-sm text-foreground placeholder-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring-focus"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground cursor-pointer"
                    >
                      <FaTimesCircle className="text-xs" />
                    </button>
                  )}
                </div>

                {/* Lifecycle Status Filter */}
                <div className="w-full md:w-56">
                  <select
                    value={lifecycleFilter}
                    onChange={(e) => {
                      setLifecycleFilter(e.target.value);
                      setPagination((prev) => ({ ...prev, page: 1 }));
                    }}
                    className="w-full px-3 py-2 bg-surface-subtle border border-border-default rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring-focus cursor-pointer"
                  >
                    <option value="ALL">All Lifecycle States</option>
                    <option value="LIVE">Live (Active Bidding)</option>
                    <option value="SCHEDULED">Scheduled (Upcoming)</option>
                    <option value="AWAITING_FINALIZATION">Awaiting Finalization</option>
                    <option value="AWAITING_PAYMENT">Awaiting Payment</option>
                    <option value="SETTLED">Settled (Paid)</option>
                    <option value="UNSOLD">Unsold (No Bids)</option>
                    <option value="Closed">Closed / Ended</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>

                {/* Moderation Status Filter */}
                <div className="w-full md:w-48">
                  <select
                    value={moderationFilter}
                    onChange={(e) => {
                      setModerationFilter(e.target.value);
                      setPagination((prev) => ({ ...prev, page: 1 }));
                    }}
                    className="w-full px-3 py-2 bg-surface-subtle border border-border-default rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring-focus cursor-pointer"
                  >
                    <option value="ALL">All Moderation</option>
                    <option value="ACTIVE">Clean (Active)</option>
                    <option value="FLAGGED">Flagged</option>
                    <option value="SUSPENDED">Suspended</option>
                    <option value="REMOVED">Removed</option>
                  </select>
                </div>

                {/* Sort Option */}
                <div className="w-full md:w-48">
                  <select
                    value={sortBy}
                    onChange={(e) => {
                      setSortBy(e.target.value);
                      setPagination((prev) => ({ ...prev, page: 1 }));
                    }}
                    className="w-full px-3 py-2 bg-surface-subtle border border-border-default rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring-focus cursor-pointer"
                  >
                    <option value="createdAt">Date Listed</option>
                    <option value="startTime">Scheduled Start</option>
                    <option value="endTime">Scheduled End</option>
                    <option value="currentPrice">Current Price</option>
                    <option value="bidCount">Bid Count</option>
                  </select>
                </div>

                {/* Sort Direction Toggle */}
                <button
                  onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                  title={`Sort ${sortOrder === "asc" ? "Descending" : "Ascending"}`}
                  className="px-3 py-2 bg-surface-subtle border border-border-default rounded-xl text-foreground-secondary hover:text-foreground hover:border-action-primary/40 transition-colors flex items-center justify-center cursor-pointer"
                >
                  {sortOrder === "asc" ? <FaSortAmountUp /> : <FaSortAmountDown />}
                </button>

                {/* Refresh */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchAuctions}
                  disabled={isLoading}
                  className="border-border-default text-foreground hover:bg-surface-subtle"
                >
                  <FaSync className={cn(isLoading && "animate-spin text-action-primary")} />
                </Button>
              </div>

              {/* Extra Filters: Reconciliation toggle */}
              <div className="flex items-center justify-between text-xs text-foreground-muted pt-2 border-t border-border-subtle">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={reconciliationOnly}
                    onChange={(e) => {
                      setReconciliationOnly(e.target.checked);
                      setPagination((prev) => ({ ...prev, page: 1 }));
                    }}
                    className="rounded bg-surface border-border-default text-action-primary focus:ring-ring-focus"
                  />
                  <span className={cn(reconciliationOnly && "text-status-error font-medium")}>
                    Show only auctions requiring reconciliation
                  </span>
                </label>

                <span>
                  Showing {auctions.length} of {pagination.total} auctions
                </span>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-status-error-bg border border-status-error/30 text-status-error px-4 py-3 rounded-xl flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <FaExclamationTriangle />
                  <span>{error}</span>
                </div>
                <Button variant="outline" size="sm" onClick={fetchAuctions}>
                  Retry
                </Button>
              </div>
            )}

            {/* Auctions Table */}
            <div className="bg-surface border border-border-default/70 rounded-2xl overflow-hidden shadow-xs">
              {isLoading ? (
                <div className="p-6 space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <Skeleton className="w-14 h-14 rounded-xl bg-surface-raised" />
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-1/3 bg-surface-raised" />
                        <Skeleton className="h-3 w-1/4 bg-surface-raised" />
                      </div>
                      <Skeleton className="h-8 w-24 rounded bg-surface-raised" />
                    </div>
                  ))}
                </div>
              ) : auctions.length === 0 ? (
                <EmptyState
                  title="No auctions match the selected criteria"
                  description="Try broadening your search term or clearing active status and moderation filters."
                  action={
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSearchQuery("");
                        setLifecycleFilter("ALL");
                        setModerationFilter("ALL");
                        setReconciliationOnly(false);
                      }}
                    >
                      Reset Filters
                    </Button>
                  }
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-foreground">
                    <thead className="text-xs uppercase bg-surface-subtle text-foreground-muted border-b border-border-subtle">
                      <tr>
                        <th className="py-3.5 px-4 font-semibold">Auction Item</th>
                        <th className="py-3.5 px-4 font-semibold">Seller</th>
                        <th className="py-3.5 px-4 font-semibold">Schedule Window</th>
                        <th className="py-3.5 px-4 font-semibold">Price & Bids</th>
                        <th className="py-3.5 px-4 font-semibold">Lifecycle State</th>
                        <th className="py-3.5 px-4 font-semibold">Moderation</th>
                        <th className="py-3.5 px-4 text-right font-semibold">Investigation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle/60">
                      {auctions.map((auction) => (
                        <tr
                          key={auction.id}
                          className={cn(
                            "hover:bg-surface-subtle/80 transition-colors",
                            auction.reconciliationRequired && "bg-status-error-bg/30"
                          )}
                        >
                          {/* Item Identity */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <img
                                src={auction.thumbnail || DEFAULT_ITEM_IMAGE}
                                alt={auction.name}
                                className="w-11 h-11 rounded-xl object-cover bg-surface-subtle border border-border-default/60 shrink-0"
                                onError={(e) => {
                                  e.target.src = DEFAULT_ITEM_IMAGE;
                                }}
                              />
                              <div className="min-w-0">
                                <div className="font-medium text-foreground truncate max-w-xs sm:max-w-sm">
                                  {auction.name}
                                </div>
                                <div className="text-xs text-foreground-muted flex items-center gap-2 mt-0.5">
                                  <span>ID: {auction.id.slice(-6)}</span>
                                  <span>•</span>
                                  <span className="truncate max-w-[120px]">{auction.category}</span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Seller */}
                          <td className="py-3 px-4">
                            <div className="text-xs font-mono text-foreground-secondary truncate max-w-[150px]">
                              {auction.sellerEmail}
                            </div>
                          </td>

                          {/* Schedule Window */}
                          <td className="py-3 px-4 text-xs whitespace-nowrap">
                            <div className="space-y-0.5">
                              <div className="text-foreground-secondary">
                                <span className="text-foreground-muted">End:</span> {formatDateTime(auction.endTime)}
                              </div>
                              {auction.antiSnipeCount > 0 && (
                                <div className="text-status-success text-[10px] flex items-center gap-1 font-medium">
                                  <span>Extended +{auction.antiSnipeCount * 2}m</span>
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Price & Bids */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="font-semibold text-foreground">
                              {formatCurrency(auction.currentPrice)}
                            </div>
                            <div className="text-xs text-foreground-muted mt-0.5">
                              {auction.bidCount} {auction.bidCount === 1 ? "bid" : "bids"}
                            </div>
                          </td>

                          {/* Lifecycle Status */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="flex flex-col items-start gap-1">
                              <Badge
                                variant={getLifecycleStatusBadgeVariant(
                                  auction.lifecycleStatusLabel || auction.status
                                )}
                                size="sm"
                              >
                                {auction.lifecycleStatusLabel || auction.status}
                              </Badge>
                              {auction.reconciliationRequired && (
                                <span className="text-[10px] font-bold text-rose-400 tracking-wider">
                                  RECONCILIATION
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Moderation */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <Badge
                              variant={
                                auction.moderationStatus === "ACTIVE"
                                  ? "neutral"
                                  : auction.moderationStatus === "FLAGGED"
                                  ? "warning"
                                  : "destructive"
                              }
                              size="sm"
                            >
                              {auction.moderationStatus || "ACTIVE"}
                            </Badge>
                          </td>

                          {/* Action Button */}
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenDetailModal(auction.id)}
                              className="border-slate-700 hover:border-emerald-500 hover:text-emerald-400"
                            >
                              <FaEye className="mr-1.5 text-xs" />
                              Inspect
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination Bar */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700 bg-slate-900/80 text-xs text-slate-400">
                  <div>
                    Page <span className="font-medium text-white">{pagination.page}</span> of{" "}
                    <span className="font-medium text-white">{pagination.totalPages}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                      disabled={pagination.page <= 1}
                      className="border-slate-700"
                    >
                      <FaChevronLeft className="mr-1 text-[10px]" /> Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                      disabled={pagination.page >= pagination.totalPages}
                      className="border-slate-700"
                    >
                      Next <FaChevronRight className="ml-1 text-[10px]" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 2: LIFECYCLE MONITORING & ENGINE HEALTH                    */}
        {/* ------------------------------------------------------------- */}
        {activeTab === "lifecycle" && (
          <div className="space-y-6">
            {isLoadingTelemetry && !telemetryData ? (
              <div className="p-8 text-center">
                <Skeleton className="h-48 w-full rounded-xl bg-slate-800" />
              </div>
            ) : telemetryData ? (
              <>
                {/* Engine Health Panel */}
                <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-6 backdrop-blur-sm shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-700 pb-4">
                    <div>
                      <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <FaClock className="text-emerald-400" /> Lifecycle Engine Heartbeat & Worker Health
                      </h2>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Authoritative scheduler state managing automated auction start, soft-close anti-sniping extensions, and winner finalization.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchTelemetry}
                        disabled={isLoadingTelemetry}
                        className="border-slate-700 text-xs"
                      >
                        <FaSync className={cn(isLoadingTelemetry && "animate-spin", "mr-1 text-[10px]")} />
                        Refresh Engine
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                    <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3.5">
                      <div className="text-xs text-slate-400 uppercase font-medium">Scheduler Status</div>
                      <div className="text-lg font-bold text-white mt-1 flex items-center gap-2">
                        {telemetryData.scheduler?.isRunning ? (
                          <>
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                            <span className="text-emerald-400">RUNNING</span>
                          </>
                        ) : (
                          <>
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                            <span className="text-amber-400">IDLE / STOPPED</span>
                          </>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        Interval: {telemetryData.scheduler?.intervalMs || 5000}ms
                      </div>
                    </div>

                    <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3.5">
                      <div className="text-xs text-slate-400 uppercase font-medium">Active Processing</div>
                      <div className="text-lg font-bold text-white mt-1">
                        {telemetryData.scheduler?.isProcessing ? (
                          <span className="text-amber-400">TICK IN PROGRESS</span>
                        ) : (
                          <span className="text-slate-300">SLEEPING (STANDBY)</span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        Consecutive Errors: {telemetryData.scheduler?.consecutiveErrors || 0}
                      </div>
                    </div>

                    <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3.5">
                      <div className="text-xs text-slate-400 uppercase font-medium">Last Reconciliation Cycle</div>
                      <div className="text-xs font-mono text-slate-200 mt-1 truncate">
                        {telemetryData.scheduler?.lastCycleTime
                          ? formatDateTime(telemetryData.scheduler.lastCycleTime)
                          : "Startup / Awaiting Tick"}
                      </div>
                      <div className="text-[11px] text-emerald-400 mt-1">Clock: Authoritative Node</div>
                    </div>

                    <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3.5">
                      <div className="text-xs text-slate-400 uppercase font-medium">Reconciliation Backlog</div>
                      <div className="text-lg font-bold text-white mt-1 flex items-center gap-2">
                        {telemetryData.queues?.reconciliationRequiredAuctionsCount > 0 ? (
                          <span className="text-rose-400 font-bold">
                            {telemetryData.queues.reconciliationRequiredAuctionsCount} Alert(s)
                          </span>
                        ) : (
                          <span className="text-emerald-400 flex items-center gap-1 text-sm font-semibold">
                            <FaCheckCircle /> 0 Clean
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">Double-fault exception trap</div>
                    </div>
                  </div>
                </div>

                {/* Pipeline Funnel Metrics */}
                <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-6 backdrop-blur-sm shadow-sm space-y-4">
                  <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                    <FaGavel className="text-emerald-400 text-xs" /> Lifecycle Stage Queue Funnel
                  </h3>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <div className="p-3 bg-slate-900/70 rounded-lg border border-slate-800 text-center">
                      <div className="text-xs text-slate-400">Scheduled Due</div>
                      <div className="text-xl font-bold text-blue-400 mt-1">
                        {telemetryData.queues?.awaitingLaunchCount || 0}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">startTime &le; now</div>
                    </div>

                    <div className="p-3 bg-slate-900/70 rounded-lg border border-slate-800 text-center">
                      <div className="text-xs text-slate-400">Scheduled Upcoming</div>
                      <div className="text-xl font-bold text-slate-200 mt-1">
                        {telemetryData.queues?.scheduledUpcomingCount || 0}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">startTime &gt; now</div>
                    </div>

                    <div className="p-3 bg-slate-900/70 rounded-lg border border-slate-800 text-center">
                      <div className="text-xs text-slate-400">Active Live</div>
                      <div className="text-xl font-bold text-emerald-400 mt-1">
                        {telemetryData.queues?.activeLiveCount || 0}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Accepting bids</div>
                    </div>

                    <div className="p-3 bg-slate-900/70 rounded-lg border border-slate-800 text-center">
                      <div className="text-xs text-slate-400">Due Finalization</div>
                      <div className="text-xl font-bold text-amber-400 mt-1">
                        {telemetryData.queues?.pendingFinalizationCount || 0}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">endTime &le; now</div>
                    </div>

                    <div className="p-3 bg-slate-900/70 rounded-lg border border-slate-800 text-center">
                      <div className="text-xs text-slate-400">Awaiting Payment</div>
                      <div className="text-xl font-bold text-amber-300 mt-1">
                        {telemetryData.queues?.awaitingPaymentCount || 0}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">24h winner window</div>
                    </div>

                    <div className="p-3 bg-slate-900/70 rounded-lg border border-slate-800 text-center">
                      <div className="text-xs text-slate-400">Settled (Paid)</div>
                      <div className="text-xl font-bold text-emerald-300 mt-1">
                        {telemetryData.queues?.settledCount || 0}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Order completed</div>
                    </div>
                  </div>
                </div>

                {/* Reconciliation Exceptions Backlog */}
                <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-6 backdrop-blur-sm shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                      <FaExclamationTriangle className="text-rose-400 text-xs" /> Reconciliation Required Exceptions (Audit & Listings)
                    </h3>
                    <span className="text-xs text-slate-400">
                      Audit Records: {telemetryData.queues?.reconciliationRequiredAuditCount || 0} | Auctions:{" "}
                      {telemetryData.queues?.reconciliationRequiredAuctionsCount || 0}
                    </span>
                  </div>

                  {telemetryData.reconciliationAlerts?.auditLogs?.length === 0 &&
                  telemetryData.reconciliationAlerts?.auctions?.length === 0 ? (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4 text-emerald-400 flex items-center gap-3 text-sm">
                      <FaCheckCircle className="text-lg shrink-0" />
                      <div>
                        <div className="font-semibold">Reconciliation State Clean</div>
                        <div className="text-xs text-emerald-400/80">
                          Zero double-fault rollback errors or interrupted mutations recorded in standalone MongoDB.
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {telemetryData.reconciliationAlerts?.auditLogs?.map((alert) => (
                        <div
                          key={alert.id}
                          className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-3.5 text-xs space-y-1 text-slate-300"
                        >
                          <div className="flex items-center justify-between text-rose-400 font-semibold">
                            <span>ACTION: {alert.action}</span>
                            <span className="text-slate-400 font-mono text-[11px]">
                              {formatDateTime(alert.timestamp)}
                            </span>
                          </div>
                          <div>Target ID: <span className="font-mono text-white">{alert.targetAccountId}</span></div>
                          <div className="text-rose-300 font-mono">Error: {alert.failureReason}</div>
                          {alert.metadata?.uncommittedListingState && (
                            <div className="text-[11px] text-slate-400 pt-1">
                              Uncommitted State: {JSON.stringify(alert.metadata.uncommittedListingState)}
                            </div>
                          )}
                        </div>
                      ))}

                      {telemetryData.reconciliationAlerts?.auctions?.map((auction) => (
                        <div
                          key={auction.id}
                          className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3.5 text-xs space-y-1 text-slate-300"
                        >
                          <div className="flex items-center justify-between text-amber-400 font-semibold">
                            <span>AUCTION: {auction.name}</span>
                            <span className="font-mono text-[11px] text-slate-400">
                              Updated: {formatDateTime(auction.updatedAt)}
                            </span>
                          </div>
                          <div>ID: <span className="font-mono text-white">{auction.id}</span></div>
                          <div className="text-amber-300">Notes: {auction.reconciliationNotes || "Reconciliation required flag set on product record"}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 3: SCHEDULED BIDS OVERSIGHT                               */}
        {/* ------------------------------------------------------------- */}
        {activeTab === "scheduledBids" && (
          <div className="space-y-4">
            {/* Filter and Search Bar for Scheduled Bids */}
            <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 backdrop-blur-sm flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
                <input
                  type="text"
                  placeholder="Search scheduled bids by user email or bidder name..."
                  value={schedSearch}
                  onChange={(e) => setSchedSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-900/90 border border-slate-700/80 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>

              <div className="w-full md:w-56">
                <select
                  value={schedStatusFilter}
                  onChange={(e) => {
                    setSchedStatusFilter(e.target.value);
                    setSchedPagination((prev) => ({ ...prev, page: 1 }));
                  }}
                  className="w-full px-3 py-2 bg-slate-900/90 border border-slate-700/80 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                >
                  <option value="ALL">All Bid Statuses</option>
                  <option value="PENDING">Pending Execution</option>
                  <option value="EXECUTED">Executed Successfully</option>
                  <option value="FAILED">Failed</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={fetchScheduledBids}
                disabled={isLoadingSchedBids}
                className="border-slate-700 text-slate-300 hover:text-white"
              >
                <FaSync className={cn(isLoadingSchedBids && "animate-spin")} />
              </Button>
            </div>

            {/* Scheduled Bids Table */}
            <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl overflow-hidden shadow-sm backdrop-blur-sm">
              {isLoadingSchedBids ? (
                <div className="p-6 space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full rounded bg-slate-700/50" />
                  ))}
                </div>
              ) : scheduledBids.length === 0 ? (
                <EmptyState
                  title="No scheduled bids found"
                  description="Users have not scheduled any automated bids matching the current filters."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-300">
                    <thead className="text-xs uppercase bg-slate-900/80 text-slate-400 border-b border-slate-700">
                      <tr>
                        <th className="py-3 px-4">Bidder</th>
                        <th className="py-3 px-4">Target Auction</th>
                        <th className="py-3 px-4">Scheduled Amount</th>
                        <th className="py-3 px-4">Target Execution Time</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Details / Failure Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                      {scheduledBids.map((b) => (
                        <tr key={b.id} className="hover:bg-slate-700/30 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-medium text-white">{b.userName}</div>
                            <div className="text-xs text-slate-400 font-mono">{b.userEmail}</div>
                          </td>

                          <td className="py-3 px-4">
                            {b.product ? (
                              <div>
                                <div className="text-white font-medium truncate max-w-xs">{b.product.name}</div>
                                <div className="text-xs text-slate-400">Current: {formatCurrency(b.product.currentPrice)}</div>
                              </div>
                            ) : (
                              <span className="text-slate-500 italic">Product Removed / Missing</span>
                            )}
                          </td>

                          <td className="py-3 px-4 font-semibold text-white">
                            {formatCurrency(b.amount)}
                          </td>

                          <td className="py-3 px-4 text-xs whitespace-nowrap">
                            {formatDateTime(b.targetTime)}
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            <Badge
                              variant={
                                b.status === "EXECUTED"
                                  ? "success"
                                  : b.status === "PENDING"
                                  ? "info"
                                  : b.status === "FAILED"
                                  ? "destructive"
                                  : "neutral"
                              }
                              size="sm"
                            >
                              {b.status}
                            </Badge>
                          </td>

                          <td className="py-3 px-4 text-xs max-w-xs">
                            {b.failureReason ? (
                              <span className="text-rose-400 font-mono text-[11px]">{b.failureReason}</span>
                            ) : b.executedBidId ? (
                              <span className="text-emerald-400 text-[11px]">Accepted Bid #{b.executedBidId.slice(-6)}</span>
                            ) : (
                              <span className="text-slate-500 italic">Awaiting cycle</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Scheduled Bids Pagination */}
              {schedPagination.totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700 bg-slate-900/80 text-xs text-slate-400">
                  <div>
                    Page <span className="font-medium text-white">{schedPagination.page}</span> of{" "}
                    <span className="font-medium text-white">{schedPagination.totalPages}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSchedPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                      disabled={schedPagination.page <= 1}
                      className="border-slate-700"
                    >
                      <FaChevronLeft className="mr-1 text-[10px]" /> Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSchedPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                      disabled={schedPagination.page >= schedPagination.totalPages}
                      className="border-slate-700"
                    >
                      Next <FaChevronRight className="ml-1 text-[10px]" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* AUCTION INVESTIGATION DRAWER / MODAL                          */}
      {/* ------------------------------------------------------------- */}
      <Dialog
        open={Boolean(selectedAuctionId)}
        onClose={handleCloseDetailModal}
        className="max-w-4xl w-full bg-surface border border-border-subtle text-foreground max-h-[90vh] overflow-y-auto overscroll-contain"
        data-lenis-prevent="true"
      >
        <div className="p-6 space-y-6">
          {isLoadingDetail || !detailAuction ? (
            <div className="p-8 space-y-4">
              <Skeleton className="h-8 w-1/3 bg-slate-800" />
              <Skeleton className="h-4 w-1/2 bg-slate-800" />
              <Skeleton className="h-40 w-full bg-slate-800" />
            </div>
          ) : (
            <>
              {/* Modal Header */}
              <div className="flex items-start justify-between border-b border-slate-800 pb-4">
                <div className="flex items-start gap-4">
                  <img
                    src={detailAuction.thumbnail || DEFAULT_ITEM_IMAGE}
                    alt={detailAuction.name}
                    className="w-16 h-16 rounded-xl object-cover bg-slate-800 border border-slate-700"
                  />
                  <div>
                    <h2 className="text-xl font-bold text-white">{detailAuction.name}</h2>
                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                      <span>ID: {detailAuction.id}</span>
                      <span>•</span>
                      <span>Seller: {detailAuction.sellerEmail}</span>
                      <span>•</span>
                      <span>Category: {detailAuction.category}</span>
                    </div>

                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant={getLifecycleStatusBadgeVariant(detailAuction.status)} size="sm">
                        {detailAuction.lifecycleStatusLabel || detailAuction.status}
                      </Badge>
                      <Badge
                        variant={detailAuction.moderationStatus === "ACTIVE" ? "neutral" : "destructive"}
                        size="sm"
                      >
                        MODERATION: {detailAuction.moderationStatus}
                      </Badge>
                      {detailAuction.reconciliationRequired && (
                        <Badge variant="destructive" size="sm">
                          RECONCILIATION REQUIRED
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleCloseDetailModal}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <FaTimesCircle className="text-lg" />
                </button>
              </div>

              {/* Modal Tabs */}
              <div className="flex border-b border-slate-800 space-x-4">
                <button
                  onClick={() => setDetailTab("overview")}
                  className={cn(
                    "pb-2.5 text-xs font-semibold tracking-wider uppercase border-b-2 transition-all",
                    detailTab === "overview"
                      ? "border-emerald-500 text-emerald-400"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  )}
                >
                  Overview & Timestamps
                </button>

                <button
                  onClick={() => setDetailTab("bids")}
                  className={cn(
                    "pb-2.5 text-xs font-semibold tracking-wider uppercase border-b-2 transition-all flex items-center gap-1.5",
                    detailTab === "bids"
                      ? "border-emerald-500 text-emerald-400"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  )}
                >
                  Bid Ledger
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-800">
                    {detailAuction.bidCount || 0}
                  </span>
                </button>

                <button
                  onClick={() => setDetailTab("settlement")}
                  className={cn(
                    "pb-2.5 text-xs font-semibold tracking-wider uppercase border-b-2 transition-all",
                    detailTab === "settlement"
                      ? "border-emerald-500 text-emerald-400"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  )}
                >
                  Settlement & Order
                </button>

                <button
                  onClick={() => setDetailTab("audit")}
                  className={cn(
                    "pb-2.5 text-xs font-semibold tracking-wider uppercase border-b-2 transition-all flex items-center gap-1.5",
                    detailTab === "audit"
                      ? "border-emerald-500 text-emerald-400"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  )}
                >
                  Governance Audit Logs
                  {detailAuction.auditLogs?.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-800">
                      {detailAuction.auditLogs.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Sub-tab 1: Overview & Boundaries */}
              {detailTab === "overview" && (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-800/50 p-4 rounded-xl border border-slate-700/60">
                    <div>
                      <div className="text-slate-400 uppercase font-medium">Starting Price</div>
                      <div className="text-base font-bold text-white mt-1">
                        {formatCurrency(detailAuction.startingPrice)}
                      </div>
                    </div>

                    <div>
                      <div className="text-slate-400 uppercase font-medium">Current Price</div>
                      <div className="text-base font-bold text-emerald-400 mt-1">
                        {formatCurrency(detailAuction.currentPrice)}
                      </div>
                    </div>

                    <div>
                      <div className="text-slate-400 uppercase font-medium">Total Bids</div>
                      <div className="text-base font-bold text-white mt-1">
                        {detailAuction.bidCount} accepted
                      </div>
                    </div>

                    <div>
                      <div className="text-slate-400 uppercase font-medium">Highest Bidder</div>
                      <div className="text-xs font-mono text-slate-200 mt-1 truncate">
                        {detailAuction.highestBidderEmail || "None"}
                      </div>
                    </div>
                  </div>

                  {/* Canonical Boundaries */}
                  <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 space-y-2.5">
                    <h3 className="font-bold text-white uppercase text-xs tracking-wider flex items-center gap-2">
                      <FaClock className="text-emerald-400 text-xs" /> Authoritative Time Boundaries & Anti-Sniping
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-300">
                      <div>
                        <span className="text-slate-500">Scheduled Start Time:</span>{" "}
                        <span className="font-mono text-white">{formatDateTime(detailAuction.startTime)}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Effective End Time:</span>{" "}
                        <span className="font-mono text-emerald-400">{formatDateTime(detailAuction.endTime)}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Original Scheduled End:</span>{" "}
                        <span className="font-mono text-white">{formatDateTime(detailAuction.originalEndTime)}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Anti-Sniping Cap (15m Max):</span>{" "}
                        <span className="font-mono text-slate-300">
                          {formatDateTime(detailAuction.maxExtensionDeadline)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">Dynamic Anti-Snipe Trigger Count:</span>{" "}
                        <span className="font-semibold text-white">{detailAuction.antiSnipeCount} times</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Reconciliation Flag:</span>{" "}
                        <span
                          className={cn(
                            "font-bold",
                            detailAuction.reconciliationRequired ? "text-rose-400" : "text-emerald-400"
                          )}
                        >
                          {detailAuction.reconciliationRequired ? "YES (INVESTIGATION NEEDED)" : "NO"}
                        </span>
                      </div>
                    </div>

                    {detailAuction.reconciliationNotes && (
                      <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 p-2.5 rounded-lg mt-2">
                        Reconciliation Notes: {detailAuction.reconciliationNotes}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Sub-tab 2: Bids Ledger */}
              {detailTab === "bids" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Showing {detailBids.length} of {bidsPagination.total} bids</span>
                    <span>Order: Chronological Descending</span>
                  </div>

                  {isLoadingBids ? (
                    <div className="space-y-2 p-4">
                      {[...Array(4)].map((_, i) => (
                        <Skeleton key={i} className="h-9 w-full bg-slate-800" />
                      ))}
                    </div>
                  ) : detailBids.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 italic text-xs">
                      No bids have been recorded in the ledger for this auction yet.
                    </div>
                  ) : (
                    <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs text-slate-300">
                        <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px] border-b border-slate-700">
                          <tr>
                            <th className="py-2.5 px-3">Bidder</th>
                            <th className="py-2.5 px-3">Amount</th>
                            <th className="py-2.5 px-3">Timestamp</th>
                            <th className="py-2.5 px-3">Status</th>
                            <th className="py-2.5 px-3">IP Address</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/40">
                          {detailBids.map((b) => (
                            <tr key={b.id} className="hover:bg-slate-700/20">
                              <td className="py-2.5 px-3 font-medium text-white">{b.bidderEmail}</td>
                              <td className="py-2.5 px-3 font-semibold text-emerald-400">
                                {formatCurrency(b.amount)}
                              </td>
                              <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                                {formatDateTime(b.createdAt)}
                              </td>
                              <td className="py-2.5 px-3">
                                <span
                                  className={cn(
                                    "px-2 py-0.5 rounded text-[10px] font-semibold",
                                    b.status === "ACCEPTED" || b.status === "WINNING"
                                      ? "bg-emerald-500/10 text-emerald-400"
                                      : "bg-slate-800 text-slate-400"
                                  )}
                                >
                                  {b.status}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">
                                {b.ipAddress}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Bids Pagination */}
                  {bidsPagination.totalPages > 1 && (
                    <div className="flex items-center justify-between text-xs text-slate-400 pt-2">
                      <span>Page {bidsPagination.page} of {bidsPagination.totalPages}</span>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => fetchAuctionBids(selectedAuctionId, bidsPagination.page - 1)}
                          disabled={bidsPagination.page <= 1}
                        >
                          Prev
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => fetchAuctionBids(selectedAuctionId, bidsPagination.page + 1)}
                          disabled={bidsPagination.page >= bidsPagination.totalPages}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Sub-tab 3: Settlement & Order */}
              {detailTab === "settlement" && (
                <div className="space-y-4 text-xs">
                  <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 space-y-3">
                    <h3 className="font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <FaMoneyBillWave className="text-emerald-400" /> Lifecycle Settlement State
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-300">
                      <div>
                        <span className="text-slate-500">Finalized At:</span>{" "}
                        <span className="font-mono text-white">
                          {formatDateTime(detailAuction.finalizedAt) || "Not Finalized"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">Payment Deadline (24h Window):</span>{" "}
                        <span className="font-mono text-amber-400">
                          {formatDateTime(detailAuction.paymentDeadline) || "N/A"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">Winning Bidder:</span>{" "}
                        <span className="font-mono text-emerald-400">
                          {detailAuction.highestBidderEmail || "None"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">Final Settled Price:</span>{" "}
                        <span className="font-semibold text-white">
                          {formatCurrency(detailAuction.finalPrice || detailAuction.currentPrice)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Order Summary */}
                  {detailAuction.order ? (
                    <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-white uppercase tracking-wider">
                          Linked Order Obligation
                        </h3>
                        <Badge
                          variant={
                            detailAuction.order.status === "PAID"
                              ? "success"
                              : detailAuction.order.status === "PENDING"
                              ? "warning"
                              : "destructive"
                          }
                          size="sm"
                        >
                          ORDER: {detailAuction.order.status}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-300">
                        <div>
                          <span className="text-slate-500">Order ID:</span>{" "}
                          <span className="font-mono text-white">{detailAuction.order.orderId}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Buyer Email:</span>{" "}
                          <span className="font-mono text-white">{detailAuction.order.winnerEmail}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Paid Timestamp:</span>{" "}
                          <span className="font-mono text-slate-300">
                            {formatDateTime(detailAuction.order.paidAt) || "Pending"}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500">Payment Attempts:</span>{" "}
                          <span className="font-semibold text-white">
                            {detailAuction.order.paymentAttempts} attempts
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-slate-500 italic p-4 text-center bg-slate-800/20 rounded-xl border border-slate-800">
                      No order obligation has been generated yet for this auction listing.
                    </div>
                  )}
                </div>
              )}

              {/* Sub-tab 4: Audit Logs */}
              {detailTab === "audit" && (
                <div className="space-y-3">
                  {detailAuction.auditLogs?.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 italic text-xs">
                      No administrative audit events recorded for this auction.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {detailAuction.auditLogs.map((log) => (
                        <div
                          key={log.id}
                          className="bg-slate-800/40 border border-slate-700/60 rounded-lg p-3 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between text-slate-400">
                            <span className="font-semibold text-white flex items-center gap-2">
                              <span>{log.action}</span>
                              <Badge
                                variant={
                                  log.outcome === "SUCCESS"
                                    ? "success"
                                    : log.outcome === "RECONCILIATION_REQUIRED"
                                    ? "destructive"
                                    : "warning"
                                }
                                size="xs"
                              >
                                {log.outcome}
                              </Badge>
                            </span>
                            <span className="font-mono text-[11px] text-slate-500">
                              {formatDateTime(log.completedAt)}
                            </span>
                          </div>

                          <div className="text-slate-300">
                            Admin: <span className="font-mono text-emerald-400">{log.actingAdminEmail}</span> ({log.actingAdminRole})
                          </div>
                          <div className="text-slate-400">
                            Reason: <span className="text-slate-200">{log.reason}</span>
                          </div>
                          {log.failureReason && (
                            <div className="text-rose-400 font-mono text-[11px]">
                              Failure: {log.failureReason}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Modal Footer */}
              <div className="flex justify-end pt-3 border-t border-slate-800">
                <Button variant="outline" size="sm" onClick={handleCloseDetailModal}>
                  Close Investigation
                </Button>
              </div>
            </>
          )}
        </div>
      </Dialog>
    </AdminDashboardShell>
  );
};

export default AdminAuctionsPage;
