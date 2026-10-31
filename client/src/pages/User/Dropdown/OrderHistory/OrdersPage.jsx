import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import axiosWithAuth from "../../../../redux/slices/axiosWithAuth";
import { FaBoxOpen, FaRupeeSign, FaGavel, FaEye, FaLock } from "react-icons/fa";

const DEFAULT_ORDER_THUMBNAIL =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 160' fill='none'%3E%3Crect width='160' height='160' fill='%23F0EBE5' rx='8'/%3E%3Cpath d='M80 52v56M52 80h56' stroke='%23A69888' stroke-width='2.5' stroke-linecap='round'/%3E%3Crect x='48' y='48' width='64' height='64' rx='8' stroke='%23CFC4B8' stroke-width='1.5' fill='none'/%3E%3Ctext x='80' y='128' font-family='sans-serif' font-size='10' fill='%237D6F62' text-anchor='middle' font-weight='600'%3ENo Lot Image%3C/text%3E%3C/svg%3E";

const OrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Get user authentication state from Redux store
  const user = useSelector((state) => state.auth?.user);
  const isAuthenticated = useSelector((state) => state.auth?.isAuthenticated);
  const userEmail = user?.email;

  const fetchOrders = async () => {
    if (!userEmail) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      // Fetch orders for the authenticated user using credentials and JWT token
      const response = await axiosWithAuth.get(
        `/orders/user/${encodeURIComponent(userEmail)}`
      );

      // Ensure `orders` is always an array
      const receivedData = response.data;
      const ordersArray = Array.isArray(receivedData)
        ? receivedData
        : receivedData?.orders || receivedData?.data || [];

      setOrders(ordersArray);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching orders:", err);
      const serverMessage =
        err.response?.data?.message ||
        err.response?.data?.error ||
        "Failed to fetch orders";
      setError(serverMessage);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [userEmail]);

  if (!isAuthenticated && !userEmail && !loading) {
    return (
      <div className="w-full max-w-2xl px-4 sm:px-6 mx-auto mt-20 mb-12 bg-white dark:bg-[#191919] text-gray-900 dark:text-white py-12 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center text-amber-500 text-2xl">
          <FaLock />
        </div>
        <h2 className="text-2xl font-bold mb-2">Sign In Required</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
          Please log in to view your orders and won auctions.
        </p>
        <Link
          to="/login"
          className="inline-flex items-center justify-center px-6 py-2.5 rounded-lg bg-black text-white dark:bg-white dark:text-black hover:opacity-90 transition font-medium text-sm"
        >
          Sign In
        </Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-2xl px-4 sm:px-6 mx-auto mt-20 mb-12 bg-white dark:bg-[#191919] text-gray-900 dark:text-white py-12 rounded-xl shadow-lg border border-red-200 dark:border-red-900/40 text-center">
        <p className="text-red-500 font-medium mb-4">{error}</p>
        <button
          onClick={fetchOrders}
          className="px-4 py-2 rounded-lg bg-black text-white dark:bg-white dark:text-black hover:opacity-90 transition text-sm font-medium"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 mx-auto mt-16 mb-12 bg-gray-50 dark:bg-[#191919] text-gray-900 dark:text-white py-8 sm:py-10 rounded-lg shadow-lg">
      <h2 className="text-center text-2xl sm:text-3xl font-semibold mb-6 sm:mb-8 flex items-center justify-center gap-2">
        <FaBoxOpen className="text-black dark:text-white" /> Your Orders
      </h2>
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {[1, 2, 3].map((index) => (
            <div
              key={index}
              className="bg-white dark:bg-[#303030] rounded-lg shadow-md p-4 sm:p-6 flex flex-col sm:flex-row border border-gray-200 dark:border-gray-600 animate-pulse"
            >
              <div className="w-full sm:w-40 h-40 flex-shrink-0 bg-gray-300 dark:bg-gray-600 rounded-lg"></div>
              <div className="w-full sm:pl-4 mt-4 sm:mt-0 flex flex-col justify-between">
                <div>
                  <div className="h-6 bg-gray-300 dark:bg-gray-600 rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/2 mb-2"></div>
                  <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/3"></div>
                </div>
                <div className="h-10 bg-gray-300 dark:bg-gray-600 rounded mt-4"></div>
              </div>
            </div>
          ))}
        </div>
      ) : orders.length === 0 ? (
        <p className="text-center text-lg text-gray-800 dark:text-gray-300">
          No orders found.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {orders.map((order) => (
            <div
              key={order._id}
              className="bg-white dark:bg-[#303030] rounded-lg shadow-md p-4 sm:p-6 flex flex-col sm:flex-row border border-gray-200 dark:border-gray-600"
            >
              <div className="w-full sm:w-40 h-40 flex-shrink-0 overflow-hidden">
                <img
                  src={
                    order.images[0]?.secure_url ||
                    DEFAULT_ORDER_THUMBNAIL
                  }
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = DEFAULT_ORDER_THUMBNAIL;
                  }}
                  className="w-full h-full object-cover rounded-lg border border-gray-300 dark:border-gray-500"
                  alt={order.title || "Order Image"}
                />
              </div>
              <div className="w-full sm:pl-4 mt-4 sm:mt-0 flex flex-col justify-between">
                <div>
                  <h1
                    className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white line-clamp-2"
                    title={order.title}
                  >
                    {order.title}
                  </h1>
                  <h4 className="text-base sm:text-lg mt-2 flex items-center gap-2 text-gray-700 dark:text-gray-300">
                    <FaRupeeSign className="text-black dark:text-white" />{" "}
                    Price:{" "}
                    {order.biddingStartPrice
                      ? `₹${order.biddingStartPrice.toFixed(2)}`
                      : "N/A"}
                  </h4>
                  <h4 className="text-base sm:text-lg flex items-center gap-2 text-gray-700 dark:text-gray-300">
                    <FaGavel className="text-black dark:text-white" /> Highest
                    Bid:{" "}
                    {order.highestBid
                      ? `₹${order.highestBid.toFixed(2)}`
                      : "N/A"}
                  </h4>
                </div>
                <Link
                  to={`/order/${order._id}`}
                  className="mt-4 px-4 py-2 flex items-center justify-center gap-2 border border-black dark:border-white text-black dark:text-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black rounded-md transition text-base sm:text-lg font-medium w-full"
                >
                  <FaEye /> View Details
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default OrdersPage;
