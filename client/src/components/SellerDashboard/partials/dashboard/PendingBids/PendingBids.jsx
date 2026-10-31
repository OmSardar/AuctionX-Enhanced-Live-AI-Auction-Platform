import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { formatCurrency } from "../../../../../lib/utils";
import { useSelector } from "react-redux";
import { toast } from "react-hot-toast";
import {
  Edit3,
  Trash2,
  Clock,
  Mail,
  Phone,
  Tag,
  IndianRupee,
  Package,
  Eye,
} from "lucide-react";

import {
  parseAuctionDates,
  calculateAuctionTime,
} from "../../../../../utils/auctionTimer";
import axiosWithAuth from "../../../../../redux/slices/axiosWithAuth";

const api = {
  getListingsByEmail: async (email) => {
    try {
      const response = await axiosWithAuth.get(
        `/products/email/${encodeURIComponent(email)}`
      );
      return response.data;
    } catch (error) {
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Failed to fetch listings. Please try again.";
      throw new Error(errorMessage);
    }
  },

  deleteListing: async (id) => {
    try {
      const response = await axiosWithAuth.delete(`/products/${id}`);
      return response.data || { success: true };
    } catch (error) {
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Failed to delete listing. Please try again.";
      throw new Error(errorMessage);
    }
  },
};

