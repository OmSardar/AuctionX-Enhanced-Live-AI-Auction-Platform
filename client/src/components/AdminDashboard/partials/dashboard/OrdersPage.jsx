import React, { useState, useEffect } from "react";
import { formatCurrency } from "../../../../lib/utils";
import axiosWithAuth from "../../../../redux/slices/axiosWithAuth";

function OrderPage() {
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [orders, setOrders] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const ordersPerPage = 5;

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await axiosWithAuth.get("/orders", {
          params: { page: currentPage, limit: ordersPerPage },
        });

        if (!response.data || !Array.isArray(response.data)) {
          throw new Error("Invalid data format received");
        }

        const transformedData = response.data.map((order) => ({
          ...order,
          itemName: order.title || "Unnamed Item",
          image: order.images?.[0]?.secure_url || "/default-order.png",
          buyerEmail: order.userEmail || "No buyer email",
          sellerEmail: order.sellerEmail || "No seller email",
          saleDate: order.createdAt || new Date().toISOString(),
          highestBid: order.highestBid || 0,
          startingPrice: order.biddingStartPrice || 0,
          name: order.name || "Not provided",
          address: order.address || "Not provided",
        }));

        setOrders(transformedData);
        setTotalPages(Math.ceil(response.data.length / ordersPerPage));
        setTotalOrders(response.data.length);
      } catch (err) {
        console.error("Order fetch error:", err);
        setError(err.message || "Failed to load orders");
        setOrders([]);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [currentPage]);

  const handleViewDetails = (orderId) => {
    const order = orders.find((o) => o._id === orderId);
    setSelectedOrder(order);
    setCurrentImageIndex(0);
  };

  const handleCloseModal = () => {
    setSelectedOrder(null);
  };

  const handleNextImage = () => {
    setCurrentImageIndex(
      (prev) => (prev + 1) % (selectedOrder?.images?.length || 1)
    );
  };

  const handlePrevImage = () => {
    setCurrentImageIndex(
      (prev) =>
        (prev - 1 + (selectedOrder?.images?.length || 1)) %
        (selectedOrder?.images?.length || 1)
    );
  };

  const paginate = (pageNumber) => {
    if (pageNumber > 0 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  return (
    <div className="col-span-full xl:col-span-6 bg-white dark:bg-gray-800 shadow-xs rounded-xl">
      <header className="px-5 py-4 border-b border-gray-100 dark:border-gray-700/60">
        <h2 className="font-semibold text-gray-800 dark:text-gray-100">
          Order History
        </h2>
      </header>

      <div className="p-3">
        {error && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-100 rounded">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-4">
            <p className="text-gray-500 dark:text-gray-400">
              Loading orders...
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="p-2 text-left">Item Name</th>
                    <th className="p-2 text-left">Seller Email</th>
                    <th className="p-2 text-left">Buyer Email</th>
                    <th className="p-2 text-left">Sale Date</th>
                    <th className="p-2 text-left">Starting Price</th>
                    <th className="p-2 text-left">Highest Bid</th>
                    <th className="p-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-sm divide-y divide-gray-100 dark:divide-gray-700/60">
                  {orders.length > 0 ? (
                    orders.map((order) => (
                      <tr
                        key={order._id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      >
                        <td className="p-2">
                          <div className="flex items-center">
                            <div className="w-10 h-10 shrink-0 mr-2">
                              <img
                                className="w-full h-full object-cover rounded-lg"
                                src={order.image}
                                alt={order.itemName}
                              />
                            </div>
                            <div className="font-medium text-gray-800 dark:text-gray-100">
                              {order.itemName}
                            </div>
                          </div>
                        </td>
                        <td className="p-2 text-gray-800 dark:text-gray-100">
                          <div className="max-w-[120px] truncate">
                            {order.sellerEmail}
                          </div>
                        </td>
                        <td className="p-2 text-gray-800 dark:text-gray-100">
                          <div className="max-w-[120px] truncate">
                            {order.buyerEmail}
                          </div>
                        </td>
                        <td className="p-2 text-gray-800 dark:text-gray-100">
                          {new Date(order.saleDate).toLocaleDateString()}
                        </td>
                        <td className="p-2 text-green-500">
                          {formatCurrency(order.startingPrice)}
                        </td>
                        <td className="p-2 text-blue-500">
                          {formatCurrency(order.highestBid)}
                        </td>
                        <td className="p-2">
                          <button
                            onClick={() => handleViewDetails(order._id)}
                            className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan="7"
                        className="p-4 text-center text-gray-500 dark:text-gray-400"
                      >
                        {error ? "Error loading orders" : "No orders found"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {orders.length > 0 && (
              <div className="flex justify-between items-center mt-4">
                <button
                  onClick={() => paginate(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => paginate(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {selectedOrder && (
        <div className="fixed inset-0 flex items-center justify-center backdrop-blur-sm z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg w-full max-w-2xl shadow-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
                Order Details
              </h3>
              <button
                onClick={handleCloseModal}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition"
              >
                &times;
              </button>
            </div>

            <div className="space-y-6">
              <div className="flex flex-col md:flex-row gap-6">
                {/* Image Gallery - Fixed height */}
                <div className="w-full md:w-1/2">
                  <div className="relative aspect-square">
                    {" "}
                    {/* Square container */}
                    <img
                      className="w-full h-full object-contain rounded-lg bg-gray-100 dark:bg-gray-700"
                      src={
                        selectedOrder.images?.[currentImageIndex]?.secure_url ||
                        selectedOrder.image
                      }
                      alt={selectedOrder.itemName}
                    />
                    {selectedOrder.images?.length > 1 && (
                      <>
                        <button
                          onClick={handlePrevImage}
                          className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/30 text-white p-2 rounded-full hover:bg-black/50"
                        >
                          &lt;
                        </button>
                        <button
                          onClick={handleNextImage}
                          className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/30 text-white p-2 rounded-full hover:bg-black/50"
                        >
                          &gt;
                        </button>
                        <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
                          {selectedOrder.images.map((_, index) => (
                            <button
                              key={index}
                              onClick={() => setCurrentImageIndex(index)}
                              className={`w-2 h-2 rounded-full ${
                                currentImageIndex === index
                                  ? "bg-white"
                                  : "bg-white/50"
                              }`}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Order Details - Improved layout */}
                <div className="w-full md:w-1/2 space-y-4">
                  <div>
                    <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                      {selectedOrder.itemName}
                    </h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Order ID: {selectedOrder._id}
                    </p>
                  </div>

                  <div className="space-y-4">
                    {/* Seller Info */}
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Seller
                      </p>
                      <p className="text-sm text-gray-800 dark:text-gray-100 break-all">
                        {selectedOrder.sellerEmail}
                      </p>
                    </div>

                    {/* Buyer Info - Grouped together */}
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Buyer
                      </p>
                      <div className="space-y-1">
                        <p className="text-sm text-gray-800 dark:text-gray-100">
                          {selectedOrder.name}
                        </p>
                        <p className="text-sm text-gray-800 dark:text-gray-100 break-all">
                          {selectedOrder.buyerEmail}
                        </p>
                        <p className="text-sm text-gray-800 dark:text-gray-100">
                          {selectedOrder.address}
                        </p>
                      </div>
                    </div>

                    {/* Transaction Details */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Sale Date
                        </p>
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                          {new Date(selectedOrder.saleDate).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Starting Price
                        </p>
                        <p className="text-sm font-medium text-green-500">
                          {formatCurrency(selectedOrder.startingPrice)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Highest Bid
                        </p>
                        <p className="text-sm font-medium text-blue-500">
                          {formatCurrency(selectedOrder.highestBid)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={handleCloseModal}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition"
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

export default OrderPage;
