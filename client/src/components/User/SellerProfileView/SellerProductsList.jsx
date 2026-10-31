import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  Gavel,
  Clock,
  Eye,
  Search,
  ExternalLink,
  Tag,
  Flame,
  CheckCircle2,
  Calendar,
} from "lucide-react";
import { getOptimizedCardImage } from "../../../utils/imageOptimizer";

const SellerProductsList = ({
  sellerEmail,
  currentProductId,
  initialProducts = null,
}) => {
  const [products, setProducts] = useState(initialProducts || []);
  const [loading, setLoading] = useState(!initialProducts);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all"); // 'all' | 'active' | 'closed'
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("newest");

  const navigate = useNavigate();
  const API_URL = import.meta.env.VITE_API_URL || "";

  useEffect(() => {
    if (initialProducts && initialProducts.length > 0) {
      setProducts(initialProducts);
      setLoading(false);
      return;
    }

    if (!sellerEmail) {
      setLoading(false);
      return;
    }

    const fetchSellerProducts = async () => {
      try {
        setLoading(true);
        const response = await axios.get(
          `${API_URL}/api/products/email/${encodeURIComponent(sellerEmail)}`
        );
        const fetched = Array.isArray(response.data.products)
          ? response.data.products
          : [];
        setProducts(fetched);
        setError(null);
      } catch (err) {
        setError(err.message || "Failed to fetch seller products");
      } finally {
        setLoading(false);
      }
    };

    fetchSellerProducts();
  }, [sellerEmail, initialProducts, API_URL]);

  const handleProductClick = (productId) => {
    navigate(`/product/${productId}`);
  };

  const formatPrice = (val) => {
    const num = Number(val) || 0;
    return `₹${num.toLocaleString("en-IN")}`;
  };

  // Filter & Search logic
  const filteredProducts = products.filter((p) => {
    if (currentProductId && p._id === currentProductId) return false;

    const matchesStatus =
      filter === "all"
        ? true
        : filter === "active"
        ? p.status === "Active"
        : p.status !== "Active";

    const matchesSearch =
      searchQuery.trim() === "" ||
      p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category?.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesStatus && matchesSearch;
  });

  // Sort logic
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (sortBy === "price-asc") {
      return (a.biddingStartPrice || 0) - (b.biddingStartPrice || 0);
    }
    if (sortBy === "price-desc") {
      return (b.biddingStartPrice || 0) - (a.biddingStartPrice || 0);
    }
    if (sortBy === "bids") {
      return (b.bidCount || 0) - (a.bidCount || 0);
    }
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  });

  const activeCount = products.filter((p) => p.status === "Active").length;
  const closedCount = products.filter((p) => p.status !== "Active").length;

  if (loading) {
    return (
      <div className="py-16 text-center">
        <div className="inline-block w-8 h-8 border-3 border-action-primary border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-foreground-muted text-sm">Loading seller catalog...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-surface border border-red-500/20 rounded-xl text-center">
        <p className="text-red-400 font-medium mb-1">Failed to load listings</p>
        <p className="text-foreground-muted text-xs">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls Bar: Filters & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pb-2 border-b border-border-subtle">
        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setFilter("all")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              filter === "all"
                ? "bg-action-primary text-white shadow-xs"
                : "bg-surface-subtle hover:bg-surface-raised border border-border-subtle text-foreground-muted hover:text-foreground"
            }`}
          >
            All Auctions ({products.length})
          </button>
          <button
            onClick={() => setFilter("active")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              filter === "active"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-surface-subtle hover:bg-surface-raised border border-border-subtle text-foreground-muted hover:text-foreground"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Live Now ({activeCount})
          </button>
          <button
            onClick={() => setFilter("closed")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              filter === "closed"
                ? "bg-action-primary text-white shadow-xs"
                : "bg-surface-subtle hover:bg-surface-raised border border-border-subtle text-foreground-muted hover:text-foreground"
            }`}
          >
            Concluded ({closedCount})
          </button>
        </div>

        {/* Search & Sort */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-56">
            <Search className="w-3.5 h-3.5 text-foreground-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search seller catalog..."
              className="w-full pl-8 pr-3 py-1.5 bg-surface border border-border-subtle focus:border-action-primary rounded-lg text-xs text-foreground placeholder:text-foreground-muted focus:outline-none transition-colors"
            />
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-surface border border-border-subtle text-foreground-muted text-xs rounded-lg px-2.5 py-1.5 focus:border-action-primary focus:outline-none cursor-pointer"
          >
            <option value="newest">Newest First</option>
            <option value="price-desc">Price: High to Low</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="bids">Most Bids</option>
          </select>
        </div>
      </div>

      {/* Grid of Listings */}
      {sortedProducts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {sortedProducts.map((product) => {
            const isLive = product.status === "Active";
            const currentPrice = product.highestBid || product.biddingStartPrice || 0;
            const primaryImage =
              product.images && product.images.length > 0
                ? product.images[0].secure_url
                : product.bannerImage?.secure_url || "/lot-placeholder.svg";

            return (
              <div
                key={product._id}
                onClick={() => handleProductClick(product._id)}
                className="group bg-surface border border-border-subtle hover:border-border-default rounded-xl overflow-hidden shadow-card hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col"
              >
                {/* Media Banner with Status Overlay */}
                <div className="relative aspect-[16/10] bg-surface-subtle overflow-hidden">
                  <img
                    src={getOptimizedCardImage(primaryImage, 450)}
                    alt={product.name}
                    loading="lazy"
                    decoding="async"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = "/lot-placeholder.svg";
                    }}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  {/* Status Badge */}
                  <div className="absolute top-3 left-3">
                    {isLive ? (
                      <span className="badge-auction-live text-[11px] backdrop-blur-md bg-emerald-950/80 text-emerald-300 border-emerald-500/40">
                        <span className="pulse-live text-emerald-400"></span>
                        Live Auction
                      </span>
                    ) : (
                      <span className="badge-auction-closed text-[11px] backdrop-blur-md bg-neutral-900/80 text-neutral-300 border-neutral-700/60">
                        Concluded
                      </span>
                    )}
                  </div>

                  {/* Category Pill */}
                  {product.category && (
                    <div className="absolute top-3 right-3">
                      <span className="bg-surface/90 backdrop-blur-md border border-border-subtle text-foreground text-[10px] font-semibold px-2 py-0.5 rounded-md uppercase tracking-wider">
                        {product.category}
                      </span>
                    </div>
                  )}
                </div>

                {/* Content Body */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <h3 className="font-semibold text-foreground text-sm line-clamp-2 group-hover:text-action-primary transition-colors mb-1.5">
                      {product.name}
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-foreground-muted">
                      <span className="flex items-center gap-1 font-numeric">
                        <Gavel className="w-3.5 h-3.5 text-action-primary" />
                        {product.bidCount || 0} bids
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {isLive
                          ? `Ends ${new Date(product.biddingEndTime).toLocaleDateString()}`
                          : "Auction Ended"}
                      </span>
                    </div>
                  </div>

                  {/* Price Section & CTA */}
                  <div className="pt-3 border-t border-border-subtle flex items-center justify-between">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-foreground-muted font-medium">
                        {isLive ? "Current Price" : "Final Price"}
                      </div>
                      <div className="text-base font-bold text-foreground font-numeric">
                        {formatPrice(currentPrice)}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleProductClick(product._id);
                      }}
                      className="px-3 py-1.5 bg-action-primary hover:bg-action-primary-hover text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                    >
                      <span>View</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-12 bg-surface-subtle border border-border-subtle rounded-xl text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-surface border border-border-subtle flex items-center justify-center mx-auto text-foreground-muted">
            <Gavel className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-semibold text-foreground">
            No listings found
          </h4>
          <p className="text-xs text-foreground-muted max-w-sm mx-auto">
            {filter === "active"
              ? "This seller does not currently have any active live auctions."
              : "No auctions match your search criteria."}
          </p>
          {filter !== "all" && (
            <button
              onClick={() => {
                setFilter("all");
                setSearchQuery("");
              }}
              className="text-xs font-semibold text-action-primary hover:underline cursor-pointer"
            >
              Show all seller listings
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default SellerProductsList;