const SellerHistoryPage = () => {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteLoading, setDeleteLoading] = useState(null);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const { user, isAuthenticated } = useSelector((state) => state.auth);
  const csrfToken = useSelector((state) => state.csrf?.token);

  // Helper function to format description properly
  const formatDescription = (description) => {
    if (!description) return "No description available";

    // If it's already a string and looks normal, return it
    if (
      typeof description === "string" &&
      !description.startsWith("[") &&
      !description.startsWith("{")
    ) {
      return description;
    }

    // Try to parse if it's JSON
    try {
      const parsed =
        typeof description === "string" ? JSON.parse(description) : description;

      // If it's an array of objects with name/description pairs
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => {
            if (item.name && item.description) {
              return `${item.name}: ${item.description}`;
            } else if (item.name) {
              return item.name;
            } else if (typeof item === "string") {
              return item;
            }
            return "";
          })
          .filter(Boolean)
          .join(", ");
      }

      // If it's an object, try to extract meaningful text
      if (typeof parsed === "object") {
        const values = Object.values(parsed).filter(
          (v) => typeof v === "string" && v.length > 0
        );
        return values.length > 0
          ? values.join(", ")
          : "No description available";
      }

      return String(parsed);
    } catch (e) {
      // If parsing fails, clean up the string representation
      const cleanString = String(description)
        .replace(/^\[|\]$/g, "") // Remove brackets
        .replace(/^\{|\}$/g, "") // Remove braces
        .replace(/"/g, "") // Remove quotes
        .replace(/_id:[^,}]+,?/g, "") // Remove _id fields
        .replace(/,\s*$/, "") // Remove trailing comma
        .replace(/\s+/g, " ") // Normalize whitespace
        .trim();

      return cleanString || "No description available";
    }
  };

  // Helper function to format the title properly
  const formatTitle = (name) => {
    if (!name) return "Untitled Listing";

    // If the name is all caps or looks weird, format it properly
    if (name === name.toUpperCase() && name.length > 5) {
      return name
        .toLowerCase()
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
    }

    return name;
  };

  useEffect(() => {
    const fetchListings = async () => {
      // Wait until user data is properly loaded
      if (isAuthenticated && !user) {
        return;
      }

      if (!isAuthenticated || !user?.email) {
        setError(
          "Authentication required. Please log in to view your listings."
        );
        setLoading(false);
        return;
      }

      try {
        setError(null);
        const data = await api.getListingsByEmail(user.email);

        let listingsArray = [];
        if (Array.isArray(data)) {
          listingsArray = data;
        } else if (data?.products) {
          listingsArray = data.products;
        } else if (data?.listings) {
          listingsArray = data.listings;
        } else if (data?.data) {
          listingsArray = data.data;
        } else if (data && typeof data === "object") {
          listingsArray = [data];
        }

        setListings(listingsArray);
      } catch (error) {
        setError(
          error.message || "Failed to fetch listings. Please try again."
        );
        toast.error(
          error.message || "Failed to fetch listings. Please try again."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchListings();
  }, [isAuthenticated, user]);

  const retryFetchListings = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await api.getListingsByEmail(user.email);
      let listingsArray = [];
      if (Array.isArray(data)) {
        listingsArray = data;
      } else if (data?.products) {
        listingsArray = data.products;
      } else if (data?.listings) {
        listingsArray = data.listings;
      } else if (data?.data) {
        listingsArray = data.data;
      } else if (data && typeof data === "object") {
        listingsArray = [data];
      }

      setListings(listingsArray);
      toast.success("Listings loaded successfully!");
    } catch (error) {
      setError(error.message || "Failed to fetch listings. Please try again.");
      toast.error(
        error.message || "Failed to fetch listings. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (id) => {
    navigate(`/seller/dashboard/pendingbids/update/${id}`);
  };

  const handleDelete = async (id) => {
    const listingToDelete = listings.find((listing) => listing._id === id);
    if (!listingToDelete) {
      toast.error("Listing not found");
      return;
    }

    const timeLeft = calculateTimeLeft(listingToDelete);
    const hasBids = Boolean(listingToDelete.bidCount && listingToDelete.bidCount > 0);

    if (timeLeft.expired) {
      toast.error("Operation not allowed: Bidding time has passed for this listing.");
      return;
    }

    if (hasBids) {
      toast.error("Operation not allowed: Bids have already been placed on this listing.");
      return;
    }

    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${formatTitle(
        listingToDelete.name
      )}"? This action cannot be undone.`
    );

    if (confirmDelete) {
      setDeleteLoading(id);
      try {
        await api.deleteListing(id);
        toast.success(
          `${formatTitle(listingToDelete.name)} deleted successfully`
        );
        setListings((prevListings) =>
          prevListings.filter((listing) => listing._id !== id)
        );
      } catch (error) {
        console.error("Error deleting listing:", error);
        toast.error(error.message || "Failed to delete listing. Please try again.");
      } finally {
        setDeleteLoading(null);
      }
    }
  };

  const calculateTimeLeft = (listingOrTime) => {
    if (!listingOrTime)
      return { text: "Date not available", expired: false };

    let startDateRaw = null;
    let startTimeRaw = null;
    let endTimeRaw = null;
    let status = "Active";

    if (typeof listingOrTime === "object") {
      startDateRaw = listingOrTime.biddingStartDate;
      startTimeRaw = listingOrTime.biddingStartTime;
      endTimeRaw = listingOrTime.biddingEndTime;
      status = listingOrTime.status || "Active";
    } else {
      endTimeRaw = listingOrTime;
    }

    const { startDate, endDate } = parseAuctionDates(
      startDateRaw,
      startTimeRaw,
      endTimeRaw
    );

    if (!endDate) {
      return { text: "Date not available", expired: false };
    }

    const calc = calculateAuctionTime(startDate, endDate, status);
    if (calc.isEnded) {
      return { text: "Expired", expired: true };
    }

    const { days, hours, minutes } = calc.timeLeft;
    const dNum = parseInt(days, 10);
    if (dNum > 0) {
      return { text: `${dNum}d ${hours}h left`, expired: false };
    }
    return { text: `${hours}h ${minutes}m left`, expired: false };
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setListings((prevListings) =>
        prevListings.map((listing) => ({
          ...listing,
          timeLeft: calculateTimeLeft(listing),
        }))
      );
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  if (loading || (isAuthenticated && !user)) {
    return (
      <div className="min-h-screen bg-canvas text-foreground flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-action-primary mx-auto mb-4"></div>
          <p className="text-lg text-foreground-secondary">Loading your listings...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-canvas text-foreground flex items-center justify-center">
        <div className="text-center p-8 rounded-xl shadow-card bg-surface border border-border-subtle">
          <p className="text-lg mb-4 text-foreground-secondary">
            Please log in to view your listings
          </p>
          <button
            onClick={() => navigate("/login")}
            className="px-6 py-2 bg-action-primary text-action-primary-fg rounded-lg hover:bg-action-primary-hover font-medium transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  if (error && !loading) {
    return (
      <div className="min-h-screen bg-canvas text-foreground flex items-center justify-center">
        <div className="text-center p-8 rounded-xl shadow-card bg-surface border border-border-subtle">
          <div className="mb-4 text-status-danger">
            <svg
              className="w-16 h-16 mx-auto"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h3 className="text-xl font-semibold mb-2 text-foreground">
            Error Loading Listings
          </h3>
          <p className="mb-6 text-foreground-secondary">{error}</p>
          <button
            onClick={retryFetchListings}
            className="px-6 py-2 bg-action-primary text-action-primary-fg rounded-lg hover:bg-action-primary-hover font-medium transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas text-foreground">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 text-foreground">
            Your Listings
          </h1>
          <p className="text-foreground-secondary">
            Manage and track your auction listings
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="p-6 rounded-xl shadow-card border bg-surface border-border-subtle">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground-secondary">
                  Total Listings
                </p>
                <p className="text-2xl font-bold text-foreground font-numeric">
                  {listings.length}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-action-primary/10">
                <Tag className="h-6 w-6 text-action-primary" />
              </div>
            </div>
          </div>

          <div className="p-6 rounded-xl shadow-card border bg-surface border-border-subtle">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground-secondary">
                  Active Auctions
                </p>
                <p className="text-2xl font-bold text-status-success font-numeric">
                  {
                    listings.filter(
                      (l) => !calculateTimeLeft(l).expired
                    ).length
                  }
                </p>
              </div>
              <div className="p-3 rounded-lg bg-status-success/10">
                <Clock className="h-6 w-6 text-status-success" />
              </div>
            </div>
          </div>

          <div className="p-6 rounded-xl shadow-card border bg-surface border-border-subtle">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground-secondary">
                  Total Value
                </p>
                <p className="text-2xl font-bold text-accent-dashboard font-numeric">
                  {formatCurrency(listings.reduce((sum, l) => sum + (l.biddingStartPrice || 0), 0))}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-accent-dashboard/10">
                <IndianRupee className="h-6 w-6 text-accent-dashboard" />
              </div>
            </div>
          </div>
        </div>

        {/* No Listings State */}
        {listings.length === 0 ? (
          <div className="rounded-xl shadow-card border p-12 text-center bg-surface border-border-subtle">
            <Package className="h-16 w-16 mx-auto mb-4 text-foreground-muted" />
            <h3 className="text-xl font-semibold mb-2 text-foreground">
              No listings found
            </h3>
            <p className="mb-6 text-foreground-secondary">
              You haven't created any listings yet. Start by adding your first
              item!
            </p>
            <button
              onClick={() => navigate("/create-listing")}
              className="px-6 py-3 bg-action-primary text-action-primary-fg rounded-lg font-medium hover:bg-action-primary-hover transition-colors"
            >
              Create Your First Listing
            </button>
          </div>
        ) : (
          /* Listings Grid */
          <div className="space-y-6">
            {listings.map((listing) => {
              const timeLeft = calculateTimeLeft(listing);
              const biddingStartPrice = listing.biddingStartPrice || 0;
              const formattedDescription = formatDescription(
                listing.description
              );
              const formattedTitle = formatTitle(listing.name);

              return (
                <div
                  key={listing._id}
                  className="rounded-xl shadow-card border overflow-hidden transition-shadow hover:shadow-card-hover bg-surface border-border-subtle"
                >
                  <div className="flex flex-col lg:flex-row">
                    {/* Image */}
                    <div className="lg:w-80 h-64 lg:h-auto flex-shrink-0 bg-surface-subtle">
                      <img
                        src={
                          listing.images?.[0]?.secure_url ||
                          "/lot-placeholder.svg"
                        }
                        alt={formattedTitle}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Content */}
                    <div className="flex-1 p-6">
                      <div className="flex flex-col h-full">
                        <div className="flex-1">
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <h3 className="text-xl font-semibold mb-2 text-foreground">
                                {formattedTitle}
                              </h3>
                              <div className="flex items-center gap-4 text-sm mb-3 text-foreground-secondary">
                                <span className="px-3 py-1 rounded-full bg-surface-subtle text-foreground-secondary font-medium">
                                  {listing.category || "Uncategorized"}
                                </span>
                                <div
                                  className={`flex items-center gap-1 px-3 py-1 rounded-full font-numeric text-xs font-semibold ${
                                    timeLeft.expired
                                      ? 'bg-status-danger/10 text-status-danger border border-status-danger/20'
                                      : 'bg-status-success/10 text-status-success border border-status-success/20'
                                  }`}
                                >
                                  <Clock className="h-3.5 w-3.5" />
                                  {timeLeft.text}
                                </div>
                                {listing.bidCount > 0 && (
                                  <span className="px-2.5 py-0.5 rounded-full bg-action-primary/10 text-action-primary font-numeric text-xs font-semibold border border-action-primary/20">
                                    {listing.bidCount} {listing.bidCount === 1 ? 'bid' : 'bids'}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-2 ml-4">
                              <button
                                onClick={() => navigate(`/product/${listing._id}`)}
                                className="p-2 rounded-lg transition-colors text-foreground-secondary hover:text-foreground hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus cursor-pointer"
                                title="View listing details"
                                aria-label="View listing details"
                              >
                                <Eye className="h-5 w-5" />
                              </button>
                              <button
                                onClick={() => handleEdit(listing._id)}
                                className="p-2 rounded-lg transition-colors text-amber-500 hover:bg-amber-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus cursor-pointer"
                                title="Edit listing"
                                aria-label="Edit listing"
                              >
                                <Edit3 className="h-5 w-5" />
                              </button>
                              <button
                                onClick={() => handleDelete(listing._id)}
                                disabled={deleteLoading === listing._id || timeLeft.expired || (listing.bidCount > 0)}
                                className={`p-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                                  timeLeft.expired || (listing.bidCount > 0)
                                    ? "text-foreground-muted/40 cursor-not-allowed hover:bg-transparent"
                                    : "text-status-danger hover:bg-status-danger/10 cursor-pointer"
                                }`}
                                title={
                                  timeLeft.expired
                                    ? "Cannot delete: Bidding time has passed"
                                    : listing.bidCount > 0
                                    ? "Cannot delete: Bids have already been placed"
                                    : "Delete listing"
                                }
                                aria-label="Delete listing"
                              >
                                {deleteLoading === listing._id ? (
                                  <div className="animate-spin h-5 w-5 border-2 rounded-full border-t-transparent border-status-danger"></div>
                                ) : (
                                  <Trash2 className="h-5 w-5" />
                                )}
                              </button>
                            </div>
                          </div>

                          <p className="mb-4 line-clamp-2 text-foreground-secondary">
                            {formattedDescription}
                          </p>

                          {/* Contact Info */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex items-center gap-2 text-sm text-foreground-secondary">
                              <Mail className="h-4 w-4 flex-shrink-0 text-foreground-muted" />
                              <span className="truncate">
                                {listing.email || "No email provided"}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-foreground-secondary">
                              <Phone className="h-4 w-4 flex-shrink-0 text-foreground-muted" />
                              <span>
                                {listing.mobileNumber || "No phone number"}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Footer */}
                        <div className="mt-4 pt-4 border-t border-border-subtle">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-foreground-muted">
                                Starting Price
                              </p>
                              <p className="text-2xl font-bold text-foreground font-numeric">
                                {formatCurrency(biddingStartPrice)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-foreground-muted">Status</p>
                              <p
                                className={`font-medium ${
                                  timeLeft.expired
                                    ? 'text-status-danger'
                                    : 'text-status-success'
                                }`}
                              >
                                {timeLeft.expired ? "Auction Ended" : "Active"}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default SellerHistoryPage;