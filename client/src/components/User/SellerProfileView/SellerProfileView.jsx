import React, { useState, useEffect, useMemo } from "react";
import {
  Star,
  Shield,
  Award,
  Calendar,
  Gavel,
  MessageCircle,
  ThumbsUp,
  Flag,
  TrendingUp,
  Clock,
  User,
  MapPin,
  Store,
  Package,
  Loader2,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Flame,
  ArrowUpRight,
  Sparkles,
  ShoppingBag,
} from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import axios from "axios";
import SellerProductsList from "./SellerProductsList";

const DEMO_MERCHANTS = [
  { email: "seller_10@auctionx.demo", label: "Shreya Rao (Grand Cru Wine & Spirits)" },
  { email: "seller_24@auctionx.demo", label: "Chloe Santos (Nirvana Asian Antiques)" },
  { email: "seller_8@auctionx.demo", label: "Aarav Patel (Rare Horology & Watches)" },
  { email: "seller_13@auctionx.demo", label: "Priya Nair (Classic Collectibles)" },
];

const SellerProfileView = () => {
  const [activeTab, setActiveTab] = useState("sellerItems"); // 'sellerItems' | 'stats' | 'reviews' | 'profile'
  const [seller, setSeller] = useState(null);
  const [products, setProducts] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [error, setError] = useState(null);

  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const authUser = useSelector((state) => state.auth?.user);
  const isAuthSeller = useSelector((state) => state.auth?.isSeller);

  const API_URL = import.meta.env.VITE_API_URL || "";

  // Derive target seller email from location.state, URL search params, logged-in seller, or fallback
  const resolvedEmail = useMemo(() => {
    return (
      location.state?.sellerEmail ||
      searchParams.get("email") ||
      searchParams.get("sellerEmail") ||
      (isAuthSeller && authUser?.email ? authUser.email : null) ||
      "seller_10@auctionx.demo"
    );
  }, [location.state, searchParams, isAuthSeller, authUser]);

  // Handle switching merchants via dropdown
  const handleSwitchSeller = (newEmail) => {
    setSearchParams({ email: newEmail });
  };

  // Helper function to format Indian Rupee currency
  const formatINR = (val) => {
    const num = Number(val) || 0;
    return `₹${num.toLocaleString("en-IN")}`;
  };

  // Helper function to format relative date safely
  const formatRelativeDate = (dateString) => {
    if (!dateString) return "Recently";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Recently";

    const diffDays = Math.ceil(Math.abs(new Date() - date) / (1000 * 60 * 60 * 24));
    if (diffDays <= 1) return "1 day ago";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.ceil(diffDays / 30)} months ago`;
    return `${Math.ceil(diffDays / 365)} years ago`;
  };

  // 1. Fetch Seller Profile and Catalog
  useEffect(() => {
    const fetchSellerAndCatalog = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch seller details
        const sellerRes = await axios.get(
          `${API_URL}/api/auth/seller/user/${encodeURIComponent(resolvedEmail)}`
        );
        const sellerData = sellerRes.data || {};

        // Fetch seller products catalog
        let catalog = [];
        try {
          const productsRes = await axios.get(
            `${API_URL}/api/products/email/${encodeURIComponent(resolvedEmail)}`
          );
          catalog = Array.isArray(productsRes.data.products)
            ? productsRes.data.products
            : [];
        } catch (catErr) {
          console.warn("Could not fetch catalog for seller:", catErr.message);
        }

        setProducts(catalog);

        // Safe location derivation
        const locationSegments = [
          sellerData.city,
          sellerData.state,
          sellerData.country,
        ].filter(Boolean);
        const displayLocation =
          locationSegments.length > 0
            ? locationSegments.join(", ")
            : sellerData.country || "India";

        // Safe join date derivation
        let joinDateFormatted = "Verified Member";
        if (sellerData.createdAt && !isNaN(new Date(sellerData.createdAt).getTime())) {
          joinDateFormatted = new Date(sellerData.createdAt).toLocaleDateString("en-IN", {
            month: "long",
            year: "numeric",
          });
        }

        // Dynamic metrics derived from real catalog
        const totalAuctions = catalog.length;
        const activeAuctions = catalog.filter((p) => p.status === "Active").length;
        const closedAuctions = catalog.filter((p) => p.status !== "Active").length;

        const maxBidRealized =
          catalog.length > 0
            ? Math.max(
                0,
                ...catalog.map(
                  (p) => p.highestBid || p.finalPrice || p.biddingStartPrice || 0
                )
              )
            : 0;

        const avgStartingPrice =
          catalog.length > 0
            ? Math.round(
                catalog.reduce((acc, p) => acc + (p.biddingStartPrice || 0), 0) /
                  catalog.length
              )
            : 0;

        const totalBidsReceived = catalog.reduce(
          (acc, p) => acc + (p.bidCount || (p.bids ? p.bids.length : 0) || 0),
          0
        );

        // Derive unique category specializations
        const categoryList = [
          ...new Set(catalog.map((p) => p.category).filter(Boolean)),
        ];

        setSeller({
          id: sellerData._id,
          name: sellerData.name || "Verified Merchant",
          email: sellerData.email || resolvedEmail,
          username: `@${(sellerData.email || resolvedEmail).split("@")[0]}`,
          avatar:
            sellerData.profilePic && sellerData.profilePic.length > 0
              ? sellerData.profilePic[0].secure_url
              : "/default-profile.png",
          location: displayLocation,
          joinDate: joinDateFormatted,
          verified: sellerData.isVerified ?? true,
          phone: sellerData.phoneNo,
          storeName: sellerData.storeName || `${sellerData.name || "AuctionX"} Collectibles`,
          storeDescription:
            sellerData.storeDescription ||
            "Authorized auction merchant specializing in authenticated collectibles, luxury horology, and certified marketplace lots with comprehensive condition reports.",
          totalAuctions,
          activeAuctions,
          closedAuctions,
          maxBidRealized,
          avgStartingPrice,
          totalBidsReceived,
          categories: categoryList.length > 0 ? categoryList : ["Antiques & Collectibles"],
          rating: 4.9, // Baseline, updated by real reviews
          totalReviews: 0,
        });
      } catch (err) {
        console.error("Error loading seller profile:", err);
        setError(err.message || "Unable to load seller information.");
      } finally {
        setLoading(false);
      }
    };

    fetchSellerAndCatalog();
  }, [resolvedEmail, API_URL]);

  // 2. Fetch Buyer Reviews
  useEffect(() => {
    const fetchReviews = async () => {
      if (!resolvedEmail) return;

      try {
        setReviewsLoading(true);
        const response = await axios.get(
          `${API_URL}/api/product-feedback/seller/${encodeURIComponent(resolvedEmail)}`
        );
        const items = response.data?.feedbacks || [];

        const transformed = items.map((f) => ({
          id: f._id,
          buyer: f.userEmail ? f.userEmail.split("@")[0] : "Verified Collector",
          avatar: "/default-profile.png",
          rating: f.rating || 5,
          date: formatRelativeDate(f.createdAt),
          item: f.productName || "Authenticated Lot",
          review: f.reviewText || "Excellent transaction. Item arrived exactly as described with great packing.",
          helpful: 5,
          verified: true,
          productImage: f.productImage,
          orderId: f.orderId,
        }));

        setReviews(transformed);

        if (transformed.length > 0) {
          const avg =
            transformed.reduce((sum, r) => sum + r.rating, 0) / transformed.length;
          setSeller((prev) =>
            prev
              ? {
                  ...prev,
                  rating: Math.round(avg * 10) / 10,
                  totalReviews: transformed.length,
                }
              : prev
          );
        }
      } catch (err) {
        console.warn("Reviews load notice:", err.message);
      } finally {
        setReviewsLoading(false);
      }
    };

    if (seller) {
      fetchReviews();
    }
  }, [resolvedEmail, seller?.email, API_URL]);

  const renderStars = (rating) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${
          i < Math.floor(rating)
            ? "fill-amber-500 text-amber-500"
            : "text-border-subtle"
        }`}
      />
    ));
  };

  // Loading State
  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center bg-canvas">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-3 border-action-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-foreground-muted text-sm font-medium">
            Loading merchant profile...
          </p>
        </div>
      </div>
    );
  }

  // Error State
  if (error || !seller) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center bg-canvas px-4">
        <div className="max-w-md w-full bg-surface border border-red-500/20 rounded-2xl p-8 shadow-card text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mx-auto">
            <Store className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-foreground">
            Seller Profile Unavailable
          </h2>
          <p className="text-sm text-foreground-muted">
            {error || "We could not find the requested seller."}
          </p>
          <div className="pt-2">
            <button
              onClick={() => handleSwitchSeller("seller_10@auctionx.demo")}
              className="px-5 py-2.5 bg-action-primary hover:bg-action-primary-hover text-white rounded-xl text-sm font-semibold shadow-xs transition-colors cursor-pointer"
            >
              Load Featured Merchant (Shreya Rao)
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas text-foreground py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-8">
      {/* Top Controls: Breadcrumb & Switcher */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2">
        <div className="flex items-center gap-2 text-xs text-foreground-muted">
          <button
            onClick={() => navigate("/")}
            className="hover:text-action-primary transition-colors cursor-pointer"
          >
            Marketplace
          </button>
          <ChevronRight className="w-3.5 h-3.5" />
          <span>Sellers & Merchants</span>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-foreground font-semibold">{seller.name}</span>
        </div>

        {/* Demo Merchant Quick-Switch Dropdown */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-foreground-muted whitespace-nowrap">
            Explore Merchant:
          </span>
          <select
            value={resolvedEmail}
            onChange={(e) => handleSwitchSeller(e.target.value)}
            className="bg-surface border border-border-subtle hover:border-border-default text-foreground text-xs rounded-lg px-3 py-1.5 focus:border-action-primary focus:outline-none cursor-pointer w-full sm:w-auto"
          >
            {DEMO_MERCHANTS.map((m) => (
              <option key={m.email} value={m.email}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Header Profile Card */}
      <div className="bg-surface border border-border-subtle rounded-2xl p-6 sm:p-8 shadow-card relative overflow-hidden backdrop-blur-sm">
        {/* Ambient Warm Glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-b from-primary-500/10 via-action-primary/5 to-transparent rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-6 sm:gap-8 relative z-10">
          {/* Avatar Section */}
          <div className="relative shrink-0">
            <img
              src={seller.avatar}
              alt={seller.name}
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = "/default-profile.png";
              }}
              className="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover border-2 border-border-subtle ring-4 ring-primary-500/15 shadow-card"
            />
            {seller.verified && (
              <div
                className="absolute -bottom-1 -right-1 bg-emerald-500 text-white rounded-full p-1.5 shadow-md"
                title="Identity & Store Verified"
              >
                <CheckCircle2 className="w-4 h-4" />
              </div>
            )}
          </div>

          {/* Details Section */}
          <div className="flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">
                {seller.name}
              </h1>
              {seller.verified && (
                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5 text-emerald-400" />
                  Verified Merchant
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-foreground-muted">
              <span className="font-mono text-action-primary font-medium">
                {seller.username}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-action-primary" />
                {seller.location}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-action-primary" />
                Member since {seller.joinDate}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-action-primary" />
                Responds &lt; 2 hrs
              </span>
            </div>

            {/* Store Description Banner */}
            <div className="p-4 bg-surface-subtle border border-border-subtle rounded-xl space-y-1">
              <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
                <Store className="w-4 h-4 text-action-primary" />
                <span>{seller.storeName}</span>
              </div>
              <p className="text-foreground-muted text-xs sm:text-sm leading-relaxed">
                {seller.storeDescription}
              </p>
            </div>

            {/* Category Badges */}
            <div className="flex flex-wrap gap-2 pt-1">
              {seller.categories.map((cat, idx) => (
                <span
                  key={idx}
                  className="bg-primary-500/10 text-action-primary border border-primary-500/20 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5"
                >
                  <Sparkles className="w-3 h-3 text-action-primary" />
                  {cat}
                </span>
              ))}
            </div>
          </div>

          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-2 gap-3 w-full lg:w-72 shrink-0">
            {/* Rating */}
            <div className="bg-surface-subtle border border-border-subtle rounded-xl p-3.5 text-center shadow-xs">
              <div className="flex items-center justify-center gap-1 mb-1">
                {renderStars(seller.rating)}
              </div>
              <div className="text-xl font-bold font-numeric text-foreground">
                {seller.rating.toFixed(1)}
              </div>
              <p className="text-[11px] text-foreground-muted">
                {seller.totalReviews} reviews
              </p>
            </div>

            {/* Total Auctions */}
            <div className="bg-surface-subtle border border-border-subtle rounded-xl p-3.5 text-center shadow-xs">
              <div className="w-6 h-6 rounded-full bg-action-primary/10 text-action-primary flex items-center justify-center mx-auto mb-1">
                <Gavel className="w-3.5 h-3.5" />
              </div>
              <div className="text-xl font-bold font-numeric text-foreground">
                {seller.totalAuctions}
              </div>
              <p className="text-[11px] text-foreground-muted">Total Auctions</p>
            </div>

            {/* Active Live */}
            <div className="bg-surface-subtle border border-border-subtle rounded-xl p-3.5 text-center shadow-xs">
              <div className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto mb-1">
                <Flame className="w-3.5 h-3.5" />
              </div>
              <div className="text-xl font-bold font-numeric text-emerald-400">
                {seller.activeAuctions}
              </div>
              <p className="text-[11px] text-foreground-muted">Live Listings</p>
            </div>

            {/* Top Realized */}
            <div className="bg-surface-subtle border border-border-subtle rounded-xl p-3.5 text-center shadow-xs">
              <div className="w-6 h-6 rounded-full bg-primary-500/10 text-action-primary flex items-center justify-center mx-auto mb-1">
                <TrendingUp className="w-3.5 h-3.5" />
              </div>
              <div className="text-sm font-bold font-numeric text-foreground line-clamp-1">
                {formatINR(seller.maxBidRealized)}
              </div>
              <p className="text-[11px] text-foreground-muted">Top Valuation</p>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-border-subtle">
        <nav className="flex space-x-6 sm:space-x-8 overflow-x-auto">
          {[
            {
              id: "sellerItems",
              label: `Auctions & Catalog (${seller.totalAuctions})`,
              icon: Gavel,
            },
            {
              id: "stats",
              label: "Bidding & Performance Stats",
              icon: TrendingUp,
            },
            {
              id: "reviews",
              label: `Buyer Reviews (${reviews.length})`,
              icon: MessageCircle,
            },
            {
              id: "profile",
              label: "Store & Contact Details",
              icon: Store,
            },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-all cursor-pointer whitespace-nowrap ${
                activeTab === id
                  ? "border-action-primary text-action-primary font-semibold"
                  : "border-transparent text-foreground-muted hover:text-foreground hover:border-border-default"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* TAB 1: AUCTIONS & CATALOG */}
      {activeTab === "sellerItems" && (
        <SellerProductsList
          sellerEmail={resolvedEmail}
          initialProducts={products}
        />
      )}

      {/* TAB 2: BIDDING STATS */}
      {activeTab === "stats" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h2 className="text-xl font-bold text-foreground">
              Merchant Bidding & Performance Statistics
            </h2>
            <span className="text-xs text-foreground-muted">
              Authoritatively calculated from AuctionX verified marketplace activity
            </span>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Catalog & Auction Metrics */}
            <div className="bg-surface border border-border-subtle rounded-2xl p-6 shadow-card space-y-4">
              <h3 className="text-base font-semibold text-foreground flex items-center gap-2 border-b border-border-subtle pb-3">
                <Gavel className="w-4 h-4 text-action-primary" />
                <span>Auction Performance</span>
              </h3>

              <div className="space-y-3.5 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-foreground-muted">Total Catalog Volume</span>
                  <span className="font-bold text-foreground font-numeric">
                    {seller.totalAuctions} items listed
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-foreground-muted">Live Active Bids</span>
                  <span className="font-bold text-emerald-400 font-numeric">
                    {seller.activeAuctions} live now
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-foreground-muted">Completed Auctions</span>
                  <span className="font-bold text-foreground font-numeric">
                    {seller.closedAuctions} concluded
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-foreground-muted">Top Realized Valuation</span>
                  <span className="font-bold text-action-primary font-numeric">
                    {formatINR(seller.maxBidRealized)}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-foreground-muted">Average Starting Price</span>
                  <span className="font-bold text-foreground font-numeric">
                    {formatINR(seller.avgStartingPrice)}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-foreground-muted">Total Bid Engagements</span>
                  <span className="font-bold text-foreground font-numeric">
                    {seller.totalBidsReceived} bids placed
                  </span>
                </div>
              </div>
            </div>

            {/* Merchant Reliability & Standards */}
            <div className="bg-surface border border-border-subtle rounded-2xl p-6 shadow-card space-y-4">
              <h3 className="text-base font-semibold text-foreground flex items-center gap-2 border-b border-border-subtle pb-3">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span>Merchant Reliability Standards</span>
              </h3>

              <div className="space-y-3.5 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-foreground-muted">Seller Identity Status</span>
                  <span className="font-semibold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Verified KYC
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-foreground-muted">Customer Rating</span>
                  <span className="font-bold text-amber-500 font-numeric">
                    ★ {seller.rating.toFixed(1)} / 5.0
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-foreground-muted">Payment Security</span>
                  <span className="font-semibold text-foreground">
                    Escrow Protected via Razorpay
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-foreground-muted">Dispatch Standard</span>
                  <span className="font-semibold text-foreground">
                    Insured Priority Courier
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-foreground-muted">Average Response Time</span>
                  <span className="font-semibold text-action-primary">
                    &lt; 2 hours (Prompt Responder)
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-foreground-muted">Buyer Guarantee</span>
                  <span className="font-semibold text-emerald-400">
                    100% Authenticity Verified
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: BUYER REVIEWS */}
      {activeTab === "reviews" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
            <h2 className="text-xl font-bold text-foreground">
              Buyer Feedback & Ratings
            </h2>
            <span className="text-xs text-foreground-muted">
              Showing {reviews.length} authenticated reviews
            </span>
          </div>

          {reviewsLoading ? (
            <div className="py-12 text-center">
              <Loader2 className="w-6 h-6 animate-spin text-action-primary mx-auto mb-2" />
              <p className="text-xs text-foreground-muted">Loading feedback...</p>
            </div>
          ) : reviews.length === 0 ? (
            <div className="p-12 bg-surface border border-border-subtle rounded-2xl text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-surface-subtle border border-border-subtle flex items-center justify-center mx-auto text-foreground-muted">
                <MessageCircle className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-semibold text-foreground">
                No Reviews Recorded Yet
              </h4>
              <p className="text-xs text-foreground-muted max-w-sm mx-auto">
                Feedback is submitted by verified winning bidders upon order fulfillment.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((r) => (
                <div
                  key={r.id}
                  className="bg-surface border border-border-subtle rounded-xl p-5 shadow-xs space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <img
                        src={r.avatar}
                        alt={r.buyer}
                        className="w-10 h-10 rounded-full object-cover border border-border-subtle"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground text-sm">
                            {r.buyer}
                          </span>
                          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-semibold">
                            Verified Buyer
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <div className="flex">{renderStars(r.rating)}</div>
                          <span className="text-xs text-foreground-muted">
                            {r.date}
                          </span>
                        </div>
                      </div>
                    </div>

                    {r.orderId && (
                      <span className="text-[11px] font-mono text-foreground-muted bg-surface-subtle px-2 py-1 rounded">
                        Order #{r.orderId.slice(-6)}
                      </span>
                    )}
                  </div>

                  <p className="text-foreground-muted text-xs sm:text-sm leading-relaxed">
                    {r.review}
                  </p>

                  <div className="flex items-center gap-4 pt-1 text-xs text-foreground-muted">
                    <button className="flex items-center gap-1 hover:text-action-primary transition-colors cursor-pointer">
                      <ThumbsUp className="w-3.5 h-3.5" />
                      Helpful ({r.helpful})
                    </button>
                    <button className="flex items-center gap-1 hover:text-red-400 transition-colors cursor-pointer">
                      <Flag className="w-3.5 h-3.5" />
                      Report
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: STORE & PROFILE DETAILS */}
      {activeTab === "profile" && (
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-foreground">
            Store & Merchant Profile Details
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Store Information */}
            <div className="bg-surface border border-border-subtle rounded-2xl p-6 shadow-card space-y-4">
              <h3 className="text-base font-semibold text-foreground flex items-center gap-2 border-b border-border-subtle pb-3">
                <Store className="w-4 h-4 text-action-primary" />
                <span>Store Information</span>
              </h3>

              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-foreground-muted text-xs block mb-0.5">
                    Store Name
                  </span>
                  <div className="font-semibold text-foreground">
                    {seller.storeName}
                  </div>
                </div>

                <div>
                  <span className="text-foreground-muted text-xs block mb-0.5">
                    Store Bio
                  </span>
                  <div className="text-foreground-muted text-xs leading-relaxed">
                    {seller.storeDescription}
                  </div>
                </div>

                <div>
                  <span className="text-foreground-muted text-xs block mb-0.5">
                    Official Contact Email
                  </span>
                  <div className="font-mono text-action-primary text-xs">
                    {seller.email}
                  </div>
                </div>
              </div>
            </div>

            {/* Verification & Regional Coverage */}
            <div className="bg-surface border border-border-subtle rounded-2xl p-6 shadow-card space-y-4">
              <h3 className="text-base font-semibold text-foreground flex items-center gap-2 border-b border-border-subtle pb-3">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span>Verification & Regional Presence</span>
              </h3>

              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-foreground-muted text-xs block mb-0.5">
                    Registered Location
                  </span>
                  <div className="font-semibold text-foreground">
                    {seller.location}
                  </div>
                </div>

                <div>
                  <span className="text-foreground-muted text-xs block mb-0.5">
                    Marketplace Account Status
                  </span>
                  <div className="font-semibold text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    Authorized Seller in Good Standing
                  </div>
                </div>

                <div>
                  <span className="text-foreground-muted text-xs block mb-0.5">
                    Registration Date
                  </span>
                  <div className="font-semibold text-foreground">
                    {seller.joinDate}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Trust & Safety Banner Footer */}
      <div className="bg-surface border border-border-subtle rounded-2xl p-6 sm:p-8 shadow-card">
        <h3 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-action-primary" />
          <span>AuctionX Buyer & Seller Trust Protocol</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs text-foreground-muted">
          <div className="flex items-center gap-2 bg-surface-subtle border border-border-subtle rounded-xl p-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Government KYC & identity verification on file</span>
          </div>
          <div className="flex items-center gap-2 bg-surface-subtle border border-border-subtle rounded-xl p-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Escrow payment release upon shipment receipt</span>
          </div>
          <div className="flex items-center gap-2 bg-surface-subtle border border-border-subtle rounded-xl p-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Strict dispute arbitration & 24h review hold</span>
          </div>
          <div className="flex items-center gap-2 bg-surface-subtle border border-border-subtle rounded-xl p-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Transparent bid increments & anti-snipe defense</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SellerProfileView;
