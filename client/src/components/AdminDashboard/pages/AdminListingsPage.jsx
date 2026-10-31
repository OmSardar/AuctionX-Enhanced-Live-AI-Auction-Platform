import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import axiosWithAuth from "../../../redux/slices/axiosWithAuth";
import { useSelector } from "react-redux";
import { toast } from "react-hot-toast";
import {
  FaGavel,
  FaSearch,
  FaFilter,
  FaBan,
  FaCheckCircle,
  FaHistory,
  FaArrowLeft,
  FaSync,
  FaEye,
  FaExclamationTriangle,
  FaBoxOpen,
  FaTag,
  FaShieldAlt,
  FaFlag,
  FaClock,
  FaUndo,
  FaUserShield,
  FaClipboardList,
  FaComments,
  FaTimesCircle,
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

const AdminListingsPage = () => {
  const auth = useSelector((state) => state.auth);
  const currentAdminEmail = auth.user?.email || "";
  const currentAdminRole = auth.role || auth.user?.role || "admin";

  // Navigation tab: 'directory' | 'reports' | 'audit'
  const [activeTab, setActiveTab] = useState("directory");

  // Query state for listings
  const [listings, setListings] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [summary, setSummary] = useState({
    totalListings: 0,
    activeLiveCount: 0,
    moderatedCount: 0,
    pendingReportsCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters for listings
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [auctionStatusFilter, setAuctionStatusFilter] = useState("all");
  const [moderationStatusFilter, setModerationStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");

  // Listing detail inspection modal
  const [selectedListingId, setSelectedListingId] = useState(null);
  const [detailListing, setDetailListing] = useState(null);
  const [detailReports, setDetailReports] = useState([]);
  const [detailAuditLogs, setDetailAuditLogs] = useState([]);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Moderation Action Modal
  const [actionListing, setActionListing] = useState(null);
  const [actionType, setActionType] = useState("REMOVE"); // "REMOVE" | "SUSPEND" | "FLAG" | "RESTORE"
  const [actionReason, setActionReason] = useState("");
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  // Reports tab state
  const [reports, setReports] = useState([]);
  const [reportsPagination, setReportsPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [reportStatusFilter, setReportStatusFilter] = useState("all");
  const [reportSearch, setReportSearch] = useState("");
  const [debouncedReportSearch, setDebouncedReportSearch] = useState("");
  const [isLoadingReports, setIsLoadingReports] = useState(false);

  // Report Resolution Modal
  const [selectedReport, setSelectedReport] = useState(null);
  const [newReportStatus, setNewReportStatus] = useState("resolved");
  const [resolutionNote, setResolutionNote] = useState("");
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

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
      setDebouncedReportSearch(reportSearch);
      setReportsPagination((prev) => ({ ...prev, page: 1 }));
    }, 350);
    return () => clearTimeout(timer);
  }, [reportSearch]);

  // Fetch listings directory
  const fetchListings = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = {
        page: pagination.page,
        limit: pagination.limit,
        search: debouncedSearch,
        status: auctionStatusFilter,
        moderationStatus: moderationStatusFilter,
        category: categoryFilter,
        sortBy,
        sortOrder,
      };

      const res = await axiosWithAuth.get(`${API_URL}/api/admin/listings`, {
        params,
        withCredentials: true,
      });

      if (res.data.success) {
        setListings(res.data.listings || []);
        setPagination(res.data.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 });
        setSummary(res.data.summary || {});
      }
    } catch (err) {
      console.error("Failed to fetch admin listings:", err);
      const msg = err.response?.data?.message || "Failed to load listings from database";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [
    pagination.page,
    pagination.limit,
    debouncedSearch,
    auctionStatusFilter,
    moderationStatusFilter,
    categoryFilter,
    sortBy,
    sortOrder,
  ]);

  // Fetch reports queue
  const fetchReports = useCallback(async () => {
    try {
      setIsLoadingReports(true);
      const params = {
        page: reportsPagination.page,
        limit: reportsPagination.limit,
        status: reportStatusFilter,
        search: debouncedReportSearch,
      };

      const res = await axiosWithAuth.get(`${API_URL}/api/admin/listings/reports`, {
        params,
        withCredentials: true,
      });

      if (res.data.success) {
        setReports(res.data.reports || []);
        setReportsPagination(res.data.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 });
      }
    } catch (err) {
      console.error("Failed to fetch reports queue:", err);
      toast.error(err.response?.data?.message || "Failed to load reports queue");
    } finally {
      setIsLoadingReports(false);
    }
  }, [reportsPagination.page, reportsPagination.limit, reportStatusFilter, debouncedReportSearch]);

  // Trigger data load on tab change or filter update
  useEffect(() => {
    if (activeTab === "directory") {
      fetchListings();
    } else if (activeTab === "reports") {
      fetchReports();
    }
  }, [activeTab, fetchListings, fetchReports]);

  // Inspect listing details
  const openListingDetails = async (listingId) => {
    try {
      setSelectedListingId(listingId);
      setIsLoadingDetail(true);
      setDetailListing(null);
      setDetailReports([]);
      setDetailAuditLogs([]);

      const [resDetail, resAudit] = await Promise.all([
        axiosWithAuth.get(`${API_URL}/api/admin/listings/${listingId}`, { withCredentials: true }),
        axiosWithAuth.get(`${API_URL}/api/admin/listings/${listingId}/audit-logs`, { withCredentials: true }).catch(() => ({ data: { auditLogs: [] } })),
      ]);

      if (resDetail.data.success) {
        setDetailListing(resDetail.data.listing);
        setDetailReports(resDetail.data.reports || []);
      }
      if (resAudit.data?.success) {
        setDetailAuditLogs(resAudit.data.auditLogs || []);
      }
    } catch (err) {
      console.error("Failed to load listing details:", err);
      toast.error(err.response?.data?.message || "Failed to load listing details");
      setSelectedListingId(null);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // Open moderation action dialog
  const initiateModerationAction = (listing, type) => {
    setActionListing(listing);
    setActionType(type);
    setActionReason("");
  };

  // Submit moderation action
  const handleConfirmModeration = async () => {
    if (!actionListing) return;

    if (!actionReason || actionReason.trim().length < 5) {
      toast.error("Please provide a valid moderation reason (at least 5 characters).");
      return;
    }

    try {
      setIsSubmittingAction(true);
      const idempotencyKey = `mod_${actionListing.id}_${actionType}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const res = await axiosWithAuth.patch(
        `${API_URL}/api/admin/listings/${actionListing.id}/moderate`,
        {
          action: actionType,
          reason: actionReason.trim(),
          idempotencyKey,
        },
        { withCredentials: true }
      );

      if (res.data.success) {
        toast.success(res.data.message || "Listing moderation state updated successfully");
        setActionListing(null);
        fetchListings();

        // Refresh detail view if open
        if (selectedListingId === actionListing.id) {
          openListingDetails(actionListing.id);
        }
      }
    } catch (err) {
      console.error("Failed to moderate listing:", err);
      const msg = err.response?.data?.message || "Moderation action failed";
      toast.error(msg);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Submit report status update
  const handleConfirmReportResolution = async () => {
    if (!selectedReport) return;

    if (!resolutionNote || resolutionNote.trim().length < 5) {
      toast.error("Please provide an administrative resolution note (at least 5 characters).");
      return;
    }

    try {
      setIsSubmittingReport(true);
      const res = await axiosWithAuth.patch(
        `${API_URL}/api/admin/listings/reports/${selectedReport._id || selectedReport.id}/status`,
        {
          status: newReportStatus,
          resolutionNote: resolutionNote.trim(),
        },
        { withCredentials: true }
      );

      if (res.data.success) {
        toast.success(res.data.message || `Report status transitioned to ${newReportStatus}`);
        setSelectedReport(null);
        setResolutionNote("");
        fetchReports();
        if (activeTab === "directory") {
          fetchListings();
        }
      }
    } catch (err) {
      console.error("Failed to update report status:", err);
      toast.error(err.response?.data?.message || "Failed to update report resolution");
    } finally {
      setIsSubmittingReport(false);
    }
  };

  // Helper badges
  const getAuctionStatusBadge = (status) => {
    const s = String(status || "").toLowerCase();
    switch (s) {
      case "live":
        return <Badge variant="success" className="animate-pulse">Live Auction</Badge>;
      case "active":
        return <Badge variant="default">Active</Badge>;
      case "upcoming":
        return <Badge variant="secondary">Upcoming</Badge>;
      case "ended":
        return <Badge variant="outline">Ended</Badge>;
      case "sold":
        return <Badge variant="gold">Sold</Badge>;
      default:
        return <Badge variant="outline">{status || "Unknown"}</Badge>;
    }
  };

  const getModerationStatusBadge = (status, isModerated) => {
    if (isModerated || status === "REMOVED") {
      return <Badge variant="danger" className="gap-1"><FaBan className="w-3 h-3" /> Removed</Badge>;
    }
    if (status === "SUSPENDED") {
      return <Badge variant="danger" className="gap-1"><FaTimesCircle className="w-3 h-3" /> Suspended</Badge>;
    }
    if (status === "FLAGGED") {
      return <Badge variant="warning" className="gap-1"><FaFlag className="w-3 h-3" /> Flagged</Badge>;
    }
    return <Badge variant="success" className="gap-1"><FaCheckCircle className="w-3 h-3" /> Active</Badge>;
  };

  const getReportStatusBadge = (status) => {
    switch (String(status).toLowerCase()) {
      case "resolved":
        return <Badge variant="success">Resolved</Badge>;
      case "rejected":
      case "closed":
        return <Badge variant="outline">Rejected / Closed</Badge>;
      case "in-progress":
        return <Badge variant="warning">In Progress</Badge>;
      case "pending":
      default:
        return <Badge variant="danger">Pending Review</Badge>;
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <AdminDashboardShell>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
        {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-subtle pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              to="/admin/dashboard"
              className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-foreground transition-colors"
            >
              <FaArrowLeft className="w-3 h-3" /> Admin Dashboard
            </Link>
            <span className="text-text-muted text-xs">/</span>
            <span className="text-xs text-brand font-medium">Listing Moderation</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-brand/10 text-brand ring-1 ring-brand/25">
              <FaGavel className="w-6 h-6" />
            </span>
            Listing Moderation & Reports
          </h1>
          <p className="text-xs sm:text-sm text-text-muted mt-1">
            Catalog enforcement, takedowns, and user dispute resolution with strict auction invariant protection.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => (activeTab === "directory" ? fetchListings() : fetchReports())}
            disabled={isLoading || isLoadingReports}
            className="gap-2"
          >
            <FaSync className={cn("w-3.5 h-3.5", (isLoading || isLoadingReports) && "animate-spin")} />
            Refresh
          </Button>
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-border-subtle rounded-lg text-xs text-text-muted">
            <FaShieldAlt className="text-brand w-3.5 h-3.5" />
            Role: <span className="font-semibold text-foreground capitalize">{currentAdminRole}</span>
          </div>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-xl bg-surface border border-border-subtle shadow-sm flex items-center gap-3">
          <div className="p-3 rounded-lg bg-brand/10 text-brand">
            <FaBoxOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-foreground">
              {isLoading ? <Skeleton className="w-12 h-6" /> : summary.totalListings || 0}
            </div>
            <div className="text-xs text-text-muted">Total Catalog Listings</div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-surface border border-border-subtle shadow-sm flex items-center gap-3">
          <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-500">
            <FaClock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-foreground">
              {isLoading ? <Skeleton className="w-12 h-6" /> : summary.activeLiveCount || 0}
            </div>
            <div className="text-xs text-text-muted">Live / Active Auctions</div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-surface border border-border-subtle shadow-sm flex items-center gap-3">
          <div className="p-3 rounded-lg bg-rose-500/10 text-rose-500">
            <FaBan className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-foreground">
              {isLoading ? <Skeleton className="w-12 h-6" /> : summary.moderatedCount || 0}
            </div>
            <div className="text-xs text-text-muted">Moderated / Removed</div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-surface border border-border-subtle shadow-sm flex items-center gap-3">
          <div className="p-3 rounded-lg bg-amber-500/10 text-amber-500">
            <FaFlag className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-foreground">
              {isLoading ? <Skeleton className="w-12 h-6" /> : summary.pendingReportsCount || 0}
            </div>
            <div className="text-xs text-text-muted">Pending User Reports</div>
          </div>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="flex border-b border-border-subtle gap-2">
        <button
          onClick={() => setActiveTab("directory")}
          className={cn(
            "flex items-center gap-2 py-3 px-4 font-medium text-sm border-b-2 transition-colors cursor-pointer",
            activeTab === "directory"
              ? "border-brand text-brand font-semibold"
              : "border-transparent text-text-muted hover:text-foreground"
          )}
        >
          <FaBoxOpen className="w-4 h-4" />
          Listings Directory
          {listings.length > 0 && (
            <span className="ml-1 px-2 py-0.5 text-xs bg-surface-subtle border border-border-subtle rounded-full">
              {pagination.total}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("reports")}
          className={cn(
            "flex items-center gap-2 py-3 px-4 font-medium text-sm border-b-2 transition-colors cursor-pointer",
            activeTab === "reports"
              ? "border-brand text-brand font-semibold"
              : "border-transparent text-text-muted hover:text-foreground"
          )}
        >
          <FaClipboardList className="w-4 h-4" />
          Report Resolution Queue
          {summary.pendingReportsCount > 0 && (
            <span className="ml-1 px-2 py-0.5 text-xs bg-rose-500/20 text-rose-600 dark:text-rose-400 font-bold rounded-full">
              {summary.pendingReportsCount}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: LISTINGS DIRECTORY */}
      {activeTab === "directory" && (
        <div className="space-y-4">
          {/* Search & Multi-Attribute Filters */}
          <div className="p-4 rounded-xl bg-surface border border-border-subtle shadow-sm space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Search */}
              <div className="lg:col-span-2 relative">
                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted w-3.5 h-3.5" />
                <input
                  type="text"
                  placeholder="Search listings by title, seller email, or category..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-surface-subtle border border-border-subtle rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-brand text-foreground placeholder:text-text-muted"
                />
              </div>

              {/* Auction Status */}
              <div>
                <select
                  value={auctionStatusFilter}
                  onChange={(e) => {
                    setAuctionStatusFilter(e.target.value);
                    setPagination((p) => ({ ...p, page: 1 }));
                  }}
                  className="w-full px-3 py-2 bg-surface-subtle border border-border-subtle rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-brand text-foreground"
                >
                  <option value="all">Auction: All States</option>
                  <option value="Live">Live Auction</option>
                  <option value="Active">Active</option>
                  <option value="Upcoming">Upcoming</option>
                  <option value="Ended">Ended</option>
                  <option value="Sold">Sold</option>
                </select>
              </div>

              {/* Moderation Status */}
              <div>
                <select
                  value={moderationStatusFilter}
                  onChange={(e) => {
                    setModerationStatusFilter(e.target.value);
                    setPagination((p) => ({ ...p, page: 1 }));
                  }}
                  className="w-full px-3 py-2 bg-surface-subtle border border-border-subtle rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-brand text-foreground"
                >
                  <option value="all">Moderation: All</option>
                  <option value="ACTIVE">Active (Clean)</option>
                  <option value="REMOVED">Removed from Public</option>
                  <option value="SUSPENDED">Suspended</option>
                  <option value="FLAGGED">Flagged</option>
                </select>
              </div>

              {/* Sort By */}
              <div>
                <select
                  value={`${sortBy}-${sortOrder}`}
                  onChange={(e) => {
                    const [field, order] = e.target.value.split("-");
                    setSortBy(field);
                    setSortOrder(order);
                    setPagination((p) => ({ ...p, page: 1 }));
                  }}
                  className="w-full px-3 py-2 bg-surface-subtle border border-border-subtle rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-brand text-foreground"
                >
                  <option value="createdAt-desc">Newest Listings</option>
                  <option value="createdAt-asc">Oldest Listings</option>
                  <option value="endTime-asc">Ending Soonest</option>
                  <option value="currentPrice-desc">Highest Price</option>
                  <option value="bidCount-desc">Most Bids</option>
                </select>
              </div>
            </div>
          </div>

          {/* Directory Table */}
          <div className="bg-surface border border-border-subtle rounded-xl shadow-sm overflow-hidden">
            {isLoading ? (
              <div className="p-6 space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="w-12 h-12 rounded-lg" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="w-1/3 h-4" />
                      <Skeleton className="w-1/4 h-3" />
                    </div>
                    <Skeleton className="w-20 h-6" />
                    <Skeleton className="w-24 h-8" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="p-12 text-center space-y-4">
                <div className="inline-flex p-4 rounded-full bg-rose-500/10 text-rose-500">
                  <FaExclamationTriangle className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">Failed to Load Listings</h3>
                <p className="text-sm text-text-muted max-w-md mx-auto">{error}</p>
                <Button variant="outline" size="sm" onClick={fetchListings} className="gap-2">
                  <FaSync className="w-3.5 h-3.5" /> Try Again
                </Button>
              </div>
            ) : listings.length === 0 ? (
              <div className="p-12 text-center space-y-4">
                <EmptyState
                  icon={FaBoxOpen}
                  title="No Listings Found"
                  description="No catalog items matched your active search query or filter configuration."
                />
                {(searchQuery || auctionStatusFilter !== "all" || moderationStatusFilter !== "all") && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearchQuery("");
                      setAuctionStatusFilter("all");
                      setModerationStatusFilter("all");
                      setCategoryFilter("all");
                    }}
                  >
                    Clear All Filters
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-border-subtle bg-surface-subtle/50 text-text-muted font-semibold">
                      <th className="py-3 px-4">Item Details</th>
                      <th className="py-3 px-4">Seller</th>
                      <th className="py-3 px-4">Auction Telemetry</th>
                      <th className="py-3 px-4">Moderation State</th>
                      <th className="py-3 px-4">Disputes</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {listings.map((item) => {
                      const isMod = item.isModerated || item.moderationStatus === "REMOVED";
                      return (
                        <tr key={item.id} className="hover:bg-surface-subtle/40 transition-colors">
                          {/* Item details */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <img
                                src={item.thumbnail || DEFAULT_ITEM_IMAGE}
                                alt={item.name}
                                className="w-12 h-12 rounded-lg object-cover border border-border-subtle bg-surface-subtle flex-shrink-0"
                                onError={(e) => {
                                  e.target.onerror = null;
                                  e.target.src = DEFAULT_ITEM_IMAGE;
                                }}
                              />
                              <div className="min-w-0">
                                <div className="font-semibold text-foreground truncate max-w-xs sm:max-w-sm">
                                  {item.name}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5 text-xs text-text-muted">
                                  <span className="capitalize">{item.category || "General"}</span>
                                  <span>•</span>
                                  <span className="font-mono text-[10px] text-text-muted">ID: {item.id.slice(-6)}</span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Seller */}
                          <td className="py-3 px-4">
                            <div className="text-foreground font-medium text-xs sm:text-sm">{item.sellerEmail || "—"}</div>
                            <div className="text-text-muted text-[11px]">{item.mobileNumber || "—"}</div>
                          </td>

                          {/* Auction telemetry */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              {getAuctionStatusBadge(item.status)}
                            </div>
                            <div className="text-xs text-text-muted mt-1">
                              Current: <span className="font-semibold text-foreground">{formatCurrency(item.currentPrice)}</span>
                              <span className="ml-1.5 text-[11px]">({item.bidCount || 0} bids)</span>
                            </div>
                          </td>

                          {/* Moderation state */}
                          <td className="py-3 px-4">
                            {getModerationStatusBadge(item.moderationStatus, item.isModerated)}
                            {item.moderationReason && (
                              <div className="text-[11px] text-text-muted mt-0.5 truncate max-w-[160px]" title={item.moderationReason}>
                                {item.moderationReason}
                              </div>
                            )}
                          </td>

                          {/* Disputes / reports count */}
                          <td className="py-3 px-4">
                            {item.reportCount > 0 ? (
                              <Badge variant="danger" className="gap-1 font-semibold">
                                <FaFlag className="w-2.5 h-2.5" /> {item.reportCount} {item.reportCount === 1 ? "report" : "reports"}
                              </Badge>
                            ) : (
                              <span className="text-xs text-text-muted">None</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-right space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openListingDetails(item.id)}
                              title="Inspect Details & Audit"
                            >
                              <FaEye className="w-3.5 h-3.5 text-text-muted hover:text-foreground" />
                            </Button>

                            {isMod ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => initiateModerationAction(item, "RESTORE")}
                                className="text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/10 text-xs gap-1"
                              >
                                <FaUndo className="w-3 h-3" /> Restore
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => initiateModerationAction(item, "REMOVE")}
                                className="text-rose-500 border-rose-500/30 hover:bg-rose-500/10 text-xs gap-1"
                              >
                                <FaBan className="w-3 h-3" /> Take Down
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {!isLoading && listings.length > 0 && (
              <div className="p-4 border-t border-border-subtle flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm text-text-muted">
                <div>
                  Showing page <span className="font-semibold text-foreground">{pagination.page}</span> of{" "}
                  <span className="font-semibold text-foreground">{pagination.totalPages}</span> (
                  <span className="font-semibold text-foreground">{pagination.total}</span> total listings)
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page <= 1}
                    onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: USER REPORTS QUEUE */}
      {activeTab === "reports" && (
        <div className="space-y-4">
          {/* Reports Filter Bar */}
          <div className="p-4 rounded-xl bg-surface border border-border-subtle shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted w-3.5 h-3.5" />
              <input
                type="text"
                placeholder="Search reports by reason, seller, order..."
                value={reportSearch}
                onChange={(e) => setReportSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-surface-subtle border border-border-subtle rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-brand text-foreground placeholder:text-text-muted"
              />
            </div>

            <div className="w-full sm:w-auto flex items-center gap-3">
              <select
                value={reportStatusFilter}
                onChange={(e) => {
                  setReportStatusFilter(e.target.value);
                  setReportsPagination((p) => ({ ...p, page: 1 }));
                }}
                className="w-full sm:w-48 px-3 py-2 bg-surface-subtle border border-border-subtle rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-brand text-foreground"
              >
                <option value="all">All Report Statuses</option>
                <option value="pending">Pending</option>
                <option value="in-progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="rejected">Rejected / Closed</option>
              </select>
            </div>
          </div>

          {/* Reports Table */}
          <div className="bg-surface border border-border-subtle rounded-xl shadow-sm overflow-hidden">
            {isLoadingReports ? (
              <div className="p-6 space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="w-full h-12 rounded-lg" />
                ))}
              </div>
            ) : reports.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <EmptyState
                  icon={FaCheckCircle}
                  title="No Reports Found"
                  description="There are currently no user dispute reports matching your filter criteria."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-border-subtle bg-surface-subtle/50 text-text-muted font-semibold">
                      <th className="py-3 px-4">Subject & Reason</th>
                      <th className="py-3 px-4">Target Entity</th>
                      <th className="py-3 px-4">Reporter</th>
                      <th className="py-3 px-4">Submission Date</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Resolution</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {reports.map((rep) => (
                      <tr key={rep._id || rep.id} className="hover:bg-surface-subtle/40 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-foreground capitalize">{rep.reason || "Catalog Grievance"}</div>
                          <div className="text-xs text-text-muted mt-0.5 line-clamp-1 max-w-xs">{rep.customReason || "—"}</div>
                        </td>
                        <td className="py-3 px-4">
                          {rep.productId ? (
                            <div>
                              <span className="font-medium text-foreground">Listing: {rep.productId.name || rep.productId}</span>
                              <div className="text-[11px] text-text-muted font-mono">ID: {String(rep.productId._id || rep.productId).slice(-6)}</div>
                            </div>
                          ) : rep.orderId ? (
                            <div>
                              <span className="font-medium text-foreground">Order: #{String(rep.orderId).slice(-6)}</span>
                            </div>
                          ) : (
                            <span className="text-text-muted">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-foreground text-xs">{rep.userEmail || "Anonymous"}</div>
                        </td>
                        <td className="py-3 px-4 text-xs text-text-muted">
                          {formatDate(rep.date || rep.createdAt)}
                        </td>
                        <td className="py-3 px-4">
                          {getReportStatusBadge(rep.status)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedReport(rep);
                              setNewReportStatus(rep.status === "pending" ? "resolved" : rep.status);
                              setResolutionNote(rep.resolutionNote || "");
                            }}
                            className="text-xs gap-1.5"
                          >
                            <FaShieldAlt className="w-3 h-3 text-brand" /> Review / Resolve
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Reports Pagination */}
            {!isLoadingReports && reports.length > 0 && (
              <div className="p-4 border-t border-border-subtle flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm text-text-muted">
                <div>
                  Page <span className="font-semibold text-foreground">{reportsPagination.page}</span> of{" "}
                  <span className="font-semibold text-foreground">{reportsPagination.totalPages}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={reportsPagination.page <= 1}
                    onClick={() => setReportsPagination((p) => ({ ...p, page: p.page - 1 }))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={reportsPagination.page >= reportsPagination.totalPages}
                    onClick={() => setReportsPagination((p) => ({ ...p, page: p.page + 1 }))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: LISTING DETAILS & AUDIT INSPECTION */}
      <Dialog
        isOpen={Boolean(selectedListingId)}
        onClose={() => setSelectedListingId(null)}
        title="Listing Inspection & Auction Telemetry"
        className="max-w-3xl w-full"
      >
        {isLoadingDetail || !detailListing ? (
          <div className="p-6 space-y-4">
            <Skeleton className="w-full h-40 rounded-xl" />
            <Skeleton className="w-2/3 h-6" />
            <Skeleton className="w-full h-24" />
          </div>
        ) : (
          <div
            className="p-6 space-y-6 max-h-[80vh] overflow-y-auto overscroll-contain"
            data-lenis-prevent="true"
          >
            {/* Header info */}
            <div className="flex flex-col sm:flex-row gap-5 items-start">
              <img
                src={detailListing.images?.[0]?.secure_url || detailListing.thumbnail || DEFAULT_ITEM_IMAGE}
                alt={detailListing.name}
                className="w-full sm:w-44 h-44 object-cover rounded-xl border border-border-subtle bg-surface-subtle"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = DEFAULT_ITEM_IMAGE;
                }}
              />
              <div className="space-y-2 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {getAuctionStatusBadge(detailListing.status)}
                  {getModerationStatusBadge(detailListing.moderationStatus, detailListing.isModerated)}
                  <Badge variant="outline" className="capitalize">{detailListing.category}</Badge>
                </div>
                <h3 className="text-xl font-bold text-foreground">{detailListing.name}</h3>
                <p className="text-xs text-text-muted leading-relaxed line-clamp-3">
                  {detailListing.description || "No extended description provided for this listing."}
                </p>
                <div className="text-xs text-text-muted pt-1">
                  Listing ID: <span className="font-mono text-foreground">{detailListing.id}</span>
                </div>
              </div>
            </div>

            {/* Auction Safety Invariant Notice */}
            <div className="p-3.5 rounded-xl bg-brand/5 border border-brand/20 flex items-start gap-3 text-xs leading-relaxed text-text-muted">
              <FaShieldAlt className="w-4 h-4 text-brand flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-foreground">Auction Safety Invariants Protected:</span> Moderating or removing this listing from public discovery guarantees that existing bid history, winner determinations, order payments, and timestamps remain completely immutable.
              </div>
            </div>

            {/* Pricing & Bidding Telemetry */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-surface-subtle border border-border-subtle text-xs">
              <div>
                <span className="text-text-muted block">Starting Price</span>
                <span className="font-bold text-sm text-foreground">{formatCurrency(detailListing.biddingStartPrice)}</span>
              </div>
              <div>
                <span className="text-text-muted block">Current Price</span>
                <span className="font-bold text-sm text-brand">{formatCurrency(detailListing.currentPrice)}</span>
              </div>
              <div>
                <span className="text-text-muted block">Total Bids</span>
                <span className="font-bold text-sm text-foreground">{detailListing.bidCount || 0}</span>
              </div>
              <div>
                <span className="text-text-muted block">Highest Bidder</span>
                <span className="font-medium text-foreground truncate block">
                  {detailListing.highestBidderEmail || "None"}
                </span>
              </div>
            </div>

            {/* Seller Information */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted">Seller Credentials</h4>
              <div className="p-3 rounded-lg bg-surface-subtle border border-border-subtle text-xs flex justify-between items-center">
                <div>
                  <span className="font-semibold text-foreground block">{detailListing.sellerEmail}</span>
                  <span className="text-text-muted">Phone: {detailListing.mobileNumber || "Not recorded"}</span>
                </div>
                <Badge variant="outline">Seller Verified</Badge>
              </div>
            </div>

            {/* Associated User Reports */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center justify-between">
                <span>Associated User Reports</span>
                <span className="text-brand font-normal">{detailReports.length} recorded</span>
              </h4>
              {detailReports.length === 0 ? (
                <div className="p-4 rounded-lg bg-surface-subtle text-center text-xs text-text-muted">
                  No grievances or user reports filed against this listing.
                </div>
              ) : (
                <div className="space-y-2">
                  {detailReports.map((rep) => (
                    <div key={rep._id || rep.id} className="p-3 rounded-lg bg-surface-subtle border border-border-subtle text-xs space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-foreground capitalize">{rep.reason}</span>
                        {getReportStatusBadge(rep.status)}
                      </div>
                      <p className="text-text-muted">{rep.customReason || "No details provided"}</p>
                      <div className="text-[10px] text-text-muted">
                        Filed by: {rep.userEmail} on {formatDate(rep.date || rep.createdAt)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Moderation History & Audit Trail */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted">
                Administrative Audit Trail ({detailAuditLogs.length})
              </h4>
              {detailAuditLogs.length === 0 ? (
                <div className="p-4 rounded-lg bg-surface-subtle text-center text-xs text-text-muted">
                  No prior administrative interventions logged for this item.
                </div>
              ) : (
                <div className="space-y-2">
                  {detailAuditLogs.map((log) => (
                    <div key={log._id || log.id} className="p-3 rounded-lg bg-surface-subtle border border-border-subtle text-xs space-y-1">
                      <div className="flex justify-between items-center">
                        <Badge variant="secondary" className="font-mono text-[10px]">{log.action}</Badge>
                        <span className="text-[10px] text-text-muted">{formatDate(log.createdAt)}</span>
                      </div>
                      <div className="text-text-muted">
                        Reason: <span className="text-foreground font-medium">{log.reason || "—"}</span>
                      </div>
                      <div className="text-[10px] text-text-muted">
                        Admin: {log.adminEmail || log.adminId} (Role: {log.adminRole})
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Action Footer */}
            <div className="pt-4 border-t border-border-subtle flex justify-end gap-3">
              <Button variant="outline" size="sm" onClick={() => setSelectedListingId(null)}>
                Close
              </Button>
              {detailListing.isModerated || detailListing.moderationStatus === "REMOVED" ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    initiateModerationAction(detailListing, "RESTORE");
                  }}
                  className="text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/10 text-xs gap-1"
                >
                  <FaUndo className="w-3 h-3" /> Restore Listing
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    initiateModerationAction(detailListing, "REMOVE");
                  }}
                  className="text-rose-500 border-rose-500/30 hover:bg-rose-500/10 text-xs gap-1"
                >
                  <FaBan className="w-3 h-3" /> Moderate / Take Down
                </Button>
              )}
            </div>
          </div>
        )}
      </Dialog>

      {/* MODAL 2: MODERATION ACTION DIALOG (REMOVE / RESTORE) */}
      <Dialog
        isOpen={Boolean(actionListing)}
        onClose={() => setActionListing(null)}
        title={actionType === "RESTORE" ? "Restore Listing to Catalog" : "Enforce Listing Moderation"}
        className="max-w-md w-full"
      >
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-3 rounded-full",
              actionType === "RESTORE" ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
            )}>
              {actionType === "RESTORE" ? <FaUndo className="w-5 h-5" /> : <FaBan className="w-5 h-5" />}
            </div>
            <div>
              <h4 className="text-sm font-bold text-foreground">
                {actionType === "RESTORE" ? "Restore to Public Catalog" : "Remove Listing from Discovery"}
              </h4>
              <p className="text-xs text-text-muted truncate max-w-[280px]">
                {actionListing?.name}
              </p>
            </div>
          </div>

          <div className="text-xs text-text-muted leading-relaxed p-3 rounded-lg bg-surface-subtle border border-border-subtle">
            {actionType === "RESTORE" ? (
              <span>
                Restoring this listing will make it visible in public searches again. Note: If this auction has already reached its scheduled end time, it will safely remain archived and cannot be restarted.
              </span>
            ) : (
              <span>
                Removing this listing hides it from all public catalog queries and immediately halts new bid submissions. All bids and financial records remain permanently intact.
              </span>
            )}
          </div>

          {actionType !== "RESTORE" && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Action Target</label>
              <select
                value={actionType}
                onChange={(e) => setActionType(e.target.value)}
                className="w-full px-3 py-2 bg-surface-subtle border border-border-subtle rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-brand text-foreground"
              >
                <option value="REMOVE">Remove from Public Discovery (Takedown)</option>
                <option value="SUSPEND">Suspend Listing Temporarily</option>
                <option value="FLAG">Flag Listing for Monitoring</option>
              </select>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Administrative Reason <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              placeholder="Provide a mandatory reason for this moderation action (min 5 characters)..."
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
              className="w-full px-3 py-2 bg-surface-subtle border border-border-subtle rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-brand text-foreground placeholder:text-text-muted resize-none"
            />
            <span className="text-[10px] text-text-muted">
              {actionReason.trim().length} / 5 characters minimum.
            </span>
          </div>

          <div className="pt-3 border-t border-border-subtle flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setActionListing(null)} disabled={isSubmittingAction}>
              Cancel
            </Button>
            <Button
              variant={actionType === "RESTORE" ? "default" : "destructive"}
              size="sm"
              onClick={handleConfirmModeration}
              disabled={isSubmittingAction || actionReason.trim().length < 5}
            >
              {isSubmittingAction ? "Processing..." : actionType === "RESTORE" ? "Confirm Restoration" : "Apply Moderation"}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* MODAL 3: REPORT RESOLUTION DIALOG */}
      <Dialog
        isOpen={Boolean(selectedReport)}
        onClose={() => setSelectedReport(null)}
        title="Resolve User Grievance Report"
        className="max-w-md w-full"
      >
        <div className="p-6 space-y-4">
          <div className="space-y-1">
            <div className="text-xs text-text-muted">Subject / Reason:</div>
            <div className="text-sm font-semibold text-foreground capitalize">
              {selectedReport?.reason || "Catalog Grievance"}
            </div>
            {selectedReport?.customReason && (
              <p className="text-xs text-text-muted bg-surface-subtle p-2.5 rounded-lg border border-border-subtle">
                "{selectedReport.customReason}"
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Resolution Decision</label>
            <select
              value={newReportStatus}
              onChange={(e) => setNewReportStatus(e.target.value)}
              className="w-full px-3 py-2 bg-surface-subtle border border-border-subtle rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-brand text-foreground"
            >
              <option value="resolved">Mark as Resolved</option>
              <option value="in-progress">Mark as In-Progress</option>
              <option value="rejected">Reject Report (Unfounded)</option>
              <option value="closed">Close Report</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Resolution Note <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              placeholder="Explain the administrative resolution or outcome (min 5 characters)..."
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              className="w-full px-3 py-2 bg-surface-subtle border border-border-subtle rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-brand text-foreground placeholder:text-text-muted resize-none"
            />
          </div>

          <div className="pt-3 border-t border-border-subtle flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setSelectedReport(null)} disabled={isSubmittingReport}>
              Cancel
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleConfirmReportResolution}
              disabled={isSubmittingReport || resolutionNote.trim().length < 5}
            >
              {isSubmittingReport ? "Saving..." : "Save Resolution"}
            </Button>
          </div>
        </div>
      </Dialog>
      </div>
    </AdminDashboardShell>
  );
};

export default AdminListingsPage;
