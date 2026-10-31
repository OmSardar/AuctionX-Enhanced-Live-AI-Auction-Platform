import React, { useState, useEffect, useMemo } from "react";
import { useSelector } from "react-redux";
import { Bell, CheckCircle, Clock, AlertCircle, Trash2, Eye, Filter } from "lucide-react";
import axiosWithAuth from "../../../../redux/slices/axiosWithAuth";

function MyNotificationPage() {
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [filter, setFilter] = useState("all"); // all, read, unread
  const [rawNotifications, setRawNotifications] = useState([]);
  const [readIds, setReadIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("seller_notifications_read") || "[]");
    } catch {
      return [];
    }
  });
  const [dismissedIds, setDismissedIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("seller_notifications_dismissed") || "[]");
    } catch {
      return [];
    }
  });

  const notificationsPerPage = 8;

  const authUser = useSelector((state) => state.auth?.user || state.user);
  const sellerEmail =
    authUser?.email ||
    (() => {
      try {
        const seller = JSON.parse(localStorage.getItem("seller") || "{}");
        return seller.email || seller.user?.email || "";
      } catch {
        return "";
      }
    })();

  useEffect(() => {
    let isMounted = true;

    const fetchSellerDataForNotifications = async () => {
      if (!sellerEmail) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const [ordersRes, productsRes] = await Promise.allSettled([
          axiosWithAuth.get(`/orders/seller/${encodeURIComponent(sellerEmail)}`),
          axiosWithAuth.get(`/products/email/${encodeURIComponent(sellerEmail)}`),
        ]);

        if (!isMounted) return;

        const items = [];

        // Add welcome notification
        items.push({
          _id: "welcome-notice",
          title: "Welcome to AuctionX Seller Hub",
          message:
            "Your seller account is active. You can create listings, monitor incoming bids in real-time, and manage winning orders from your dashboard.",
          priority: "normal",
          createdAt: new Date().toISOString(),
          type: "system",
        });

        // Add notifications from orders
        if (ordersRes.status === "fulfilled" && Array.isArray(ordersRes.value.data)) {
          ordersRes.value.data.forEach((order) => {
            const itemName = order.title || order.itemName || "Auction Item";
            const amount = order.highestBid || order.soldPrice || order.biddingStartPrice || 0;
            const buyer = order.name || order.userEmail || "Buyer";
            items.push({
              _id: `order-${order._id}`,
              title: `New Order: ${itemName}`,
              message: `Order #${order._id} was created by ${buyer} for ₹${amount}. Ready for processing and fulfillment.`,
              priority: "high",
              createdAt: order.createdAt || new Date().toISOString(),
              type: "order",
            });
          });
        }

        // Add notifications from active / pending listings
        if (productsRes.status === "fulfilled" && Array.isArray(productsRes.value.data)) {
          productsRes.value.data.forEach((lot) => {
            const bidCount = lot.bidCount || (lot.bids ? lot.bids.length : 0);
            if (bidCount > 0) {
              items.push({
                _id: `lot-bids-${lot._id}`,
                title: `Bidding Activity: ${lot.title}`,
                message: `Your listing "${lot.title}" has ${bidCount} active bids. Current price: ₹${lot.currentPrice || lot.startingPrice}.`,
                priority: "normal",
                createdAt: lot.updatedAt || lot.createdAt || new Date().toISOString(),
                type: "lot",
              });
            }
          });
        }

        // Sort descending by date
        items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setRawNotifications(items);
      } catch (err) {
        if (!isMounted) return;
        console.error("Error populating seller notifications:", err);
        setRawNotifications([
          {
            _id: "welcome-fallback",
            title: "Welcome to AuctionX Seller Hub",
            message:
              "Your seller account is active. Explore your dashboard to manage listings, orders, and sales.",
            priority: "normal",
            createdAt: new Date().toISOString(),
            type: "system",
          },
        ]);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchSellerDataForNotifications();

    return () => {
      isMounted = false;
    };
  }, [sellerEmail]);

  // Save readIds and dismissedIds to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("seller_notifications_read", JSON.stringify(readIds));
    } catch (e) {
      console.warn("Could not save read notifications state", e);
    }
  }, [readIds]);

  useEffect(() => {
    try {
      localStorage.setItem("seller_notifications_dismissed", JSON.stringify(dismissedIds));
    } catch (e) {
      console.warn("Could not save dismissed notifications state", e);
    }
  }, [dismissedIds]);

  // Filtered notifications
  const visibleNotifications = useMemo(() => {
    return rawNotifications
      .filter((n) => !dismissedIds.includes(n._id))
      .filter((n) => {
        const isRead = readIds.includes(n._id);
        if (filter === "read") return isRead;
        if (filter === "unread") return !isRead;
        return true;
      });
  }, [rawNotifications, dismissedIds, readIds, filter]);

  const totalPages = Math.max(1, Math.ceil(visibleNotifications.length / notificationsPerPage));
  const displayedNotifications = visibleNotifications.slice(
    (currentPage - 1) * notificationsPerPage,
    currentPage * notificationsPerPage
  );

  const handleViewNotification = (notification) => {
    setSelectedNotification(notification);
    if (!readIds.includes(notification._id)) {
      setReadIds((prev) => [...prev, notification._id]);
    }
  };

  const handleDeleteNotification = (notificationId) => {
    setDismissedIds((prev) => [...prev, notificationId]);
    if (selectedNotification && selectedNotification._id === notificationId) {
      setSelectedNotification(null);
    }
  };

  const handleMarkAllAsRead = () => {
    const allIds = visibleNotifications.map((n) => n._id);
    setReadIds((prev) => Array.from(new Set([...prev, ...allIds])));
  };

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      }
      return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return "Recent";
    }
  };

  return (
    <div className="col-span-full xl:col-span-8 bg-surface border border-border-subtle shadow-card rounded-xl text-foreground">
      <header className="px-5 py-4 border-b border-border-subtle flex flex-wrap justify-between items-center gap-4">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-action-primary" />
          <h2 className="font-semibold text-foreground text-lg">Seller Notifications</h2>
        </div>
        <div className="flex items-center space-x-3">
          <div className="relative">
            <select
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="rounded-lg border border-border-subtle bg-surface-subtle text-foreground pl-3 pr-8 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-action-primary"
            >
              <option value="all">All notifications</option>
              <option value="unread">Unread</option>
              <option value="read">Read</option>
            </select>
          </div>
          {visibleNotifications.some((n) => !readIds.includes(n._id)) && (
            <button
              onClick={handleMarkAllAsRead}
              className="text-xs px-3 py-1.5 bg-surface-subtle border border-border-subtle text-foreground-secondary hover:text-foreground hover:bg-surface-hover rounded-lg transition"
            >
              Mark all as read
            </button>
          )}
        </div>
      </header>

      <div className="p-4">
        {loading ? (
          <div className="flex justify-center items-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-action-primary"></div>
          </div>
        ) : displayedNotifications.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="w-12 h-12 text-foreground-muted mx-auto mb-3 opacity-40" />
            <p className="text-foreground-muted">No notifications matching your filter.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border-subtle">
            {displayedNotifications.map((notification) => {
              const isRead = readIds.includes(notification._id);
              return (
                <li
                  key={notification._id}
                  onClick={() => handleViewNotification(notification)}
                  className={`p-4 rounded-lg transition cursor-pointer hover:bg-surface-hover flex items-start justify-between gap-4 ${
                    !isRead ? "bg-action-primary/5 border-l-4 border-action-primary" : ""
                  }`}
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="mt-1">
                      {notification.priority === "high" ? (
                        <span className="flex h-2.5 w-2.5 rounded-full bg-status-danger" />
                      ) : (
                        <span className="flex h-2.5 w-2.5 rounded-full bg-action-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p
                          className={`text-sm font-medium truncate ${
                            !isRead ? "text-foreground font-semibold" : "text-foreground-secondary"
                          }`}
                        >
                          {notification.title}
                        </p>
                        {!isRead && (
                          <span className="px-1.5 py-0.5 text-[10px] uppercase font-bold rounded bg-action-primary/20 text-action-primary">
                            New
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-foreground-muted mt-1 line-clamp-2">
                        {notification.message}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end shrink-0 gap-2">
                    <span className="text-xs text-foreground-muted">
                      {formatDate(notification.createdAt)}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteNotification(notification._id);
                      }}
                      title="Dismiss notification"
                      className="text-foreground-muted hover:text-status-danger transition p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {totalPages > 1 && (
          <div className="flex justify-between items-center mt-6 pt-4 border-t border-border-subtle">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 bg-surface-subtle border border-border-subtle rounded-lg text-sm text-foreground hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-xs text-foreground-muted font-numeric">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 bg-surface-subtle border border-border-subtle rounded-lg text-sm text-foreground hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedNotification && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-surface border border-border-subtle rounded-xl max-w-lg w-full p-6 shadow-xl text-foreground">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-bold text-foreground">
                {selectedNotification.title}
              </h3>
              <button
                onClick={() => setSelectedNotification(null)}
                className="text-foreground-muted hover:text-foreground text-xl"
              >
                &times;
              </button>
            </div>
            <p className="text-xs text-foreground-muted mb-4 font-numeric">
              {new Date(selectedNotification.createdAt).toLocaleString()}
            </p>
            <div className="p-4 bg-surface-subtle border border-border-subtle rounded-lg mb-6">
              <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">
                {selectedNotification.message}
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => handleDeleteNotification(selectedNotification._id)}
                className="px-4 py-2 text-sm bg-status-danger/10 text-status-danger hover:bg-status-danger/20 rounded-lg font-medium transition"
              >
                Dismiss
              </button>
              <button
                onClick={() => setSelectedNotification(null)}
                className="px-4 py-2 text-sm bg-action-primary text-action-primary-fg hover:bg-action-primary-hover rounded-lg font-medium transition"
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

export default MyNotificationPage;
