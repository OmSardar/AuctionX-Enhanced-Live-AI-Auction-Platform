import React, { useState, useEffect } from "react";
import { formatCurrency } from "../../../../lib/utils";
import { useSelector } from "react-redux";
import axios from "axios";

function OrderRevenuePage() {
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [orders, setOrders] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const ordersPerPage = 5;
  const API_URL = import.meta.env.VITE_API_URL;
  // Get email from Redux store
  const userEmail = useSelector(
    (state) => state.user?.email || state.auth?.user?.email
  );

  // Fetch orders from the backend
  useEffect(() => {
    const fetchOrders = async () => {
      if (!userEmail) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const response = await axios.get(
          `${API_URL}/api/orders/seller/${userEmail}`
        );

        if (Array.isArray(response.data)) {
          setOrders(response.data);
          setTotalPages(Math.ceil(response.data.length / ordersPerPage));

          // Calculate total revenue from highest bids
          const revenue = response.data.reduce((sum, order) => {
            return sum + (order.highestBid || 0);
          }, 0);
          setTotalRevenue(revenue);
        } else {
          console.error("Invalid response format:", response.data);
          setOrders([]);
          setTotalRevenue(0);
        }
      } catch (err) {
        console.error("Error fetching orders:", err);
        setOrders([]);
        setTotalRevenue(0);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [currentPage, userEmail]);

  // Function to handle "View" button click
  const handleViewDetails = (orderId) => {
    const order = orders.find((o) => o._id === orderId);
    setSelectedOrder(order);
  };

  // Function to close the modal
  const handleCloseModal = () => {
    setSelectedOrder(null);
  };

  // Function to change page
  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  // Get current page orders
  const indexOfLastOrder = currentPage * ordersPerPage;
  const indexOfFirstOrder = indexOfLastOrder - ordersPerPage;
  const currentOrders = orders.slice(indexOfFirstOrder, indexOfLastOrder);

  // Inline styles for ellipsis
  const ellipsisStyle = {
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: "130px",
  };

  if (!userEmail) {
    return (
      <div className="col-span-full xl:col-span-6 bg-white dark:bg-gray-800 shadow-xs rounded-xl">
        <div className="p-6 text-center">
          <p className="text-red-500 dark:text-red-400">
            Please log in to view your order revenue.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="col-span-full xl:col-span-6 bg-white dark:bg-gray-800 shadow-xs rounded-xl">
      <header className="px-5 py-4 border-b border-gray-100 dark:border-gray-700/60">
        <div className="flex justify-between items-center">
          <h2 className="font-semibold text-gray-800 dark:text-gray-100">
            Order Revenue
          </h2>
          <div className="text-right">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Total Revenue
            </p>
            <p className="text-xl font-bold text-green-600 dark:text-green-400">
              {formatCurrency(totalRevenue)}
            </p>
          </div>
        </div>
      </header>
      <div className="p-3">
        {/* Loading indicator */}
        {loading ? (
          <div className="text-center py-4">
            <p className="text-gray-500 dark:text-gray-400">
              Loading orders...
            </p>
          </div>
        ) : (
          <>
            {/* Table */}
            <div className="overflow-x-auto">
              <table className="table-auto w-full">
                {/* Table header */}
                <thead className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="p-2 whitespace-nowrap">
                      <div className="font-semibold text-left">Order ID</div>
                    </th>
                    <th className="p-2 whitespace-nowrap">
                      <div className="font-semibold text-left">Title</div>
                    </th>
                    <th className="p-2 whitespace-nowrap">
                      <div className="font-semibold text-left">Buyer</div>
                    </th>
                    <th className="p-2 whitespace-nowrap">
                      <div className="font-semibold text-left">Category</div>
                    </th>
                    <th className="p-2 whitespace-nowrap">
                      <div className="font-semibold text-left">Start Price</div>
                    </th>
                    <th className="p-2 whitespace-nowrap">
                      <div className="font-semibold text-left">Highest Bid</div>
                    </th>
                    <th className="p-2 whitespace-nowrap">
                      <div className="font-semibold text-left">Date</div>
                    </th>
                    <th className="p-2 whitespace-nowrap">
                      <div className="font-semibold text-left">Actions</div>
                    </th>
                  </tr>
                </thead>
                {/* Table body */}
                <tbody className="text-sm divide-y divide-gray-100 dark:divide-gray-700/60">
                  {currentOrders && currentOrders.length > 0 ? (
                    currentOrders.map((order) => (
                      <tr key={order._id}>
                        <td className="p-2 whitespace-nowrap">
                          <div className="text-left font-medium text-gray-800 dark:text-gray-100">
                            <div style={ellipsisStyle}>
                              {order._id.substring(0, 8)}...
                            </div>
                          </div>
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          <div className="text-left">
                            <div style={ellipsisStyle}>{order.title}</div>
                          </div>
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          <div className="text-left">
                            <div style={ellipsisStyle}>{order.userEmail}</div>
                          </div>
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          <div className="text-left">
                            <span className="inline-flex px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-700/20 dark:text-blue-400">
                              {order.category}
                            </span>
                          </div>
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          <div className="text-left font-medium text-gray-600 dark:text-gray-400">
                            {formatCurrency(order.biddingStartPrice)}
                          </div>
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          <div className="text-left font-medium text-green-600 dark:text-green-400">
                            {formatCurrency(order.highestBid || 0)}
                          </div>
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          <div className="text-left text-gray-500 dark:text-gray-400">
                            {new Date(order.createdAt).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          <button
                            onClick={() => handleViewDetails(order._id)}
                            className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition duration-200"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan="8"
                        className="p-4 text-center text-gray-500 dark:text-gray-400"
                      >
                        No orders found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination - only show if there are orders */}
            {orders && orders.length > 0 && (
              <div className="flex justify-between items-center mt-4">
                <button
                  onClick={() => paginate(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => paginate(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal for Order Details */}
      {selectedOrder && (
        <div className="fixed inset-0 flex items-center justify-center backdrop-blur-sm z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg w-full max-w-lg shadow-lg">
            {/* Modal Header */}
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
                Order Details
              </h3>
              <button
                onClick={handleCloseModal}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition duration-200 text-2xl leading-none"
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-4">
              {/* Order ID */}
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Order ID
                </p>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100 break-all">
                  {selectedOrder._id}
                </p>
              </div>

              {/* Order Image */}
              {selectedOrder.images && selectedOrder.images.length > 0 && (
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                    Images
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedOrder.images.slice(0, 3).map((image, index) => (
                      <img
                        key={index}
                        src={image.secure_url}
                        alt={`Order ${index + 1}`}
                        className="w-16 h-16 object-cover rounded-md border border-gray-200 dark:border-gray-600"
                      />
                    ))}
                    {selectedOrder.images.length > 3 && (
                      <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-md border border-gray-200 dark:border-gray-600 flex items-center justify-center">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          +{selectedOrder.images.length - 3}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Title
                  </p>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                    {selectedOrder.title}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Buyer Name
                  </p>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                    {selectedOrder.name}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Buyer Email
                  </p>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                    {selectedOrder.userEmail}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Category
                  </p>
                  <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                    {selectedOrder.category}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Phone Number
                  </p>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                    {selectedOrder.phoneNo}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Starting Price
                  </p>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    {formatCurrency(selectedOrder.biddingStartPrice)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Highest Bid
                  </p>
                  <p className="text-sm font-medium text-green-600 dark:text-green-400">
                    {formatCurrency(selectedOrder.highestBid || 0)}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Address
                  </p>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                    {selectedOrder.address}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Order Date
                  </p>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                    {new Date(selectedOrder.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="mt-6 flex justify-end">
              <button
                onClick={handleCloseModal}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition duration-200"
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

export default OrderRevenuePage;
