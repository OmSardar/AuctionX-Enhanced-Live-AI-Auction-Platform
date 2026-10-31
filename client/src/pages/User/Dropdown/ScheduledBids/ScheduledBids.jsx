import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import axios from "axios";
import {
  FaClock,
  FaRupeeSign,
  FaCalendarAlt,
  FaEye,
  FaArrowRight,
  FaBan,
  FaCheckCircle,
  FaExclamationCircle,
  FaHourglassHalf,
  FaUserClock,
} from "react-icons/fa";
import toast from "react-hot-toast";
import {
  parseAuctionDates,
  calculateAuctionTime,
} from "../../../../utils/auctionTimer";

const API_URL = import.meta.env.VITE_API_URL;

const ScheduledBids = () => {
  const navigate = useNavigate();
  const authUser = useSelector((state) => state.auth?.user);
  const isAuthenticated = Boolean(authUser?.email);

  const [activeTab, setActiveTab] = useState(isAuthenticated ? "my-bids" : "upcoming");
  const [products, setProducts] = useState([]);
  const [userBids, setUserBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userBidsLoading, setUserBidsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [countdowns, setCountdowns] = useState({});
  const [cancellingId, setCancellingId] = useState(null);
  const timerIntervalRef = useRef(null);

  // Fetch upcoming auction lots
  const fetchScheduledAuctions = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await axios.get(`${API_URL}/api/products`);
      const allProducts = Array.isArray(response.data?.products)
        ? response.data.products
        : Array.isArray(response.data)
        ? response.data
        : [];

      const scheduledList = allProducts.filter((item) => {
        if (!item) return false;
        if (item.status === "SCHEDULED" || item.status === "DRAFT") return true;

        const { startDate, endDate } = parseAuctionDates(item);
        const calc = calculateAuctionTime(startDate, endDate, item.status || "Active");
        return calc.isUpcoming;
      });

      scheduledList.sort((a, b) => {
        const { startDate: startA } = parseAuctionDates(a);
        const { startDate: startB } = parseAuctionDates(b);
        const timeA = startA ? startA.getTime() : Infinity;
        const timeB = startB ? startB.getTime() : Infinity;
        return timeA - timeB;
      });

      setProducts(scheduledList);
      updateCountdowns(scheduledList);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching scheduled auctions:", err);
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Failed to load scheduled auctions. Please try again."
      );
      setLoading(false);
    }
  };

  // Fetch user's own scheduled bids
  const fetchUserScheduledBids = async () => {
    if (!isAuthenticated) return;
    try {
      setUserBidsLoading(true);
      const res = await axios.get(`${API_URL}/api/scheduled-bids/user`, {
        withCredentials: true,
      });
      if (res.data?.success) {
        setUserBids(res.data.scheduledBids || []);
      }
    } catch (err) {
      console.error("Error fetching user scheduled bids:", err);
    } finally {
      setUserBidsLoading(false);
    }
  };

  // Cancel scheduled bid
  const handleCancelBid = async (bidId) => {
    if (!window.confirm("Are you sure you want to cancel this scheduled bid?")) {
      return;
    }

    try {
      setCancellingId(bidId);
      const res = await axios.delete(`${API_URL}/api/scheduled-bids/${bidId}`, {
        withCredentials: true,
      });

      if (res.data?.success) {
        toast.success("Scheduled bid cancelled successfully");
        setUserBids((prev) =>
          prev.map((b) => (b._id === bidId ? { ...b, status: "CANCELLED" } : b))
        );
      }
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        "Failed to cancel scheduled bid";
      toast.error(msg);
    } finally {
      setCancellingId(null);
    }
  };

  const updateCountdowns = (items) => {
    const newCountdowns = {};
    items.forEach((item) => {
      if (!item?._id) return;
      const { startDate, endDate } = parseAuctionDates(item);
      const calc = calculateAuctionTime(startDate, endDate, item.status || "SCHEDULED");
      newCountdowns[item._id] = calc;
    });
    setCountdowns(newCountdowns);
  };

  useEffect(() => {
    fetchScheduledAuctions();
    if (isAuthenticated) {
      fetchUserScheduledBids();
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (products.length === 0) return;

    timerIntervalRef.current = setInterval(() => {
      updateCountdowns(products);
    }, 1000);

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [products]);

  const formatDescription = (desc) => {
    if (!desc) return "No description available";
    if (Array.isArray(desc)) {
      return desc.map((d) => d.description || d.name).filter(Boolean).join(" • ");
    }
    if (typeof desc === "object") {
      return desc.description || desc.name || JSON.stringify(desc);
    }
    return String(desc);
  };

  const formatScheduledDate = (product) => {
    const { startDate } = parseAuctionDates(product);
    if (!startDate || isNaN(startDate.getTime())) {
      return product?.biddingStartTime || "Date not specified";
    }
    return startDate.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  const getStatusBadge = (status, failureReason) => {
    switch (status) {
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
            <FaHourglassHalf className="text-[10px]" /> Pending Execution
          </span>
        );
      case "PROCESSING":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
            <FaClock className="text-[10px] animate-spin" /> Processing
          </span>
        );
      case "EXECUTED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 dark:bg-green-950/60 text-green-800 dark:text-green-300 border border-green-300 dark:border-green-800">
            <FaCheckCircle className="text-[10px]" /> Executed
          </span>
        );
      case "CANCELLED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700">
            <FaBan className="text-[10px]" /> Cancelled
          </span>
        );
      case "FAILED":
        return (
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 border border-red-300 dark:border-red-800"
            title={failureReason || "Execution failed"}
          >
            <FaExclamationCircle className="text-[10px]" /> Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-canvas text-foreground py-12 transition-colors duration-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground flex items-center justify-center gap-3">
            <FaCalendarAlt className="text-action-primary" /> Scheduled Bids & Auctions
          </h1>
          <p className="text-sm sm:text-base text-foreground-secondary mt-2 max-w-2xl mx-auto">
            Manage your automated scheduled bids and monitor upcoming public auction schedules.
          </p>

          {/* Navigation Tabs */}
          <div className="flex items-center justify-center gap-2 mt-6">
            <button
              onClick={() => setActiveTab("my-bids")}
              className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 ${
                activeTab === "my-bids"
                  ? "bg-action-primary text-action-primary-foreground shadow-sm"
                  : "bg-surface border border-border-subtle text-foreground-secondary hover:text-foreground hover:bg-surface-raised"
              }`}
            >
              <FaUserClock /> My Scheduled Bids
              {userBids.length > 0 && (
                <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-white/20">
                  {userBids.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("upcoming")}
              className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 ${
                activeTab === "upcoming"
                  ? "bg-action-primary text-action-primary-foreground shadow-sm"
                  : "bg-surface border border-border-subtle text-foreground-secondary hover:text-foreground hover:bg-surface-raised"
              }`}
            >
              <FaCalendarAlt /> Upcoming Auctions
              {products.length > 0 && (
                <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-white/20">
                  {products.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* TAB 1: USER'S OWN SCHEDULED BIDS */}
        {activeTab === "my-bids" && (
          <div>
            {!isAuthenticated ? (
              <div className="bg-surface border border-border-subtle rounded-2xl p-12 text-center max-w-xl mx-auto shadow-card">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-action-primary/10 flex items-center justify-center text-action-primary text-2xl">
                  <FaUserClock />
                </div>
                <h2 className="text-xl font-bold text-foreground mb-2">
                  Authentication Required
                </h2>
                <p className="text-foreground-secondary text-sm mb-6">
                  Log in to create and monitor automated scheduled bids on your favorite auction lots.
                </p>
                <Link
                  to="/login"
                  className="btn-canonical btn-canonical-md btn-canonical-primary inline-flex items-center gap-2"
                >
                  Log In to View <FaArrowRight />
                </Link>
              </div>
            ) : userBidsLoading ? (
              <div className="space-y-6">
                {[1, 2].map((n) => (
                  <div
                    key={n}
                    className="bg-surface border border-border-subtle rounded-2xl p-5 sm:p-6 flex flex-col md:flex-row gap-6 animate-pulse"
                  >
                    <div className="w-full md:w-56 lg:w-64 aspect-[16/10] md:aspect-[4/3] bg-surface-subtle rounded-xl shrink-0"></div>
                    <div className="flex-1 space-y-3 py-1">
                      <div className="h-5 bg-surface-subtle rounded w-1/4"></div>
                      <div className="h-6 bg-surface-subtle rounded w-3/4"></div>
                      <div className="h-4 bg-surface-subtle rounded w-1/2"></div>
                      <div className="h-4 bg-surface-subtle rounded w-1/3 pt-2"></div>
                    </div>
                    <div className="w-full md:w-56 lg:w-64 shrink-0 md:border-l md:border-border-subtle md:pl-6 space-y-3">
                      <div className="h-8 bg-surface-subtle rounded w-1/2"></div>
                      <div className="h-10 bg-surface-subtle rounded-lg w-full"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : userBids.length === 0 ? (
              <div className="bg-surface border border-border-subtle rounded-2xl p-12 text-center max-w-xl mx-auto shadow-card">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-action-primary/10 flex items-center justify-center text-action-primary text-2xl">
                  <FaUserClock />
                </div>
                <h2 className="text-xl font-bold text-foreground mb-2">
                  No Scheduled Bids Found
                </h2>
                <p className="text-foreground-secondary text-sm mb-6">
                  You haven&apos;t configured any scheduled bids yet. Visit any active or upcoming product detail page and click &quot;Schedule Bid&quot; to set up automated bidding.
                </p>
                <Link
                  to="/bid"
                  className="btn-canonical btn-canonical-md btn-canonical-primary inline-flex items-center gap-2"
                >
                  Explore Auctions <FaArrowRight />
                </Link>
              </div>
            ) : (
              <div className="space-y-6">
                {userBids.map((b) => {
                  const prod = b.productId;
                  const prodName = prod?.name || "Auction Listing";
                  const prodImg =
                    prod?.images?.[0]?.secure_url ||
                    "/lot-placeholder.svg";
                  const targetFormatted = b.targetTime
                    ? new Date(b.targetTime).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })
                    : "Not specified";

                  return (
                    <div
                      key={b._id}
                      className="bg-surface border border-border-subtle rounded-2xl p-5 sm:p-6 shadow-card hover:shadow-card-hover transition-all duration-200 flex flex-col md:flex-row items-stretch gap-6 min-w-0 group"
                    >
                      {/* 1. Image Thumbnail Region */}
                      <div className="w-full md:w-56 lg:w-64 shrink-0">
                        <div className="w-full aspect-[16/10] md:aspect-[4/3] rounded-xl overflow-hidden bg-surface-subtle border border-border-subtle relative group-hover:border-action-primary/30 transition-colors">
                          <img
                            src={prodImg}
                            alt={prodName}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            onError={(e) => {
                              e.currentTarget.src = "/lot-placeholder.svg";
                            }}
                          />
                        </div>
                      </div>

                      {/* 2. Main Information Region */}
                      <div className="flex-1 min-w-0 flex flex-col justify-between py-1 space-y-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            {getStatusBadge(b.status, b.failureReason)}
                            <span className="text-xs text-foreground-muted flex items-center gap-1.5 font-numeric">
                              <FaClock className="text-foreground-muted text-[11px]" />
                              <span>Scheduled for: {targetFormatted}</span>
                            </span>
                          </div>

                          <h3
                            onClick={() => prod?._id && navigate(`/product/${prod._id}`)}
                            className="text-base sm:text-lg font-bold text-foreground hover:text-action-primary transition-colors cursor-pointer truncate"
                            title={prodName}
                          >
                            {prodName}
                          </h3>

                          {b.failureReason && b.status === "FAILED" && (
                            <p className="text-xs text-status-danger mt-1">
                              Reason: {b.failureReason}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-6 pt-3 border-t border-border-subtle/70">
                          <div>
                            <span className="text-[11px] text-foreground-muted block uppercase font-medium">Scheduled Bid</span>
                            <span className="text-lg font-bold text-action-primary font-numeric">
                              ₹{Number(b.amount || 0).toLocaleString()}
                            </span>
                          </div>
                          {prod?.currentPrice !== undefined && (
                            <div>
                              <span className="text-[11px] text-foreground-muted block uppercase font-medium">Current Price</span>
                              <span className="text-sm font-semibold text-foreground font-numeric">
                                ₹{Number(prod.currentPrice).toLocaleString()}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 3. Actions Region */}
                      <div className="w-full md:w-56 lg:w-64 shrink-0 md:border-l md:border-border-subtle md:pl-6 flex flex-col justify-center gap-3 bg-surface-subtle/40 -mx-5 -mb-5 sm:-mx-6 sm:-mb-6 md:m-0 p-5 sm:p-6 md:p-0 rounded-b-2xl md:rounded-none md:bg-transparent">
                        {prod?._id && (
                          <button
                            onClick={() => navigate(`/product/${prod._id}`)}
                            className="w-full btn-canonical btn-canonical-md btn-canonical-primary flex items-center justify-center gap-2 font-semibold shadow-xs hover:shadow-md transition-all py-2.5"
                          >
                            <FaEye className="text-sm" /> View Item
                          </button>
                        )}

                        {b.status === "PENDING" && (
                          <button
                            onClick={() => handleCancelBid(b._id)}
                            disabled={cancellingId === b._id}
                            className="w-full btn-canonical btn-canonical-md btn-canonical-outline text-status-danger border-status-danger/30 hover:bg-status-danger/10 flex items-center justify-center gap-2 py-2.5"
                          >
                            <FaBan className="text-xs" />
                            {cancellingId === b._id ? "Cancelling..." : "Cancel Bid"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: UPCOMING AUCTIONS */}
        {activeTab === "upcoming" && (
          <div>
            {loading ? (
              <div className="space-y-6">
                {[1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className="bg-surface border border-border-subtle rounded-2xl p-5 sm:p-6 flex flex-col md:flex-row gap-6 animate-pulse"
                  >
                    <div className="w-full md:w-56 lg:w-64 aspect-[16/10] md:aspect-[4/3] bg-surface-subtle rounded-xl shrink-0"></div>
                    <div className="flex-1 space-y-3 py-1">
                      <div className="h-5 bg-surface-subtle rounded w-1/4"></div>
                      <div className="h-6 bg-surface-subtle rounded w-3/4"></div>
                      <div className="h-4 bg-surface-subtle rounded w-5/6"></div>
                      <div className="h-4 bg-surface-subtle rounded w-1/2"></div>
                      <div className="h-4 bg-surface-subtle rounded w-1/3 pt-2"></div>
                    </div>
                    <div className="w-full md:w-64 lg:w-72 shrink-0 md:border-l md:border-border-subtle md:pl-6 space-y-4">
                      <div className="h-8 bg-surface-subtle rounded w-1/2"></div>
                      <div className="h-20 bg-surface-subtle rounded-xl w-full"></div>
                      <div className="h-10 bg-surface-subtle rounded-lg w-full"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="w-full max-w-2xl px-4 mx-auto mt-12 text-center">
                <div className="bg-surface border border-status-danger/30 rounded-xl p-8 shadow-card">
                  <p className="text-status-danger font-medium mb-4">{error}</p>
                  <button
                    onClick={fetchScheduledAuctions}
                    className="btn-canonical btn-canonical-md btn-canonical-primary"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            ) : products.length === 0 ? (
              <div className="bg-surface border border-border-subtle rounded-2xl p-12 text-center max-w-xl mx-auto shadow-card">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-action-primary/10 flex items-center justify-center text-action-primary text-2xl">
                  <FaClock />
                </div>
                <h2 className="text-xl font-bold text-foreground mb-2">
                  No Scheduled Auctions
                </h2>
                <p className="text-foreground-secondary text-sm mb-6">
                  There are currently no upcoming auctions scheduled in advance. Explore currently active live auctions now.
                </p>
                <Link
                  to="/bid"
                  className="btn-canonical btn-canonical-md btn-canonical-primary inline-flex items-center gap-2"
                >
                  Browse Live Auctions <FaArrowRight />
                </Link>
              </div>
            ) : (
              <div className="space-y-6">
                {products.map((product) => {
                  const cd = countdowns[product._id];
                  const timeLeft = cd?.timeLeft || { days: "00", hours: "00", minutes: "00", seconds: "00" };
                  const startingPrice =
                    product.biddingStartPrice !== undefined
                      ? product.biddingStartPrice
                      : product.startingPrice || 0;

                  return (
                    <div
                      key={product._id}
                      className="bg-surface border border-border-subtle rounded-2xl p-5 sm:p-6 shadow-card hover:shadow-card-hover transition-all duration-200 flex flex-col md:flex-row items-stretch gap-6 min-w-0 group"
                    >
                      {/* 1. Image Thumbnail Region */}
                      <div className="w-full md:w-56 lg:w-64 shrink-0">
                        <div className="w-full aspect-[16/10] md:aspect-[4/3] rounded-xl overflow-hidden bg-surface-subtle border border-border-subtle relative group-hover:border-action-primary/30 transition-colors">
                          <img
                            src={product.images?.[0]?.secure_url || "/lot-placeholder.svg"}
                            alt={product.name || "Auction lot"}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            onError={(e) => {
                              e.currentTarget.src = "/lot-placeholder.svg";
                            }}
                          />
                          <div className="absolute top-2.5 left-2.5 bg-black/75 backdrop-blur-md text-white text-[11px] font-semibold px-2.5 py-1 rounded-md flex items-center gap-1.5 shadow-sm">
                            <FaClock className="text-action-primary text-xs" />
                            <span>{cd?.isUpcoming ? "Scheduled" : cd?.isActive ? "Live" : "Upcoming"}</span>
                          </div>
                        </div>
                      </div>

                      {/* 2. Main Information Region */}
                      <div className="flex-1 min-w-0 flex flex-col justify-between py-1 space-y-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-action-primary/10 text-action-primary border border-action-primary/20">
                              {product.category || "Scheduled Lot"}
                            </span>
                            <span className="text-xs text-foreground-muted flex items-center gap-1.5 font-numeric">
                              <FaCalendarAlt className="text-foreground-muted text-[11px]" />
                              <span>Starts: {formatScheduledDate(product)}</span>
                            </span>
                          </div>

                          <h2
                            onClick={() => navigate(`/product/${product._id}`)}
                            className="text-lg sm:text-xl font-bold text-foreground hover:text-action-primary transition-colors cursor-pointer line-clamp-2 leading-snug"
                            title={product.name}
                          >
                            {product.name}
                          </h2>

                          <p className="text-foreground-secondary text-xs sm:text-sm mt-2 line-clamp-2 leading-relaxed">
                            {formatDescription(product.description)}
                          </p>
                        </div>

                        {/* Lot Details Bottom Bar */}
                        <div className="pt-3 border-t border-border-subtle/70 flex flex-wrap items-center gap-4 text-xs text-foreground-muted">
                          <span>
                            Lot ID: <span className="font-mono text-foreground font-semibold">#{String(product._id).slice(-6).toUpperCase()}</span>
                          </span>
                          {product.totalBids !== undefined && (
                            <span>
                              Pre-bids: <span className="text-foreground font-semibold font-numeric">{product.totalBids}</span>
                            </span>
                          )}
                          {product.seller?.name && (
                            <span>
                              Seller: <span className="text-foreground font-medium">{product.seller.name}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 3. Dedicated Metadata & Action Region */}
                      <div className="w-full md:w-64 lg:w-72 shrink-0 md:border-l md:border-border-subtle md:pl-6 flex flex-col justify-between gap-4 bg-surface-subtle/40 -mx-5 -mb-5 sm:-mx-6 sm:-mb-6 md:m-0 p-5 sm:p-6 md:p-0 rounded-b-2xl md:rounded-none md:bg-transparent">
                        <div>
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground-muted block mb-1">
                            Starting Price
                          </span>
                          <div className="text-2xl font-black text-foreground font-numeric tracking-tight flex items-center">
                            ₹{Number(startingPrice).toLocaleString()}
                          </div>
                        </div>

                        <div className="bg-surface border border-border-subtle/80 rounded-xl p-3 shadow-xs">
                          <div className="text-[10px] uppercase font-bold tracking-wider text-action-primary flex items-center justify-center gap-1.5 mb-1.5">
                            <FaHourglassHalf className="text-xs animate-pulse" />
                            <span>{cd?.statusText || "AUCTION STARTS IN"}</span>
                          </div>
                          <div className="grid grid-cols-4 gap-1.5 text-center font-numeric">
                            <div className="bg-surface-subtle rounded-lg py-1 px-1 border border-border-subtle/50">
                              <span className="block text-sm font-extrabold text-foreground leading-tight">{timeLeft.days}</span>
                              <span className="block text-[8px] font-medium text-foreground-muted uppercase tracking-wider">Days</span>
                            </div>
                            <div className="bg-surface-subtle rounded-lg py-1 px-1 border border-border-subtle/50">
                              <span className="block text-sm font-extrabold text-foreground leading-tight">{timeLeft.hours}</span>
                              <span className="block text-[8px] font-medium text-foreground-muted uppercase tracking-wider">Hours</span>
                            </div>
                            <div className="bg-surface-subtle rounded-lg py-1 px-1 border border-border-subtle/50">
                              <span className="block text-sm font-extrabold text-foreground leading-tight">{timeLeft.minutes}</span>
                              <span className="block text-[8px] font-medium text-foreground-muted uppercase tracking-wider">Mins</span>
                            </div>
                            <div className="bg-surface-subtle rounded-lg py-1 px-1 border border-border-subtle/50">
                              <span className="block text-sm font-extrabold text-foreground leading-tight">{timeLeft.seconds}</span>
                              <span className="block text-[8px] font-medium text-foreground-muted uppercase tracking-wider">Secs</span>
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => navigate(`/product/${product._id}`)}
                          className="w-full btn-canonical btn-canonical-md btn-canonical-primary flex items-center justify-center gap-2 font-semibold shadow-xs hover:shadow-md transition-all py-2.5"
                        >
                          <FaEye className="text-sm" /> View Item
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ScheduledBids;