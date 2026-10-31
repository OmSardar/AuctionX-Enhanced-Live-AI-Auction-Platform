import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import axiosWithAuth from "../../../redux/slices/axiosWithAuth";
import { useSelector } from "react-redux";
import { toast } from "react-hot-toast";
import {
  FaBalanceScale,
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
  FaTruck,
  FaReceipt,
  FaFileImage,
  FaComments,
  FaGavel,
  FaLock,
  FaUnlock,
  FaStickyNote,
} from "react-icons/fa";

import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Dialog } from "../../ui/Dialog";
import { Skeleton } from "../../ui/Skeleton";
import { EmptyState } from "../../ui/EmptyState";
import { cn, formatCurrency } from "../../../lib/utils";
import AdminDashboardShell from "../layouts/AdminDashboardShell";

const API_URL = import.meta.env.VITE_API_URL || "";

const formatDateTime = (dateString) => {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "N/A";
  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const getReportStatusBadgeVariant = (status) => {
  switch (status?.toLowerCase()) {
    case "resolved":
    case "closed":
      return "success";
    case "in-progress":
      return "info";
    case "pending":
      return "warning";
    case "rejected":
      return "destructive";
    default:
      return "neutral";
  }
};

const getReportTypeBadge = (type) => {
  switch (type) {
    case "delivery":
      return { label: "Delivery Dispute", variant: "warning" };
    case "payment-deposit":
      return { label: "Deposit Dispute", variant: "destructive" };
    case "payment-withdraw":
      return { label: "Withdrawal Dispute", variant: "destructive" };
    case "illegal":
      return { label: "Listing Violation", variant: "info" };
    default:
      return { label: "General Complaint", variant: "neutral" };
  }
};

const AdminDisputesPage = () => {
  const auth = useSelector((state) => state.auth);
  const currentAdminRole = auth.role || auth.user?.role || "admin";

  // Navigation tab: 'all' | 'orderDisputes' | 'contestedOrders'
  const [activeTab, setActiveTab] = useState("all");

  // Directory state
  const [disputes, setDisputes] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });
  const [summary, setSummary] = useState({
    totalCases: 0,
    unresolvedCount: 0,
    resolvedCount: 0,
    closedCount: 0,
    rejectedCount: 0,
    types: {
      deliveryDisputes: 0,
      paymentDisputes: 0,
      paymentDepositDisputes: 0,
      paymentWithdrawDisputes: 0,
      listingReports: 0,
      otherComplaints: 0,
    },
    attachmentCasesCount: 0,
    contestedOrdersCount: 0,
    reconciliationPaymentsCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [hasOrderOnly, setHasOrderOnly] = useState(false);
  const [hasAttachmentsOnly, setHasAttachmentsOnly] = useState(false);
  const [sortBy, setSortBy] = useState("date");
  const [sortOrder, setSortOrder] = useState("desc");

  // Contested orders triage data
  const [contestedOrders, setContestedOrders] = useState([]);
  const [isContestedLoading, setIsContestedLoading] = useState(false);

  // Case investigation modal
  const [selectedCaseId, setSelectedCaseId] = useState(null);
  const [caseDetail, setCaseDetail] = useState(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState("overview"); // 'overview' | 'evidence' | 'order' | 'auction' | 'hold' | 'notes' | 'audit'

  // Stage 7: Dispute Hold & Internal Notes state
  const [isHoldDialogOpen, setIsHoldDialogOpen] = useState(false);
  const [holdReason, setHoldReason] = useState("");
  const [isSubmittingHold, setIsSubmittingHold] = useState(false);

  const [isReleaseDialogOpen, setIsReleaseDialogOpen] = useState(false);
  const [releaseReason, setReleaseReason] = useState("");
  const [isSubmittingRelease, setIsSubmittingRelease] = useState(false);

  const [newNoteContent, setNewNoteContent] = useState("");
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 350);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Fetch summary telemetry
  const fetchSummary = useCallback(async () => {
    try {
      const res = await axiosWithAuth.get(`${API_URL}/api/admin/disputes/summary`, {
        withCredentials: true,
      });
      if (res.data?.success) {
        setSummary(res.data.summary);
      }
    } catch (err) {
      console.warn("Failed to load dispute summary:", err);
    }
  }, []);

  // Fetch disputes directory
  const fetchDisputes = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        status: statusFilter,
        category: activeTab === "orderDisputes" ? "order_disputes" : categoryFilter,
        hasOrder: hasOrderOnly ? "true" : undefined,
        hasAttachments: hasAttachmentsOnly ? "true" : undefined,
        sortBy,
        sortOrder,
      };

      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();

      const res = await axiosWithAuth.get(`${API_URL}/api/admin/disputes`, {
        params,
        withCredentials: true,
      });

      if (res.data?.success) {
        setDisputes(res.data.disputes || []);
        setPagination((prev) => ({
          ...prev,
          total: res.data.pagination.total,
          totalPages: res.data.pagination.totalPages,
        }));
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Failed to load disputes directory";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [
    pagination.page,
    pagination.limit,
    statusFilter,
    categoryFilter,
    activeTab,
    hasOrderOnly,
    hasAttachmentsOnly,
    debouncedSearch,
    sortBy,
    sortOrder,
  ]);

  // Fetch contested orders triage
  const fetchContestedOrders = useCallback(async () => {
    setIsContestedLoading(true);
    try {
      const res = await axiosWithAuth.get(`${API_URL}/api/admin/disputes/contested/orders`, {
        withCredentials: true,
      });
      if (res.data?.success) {
        setContestedOrders(res.data.contestedOrders || []);
      }
    } catch (err) {
      console.warn("Failed to load contested orders:", err);
    } finally {
      setIsContestedLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    if (activeTab === "all" || activeTab === "orderDisputes") {
      fetchDisputes();
    } else if (activeTab === "contestedOrders") {
      fetchContestedOrders();
    }
  }, [activeTab, fetchDisputes, fetchContestedOrders]);

  // Handle open investigation detail
  const handleOpenDetailModal = async (caseId) => {
    setSelectedCaseId(caseId);
    setDetailTab("overview");
    setIsDetailLoading(true);
    setCaseDetail(null);

    try {
      const res = await axiosWithAuth.get(`${API_URL}/api/admin/disputes/${caseId}`, {
        withCredentials: true,
      });
      if (res.data?.success) {
        setCaseDetail(res.data.data);
      }
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to fetch dispute investigation details";
      toast.error(msg);
      setSelectedCaseId(null);
    } finally {
      setIsDetailLoading(false);
    }
  };

  const handleCloseDetailModal = () => {
    setSelectedCaseId(null);
    setCaseDetail(null);
    setIsHoldDialogOpen(false);
    setIsReleaseDialogOpen(false);
  };

  // Place Dispute Hold
  const handlePlaceHold = async () => {
    if (!holdReason || holdReason.trim().length < 5) {
      toast.error("Please provide a meaningful hold reason (at least 5 characters).");
      return;
    }
    setIsSubmittingHold(true);
    try {
      const res = await axiosWithAuth.post(
        `${API_URL}/api/admin/disputes/${selectedCaseId}/hold`,
        { reason: holdReason.trim(), idempotencyKey: `UI_HOLD_${Date.now()}` },
        { withCredentials: true }
      );
      if (res.data?.success) {
        toast.success(res.data.message || "Dispute hold placed successfully");
        setIsHoldDialogOpen(false);
        setHoldReason("");
        handleOpenDetailModal(selectedCaseId);
        fetchDisputes();
      }
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to place dispute hold";
      toast.error(msg);
    } finally {
      setIsSubmittingHold(false);
    }
  };

  // Release Dispute Hold
  const handleReleaseHold = async () => {
    if (!releaseReason || releaseReason.trim().length < 5) {
      toast.error("Please provide a meaningful release reason (at least 5 characters).");
      return;
    }
    setIsSubmittingRelease(true);
    try {
      const res = await axiosWithAuth.post(
        `${API_URL}/api/admin/disputes/${selectedCaseId}/release-hold`,
        { releaseReason: releaseReason.trim(), idempotencyKey: `UI_REL_${Date.now()}` },
        { withCredentials: true }
      );
      if (res.data?.success) {
        toast.success(res.data.message || "Dispute hold released successfully");
        setIsReleaseDialogOpen(false);
        setReleaseReason("");
        handleOpenDetailModal(selectedCaseId);
        fetchDisputes();
      }
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to release dispute hold";
      toast.error(msg);
    } finally {
      setIsSubmittingRelease(false);
    }
  };

  // Add Internal Note
  const handleAddNote = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!newNoteContent || newNoteContent.trim().length < 3) {
      toast.error("Note must be at least 3 characters long.");
      return;
    }
    setIsSubmittingNote(true);
    try {
      const res = await axiosWithAuth.post(
        `${API_URL}/api/admin/disputes/${selectedCaseId}/notes`,
        { content: newNoteContent.trim() },
        { withCredentials: true }
      );
      if (res.data?.success) {
        toast.success("Internal note added");
        setNewNoteContent("");
        if (caseDetail) {
          setCaseDetail((prev) => ({
            ...prev,
            internalNotes: [res.data.note, ...(prev.internalNotes || [])],
          }));
        }
      }
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to add internal note";
      toast.error(msg);
    } finally {
      setIsSubmittingNote(false);
    }
  };

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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border-subtle pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-text-muted">
              <Link
                to="/admin/dashboard"
                className="hover:text-foreground transition-colors flex items-center gap-1"
              >
                <FaArrowLeft className="text-xs" /> Admin Console
              </Link>
              <span>/</span>
              <span className="text-foreground">Disputes & Resolution Management</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <FaBalanceScale className="text-action-primary" /> Disputes & Resolution Management
            </h1>
            <p className="text-sm text-text-muted">
              Investigate contested orders, buyer/seller complaints, delivery grievances, and payment concerns.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link to="/admin/reconciliation">
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2 border-rose-500/40 bg-rose-950/20 hover:bg-rose-900/30 text-rose-300"
              >
                <FaShieldAlt className="text-xs text-rose-400" /> Recovery Console
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                fetchSummary();
                if (activeTab === "contestedOrders") fetchContestedOrders();
                else fetchDisputes();
                toast.success("Dispute telemetry refreshed");
              }}
              className="flex items-center gap-2 border-border-default bg-surface hover:bg-surface-subtle text-foreground"
            >
              <FaSync className={isLoading || isContestedLoading ? "animate-spin" : ""} /> Refresh
            </Button>
          </div>
        </div>

        {/* Operational KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Card 1: Total Cases */}
          <div className="bg-surface border border-border-default rounded-xl p-4 space-y-1 shadow-xs">
            <div className="flex items-center justify-between text-text-muted text-xs">
              <span className="font-medium">Total Cases</span>
              <FaBalanceScale className="text-text-muted text-sm" />
            </div>
            <div className="text-2xl font-bold text-foreground tracking-tight">
              {summary.totalCases}
            </div>
            <div className="text-[11px] text-text-muted">All recorded reports & complaints</div>
          </div>

          {/* Card 2: Unresolved Complaints */}
          <div
            className={cn(
              "rounded-xl p-4 space-y-1 shadow-xs border transition-all",
              summary.unresolvedCount > 0
                ? "bg-amber-500/10 border-amber-600/40 text-amber-300"
                : "bg-surface border-border-default text-text-muted"
            )}
          >
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">Unresolved Cases</span>
              <FaClock className={cn("text-sm", summary.unresolvedCount > 0 ? "text-amber-400" : "text-text-muted")} />
            </div>
            <div
              className={cn(
                "text-2xl font-bold tracking-tight",
                summary.unresolvedCount > 0 ? "text-amber-400" : "text-foreground"
              )}
            >
              {summary.unresolvedCount}
            </div>
            <div className="text-[11px] text-text-muted">Pending or in-progress investigation</div>
          </div>

          {/* Card 3: Delivery Disputes */}
          <div className="bg-surface border border-border-default rounded-xl p-4 space-y-1 shadow-xs">
            <div className="flex items-center justify-between text-text-muted text-xs">
              <span className="font-medium">Order & Delivery</span>
              <FaTruck className="text-indigo-400 text-sm" />
            </div>
            <div className="text-2xl font-bold text-indigo-400 tracking-tight">
              {summary.types?.deliveryDisputes || 0}
            </div>
            <div className="text-[11px] text-text-muted">Order fulfillment grievances</div>
          </div>

          {/* Card 4: Payment Disputes */}
          <div className="bg-surface border border-border-default rounded-xl p-4 space-y-1 shadow-xs">
            <div className="flex items-center justify-between text-text-muted text-xs">
              <span className="font-medium">Payment Disputes</span>
              <FaMoneyBillWave className="text-rose-400 text-sm" />
            </div>
            <div className="text-2xl font-bold text-rose-400 tracking-tight">
              {summary.types?.paymentDisputes || 0}
            </div>
            <div className="text-[11px] text-text-muted">Deposit & withdrawal issues</div>
          </div>

          {/* Card 5: Resolved Cases */}
          <div className="bg-surface border border-border-default rounded-xl p-4 space-y-1 shadow-xs">
            <div className="flex items-center justify-between text-text-muted text-xs">
              <span className="font-medium">Resolved / Closed</span>
              <FaCheckCircle className="text-emerald-400 text-sm" />
            </div>
            <div className="text-2xl font-bold text-emerald-400 tracking-tight">
              {summary.resolvedCount + summary.closedCount}
            </div>
            <div className="text-[11px] text-text-muted">{summary.rejectedCount} rejected with notes</div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-border-subtle gap-2">
          <button
            onClick={() => setActiveTab("all")}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 transition-all flex items-center gap-2",
              activeTab === "all"
                ? "border-action-primary text-action-primary"
                : "border-transparent text-text-muted hover:text-foreground"
            )}
          >
            <FaBalanceScale /> All Cases & Reports
          </button>
          <button
            onClick={() => setActiveTab("orderDisputes")}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 transition-all flex items-center gap-2",
              activeTab === "orderDisputes"
                ? "border-action-primary text-action-primary"
                : "border-transparent text-text-muted hover:text-foreground"
            )}
          >
            <FaReceipt /> Order & Payment Disputes
            {summary.types?.deliveryDisputes + summary.types?.paymentDisputes > 0 && (
              <Badge variant="warning" size="xs">
                {summary.types.deliveryDisputes + summary.types.paymentDisputes}
              </Badge>
            )}
          </button>
          <button
            onClick={() => setActiveTab("contestedOrders")}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 transition-all flex items-center gap-2",
              activeTab === "contestedOrders"
                ? "border-action-primary text-action-primary"
                : "border-transparent text-text-muted hover:text-foreground"
            )}
          >
            <FaGavel /> Contested Orders Triage
            {summary.contestedOrdersCount > 0 && (
              <Badge variant="destructive" size="xs">
                {summary.contestedOrdersCount}
              </Badge>
            )}
          </button>
        </div>

        {/* ========================================================================= */}
        {/* TABS 1 & 2: DISPUTES DIRECTORY */}
        {/* ========================================================================= */}
        {(activeTab === "all" || activeTab === "orderDisputes") && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="bg-surface border border-border-default rounded-xl p-4 space-y-3 shadow-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Search Input */}
                <div className="relative">
                  <FaSearch className="absolute left-3 top-3 text-text-muted text-xs" />
                  <input
                    type="text"
                    placeholder="Search complaint, case ID, reporter, seller..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-surface-subtle border border-border-default rounded-lg pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-text-muted focus:outline-hidden focus:border-action-primary transition-colors"
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
                    className="w-full bg-surface-subtle border border-border-default rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-hidden focus:border-action-primary transition-colors"
                  >
                    <option value="all">All Statuses</option>
                    <option value="pending">pending (Awaiting Review)</option>
                    <option value="in-progress">in-progress (Active)</option>
                    <option value="resolved">resolved (Closed Favorably)</option>
                    <option value="closed">closed</option>
                    <option value="rejected">rejected (Dismissed)</option>
                  </select>
                </div>

                {/* Category Filter (if activeTab is 'all') */}
                {activeTab === "all" ? (
                  <div>
                    <select
                      value={categoryFilter}
                      onChange={(e) => {
                        setCategoryFilter(e.target.value);
                        setPagination((prev) => ({ ...prev, page: 1 }));
                      }}
                      className="w-full bg-surface-subtle border border-border-default rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-hidden focus:border-action-primary transition-colors"
                    >
                      <option value="all">All Categories</option>
                      <option value="delivery">Delivery Grievance</option>
                      <option value="payment-deposit">Payment Deposit</option>
                      <option value="payment-withdraw">Payment Withdrawal</option>
                      <option value="illegal">Listing Violation</option>
                      <option value="other">Other Complaint</option>
                    </select>
                  </div>
                ) : (
                  <div>
                    <select
                      value={categoryFilter}
                      onChange={(e) => {
                        setCategoryFilter(e.target.value);
                        setPagination((prev) => ({ ...prev, page: 1 }));
                      }}
                      className="w-full bg-surface-subtle border border-border-default rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-hidden focus:border-action-primary transition-colors"
                    >
                      <option value="all">All Dispute Sub-types</option>
                      <option value="delivery">Delivery Grievances</option>
                      <option value="payment-deposit">Payment Deposit Issues</option>
                      <option value="payment-withdraw">Payment Withdrawal Issues</option>
                    </select>
                  </div>
                )}

                {/* Sort Order */}
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))
                    }
                    className="flex-1 bg-surface-subtle border border-border-default rounded-lg px-3 py-1.5 text-xs text-foreground hover:bg-surface flex items-center justify-center gap-2 transition-colors"
                  >
                    {sortOrder === "asc" ? <FaSortAmountUp /> : <FaSortAmountDown />}
                    <span>{sortOrder === "asc" ? "Ascending" : "Descending"}</span>
                  </button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearchQuery("");
                      setStatusFilter("all");
                      setCategoryFilter("all");
                      setHasOrderOnly(false);
                      setHasAttachmentsOnly(false);
                      setSortBy("date");
                      setSortOrder("desc");
                      setPagination((prev) => ({ ...prev, page: 1 }));
                    }}
                    className="text-xs border-border-default text-text-muted hover:text-foreground"
                  >
                    Reset
                  </Button>
                </div>
              </div>

              {/* Quick Filter Toggles */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border-subtle text-xs">
                <span className="text-text-muted text-[11px] font-medium mr-1">Toggles:</span>
                <button
                  onClick={() => {
                    setHasOrderOnly((prev) => !prev);
                    setPagination((prev) => ({ ...prev, page: 1 }));
                  }}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-xs font-medium border transition-colors flex items-center gap-1.5",
                    hasOrderOnly
                      ? "bg-action-primary/15 border-action-primary text-action-primary"
                      : "bg-surface-subtle border-border-default text-text-muted hover:text-foreground"
                  )}
                >
                  <FaReceipt className="text-[10px]" /> Linked to Order Only
                </button>

                <button
                  onClick={() => {
                    setHasAttachmentsOnly((prev) => !prev);
                    setPagination((prev) => ({ ...prev, page: 1 }));
                  }}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-xs font-medium border transition-colors flex items-center gap-1.5",
                    hasAttachmentsOnly
                      ? "bg-indigo-500/15 border-indigo-500 text-indigo-400"
                      : "bg-surface-subtle border-border-default text-text-muted hover:text-foreground"
                  )}
                >
                  <FaFileImage className="text-[10px]" /> Has Evidence ({summary.attachmentCasesCount})
                </button>
              </div>
            </div>

            {/* Cases Table */}
            <div className="bg-surface border border-border-default rounded-xl overflow-hidden shadow-xs">
              {isLoading ? (
                <div className="p-6 space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <Skeleton className="h-10 w-24 rounded-lg bg-surface-subtle" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-1/3 bg-surface-subtle" />
                        <Skeleton className="h-3 w-1/2 bg-surface-subtle" />
                      </div>
                      <Skeleton className="h-6 w-20 bg-surface-subtle" />
                    </div>
                  ))}
                </div>
              ) : error ? (
                <div className="p-8 text-center space-y-3">
                  <FaExclamationTriangle className="text-3xl text-rose-500 mx-auto" />
                  <div className="text-rose-400 font-medium">{error}</div>
                  <Button variant="outline" size="sm" onClick={fetchDisputes}>
                    Retry
                  </Button>
                </div>
              ) : disputes.length === 0 ? (
                <div className="p-12 text-center space-y-3">
                  <EmptyState
                    icon={<FaBalanceScale className="text-4xl text-text-muted mx-auto" />}
                    title="No Dispute Cases Found"
                    description="No complaints match the specified search, category, or status parameters."
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-foreground">
                    <thead className="bg-surface-subtle text-[11px] uppercase tracking-wider text-text-muted border-b border-border-default font-semibold">
                      <tr>
                        <th className="py-3 px-4">Case Type & ID</th>
                        <th className="py-3 px-4">Complainant</th>
                        <th className="py-3 px-4">Complaint Overview</th>
                        <th className="py-3 px-4">Linked Context</th>
                        <th className="py-3 px-4">Status & Date</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {disputes.map((d) => {
                        const typeInfo = getReportTypeBadge(d.reportType);
                        return (
                          <tr key={d.id} className="hover:bg-surface-subtle transition-colors">
                            {/* Type & ID */}
                            <td className="py-3 px-4">
                              <div className="space-y-1">
                                <Badge variant={typeInfo.variant} size="xs">
                                  {typeInfo.label}
                                </Badge>
                                <div className="font-mono text-[10px] text-text-muted">
                                  #{d.id.slice(-8)}
                                </div>
                              </div>
                            </td>

                            {/* Complainant */}
                            <td className="py-3 px-4">
                              <div className="space-y-0.5">
                                <div className="font-medium text-foreground">
                                  {d.reporter?.name}
                                </div>
                                <div className="font-mono text-[11px] text-action-primary truncate max-w-[150px]">
                                  {d.reporter?.email}
                                </div>
                              </div>
                            </td>

                            {/* Complaint Overview */}
                            <td className="py-3 px-4 max-w-[280px]">
                              <div className="space-y-1">
                                <div className="text-foreground truncate font-normal" title={d.reportText}>
                                  {d.reportText}
                                </div>
                                {d.hasAttachments && (
                                  <div className="flex items-center gap-1 text-[10px] text-indigo-400">
                                    <FaFileImage /> {d.attachmentCount} Attachment(s)
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Linked Context */}
                            <td className="py-3 px-4">
                              <div className="space-y-0.5">
                                {d.orderId && (
                                  <div className="text-[11px] font-mono text-amber-400">
                                    Order: #{d.orderId.slice(-8)}
                                  </div>
                                )}
                                {d.productId && (
                                  <div className="text-[10px] font-mono text-text-muted">
                                    Auction: #{d.productId.slice(-8)}
                                  </div>
                                )}
                                {!d.orderId && !d.productId && (
                                  <div className="text-[10px] text-text-muted italic">
                                    General User Grievance
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Status & Date */}
                            <td className="py-3 px-4">
                              <div className="space-y-1">
                                <Badge variant={getReportStatusBadgeVariant(d.status)} size="xs">
                                  {d.status}
                                </Badge>
                                <div className="text-[10px] text-text-muted font-mono">
                                  {formatDateTime(d.date)}
                                </div>
                              </div>
                            </td>

                            {/* Actions */}
                            <td className="py-3 px-4 text-right">
                              <Button
                                variant="outline"
                                size="xs"
                                onClick={() => handleOpenDetailModal(d.id)}
                                className="border-border-default bg-surface hover:bg-surface-subtle text-foreground inline-flex items-center gap-1.5"
                              >
                                <FaEye /> Investigate
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination Bar */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-border-subtle bg-surface-subtle text-xs text-text-muted">
                <div>
                  Showing {disputes.length} of {pagination.total} cases
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
        {/* TAB 3: CONTESTED ORDERS TRIAGE */}
        {/* ========================================================================= */}
        {activeTab === "contestedOrders" && (
          <div className="space-y-4">
            <div className="bg-surface border border-border-default rounded-xl p-5 space-y-4 shadow-xs">
              <div className="space-y-1">
                <h3 className="font-semibold text-foreground text-base flex items-center gap-2">
                  <FaGavel className="text-amber-400" /> Contested Orders Queue
                </h3>
                <p className="text-xs text-text-muted">
                  Active orders that currently have unreviewed buyer complaints or delivery grievances attached.
                </p>
              </div>

              {isContestedLoading ? (
                <div className="p-8 text-center text-text-muted">
                  <FaSync className="animate-spin text-2xl mx-auto mb-2 text-action-primary" />
                  Loading contested orders queue...
                </div>
              ) : contestedOrders.length === 0 ? (
                <div className="p-8 text-center space-y-2 border border-emerald-900/30 bg-emerald-950/10 rounded-xl">
                  <FaCheckCircle className="text-3xl text-emerald-400 mx-auto" />
                  <div className="font-semibold text-emerald-300">No Contested Orders Active</div>
                  <div className="text-xs text-text-muted max-w-md mx-auto">
                    All settled auction orders are free from open delivery or payment grievances.
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {contestedOrders.map((item) => (
                    <div
                      key={item.caseId}
                      className="bg-amber-500/10 border border-amber-600/30 rounded-lg p-3 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between font-semibold text-foreground">
                        <span className="truncate max-w-[180px]">{item.orderTitle}</span>
                        <span className="font-bold text-amber-400">
                          {formatCurrency(item.finalPrice)}
                        </span>
                      </div>
                      <div className="text-text-muted font-mono text-[11px]">
                        Complainant: {item.reporterEmail}
                      </div>
                      <div className="text-foreground text-[11px] line-clamp-2">
                        "{item.complaintSummary}"
                      </div>
                      <div className="flex items-center justify-between text-[11px] pt-2 border-t border-amber-600/20">
                        <Badge variant="warning" size="xs">
                          {item.reportType}
                        </Badge>
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => handleOpenDetailModal(item.caseId)}
                          className="text-[10px] border-border-default bg-surface hover:bg-surface-subtle text-foreground"
                        >
                          Investigate Case
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* CASE INVESTIGATION MODAL */}
      {/* ========================================================================= */}
      <Dialog
        isOpen={Boolean(selectedCaseId)}
        onClose={handleCloseDetailModal}
        title="Dispute Case Investigation"
        className="max-w-4xl"
      >
        <div
          className="space-y-4 max-h-[80vh] overflow-y-auto overscroll-contain pr-1 text-xs"
          data-lenis-prevent="true"
        >
          {isDetailLoading || !caseDetail ? (
            <div className="p-8 space-y-4">
              <Skeleton className="h-6 w-1/2 bg-surface-subtle" />
              <Skeleton className="h-24 w-full bg-surface-subtle" />
              <Skeleton className="h-24 w-full bg-surface-subtle" />
            </div>
          ) : (
            <>
              {/* Header Box */}
              <div className="bg-surface border border-border-default rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={getReportTypeBadge(caseDetail.case?.reportType).variant} size="sm">
                      {getReportTypeBadge(caseDetail.case?.reportType).label}
                    </Badge>
                    <Badge variant={getReportStatusBadgeVariant(caseDetail.case?.status)} size="sm">
                      {caseDetail.case?.status}
                    </Badge>
                  </div>
                  <div className="font-mono text-text-muted text-xs">
                    Case ID: {caseDetail.case?.id}
                  </div>
                  <div className="text-[11px] text-text-muted">
                    Logged: {formatDateTime(caseDetail.case?.date)}
                  </div>
                </div>

                {caseDetail.order && (
                  <div className="text-right space-y-0.5">
                    <div className="text-lg font-bold text-action-primary">
                      {formatCurrency(caseDetail.order.finalPrice)}
                    </div>
                    <div className="text-[10px] text-text-muted font-mono">
                      Order #{caseDetail.order.id.slice(-8)}
                    </div>
                  </div>
                )}
              </div>

              {/* Inconsistency Alert Box if any */}
              {caseDetail.inconsistencies?.length > 0 && (
                <div className="bg-rose-950/20 border border-rose-800/60 rounded-xl p-3 space-y-1">
                  <div className="font-bold text-rose-400 flex items-center gap-1.5">
                    <FaExclamationTriangle /> Investigation Anomaly Detected:
                  </div>
                  {caseDetail.inconsistencies.map((inc, i) => (
                    <div key={i} className="text-[11px] text-foreground">
                      • <span className="font-mono text-rose-300">[{inc.code}]</span> {inc.message}
                    </div>
                  ))}
                </div>
              )}

              {/* Sub-tab Navigation */}
              <div className="flex border-b border-border-subtle gap-2">
                <button
                  onClick={() => setDetailTab("overview")}
                  className={cn(
                    "px-3 py-1.5 font-medium border-b-2 text-xs transition-colors",
                    detailTab === "overview"
                      ? "border-action-primary text-action-primary"
                      : "border-transparent text-text-muted hover:text-foreground"
                  )}
                >
                  Case Overview
                </button>
                <button
                  onClick={() => setDetailTab("evidence")}
                  className={cn(
                    "px-3 py-1.5 font-medium border-b-2 text-xs transition-colors",
                    detailTab === "evidence"
                      ? "border-action-primary text-action-primary"
                      : "border-transparent text-text-muted hover:text-foreground"
                  )}
                >
                  Evidence ({caseDetail.case?.attachments?.length || 0})
                </button>
                <button
                  onClick={() => setDetailTab("order")}
                  className={cn(
                    "px-3 py-1.5 font-medium border-b-2 text-xs transition-colors",
                    detailTab === "order"
                      ? "border-action-primary text-action-primary"
                      : "border-transparent text-text-muted hover:text-foreground"
                  )}
                >
                  Linked Order & Payments
                </button>
                <button
                  onClick={() => setDetailTab("auction")}
                  className={cn(
                    "px-3 py-1.5 font-medium border-b-2 text-xs transition-colors",
                    detailTab === "auction"
                      ? "border-action-primary text-action-primary"
                      : "border-transparent text-text-muted hover:text-foreground"
                  )}
                >
                  Auction & Bids
                </button>
                <button
                  onClick={() => setDetailTab("hold")}
                  className={cn(
                    "px-3 py-1.5 font-medium border-b-2 text-xs transition-colors flex items-center gap-1.5",
                    detailTab === "hold"
                      ? "border-action-primary text-action-primary"
                      : "border-transparent text-text-muted hover:text-foreground"
                  )}
                >
                  <FaLock className="text-[10px]" /> Dispute Hold & Safety
                  {caseDetail.order?.isDisputeHoldActive && (
                    <Badge variant="destructive" size="xs">
                      HOLD ACTIVE
                    </Badge>
                  )}
                </button>
                <button
                  onClick={() => setDetailTab("notes")}
                  className={cn(
                    "px-3 py-1.5 font-medium border-b-2 text-xs transition-colors flex items-center gap-1.5",
                    detailTab === "notes"
                      ? "border-action-primary text-action-primary"
                      : "border-transparent text-text-muted hover:text-foreground"
                  )}
                >
                  <FaStickyNote className="text-[10px]" /> Notes ({caseDetail.internalNotes?.length || 0})
                </button>
                <button
                  onClick={() => setDetailTab("audit")}
                  className={cn(
                    "px-3 py-1.5 font-medium border-b-2 text-xs transition-colors",
                    detailTab === "audit"
                      ? "border-action-primary text-action-primary"
                      : "border-transparent text-text-muted hover:text-foreground"
                  )}
                >
                  Audit History ({caseDetail.auditLogs?.length || 0})
                </button>
              </div>

              {/* Sub-tab 1: Case Overview */}
              {detailTab === "overview" && (
                <div className="space-y-4">
                  {/* Complaint Narrative */}
                  <div className="bg-surface border border-border-default rounded-xl p-4 space-y-2 shadow-xs">
                    <div className="font-semibold text-foreground">Complainant Narrative</div>
                    <div className="bg-surface-subtle p-3 rounded-lg border border-border-default text-foreground whitespace-pre-wrap leading-relaxed text-xs">
                      {caseDetail.case?.reportText}
                    </div>
                  </div>

                  {/* Parties */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-surface border border-border-default rounded-xl p-4 space-y-1.5 shadow-xs">
                      <div className="font-semibold text-foreground flex items-center gap-2 border-b border-border-subtle pb-1.5">
                        <FaUserCheck className="text-action-primary" /> Reporting Party
                      </div>
                      <div>
                        <span className="text-text-muted">Name:</span>{" "}
                        <span className="text-foreground font-medium">{caseDetail.case?.reporter?.name}</span>
                      </div>
                      <div>
                        <span className="text-text-muted">Email:</span>{" "}
                        <span className="text-action-primary font-mono">{caseDetail.case?.reporter?.email}</span>
                      </div>
                    </div>

                    <div className="bg-surface border border-border-default rounded-xl p-4 space-y-1.5 shadow-xs">
                      <div className="font-semibold text-foreground flex items-center gap-2 border-b border-border-subtle pb-1.5">
                        <FaReceipt className="text-indigo-400" /> Reported Seller
                      </div>
                      <div>
                        <span className="text-text-muted">Seller Email:</span>{" "}
                        <span className="text-indigo-400 font-mono">
                          {caseDetail.case?.seller?.email || "Not specified in report"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Resolution Notes if present */}
                  {caseDetail.case?.resolutionNote && (
                    <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-xl p-4 space-y-1">
                      <div className="font-semibold text-emerald-400 flex items-center gap-2">
                        <FaCheckCircle /> Authoritative Resolution Record
                      </div>
                      <div className="text-foreground text-xs">
                        {caseDetail.case.resolutionNote}
                      </div>
                      <div className="text-[10px] text-text-muted font-mono pt-1">
                        Resolved By: {caseDetail.case.resolvedBy} on {formatDateTime(caseDetail.case.resolvedAt)}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Sub-tab 2: Evidence */}
              {detailTab === "evidence" && (
                <div className="space-y-4">
                  {caseDetail.case?.attachments?.length === 0 ? (
                    <div className="p-8 text-center text-text-muted italic border border-border-default rounded-xl bg-surface-subtle">
                      No photographic or document attachments were provided with this complaint.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="font-semibold text-foreground">Complainant Evidence Gallery</div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {caseDetail.case.attachments.map((att, i) => (
                          <div
                            key={i}
                            className="bg-surface border border-border-default rounded-lg p-2 space-y-1 text-center shadow-xs"
                          >
                            <img
                              src={att.secure_url}
                              alt={`Evidence attachment ${i + 1}`}
                              className="w-full h-32 object-cover rounded-md bg-surface-subtle"
                            />
                            <a
                              href={att.secure_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] text-action-primary hover:underline block pt-1"
                            >
                              View Full Size ↗
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Documented Capability Gap */}
                  <div className="bg-surface border border-border-default rounded-xl p-4 text-[11px] text-text-muted space-y-1 shadow-xs">
                    <div className="font-semibold text-foreground flex items-center gap-2">
                      <FaComments className="text-text-muted" /> Buyer/Seller Direct Messaging Capability
                    </div>
                    <div>{caseDetail.governance?.messagingCapability?.notes}</div>
                  </div>
                </div>
              )}

              {/* Sub-tab 3: Linked Order & Payments */}
              {detailTab === "order" && (
                <div className="space-y-4">
                  {caseDetail.order ? (
                    <div className="bg-surface border border-border-default rounded-xl p-4 space-y-2 shadow-xs">
                      <div className="font-semibold text-foreground flex items-center justify-between border-b border-border-subtle pb-2">
                        <span>Linked Order Information</span>
                        <Badge variant="neutral" size="xs">
                          {caseDetail.order.status}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-foreground">
                        <div>
                          <span className="text-text-muted">Item Title:</span>{" "}
                          <span className="font-medium text-foreground">{caseDetail.order.title}</span>
                        </div>
                        <div>
                          <span className="text-text-muted">Final Price:</span>{" "}
                          <span className="font-bold text-action-primary font-mono">
                            {formatCurrency(caseDetail.order.finalPrice)}
                          </span>
                        </div>
                        <div>
                          <span className="text-text-muted">Winner Email:</span>{" "}
                          <span className="font-mono">{caseDetail.order.winnerEmail}</span>
                        </div>
                        <div>
                          <span className="text-text-muted">Seller Email:</span>{" "}
                          <span className="font-mono">{caseDetail.order.sellerEmail}</span>
                        </div>
                        <div>
                          <span className="text-text-muted">Shipping Address:</span>{" "}
                          <span>{caseDetail.order.shippingAddress}</span>
                        </div>
                        <div>
                          <span className="text-text-muted">Payment Deadline:</span>{" "}
                          <span className="font-mono">{formatDateTime(caseDetail.order.paymentDeadline)}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 text-center text-text-muted italic bg-surface-subtle rounded-xl border border-border-default">
                      No linked order obligation record found for this complaint.
                    </div>
                  )}

                  {/* Payment Attempt Records */}
                  <div className="space-y-2">
                    <h4 className="font-semibold text-foreground">Associated Payment Ledger</h4>
                    {caseDetail.payments?.length === 0 ? (
                      <div className="p-4 text-center text-text-muted italic border border-border-default rounded-xl bg-surface-subtle">
                        No payment transaction attempts recorded for this case.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {caseDetail.payments.map((p) => (
                          <div
                            key={p.id}
                            className="bg-surface border border-border-default rounded-lg p-3 space-y-1 shadow-xs"
                          >
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-foreground">
                                {formatCurrency(p.amountInRupees)} ({p.currency})
                              </span>
                              <Badge variant="neutral" size="xs">
                                {p.status}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-[11px] text-text-muted font-mono">
                              <div>Provider Order: {p.razorpayOrderId || "N/A"}</div>
                              <div>Payment ID: {p.razorpayPaymentId || "N/A"}</div>
                            </div>
                            {p.failureReason && (
                              <div className="text-rose-400 text-[11px]">
                                Failure Reason: {p.failureReason}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Sub-tab 4: Auction & Bids */}
              {detailTab === "auction" && (
                <div className="space-y-4">
                  {caseDetail.auction ? (
                    <div className="bg-surface border border-border-default rounded-xl p-4 space-y-2 shadow-xs">
                      <div className="font-semibold text-foreground border-b border-border-subtle pb-2">
                        Linked Auction Document
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-foreground">
                        <div>
                          <span className="text-text-muted">Auction Name:</span>{" "}
                          <span className="font-medium text-foreground">{caseDetail.auction.name}</span>
                        </div>
                        <div>
                          <span className="text-text-muted">Status:</span>{" "}
                          <Badge variant="neutral" size="xs">
                            {caseDetail.auction.status}
                          </Badge>
                        </div>
                        <div>
                          <span className="text-text-muted">Total Bids:</span>{" "}
                          <span className="font-mono">{caseDetail.auction.bidCount}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 text-center text-text-muted italic bg-surface-subtle rounded-xl border border-border-default">
                      No linked auction listing found for this complaint.
                    </div>
                  )}

                  {/* Top Bids */}
                  {caseDetail.topBids?.length > 0 && (
                    <div className="bg-surface border border-border-default rounded-xl p-4 space-y-2 shadow-xs">
                      <div className="font-semibold text-foreground border-b border-border-subtle pb-2">
                        Authoritative Accepted Bids
                      </div>
                      <div className="space-y-2">
                        {caseDetail.topBids.map((b, idx) => (
                          <div
                            key={b.id}
                            className="flex items-center justify-between text-xs bg-surface-subtle p-2.5 rounded-lg border border-border-default"
                          >
                            <span className="font-bold text-action-primary font-mono">
                              #{idx + 1}: {formatCurrency(b.amount)}
                            </span>
                            <span className="font-mono text-text-muted">{b.bidderEmail}</span>
                            <span className="text-[11px] text-text-muted font-mono">
                              {formatDateTime(b.createdAt)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Sub-tab: Dispute Hold & Lifecycle Safety */}
              {detailTab === "hold" && (
                <div className="space-y-4">
                  {caseDetail.order ? (
                    <>
                      {/* Active Hold Status Card */}
                      <div
                        className={cn(
                          "border rounded-xl p-4 space-y-3 shadow-xs",
                          caseDetail.order.isDisputeHoldActive
                            ? "bg-rose-950/20 border-rose-800/60"
                            : "bg-surface border-border-default"
                        )}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-subtle pb-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-foreground">Dispute Hold Protection</span>
                              {caseDetail.order.isDisputeHoldActive ? (
                                <Badge variant="destructive" size="xs">
                                  HOLD ACTIVE ({caseDetail.order.activeHoldsCount || 1})
                                </Badge>
                              ) : (
                                <Badge variant="neutral" size="xs">
                                  NO ACTIVE HOLD
                                </Badge>
                              )}
                            </div>
                            <div className="text-text-muted text-xs">
                              Linked Order ID: <span className="font-mono text-action-primary">{caseDetail.order.id}</span>
                            </div>
                          </div>

                          {/* Action Button */}
                          {currentAdminRole !== "editor" && (
                            <div>
                              {caseDetail.order.activeHoldForThisCase ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setIsReleaseDialogOpen(true)}
                                  className="border-amber-600/50 text-amber-400 hover:bg-amber-500/10 text-xs flex items-center gap-1.5"
                                >
                                  <FaUnlock /> Release Dispute Hold
                                </Button>
                              ) : (
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={() => setIsHoldDialogOpen(true)}
                                  className="bg-rose-600 hover:bg-rose-700 text-white text-xs flex items-center gap-1.5"
                                >
                                  <FaLock /> Place Dispute Hold
                                </Button>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Active Hold Details or Notice */}
                        {caseDetail.order.activeHoldForThisCase ? (
                          <div className="bg-surface-subtle p-3 rounded-lg border border-border-default space-y-1 text-xs">
                            <div className="text-rose-400 font-semibold flex items-center gap-1.5">
                              <FaLock className="text-xs" /> Active Hold Placed For This Case:
                            </div>
                            <div className="text-foreground">
                              "{caseDetail.order.activeHoldForThisCase.reason}"
                            </div>
                            <div className="text-[11px] text-text-muted font-mono pt-1">
                              Placed by: {caseDetail.order.activeHoldForThisCase.placedBy?.adminEmail} (
                              {caseDetail.order.activeHoldForThisCase.placedBy?.role}) on{" "}
                              {formatDateTime(caseDetail.order.activeHoldForThisCase.placedAt)}
                            </div>
                          </div>
                        ) : caseDetail.order.isDisputeHoldActive ? (
                          <div className="bg-amber-500/10 p-3 rounded-lg border border-amber-600/40 text-xs text-amber-300">
                            An active hold is in place on this order from another linked report. You can place an additional hold for this specific case if required.
                          </div>
                        ) : null}

                        {/* Blocked Lifecycle Transitions */}
                        {caseDetail.order.isDisputeHoldActive && (
                          <div className="space-y-1.5 pt-1">
                            <div className="text-xs font-semibold text-rose-300 flex items-center gap-1.5">
                              <FaShieldAlt className="text-xs" /> Enforced Operational Blocks:
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                              <div className="bg-surface-subtle p-2 rounded border border-border-default text-foreground">
                                <span className="font-semibold text-rose-400">• Payment Deadline Expiration:</span> FROZEN. Automated worker will not expire this order.
                              </div>
                              <div className="bg-surface-subtle p-2 rounded border border-border-default text-foreground">
                                <span className="font-semibold text-rose-400">• Order Finalization / Settlement:</span> HELD pending investigation completion.
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Dispute Holds History Timeline */}
                      <div className="bg-surface border border-border-default rounded-xl p-4 space-y-3 shadow-xs">
                        <div className="font-semibold text-foreground border-b border-border-subtle pb-2 flex items-center justify-between">
                          <span>Dispute Hold & Release History</span>
                          <span className="text-xs text-text-muted font-normal">
                            {caseDetail.order.disputeHolds?.length || 0} recorded events
                          </span>
                        </div>

                        {!caseDetail.order.disputeHolds || caseDetail.order.disputeHolds.length === 0 ? (
                          <div className="text-center py-6 text-text-muted italic text-xs">
                            No dispute hold events have been recorded on this order.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {caseDetail.order.disputeHolds.map((h, i) => (
                              <div
                                key={h.holdId || i}
                                className="bg-surface-subtle p-3 rounded-lg border border-border-default text-xs space-y-1.5"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Badge
                                      variant={h.status === "ACTIVE" ? "destructive" : "neutral"}
                                      size="xs"
                                    >
                                      {h.status}
                                    </Badge>
                                    <span className="font-mono text-[11px] text-text-muted">
                                      {h.holdId}
                                    </span>
                                  </div>
                                  <span className="text-[11px] text-text-muted font-mono">
                                    Placed: {formatDateTime(h.placedAt)}
                                  </span>
                                </div>
                                <div className="text-foreground">
                                  <span className="text-text-muted">Reason:</span> "{h.reason}"
                                </div>
                                <div className="text-[11px] text-text-muted">
                                  Placed By: <span className="text-action-primary font-mono">{h.placedBy?.adminEmail}</span> ({h.placedBy?.role})
                                </div>
                                {h.status === "RELEASED" && (
                                  <div className="mt-1 pt-1 border-t border-border-subtle text-[11px] text-text-muted space-y-0.5">
                                    <div>
                                      Released by <span className="text-amber-400 font-mono">{h.releasedBy?.adminEmail}</span> on {formatDateTime(h.releasedAt)}
                                    </div>
                                    <div>Release Note: "{h.releaseReason}"</div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="p-8 text-center bg-surface-subtle rounded-xl border border-border-default text-text-muted text-xs space-y-2">
                      <FaInfoCircle className="text-2xl text-text-muted mx-auto" />
                      <div>Dispute hold protocol requires a linked order.</div>
                      <div className="text-[11px] text-text-muted">
                        This complaint is either a general listing violation or does not reference an active order ID.
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Sub-tab: Internal Investigation Notes */}
              {detailTab === "notes" && (
                <div className="space-y-4">
                  {/* Add Note Form */}
                  {currentAdminRole !== "editor" ? (
                    <form onSubmit={handleAddNote} className="bg-surface border border-border-default rounded-xl p-4 space-y-3 shadow-xs">
                      <div className="font-semibold text-foreground flex items-center gap-2">
                        <FaStickyNote className="text-action-primary" /> Add Internal Investigation Note
                      </div>
                      <textarea
                        value={newNoteContent}
                        onChange={(e) => setNewNoteContent(e.target.value)}
                        placeholder="Enter confidential internal observations, interview notes, or evidence assessment (visible only to administrators)..."
                        rows={3}
                        maxLength={2000}
                        className="w-full bg-surface-subtle border border-border-default rounded-lg p-2.5 text-xs text-foreground placeholder:text-text-muted focus:outline-none focus:border-action-primary resize-none transition-colors"
                      />
                      <div className="flex items-center justify-between text-[11px] text-text-muted">
                        <span>{newNoteContent.length} / 2000 characters (min 3)</span>
                        <Button
                          type="submit"
                          variant="default"
                          size="xs"
                          disabled={isSubmittingNote || newNoteContent.trim().length < 3}
                          className="bg-action-primary hover:bg-action-primary-hover text-white"
                        >
                          {isSubmittingNote ? "Saving Note..." : "Add Note"}
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <div className="p-3 bg-surface-subtle border border-border-default rounded-lg text-text-muted text-xs italic">
                      Read-only access: Editor role cannot add internal investigation notes.
                    </div>
                  )}

                  {/* Notes List */}
                  <div className="space-y-2">
                    <div className="font-semibold text-foreground text-xs px-1">
                      Recorded Investigation Notes ({caseDetail.internalNotes?.length || 0})
                    </div>
                    {!caseDetail.internalNotes || caseDetail.internalNotes.length === 0 ? (
                      <div className="text-center py-8 text-text-muted italic text-xs bg-surface-subtle rounded-xl border border-border-default">
                        No internal investigation notes have been logged for this case.
                      </div>
                    ) : (
                      caseDetail.internalNotes.map((note) => (
                        <div
                          key={note.id}
                          className="bg-surface border border-border-default rounded-lg p-3 text-xs space-y-1.5 shadow-xs"
                        >
                          <div className="flex items-center justify-between text-text-muted text-[11px]">
                            <span className="font-mono text-action-primary font-medium">
                              {note.authorEmail} ({note.authorRole})
                            </span>
                            <span className="font-mono text-text-muted">
                              {formatDateTime(note.createdAt)}
                            </span>
                          </div>
                          <div className="text-foreground whitespace-pre-wrap leading-relaxed">
                            {note.content}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Sub-tab 5: Audit History */}
              {detailTab === "audit" && (
                <div className="space-y-3">
                  {caseDetail.auditLogs?.length === 0 ? (
                    <div className="text-center py-8 text-text-muted italic text-xs">
                      No administrative audit events recorded for this case or its linked entities.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {caseDetail.auditLogs.map((log) => (
                        <div
                          key={log.id}
                          className="bg-surface border border-border-default rounded-lg p-3 text-xs space-y-1 shadow-xs"
                        >
                          <div className="flex items-center justify-between text-text-muted">
                            <span className="font-semibold text-foreground flex items-center gap-2">
                              <span>{log.action}</span>
                              <Badge
                                variant={log.outcome === "SUCCESS" ? "success" : "warning"}
                                size="xs"
                              >
                                {log.outcome}
                              </Badge>
                            </span>
                            <span className="font-mono text-[11px] text-text-muted">
                              {formatDateTime(log.completedAt)}
                            </span>
                          </div>
                          <div className="text-foreground">
                            Admin: <span className="font-mono text-action-primary">{log.actingAdminEmail}</span> ({log.actingAdminRole})
                          </div>
                          <div className="text-text-muted">
                            Reason: <span className="text-foreground">{log.reason}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Modal Footer */}
              <div className="flex justify-between items-center pt-3 border-t border-border-subtle">
                <div className="text-[11px] text-text-muted italic">
                  Read-only investigation view. Status changes must use authoritative governance endpoints.
                </div>
                <Button variant="outline" size="sm" onClick={handleCloseDetailModal}>
                  Close Investigation
                </Button>
              </div>
            </>
          )}
        </div>
      </Dialog>

      {/* ========================================================================= */}
      {/* PLACE DISPUTE HOLD DIALOG */}
      {/* ========================================================================= */}
      <Dialog
        isOpen={isHoldDialogOpen}
        onClose={() => setIsHoldDialogOpen(false)}
        title="Place Authoritative Dispute Hold"
        className="max-w-md"
      >
        <div className="space-y-4 text-xs">
          <div className="bg-rose-950/20 border border-rose-800/60 p-3 rounded-lg text-rose-300 space-y-1">
            <div className="font-semibold flex items-center gap-1.5">
              <FaLock /> Hold Protocol Notice
            </div>
            <p className="text-[11px] leading-relaxed">
              Placing a dispute hold immediately blocks automated 24-hour payment deadline expiration, suspends seller fulfillment, and logs an immutable administrative audit intent.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="font-medium text-foreground">
              Hold Reason <span className="text-rose-400">*</span>
            </label>
            <textarea
              value={holdReason}
              onChange={(e) => setHoldReason(e.target.value)}
              placeholder="State the authoritative reason for placing this dispute hold (e.g. Buyer claims delivery failure, investigating carrier tracking)..."
              rows={4}
              maxLength={500}
              className="w-full bg-surface-subtle border border-border-default rounded-lg p-2.5 text-xs text-foreground placeholder:text-text-muted focus:outline-none focus:border-rose-500 resize-none transition-colors"
            />
            <div className="text-[11px] text-text-muted text-right">
              {holdReason.length} / 500 characters (min 5)
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsHoldDialogOpen(false)}
              disabled={isSubmittingHold}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handlePlaceHold}
              disabled={isSubmittingHold || holdReason.trim().length < 5}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {isSubmittingHold ? "Placing Hold..." : "Confirm Dispute Hold"}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* ========================================================================= */}
      {/* RELEASE DISPUTE HOLD DIALOG */}
      {/* ========================================================================= */}
      <Dialog
        isOpen={isReleaseDialogOpen}
        onClose={() => setIsReleaseDialogOpen(false)}
        title="Release Dispute Hold"
        className="max-w-md"
      >
        <div className="space-y-4 text-xs">
          <div className="bg-amber-500/10 border border-amber-600/40 p-3 rounded-lg text-amber-300 space-y-1">
            <div className="font-semibold flex items-center gap-1.5">
              <FaUnlock /> Release Protocol Notice
            </div>
            <p className="text-[11px] leading-relaxed">
              Releasing this hold lifts the dispute restriction for this case. If no other active holds exist on the order, normal lifecycle processing resumes. This action will NOT mutate the order status to paid, expired, cancelled, or refunded.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="font-medium text-foreground">
              Release Reason <span className="text-amber-400">*</span>
            </label>
            <textarea
              value={releaseReason}
              onChange={(e) => setReleaseReason(e.target.value)}
              placeholder="State the resolution reason for releasing this dispute hold (e.g. Investigation completed, carrier confirmed delivery)..."
              rows={4}
              maxLength={500}
              className="w-full bg-surface-subtle border border-border-default rounded-lg p-2.5 text-xs text-foreground placeholder:text-text-muted focus:outline-none focus:border-amber-500 resize-none transition-colors"
            />
            <div className="text-[11px] text-text-muted text-right">
              {releaseReason.length} / 500 characters (min 5)
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsReleaseDialogOpen(false)}
              disabled={isSubmittingRelease}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleReleaseHold}
              disabled={isSubmittingRelease || releaseReason.trim().length < 5}
              className="bg-amber-600 hover:bg-amber-500 text-white"
            >
              {isSubmittingRelease ? "Releasing Hold..." : "Confirm Hold Release"}
            </Button>
          </div>
        </div>
      </Dialog>
    </AdminDashboardShell>
  );
};

export default AdminDisputesPage;
