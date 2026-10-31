import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { Package, TrendingUp, Tag, Clock } from "lucide-react";
import axiosWithAuth from "../../../../redux/slices/axiosWithAuth";

function RevenueVisitors() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const sellerEmail = useSelector(
    (state) => state.auth?.user?.email || state.user?.email
  );

  useEffect(() => {
    let isMounted = true;

    const fetchSellerProducts = async () => {
      if (!sellerEmail) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await axiosWithAuth.get(
          `/products/email/${encodeURIComponent(sellerEmail)}`
        );

        if (!isMounted) return;

        const products =
          response.data?.products ||
          (Array.isArray(response.data) ? response.data : []);

        const formatted = products.map((prod) => ({
          id: prod._id,
          name: prod.name || "Untitled Lot",
          category: prod.category || "General",
          image: prod.images?.[0]?.secure_url || "/lot-placeholder.svg",
          bidCount: prod.bidCount || 0,
          startingPrice: prod.biddingStartPrice || prod.startingPrice || 0,
          currentPrice:
            prod.currentPrice ||
            prod.finalPrice ||
            prod.biddingStartPrice ||
            prod.startingPrice ||
            0,
          status: prod.status || "Active",
        }));

        setItems(formatted);
      } catch (err) {
        if (!isMounted) return;
        console.error("Error fetching seller auction items:", err);
        setError(
          err.response?.data?.message ||
            err.message ||
            "Failed to load seller catalog"
        );
        setItems([]);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchSellerProducts();

    return () => {
      isMounted = false;
    };
  }, [sellerEmail]);

  return (
    <div className="col-span-full xl:col-span-8 bg-surface border border-border-subtle shadow-card rounded-2xl overflow-hidden">
      <header className="px-5 py-4 border-b border-border-subtle flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="font-bold text-foreground text-base sm:text-lg flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-action-primary" />
            Top Listed Lots & Auction Performance
          </h2>
          <p className="text-xs text-foreground-secondary">
            Real-time bidder engagement, current bid volume, and catalog status
          </p>
        </div>
        <Link
          to="/seller/dashboard/pendingbids"
          className="text-xs font-semibold text-action-primary hover:text-action-primary-hover transition-colors"
        >
          View All Listings →
        </Link>
      </header>

      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-foreground-secondary">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-action-primary mr-3"></div>
            <span>Loading your listings...</span>
          </div>
        ) : error ? (
          <div className="p-6 text-center text-status-danger bg-status-danger/5 rounded-xl border border-status-danger/20 text-sm">
            {error}
          </div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-foreground-secondary">
            <Package className="w-12 h-12 mx-auto mb-3 text-foreground-muted opacity-50" />
            <p className="font-medium text-foreground">No auction listings found</p>
            <p className="text-xs text-foreground-secondary mt-1">
              Create your first lot to track real-time bids and performance.
            </p>
            <Link
              to="/seller/dashboard/sell"
              className="inline-block mt-4 px-4 py-2 bg-action-primary text-action-primary-fg rounded-lg text-xs font-semibold hover:bg-action-primary-hover transition-colors"
            >
              List an Item
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-auto w-full text-left">
              <thead className="text-xs uppercase font-semibold text-foreground-muted bg-surface-subtle border-b border-border-subtle">
                <tr>
                  <th className="p-3">Lot Details</th>
                  <th className="p-3 text-center">Bids Placed</th>
                  <th className="p-3 text-right">Start Price</th>
                  <th className="p-3 text-right">Current Bid</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-border-subtle">
                {items.slice(0, 6).map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-surface-subtle/50 transition-colors"
                  >
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-10 h-10 object-cover rounded-lg border border-border-subtle flex-shrink-0"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = "/lot-placeholder.svg";
                          }}
                        />
                        <div className="min-w-0">
                          <Link
                            to={`/product/${item.id}`}
                            className="font-medium text-foreground hover:text-action-primary transition-colors block truncate max-w-xs"
                            title={item.name}
                          >
                            {item.name}
                          </Link>
                          <span className="text-xs text-foreground-muted">
                            {item.category}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-center font-numeric font-medium text-foreground">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-action-primary/10 text-action-primary">
                        {item.bidCount} {item.bidCount === 1 ? "bid" : "bids"}
                      </span>
                    </td>
                    <td className="p-3 text-right font-numeric text-foreground-secondary">
                      ₹{item.startingPrice.toLocaleString("en-IN")}
                    </td>
                    <td className="p-3 text-right font-numeric font-bold text-foreground">
                      ₹{item.currentPrice.toLocaleString("en-IN")}
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          item.status === "Active" || item.status === "LIVE"
                            ? "bg-status-success/10 text-status-success border border-status-success/20"
                            : "bg-surface-subtle text-foreground-secondary border border-border-subtle"
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default RevenueVisitors;
