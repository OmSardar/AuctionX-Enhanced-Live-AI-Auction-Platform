import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import axiosWithAuth from "../../../redux/slices/axiosWithAuth";
import { useSelector } from "react-redux";
import { toast } from "react-hot-toast";
import {
  FaShoppingBag,
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
  FaTruck,
  FaReceipt,
  FaExclamationCircle,
  FaHourglassHalf,
  FaUserFriends,
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

const formatDuration = (ms) => {
  if (!ms || ms <= 0) return "0m";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return `${days}d ${remHours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

const getOrderStatusBadgeVariant = (status) => {
  switch (status?.toUpperCase()) {
    case "PAID":
      return "success";
    case "PENDING":
      return "warning";
    case "EXPIRED":
      return "neutral";
    case "CANCELLED":
    case "REFUNDED":
      return "destructive";
    default:
      return "neutral";
  }
};

const AdminOrdersPage = () => {
  const auth = useSelector((state) => state.auth);
  const currentAdminRole = auth.role || auth.user?.role || "admin";

  // Navigation tab: 'directory' | 'deadlines' | 'inconsistencies'
  const [activeTab, setActiveTab] = useState("directory");

  // Orders directory state
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });
  const [summary, setSummary] = useState({
    totalOrders: 0,
    pendingCount: 0,
    paidCount: 0,
    expiredCount: 0,
    cancelledCount: 0,
    refundedCount: 0,
    overdueCount: 0,
    approachingCount: 0,
    reconciliationAlertsCount: 0,
    totalSettledVolume: 0,
    pendingSettlementVolume: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters for orders directory
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [approachingOnly, setApproachingOnly] = useState(false);
  const [reconciliationOnly, setReconciliationOnly] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");

  // Order detail inspection modal
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState("overview"); // 'overview' | 'payment' | 'auction' | 'audit'

  // Deadline monitoring data
  const [deadlineMonitoring, setDeadlineMonitoring] = useState(null);
  const [isMonitoringLoading, setIsMonitoringLoading] = useState(false);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 350);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Fetch Summary / KPIs
  const fetchSummary = useCallback(async () => {
    try {
      const res = await axiosWithAuth.get(`${API_URL}/api/admin/orders/summary`, {
        withCredentials: true,
      });
      if (res.data?.success) {
        setSummary(res.data.summary);
      }
    } catch (err) {
      console.warn("Failed to load order summary:", err);
    }
  }, []);

  // Fetch Orders Directory
  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        status: statusFilter,
        overdueOnly: overdueOnly ? "true" : "false",
        approachingOnly: approachingOnly ? "true" : "false",
        reconciliationOnly: reconciliationOnly ? "true" : "false",
        sortBy,
        sortOrder,
      };

      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const res = await axiosWithAuth.get(`${API_URL}/api/admin/orders`, {
        params,
        withCredentials: true,
      });

      if (res.data?.success) {
        setOrders(res.data.orders || []);
        setPagination((prev) => ({
          ...prev,
          total: res.data.pagination.total,
          totalPages: res.data.pagination.totalPages,
        }));
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Failed to load orders directory";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [
    pagination.page,
    pagination.limit,
    statusFilter,
    overdueOnly,
    approachingOnly,
    reconciliationOnly,
    debouncedSearch,
    startDate,
    endDate,
    sortBy,
    sortOrder,
  ]);

  // Fetch Deadline Monitoring
  const fetchDeadlineMonitoring = useCallback(async () => {
    setIsMonitoringLoading(true);
    try {
      const res = await axiosWithAuth.get(`${API_URL}/api/admin/orders/deadlines/monitoring`, {
        withCredentials: true,
      });
      if (res.data?.success) {
        setDeadlineMonitoring(res.data.monitoring);
      }
    } catch (err) {
      console.warn("Failed to fetch deadline monitoring:", err);
    } finally {
      setIsMonitoringLoading(false);
    }
  }, []);

  // Initial load & filter change
  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    if (activeTab === "directory") {
      fetchOrders();
    } else if (activeTab === "deadlines" || activeTab === "inconsistencies") {
      fetchDeadlineMonitoring();
    }
  }, [activeTab, fetchOrders, fetchDeadlineMonitoring]);

  // Handle open investigation detail
  const handleOpenDetailModal = async (orderId) => {
    setSelectedOrderId(orderId);
    setDetailTab("overview");
    setIsDetailLoading(true);
    setDetailData(null);

    try {
      const res = await axiosWithAuth.get(`${API_URL}/api/admin/orders/${orderId}`, {
        withCredentials: true,
      });
      if (res.data?.success) {
        setDetailData(res.data.data);
      }
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to fetch order investigation details";
      toast.error(msg);
      setSelectedOrderId(null);
    } finally {
      setIsDetailLoading(false);
    }
  };

  const handleCloseDetailModal = () => {
    setSelectedOrderId(null);
    setDetailData(null);
  };

  // Pagination Handlers
  const handlePrevPage = () => {
    if (pagination.page > 1) {
      setPagination((prev) => ({ ...prev, page: prev.page - 1 }));
    }
  };

  const handleNextPage = () => {
    if (pagination.page < pagination.totalPages) {
      setPagination((prev) => ({ ...prev, page: prev.page + 1 }));
    }
  };

  return (
    <AdminDashboardShell>
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
        {/* Top Header & Breadcrumb */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border-default pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-foreground-secondary">
              <Link
                to="/admin/dashboard"
                className="hover:text-action-primary transition-colors flex items-center gap-1"
              >
                <FaArrowLeft className="text-xs" /> Admin Console
              </Link>
              <span>/</span>
              <span className="text-foreground">Orders & Settlement Operations</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <FaShoppingBag className="text-action-primary" /> Orders & Settlement Operations
            </h1>
            <p className="text-sm text-foreground-secondary">
              Post-auction settlement investigation, 24h winner payment deadlines, fulfillment
              visibility, and audit verification.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                fetchSummary();
                if (activeTab === "directory") fetchOrders();
                else fetchDeadlineMonitoring();
                toast.success("Operational telemetry refreshed");
              }}
              className="flex items-center gap-2 border-border-default bg-surface hover:bg-surface-subtle text-foreground"
            >
              <FaSync className={isLoading || isMonitoringLoading ? "animate-spin" : ""} /> Refresh
            </Button>
          </div>
        </div>

        {/* Operational KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Card 1: Total Orders */}
          <div className="bg-surface border border-border-default rounded-xl p-4 space-y-1 shadow-xs">
            <div className="flex items-center justify-between text-foreground-secondary text-xs">
              <span className="font-medium">Total Orders</span>
              <FaReceipt className="text-foreground-muted text-sm" />
            </div>
            <div className="text-2xl font-bold text-foreground tracking-tight">
              {summary.totalOrders}
            </div>
            <div className="text-[11px] text-foreground-muted">All recorded winner obligations</div>
          </div>

          {/* Card 2: Awaiting Payment */}
          <div className="bg-surface border border-border-default rounded-xl p-4 space-y-1 shadow-xs">
            <div className="flex items-center justify-between text-foreground-secondary text-xs">
              <span className="font-medium">Awaiting Payment</span>
              <FaClock className="text-status-warning text-sm" />
            </div>
            <div className="text-2xl font-bold text-status-warning tracking-tight">
              {summary.pendingCount}
            </div>
            <div className="text-[11px] text-foreground-muted">
              Active window: {summary.approachingCount} within 4h
            </div>
          </div>

          {/* Card 3: Overdue / Unreconciled */}
          <div
            className={cn(
              "rounded-xl p-4 space-y-1 shadow-xs border transition-all",
              summary.overdueCount > 0
                ? "bg-status-danger-bg border-status-danger/40 text-status-danger"
                : "bg-surface border-border-default text-foreground-secondary"
            )}
          >
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">Overdue / Unreconciled</span>
              <FaExclamationTriangle
                className={cn("text-sm", summary.overdueCount > 0 ? "text-status-danger" : "text-foreground-muted")}
              />
            </div>
            <div
              className={cn(
                "text-2xl font-bold tracking-tight",
                summary.overdueCount > 0 ? "text-status-danger" : "text-foreground"
              )}
            >
              {summary.overdueCount}
            </div>
            <div className="text-[11px] text-foreground-muted">Past 24h deadline awaiting transition</div>
          </div>

          {/* Card 4: Settled Volume */}
          <div className="bg-surface border border-border-default rounded-xl p-4 space-y-1 shadow-xs">
            <div className="flex items-center justify-between text-foreground-secondary text-xs">
              <span className="font-medium">Settled / Paid</span>
              <FaCheckCircle className="text-status-success text-sm" />
            </div>
            <div className="text-2xl font-bold text-status-success tracking-tight">
              {formatCurrency(summary.totalSettledVolume)}
            </div>
            <div className="text-[11px] text-foreground-muted">{summary.paidCount} orders fully settled</div>
          </div>

          {/* Card 5: Expired / Terminated */}
          <div className="bg-surface border border-border-default rounded-xl p-4 space-y-1 shadow-xs">
            <div className="flex items-center justify-between text-foreground-secondary text-xs">
              <span className="font-medium">Expired Orders</span>
              <FaHourglassHalf className="text-foreground-muted text-sm" />
            </div>
            <div className="text-2xl font-bold text-foreground-secondary tracking-tight">
              {summary.expiredCount}
            </div>
            <div className="text-[11px] text-foreground-muted">Unpaid obligations expired</div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-border-default gap-2">
          <button
            onClick={() => setActiveTab("directory")}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 transition-all flex items-center gap-2",
              activeTab === "directory"
                ? "border-action-primary text-action-primary font-semibold"
                : "border-transparent text-foreground-secondary hover:text-foreground"
            )}
          >
            <FaShoppingBag /> Orders Directory
          </button>
          <button
            onClick={() => setActiveTab("deadlines")}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 transition-all flex items-center gap-2",
              activeTab === "deadlines"
                ? "border-action-primary text-action-primary font-semibold"
                : "border-transparent text-foreground-secondary hover:text-foreground"
            )}
          >
            <FaClock /> Payment Deadlines & Unpaid Monitoring
            {summary.overdueCount > 0 && (
              <Badge variant="destructive" size="xs">
                {summary.overdueCount} Overdue
              </Badge>
            )}
          </button>
          <button
            onClick={() => setActiveTab("inconsistencies")}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 transition-all flex items-center gap-2",
              activeTab === "inconsistencies"
                ? "border-action-primary text-action-primary font-semibold"
                : "border-transparent text-foreground-secondary hover:text-foreground"
            )}
          >
            <FaShieldAlt /> Settlement Inconsistencies & Alerts
            {summary.reconciliationAlertsCount > 0 && (
              <Badge variant="warning" size="xs">
                {summary.reconciliationAlertsCount}
              </Badge>
            )}
          </button>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: ORDERS DIRECTORY */}
        {/* ========================================================================= */}
        {activeTab === "directory" && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="bg-surface border border-border-default rounded-xl p-4 space-y-3 shadow-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Search Input */}
                <div className="relative">
                  <FaSearch className="absolute left-3 top-3 text-foreground-muted text-xs" />
                  <input
                    type="text"
                    placeholder="Search title, order ID, buyer, seller..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-surface-subtle border border-border-default rounded-lg pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-foreground-muted focus:outline-hidden focus:border-action-primary"
                  />
                </div>

                {/* Status Filter */}
                <div>
                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setPagination((prev) => ({ ...prev, page: 1 }));
                    }}
                    className="w-full bg-surface-subtle border border-border-default rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-hidden focus:border-action-primary"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="PENDING">PENDING (Awaiting Payment)</option>
                    <option value="PAID">PAID (Settled)</option>
                    <option value="EXPIRED">EXPIRED (Unpaid)</option>
                    <option value="CANCELLED">CANCELLED</option>
                    <option value="REFUNDED">REFUNDED</option>
                  </select>
                </div>

                {/* Sort By Field */}
                <div>
                  <select
                    value={sortBy}
                    onChange={(e) => {
                      setSortBy(e.target.value);
                      setPagination((prev) => ({ ...prev, page: 1 }));
                    }}
                    className="w-full bg-surface-subtle border border-border-default rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-hidden focus:border-action-primary"
                  >
                    <option value="createdAt">Created Date</option>
                    <option value="paymentDeadline">Payment Deadline</option>
                    <option value="finalPrice">Final Price</option>
                    <option value="updatedAt">Updated Date</option>
                  </select>
                </div>

                {/* Sort Order */}
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))
                    }
                    className="flex-1 bg-surface-subtle border border-border-default rounded-lg px-3 py-1.5 text-xs text-foreground-secondary hover:text-foreground flex items-center justify-center gap-2"
                  >
                    {sortOrder === "asc" ? <FaSortAmountUp /> : <FaSortAmountDown />}
                    <span>{sortOrder === "asc" ? "Ascending" : "Descending"}</span>
                  </button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearchQuery("");
                      setStatusFilter("ALL");
                      setOverdueOnly(false);
                      setApproachingOnly(false);
                      setReconciliationOnly(false);
                      setStartDate("");
                      setEndDate("");
                      setSortBy("createdAt");
                      setSortOrder("desc");
                      setPagination((prev) => ({ ...prev, page: 1 }));
                    }}
                    className="text-xs border-border-default text-foreground-secondary hover:text-foreground"
                  >
                    Reset
                  </Button>
                </div>
              </div>

              {/* Quick Filter Toggles */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border-subtle text-xs">
                <span className="text-foreground-muted text-[11px] font-medium mr-1">Quick Filters:</span>
                <button
                  onClick={() => {
                    setOverdueOnly((prev) => !prev);
                    setPagination((prev) => ({ ...prev, page: 1 }));
                  }}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-xs font-medium border transition-colors flex items-center gap-1.5",
                    overdueOnly
                      ? "bg-status-danger-bg border-status-danger/60 text-status-danger"
                      : "bg-surface-subtle border-border-default text-foreground-secondary hover:text-foreground"
                  )}
                >
                  <FaExclamationTriangle className="text-[10px]" /> Overdue Only ({summary.overdueCount})
                </button>

                <button
                  onClick={() => {
                    setApproachingOnly((prev) => !prev);
                    setPagination((prev) => ({ ...prev, page: 1 }));
                  }}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-xs font-medium border transition-colors flex items-center gap-1.5",
                    approachingOnly
                      ? "bg-status-warning-bg border-status-warning/60 text-status-warning"
                      : "bg-surface-subtle border-border-default text-foreground-secondary hover:text-foreground"
                  )}
                >
                  <FaClock className="text-[10px]" /> Approaching Deadline (4h) ({summary.approachingCount})
                </button>
              </div>
            </div>

            {/* Orders Table */}
            <div className="bg-surface border border-border-default rounded-xl overflow-hidden shadow-xs">
              {isLoading ? (
                <div className="p-6 space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <Skeleton className="h-12 w-12 rounded-lg bg-surface-subtle" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-1/3 bg-surface-subtle" />
                        <Skeleton className="h-3 w-1/4 bg-surface-subtle" />
                      </div>
                      <Skeleton className="h-6 w-20 bg-surface-subtle" />
                    </div>
                  ))}
                </div>
              ) : error ? (
                <div className="p-8 text-center space-y-3">
                  <FaExclamationTriangle className="text-3xl text-status-danger mx-auto" />
                  <div className="text-status-danger font-medium">{error}</div>
                  <Button variant="outline" size="sm" onClick={fetchOrders}>
                    Retry
                  </Button>
                </div>
              ) : orders.length === 0 ? (
                <div className="p-12 text-center space-y-3">
                  <EmptyState
                    icon={<FaShoppingBag className="text-4xl text-foreground-muted mx-auto" />}
                    title="No Orders Found"
                    description="No orders match the selected search, status, or date filters."
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-foreground">
                    <thead className="bg-surface-subtle text-[11px] uppercase tracking-wider text-foreground-muted border-b border-border-default font-semibold">
                      <tr>
                        <th className="py-3 px-4">Item & Order ID</th>
                        <th className="py-3 px-4">Winner / Buyer</th>
                        <th className="py-3 px-4">Final Settlement</th>
                        <th className="py-3 px-4">Status & Invariant</th>
                        <th className="py-3 px-4">24h Payment Deadline</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {orders.map((ord) => (
                        <tr key={ord.id} className="hover:bg-surface-subtle/50 transition-colors">
                          {/* Item & Order ID */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <img
                                src={ord.image || DEFAULT_ITEM_IMAGE}
                                alt={ord.title}
                                className="w-10 h-10 rounded-lg object-cover bg-surface-subtle border border-border-default shrink-0"
                                onError={(e) => {
                                  e.target.onerror = null;
                                  e.target.src = DEFAULT_ITEM_IMAGE;
                                }}
                              />
                              <div className="space-y-0.5 max-w-[200px] truncate">
                                <div className="font-semibold text-foreground truncate" title={ord.title}>
                                  {ord.title}
                                </div>
                                <div className="font-mono text-[10px] text-foreground-muted">
                                  #{ord.id.slice(-8)}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Winner / Buyer */}
                          <td className="py-3 px-4">
                            <div className="space-y-0.5">
                              <div className="font-medium text-foreground truncate max-w-[160px]">
                                {ord.winner?.name}
                              </div>
                              <div className="font-mono text-[11px] text-action-primary truncate max-w-[160px]">
                                {ord.winner?.email}
                              </div>
                            </div>
                          </td>

                          {/* Final Settlement */}
                          <td className="py-3 px-4">
                            <div className="space-y-0.5">
                              <div className="font-bold text-foreground text-sm">
                                {formatCurrency(ord.finalPrice)}
                              </div>
                              <div className="text-[10px] text-foreground-muted">
                                Start: {formatCurrency(ord.biddingStartPrice)}
                              </div>
                            </div>
                          </td>

                          {/* Status & Invariant */}
                          <td className="py-3 px-4">
                            <div className="space-y-1">
                              <Badge variant={getOrderStatusBadgeVariant(ord.status)} size="xs">
                                {ord.status}
                              </Badge>
                              {ord.isDisputeHoldActive && (
                                <Badge variant="destructive" size="xs" className="block w-fit">
                                  HOLD ACTIVE
                                </Badge>
                              )}
                              {ord.isOverdue && ord.status === "PENDING" && !ord.isDisputeHoldActive && (
                                <Badge variant="destructive" size="xs" className="block w-fit">
                                  OVERDUE
                                </Badge>
                              )}
                            </div>
                          </td>

                          {/* 24h Payment Deadline */}
                          <td className="py-3 px-4">
                            <div className="space-y-0.5">
                              <div className="text-foreground-secondary font-mono text-[11px]">
                                {formatDateTime(ord.paymentDeadline)}
                              </div>
                              {ord.status === "PENDING" && (
                                <div
                                  className={cn(
                                    "text-[10px] font-medium",
                                    ord.isOverdue
                                      ? "text-status-danger"
                                      : ord.isApproaching
                                      ? "text-status-warning font-semibold"
                                      : "text-foreground-muted"
                                  )}
                                >
                                  {ord.isOverdue
                                    ? `Overdue by ${formatDuration(ord.overdueMs)}`
                                    : `${formatDuration(ord.remainingMs)} remaining`}
                                </div>
                              )}
                              {ord.status === "PAID" && ord.paidAt && (
                                <div className="text-[10px] text-status-success">
                                  Paid: {formatDateTime(ord.paidAt)}
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-right">
                            <Button
                              variant="outline"
                              size="xs"
                              onClick={() => handleOpenDetailModal(ord.id)}
                              className="border-border-default bg-surface hover:bg-surface-subtle text-foreground inline-flex items-center gap-1.5"
                            >
                              <FaEye /> Inspect
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination Bar */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-border-default bg-surface-subtle text-xs text-foreground-secondary">
                <div>
                  Showing {orders.length} of {pagination.total} orders
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrevPage}
                    disabled={pagination.page <= 1}
                    className="p-1.5 rounded-lg border border-border-default bg-surface disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-subtle text-foreground"
                  >
                    <FaChevronLeft className="text-xs" />
                  </button>
                  <span className="px-2">
                    Page {pagination.page} of {pagination.totalPages || 1}
                  </span>
                  <button
                    onClick={handleNextPage}
                    disabled={pagination.page >= pagination.totalPages}
                    className="p-1.5 rounded-lg border border-border-default bg-surface disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-subtle text-foreground"
                  >
                    <FaChevronRight className="text-xs" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: DEADLINES & UNPAID MONITORING */}
        {/* ========================================================================= */}
        {activeTab === "deadlines" && (
          <div className="space-y-6">
            {isMonitoringLoading ? (
              <div className="p-8 text-center text-foreground-secondary">
                <FaSync className="animate-spin text-2xl mx-auto mb-2 text-action-primary" />
                Loading deadline and unpaid telemetry...
              </div>
            ) : !deadlineMonitoring ? (
              <div className="p-8 text-center text-foreground-muted italic">
                No deadline monitoring data available.
              </div>
            ) : (
              <>
                {/* Overdue / Unreconciled Section */}
                <div className="bg-surface border border-border-default rounded-xl p-5 space-y-4 shadow-xs">
                  <div className="flex items-center justify-between border-b border-border-default pb-3">
                    <div className="space-y-0.5">
                      <h3 className="font-semibold text-foreground text-base flex items-center gap-2">
                        <FaExclamationTriangle className="text-status-danger" /> Overdue Unreconciled Orders
                      </h3>
                      <p className="text-xs text-foreground-secondary">
                        Orders past their 24h payment deadline that have not yet been authoritatively transitioned to EXPIRED.
                      </p>
                    </div>
                    <Badge variant="destructive" size="sm">
                      {deadlineMonitoring.overdueUnreconciledCount} Overdue
                    </Badge>
                  </div>

                  {deadlineMonitoring.overdueUnreconciledOrders?.length === 0 ? (
                    <div className="text-center py-6 text-foreground-muted italic text-xs">
                      No overdue pending orders. All deadlines are within active windows or resolved.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {deadlineMonitoring.overdueUnreconciledOrders.map((ord) => (
                        <div
                          key={ord.id}
                          className="bg-status-danger-bg border border-status-danger/40 rounded-lg p-3 space-y-2 text-xs"
                        >
                          <div className="flex items-center justify-between font-semibold text-foreground">
                            <span className="truncate max-w-[180px]">{ord.title}</span>
                            <span className="font-bold text-status-danger">
                              {formatCurrency(ord.finalPrice)}
                            </span>
                          </div>
                          <div className="text-foreground-secondary font-mono text-[11px]">
                            Winner: {ord.winner?.email}
                          </div>
                          <div className="flex items-center justify-between text-[11px] pt-1 border-t border-status-danger/20">
                            <span className="text-status-danger font-medium">
                              Overdue by {formatDuration(ord.overdueMs)}
                            </span>
                            <Button
                              variant="outline"
                              size="xs"
                              onClick={() => handleOpenDetailModal(ord.id)}
                              className="text-[10px] border-border-default bg-surface hover:bg-surface-subtle text-foreground"
                            >
                              Inspect
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Approaching Deadlines Section */}
                <div className="bg-surface border border-border-default rounded-xl p-5 space-y-4 shadow-xs">
                  <div className="flex items-center justify-between border-b border-border-default pb-3">
                    <div className="space-y-0.5">
                      <h3 className="font-semibold text-foreground text-base flex items-center gap-2">
                        <FaClock className="text-status-warning" /> Deadlines Approaching (Within 4 Hours)
                      </h3>
                      <p className="text-xs text-foreground-secondary">
                        Orders awaiting winner payment whose 24-hour expiration window will elapse soon.
                      </p>
                    </div>
                    <Badge variant="warning" size="sm">
                      {deadlineMonitoring.approachingCount} Approaching
                    </Badge>
                  </div>

                  {deadlineMonitoring.approachingOrders?.length === 0 ? (
                    <div className="text-center py-6 text-foreground-muted italic text-xs">
                      No orders currently approaching expiration within the 4-hour window.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {deadlineMonitoring.approachingOrders.map((ord) => (
                        <div
                          key={ord.id}
                          className="bg-status-warning-bg border border-status-warning/40 rounded-lg p-3 space-y-2 text-xs"
                        >
                          <div className="flex items-center justify-between font-semibold text-foreground">
                            <span className="truncate max-w-[180px]">{ord.title}</span>
                            <span className="font-bold text-status-warning">
                              {formatCurrency(ord.finalPrice)}
                            </span>
                          </div>
                          <div className="text-foreground-secondary font-mono text-[11px]">
                            Winner: {ord.winner?.email}
                          </div>
                          <div className="flex items-center justify-between text-[11px] pt-1 border-t border-status-warning/20">
                            <span className="text-status-warning font-medium">
                              Remaining: {formatDuration(ord.remainingMs)}
                            </span>
                            <Button
                              variant="outline"
                              size="xs"
                              onClick={() => handleOpenDetailModal(ord.id)}
                              className="text-[10px] border-border-default bg-surface hover:bg-surface-subtle text-foreground"
                            >
                              Inspect
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recently Expired Orders Section */}
                <div className="bg-surface border border-border-default rounded-xl p-5 space-y-4 shadow-xs">
                  <div className="flex items-center justify-between border-b border-border-default pb-3">
                    <div className="space-y-0.5">
                      <h3 className="font-semibold text-foreground text-base flex items-center gap-2">
                        <FaHourglassHalf className="text-foreground-muted" /> Confirmed Expired Orders
                      </h3>
                      <p className="text-xs text-foreground-secondary">
                        Orders confirmed expired due to non-payment within the 24-hour statutory deadline.
                      </p>
                    </div>
                    <Badge variant="neutral" size="sm">
                      {deadlineMonitoring.recentlyExpiredCount} Expired
                    </Badge>
                  </div>

                  {deadlineMonitoring.recentlyExpiredOrders?.length === 0 ? (
                    <div className="text-center py-6 text-foreground-muted italic text-xs">
                      No expired orders recorded.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {deadlineMonitoring.recentlyExpiredOrders.map((ord) => (
                        <div
                          key={ord.id}
                          className="bg-surface-subtle border border-border-default rounded-lg p-3 space-y-2 text-xs"
                        >
                          <div className="flex items-center justify-between font-semibold text-foreground">
                            <span className="truncate max-w-[180px]">{ord.title}</span>
                            <span className="font-bold text-foreground-secondary">
                              {formatCurrency(ord.finalPrice)}
                            </span>
                          </div>
                          <div className="text-foreground-muted font-mono text-[11px]">
                            Winner: {ord.winner?.email}
                          </div>
                          <div className="flex items-center justify-between text-[11px] pt-1 border-t border-border-default">
                            <span className="text-foreground-muted font-medium">Status: EXPIRED</span>
                            <Button
                              variant="outline"
                              size="xs"
                              onClick={() => handleOpenDetailModal(ord.id)}
                              className="text-[10px] border-border-default bg-surface hover:bg-surface-subtle text-foreground"
                            >
                              Inspect
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: SETTLEMENT INCONSISTENCIES & ALERTS */}
        {/* ========================================================================= */}
        {activeTab === "inconsistencies" && (
          <div className="space-y-4">
            <div className="bg-surface border border-border-default rounded-xl p-5 space-y-4 shadow-xs">
              <div className="space-y-1">
                <h3 className="font-semibold text-foreground text-base flex items-center gap-2">
                  <FaShieldAlt className="text-action-primary" /> Settlement & Ledger Invariant Verification
                </h3>
                <p className="text-xs text-foreground-secondary">
                  Automated detection of state divergence between Orders, Bids, Payments, and Auction products.
                </p>
              </div>

              {summary.overdueCount === 0 && summary.reconciliationAlertsCount === 0 ? (
                <div className="p-8 text-center space-y-2 border border-status-success/30 bg-status-success-bg rounded-xl">
                  <FaCheckCircle className="text-3xl text-status-success mx-auto" />
                  <div className="font-semibold text-status-success">All Order Invariants Balanced</div>
                  <div className="text-xs text-foreground-secondary max-w-md mx-auto">
                    No payment ledger discrepancies, orphaned product references, or unhandled overdue obligations detected.
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {summary.overdueCount > 0 && (
                    <div className="bg-status-danger-bg border border-status-danger/40 rounded-xl p-4 flex items-start gap-3">
                      <FaExclamationTriangle className="text-status-danger text-lg mt-0.5 shrink-0" />
                      <div className="space-y-1 text-xs">
                        <div className="font-bold text-status-danger">
                          {summary.overdueCount} Orders Exceeded 24h Payment Deadline
                        </div>
                        <div className="text-foreground-secondary">
                          These orders have elapsed past their authoritative payment window while remaining in PENDING state.
                          The background lifecycle worker will transition them to EXPIRED during the next reconciliation pass.
                        </div>
                        <div className="pt-2">
                          <Button
                            variant="outline"
                            size="xs"
                            onClick={() => {
                              setActiveTab("directory");
                              setOverdueOnly(true);
                            }}
                            className="border-status-danger/60 bg-status-danger-bg hover:bg-status-danger/20 text-status-danger"
                          >
                            Filter Overdue Orders in Directory
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* ORDER INVESTIGATION MODAL */}
      {/* ========================================================================= */}
      <Dialog
        isOpen={Boolean(selectedOrderId)}
        onClose={handleCloseDetailModal}
        title="Order Operational Investigation"
        className="max-w-4xl"
      >
        <div
          className="space-y-4 max-h-[80vh] overflow-y-auto overscroll-contain pr-1 text-xs"
          data-lenis-prevent="true"
        >
          {isDetailLoading || !detailData ? (
            <div className="p-8 space-y-4">
              <Skeleton className="h-6 w-1/2 bg-surface-subtle" />
              <Skeleton className="h-24 w-full bg-surface-subtle" />
              <Skeleton className="h-24 w-full bg-surface-subtle" />
            </div>
          ) : (
            <>
              {/* Header Card */}
              <div className="bg-surface border border-border-default rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <img
                    src={detailData.order?.images?.[0]?.secure_url || DEFAULT_ITEM_IMAGE}
                    alt={detailData.order?.title}
                    className="w-14 h-14 rounded-lg object-cover bg-surface-subtle border border-border-default"
                  />
                  <div>
                    <h3 className="font-bold text-foreground text-base">
                      {detailData.order?.title}
                    </h3>
                    <div className="text-foreground-secondary font-mono text-[11px]">
                      Order ID: {detailData.order?.id}
                    </div>
                    <div className="text-[11px] text-foreground-muted">
                      Category: {detailData.order?.category}
                    </div>
                  </div>
                </div>

                <div className="text-right sm:text-right space-y-1">
                  <div className="text-xl font-bold text-status-success">
                    {formatCurrency(detailData.order?.finalPrice)}
                  </div>
                  <div className="flex items-center gap-1.5 justify-end">
                    <Badge variant={getOrderStatusBadgeVariant(detailData.order?.status)} size="sm">
                      {detailData.order?.status}
                    </Badge>
                    {detailData.order?.isDisputeHoldActive && (
                      <Badge variant="destructive" size="sm">
                        DISPUTE HOLD ACTIVE
                      </Badge>
                    )}
                    {detailData.order?.isOverdue && !detailData.order?.isDisputeHoldActive && (
                      <Badge variant="destructive" size="sm">
                        OVERDUE
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Stage 7 Dispute Hold Warning Banner */}
              {detailData.order?.isDisputeHoldActive && (
                <div className="bg-status-danger-bg border border-status-danger/60 rounded-xl p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-status-danger flex items-center gap-2">
                      <FaShieldAlt className="text-status-danger" /> Active Dispute Hold on Order
                    </span>
                    <Badge variant="destructive" size="xs">
                      {detailData.order.activeHoldsCount || 1} ACTIVE HOLD
                    </Badge>
                  </div>
                  <div className="text-[11px] text-foreground-secondary">
                    This order is under administrative dispute hold. Automated 24-hour payment deadline expiration, seller fulfillment, and settlement transitions are paused pending resolution.
                  </div>
                  {detailData.order.blockedTransitions?.length > 0 && (
                    <div className="text-[10px] text-status-danger font-mono pt-0.5">
                      Blocked: {detailData.order.blockedTransitions.join(" • ")}
                    </div>
                  )}
                </div>
              )}

              {/* Sub-tab Navigation */}
              <div className="flex border-b border-border-default gap-2">
                <button
                  onClick={() => setDetailTab("overview")}
                  className={cn(
                    "px-3 py-1.5 font-medium border-b-2 text-xs transition-colors",
                    detailTab === "overview"
                      ? "border-action-primary text-action-primary font-semibold"
                      : "border-transparent text-foreground-secondary hover:text-foreground"
                  )}
                >
                  Overview & Parties
                </button>
                <button
                  onClick={() => setDetailTab("payment")}
                  className={cn(
                    "px-3 py-1.5 font-medium border-b-2 text-xs transition-colors",
                    detailTab === "payment"
                      ? "border-action-primary text-action-primary font-semibold"
                      : "border-transparent text-foreground-secondary hover:text-foreground"
                  )}
                >
                  Payment & Deadline ({detailData.payments?.length || 0})
                </button>
                <button
                  onClick={() => setDetailTab("auction")}
                  className={cn(
                    "px-3 py-1.5 font-medium border-b-2 text-xs transition-colors",
                    detailTab === "auction"
                      ? "border-action-primary text-action-primary font-semibold"
                      : "border-transparent text-foreground-secondary hover:text-foreground"
                  )}
                >
                  Auction & Runner-Up
                </button>
                <button
                  onClick={() => setDetailTab("audit")}
                  className={cn(
                    "px-3 py-1.5 font-medium border-b-2 text-xs transition-colors",
                    detailTab === "audit"
                      ? "border-action-primary text-action-primary font-semibold"
                      : "border-transparent text-foreground-secondary hover:text-foreground"
                  )}
                >
                  Governance Audit Trail ({detailData.auditLogs?.length || 0})
                </button>
              </div>

              {/* Sub-tab 1: Overview & Parties */}
              {detailTab === "overview" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Buyer Details */}
                    <div className="bg-surface-subtle border border-border-default rounded-xl p-4 space-y-2">
                      <div className="font-semibold text-foreground flex items-center gap-2 border-b border-border-default pb-2">
                        <FaUserCheck className="text-action-primary" /> Winning Buyer Details
                      </div>
                      <div className="space-y-1.5 text-foreground">
                        <div>
                          <span className="text-foreground-muted">Name:</span>{" "}
                          <span className="font-medium text-foreground">{detailData.order?.winner?.name}</span>
                        </div>
                        <div>
                          <span className="text-foreground-muted">Email:</span>{" "}
                          <span className="font-mono text-action-primary">{detailData.order?.winner?.email}</span>
                        </div>
                        <div>
                          <span className="text-foreground-muted">Phone:</span>{" "}
                          <span className="font-mono text-foreground-secondary">{detailData.order?.winner?.phoneNo}</span>
                        </div>
                        <div>
                          <span className="text-foreground-muted">Shipping Address:</span>{" "}
                          <span className="text-foreground-secondary">{detailData.order?.winner?.shippingAddress}</span>
                        </div>
                      </div>
                    </div>

                    {/* Seller Details & Pricing */}
                    <div className="bg-surface-subtle border border-border-default rounded-xl p-4 space-y-2">
                      <div className="font-semibold text-foreground flex items-center gap-2 border-b border-border-default pb-2">
                        <FaReceipt className="text-action-primary" /> Seller & Settlement Breakdown
                      </div>
                      <div className="space-y-1.5 text-foreground">
                        <div>
                          <span className="text-foreground-muted">Seller Email:</span>{" "}
                          <span className="font-mono text-foreground-secondary">{detailData.order?.seller?.email}</span>
                        </div>
                        <div>
                          <span className="text-foreground-muted">Starting Price:</span>{" "}
                          <span className="font-mono">{formatCurrency(detailData.order?.biddingStartPrice)}</span>
                        </div>
                        <div>
                          <span className="text-foreground-muted">Highest Bid:</span>{" "}
                          <span className="font-mono">{formatCurrency(detailData.order?.highestBid)}</span>
                        </div>
                        <div>
                          <span className="text-foreground-muted">Final Price:</span>{" "}
                          <span className="font-bold text-status-success font-mono">
                            {formatCurrency(detailData.order?.finalPrice)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Fulfillment Summary */}
                  <div className="bg-surface-subtle border border-border-default rounded-xl p-4 space-y-2">
                    <div className="font-semibold text-foreground flex items-center gap-2">
                      <FaTruck className="text-action-primary" /> Fulfillment State
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                      <div>
                        <div className="text-[10px] text-foreground-muted">Fulfillment Status</div>
                        <Badge variant="neutral" size="xs">
                          {detailData.fulfillment?.fulfillmentState}
                        </Badge>
                      </div>
                      <div>
                        <div className="text-[10px] text-foreground-muted">Carrier Tracking</div>
                        <span className="text-foreground-secondary font-mono text-[11px]">
                          {detailData.fulfillment?.carrierIntegrationStatus}
                        </span>
                      </div>
                      <div>
                        <div className="text-[10px] text-foreground-muted">Address Recorded</div>
                        <span className="text-foreground-secondary">
                          {detailData.fulfillment?.destinationRecorded ? "✓ Recorded" : "Pending Checkout"}
                        </span>
                      </div>
                    </div>
                    <div className="text-[11px] text-foreground-muted italic pt-1">
                      {detailData.fulfillment?.notes}
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-tab 2: Payment & Deadline */}
              {detailTab === "payment" && (
                <div className="space-y-4">
                  {/* Deadline Banner */}
                  <div
                    className={cn(
                      "p-4 rounded-xl border space-y-1",
                      detailData.order?.isOverdue
                        ? "bg-status-danger-bg border-status-danger/80 text-status-danger"
                        : "bg-surface-subtle border-border-default text-foreground-secondary"
                    )}
                  >
                    <div className="flex items-center justify-between font-semibold">
                      <span className="flex items-center gap-2">
                        <FaClock /> 24-Hour Statutory Winner Payment Deadline
                      </span>
                      <Badge
                        variant={detailData.order?.isOverdue ? "destructive" : "warning"}
                        size="sm"
                      >
                        {detailData.order?.deadlineStatus}
                      </Badge>
                    </div>
                    <div className="font-mono text-sm text-foreground">
                      Deadline: {formatDateTime(detailData.order?.paymentDeadline)}
                    </div>
                    <div className="text-xs">
                      {detailData.order?.isOverdue ? (
                        <span className="font-bold text-status-danger">
                          ⚠ This order is overdue by {formatDuration(detailData.order?.overdueMs)}.
                        </span>
                      ) : (
                        <span>
                          Time remaining: {formatDuration(detailData.order?.remainingMs)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Payment Ledger Records */}
                  <div className="space-y-2">
                    <h4 className="font-semibold text-foreground">Payment Attempt Ledger</h4>
                    {detailData.payments?.length === 0 ? (
                      <div className="p-6 text-center text-foreground-muted italic border border-border-default rounded-xl bg-surface-subtle">
                        No payment attempts recorded for this order yet.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {detailData.payments.map((p) => (
                          <div
                            key={p.id}
                            className="bg-surface-subtle border border-border-default rounded-lg p-3 space-y-2"
                          >
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-foreground">
                                {formatCurrency(p.amountInRupees)} ({p.currency})
                              </span>
                              <Badge
                                variant={
                                  p.status === "CAPTURED"
                                    ? "success"
                                    : p.status === "FAILED"
                                    ? "destructive"
                                    : "warning"
                                }
                                size="xs"
                              >
                                {p.status}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-foreground-secondary font-mono">
                              <div>Provider Order: {p.razorpayOrderId || "N/A"}</div>
                              <div>Payment ID: {p.razorpayPaymentId || "N/A"}</div>
                              <div>Verified Via: {p.verifiedVia || "N/A"}</div>
                            </div>
                            {p.failureReason && (
                              <div className="text-status-danger text-[11px]">
                                Failure: {p.failureReason}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Sub-tab 3: Auction & Runner-Up */}
              {detailTab === "auction" && (
                <div className="space-y-4">
                  {/* Linked Auction Details */}
                  {detailData.auction ? (
                    <div className="bg-surface-subtle border border-border-default rounded-xl p-4 space-y-2">
                      <div className="font-semibold text-foreground border-b border-border-default pb-2">
                        Linked Auction Document
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-foreground-secondary">
                        <div>
                          <span className="text-foreground-muted">Status:</span>{" "}
                          <Badge variant="neutral" size="xs">
                            {detailData.auction.status}
                          </Badge>
                        </div>
                        <div>
                          <span className="text-foreground-muted">Bid Count:</span>{" "}
                          <span className="font-mono">{detailData.auction.bidCount}</span>
                        </div>
                        <div>
                          <span className="text-foreground-muted">Anti-Sniping Extensions:</span>{" "}
                          <span className="font-mono">
                            {detailData.auction.antiSnipingExtensionsCount}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 text-center text-foreground-muted italic bg-surface-subtle rounded-xl border border-border-default">
                      No linked auction product record found (Orphaned Reference).
                    </div>
                  )}

                  {/* Winning Bid */}
                  {detailData.winningBid && (
                    <div className="bg-surface-subtle border border-border-default rounded-xl p-4 space-y-2">
                      <div className="font-semibold text-foreground border-b border-border-default pb-2">
                        Authoritative Winning Bid
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-foreground-secondary">
                        <div>
                          <span className="text-foreground-muted">Amount:</span>{" "}
                          <span className="font-bold text-status-success font-mono">
                            {formatCurrency(detailData.winningBid.amount)}
                          </span>
                        </div>
                        <div>
                          <span className="text-foreground-muted">Bidder:</span>{" "}
                          <span className="font-mono">{detailData.winningBid.bidderEmail}</span>
                        </div>
                        <div>
                          <span className="text-foreground-muted">Accepted:</span>{" "}
                          <span className="font-mono text-[11px]">
                            {formatDateTime(detailData.winningBid.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Runner-Up Candidate & Invariants Policy */}
                  <div className="bg-surface-subtle border border-border-default rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-border-default pb-2">
                      <h4 className="font-semibold text-foreground flex items-center gap-2">
                        <FaUserFriends className="text-action-primary" /> Runner-Up Oversight
                      </h4>
                      <Badge variant="neutral" size="xs">
                        {detailData.runnerUpOversight?.hasCandidate
                          ? "Candidate Discovered"
                          : "No Second Bidder"}
                      </Badge>
                    </div>

                    {detailData.runnerUpOversight?.hasCandidate ? (
                      <div className="bg-surface border border-border-default rounded-lg p-3 space-y-1.5">
                        <div className="text-xs font-semibold text-foreground">
                          Discovered Runner-Up Bidder
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-foreground-secondary font-mono">
                          <div>
                            Bidder: {detailData.runnerUpOversight.candidateBid?.bidderEmail}
                          </div>
                          <div>
                            Offer Amount:{" "}
                            {formatCurrency(detailData.runnerUpOversight.candidateBid?.amount)}
                          </div>
                          <div>
                            Bid Date:{" "}
                            {formatDateTime(detailData.runnerUpOversight.candidateBid?.createdAt)}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-foreground-muted italic text-xs">
                        No secondary bid exists on this auction.
                      </div>
                    )}

                    <div className="text-[11px] text-foreground-secondary bg-surface p-3 rounded-lg border border-border-default space-y-1">
                      <div className="font-semibold text-status-warning flex items-center gap-1.5">
                        <FaShieldAlt /> Auction Governance Invariant:
                      </div>
                      <p>{detailData.runnerUpOversight?.policy}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-tab 4: Governance Audit Trail */}
              {detailTab === "audit" && (
                <div className="space-y-3">
                  {detailData.auditLogs?.length === 0 ? (
                    <div className="text-center py-8 text-foreground-muted italic text-xs">
                      No administrative audit events recorded for this order or its parent auction.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {detailData.auditLogs.map((log) => (
                        <div
                          key={log.id}
                          className="bg-surface-subtle border border-border-default rounded-lg p-3 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between text-foreground-secondary">
                            <span className="font-semibold text-foreground flex items-center gap-2">
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
                            <span className="font-mono text-[11px] text-foreground-muted">
                              {formatDateTime(log.completedAt)}
                            </span>
                          </div>
                          <div className="text-foreground">
                            Admin: <span className="font-mono text-action-primary">{log.actingAdminEmail}</span> ({log.actingAdminRole})
                          </div>
                          <div className="text-foreground-secondary">
                            Reason: <span className="text-foreground">{log.reason}</span>
                          </div>
                          {log.failureReason && (
                            <div className="text-status-danger font-mono text-[11px]">
                              Failure: {log.failureReason}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Footer */}
              <div className="flex justify-end pt-3 border-t border-border-default">
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

export default AdminOrdersPage;
