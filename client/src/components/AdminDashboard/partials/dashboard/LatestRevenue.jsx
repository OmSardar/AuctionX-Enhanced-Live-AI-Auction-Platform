import React, { useState, useEffect } from "react";
import axiosWithAuth from "../../../../redux/slices/axiosWithAuth";

function OrdersPage() {
  const [selectedOrder, setSelectedOrder] = useState(null); // State for selected order (modal)
  const [currentPage, setCurrentPage] = useState(1); // State for current page
  const [orders, setOrders] = useState([]); // State for orders fetched from the backend
  const [totalPages, setTotalPages] = useState(1); // State for total pages
  const ordersPerPage = 5; // Number of orders to display per page

  // Fetch orders from the backend
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const response = await axiosWithAuth.get("/orders", {
          params: { page: currentPage, limit: ordersPerPage },
        });
        const orderList = Array.isArray(response.data)
          ? response.data
          : response.data.orders || [];
        setOrders(orderList);
        setTotalPages(
          response.data.totalPages ||
            Math.ceil(orderList.length / ordersPerPage) ||
            1
        );
      } catch (err) {
        console.error("Error fetching orders:", err);
      }
    };

    fetchOrders();
  }, [currentPage]);

  // Function to handle "View" button click
  const handleViewDetails = (orderId) => {
    const order = orders.find((o) => o._id === orderId); // Find the selected order
    setSelectedOrder(order); // Set the selected order in state
  };

  // Function to close the modal
  const handleCloseModal = () => {
    setSelectedOrder(null); // Reset the selected order
  };

  // Pagination logic
  const indexOfLastOrder = currentPage * ordersPerPage;
  const indexOfFirstOrder = indexOfLastOrder - ordersPerPage;
  const currentOrders = orders.slice(indexOfFirstOrder, indexOfLastOrder);

  // Function to change page
  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  // Inline styles for ellipsis
  const ellipsisStyle = {
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: "130px", // Adjust the width as needed
  };

  return (
    <div className="col-span-full xl:col-span-6 bg-surface border border-border-subtle shadow-card rounded-xl">
      <header className="px-5 py-4 border-b border-border-subtle">
        <h2 className="font-semibold text-foreground">
          Orders
        </h2>
      </header>
      <div className="p-3">
        {/* Table */}
        <div className="overflow-x-auto">
          <table className="table-auto w-full">
            {/* Table header */}
            <thead className="text-xs font-semibold uppercase text-foreground-muted bg-surface-subtle border-y border-border-subtle">
              <tr>
                <th className="p-2 whitespace-nowrap">
                  <div className="font-semibold text-left">Item Name</div>
                </th>
                <th className="p-2 whitespace-nowrap">
                  <div className="font-semibold text-left">User Email</div>
                </th>
                <th className="p-2 whitespace-nowrap">
                  <div className="font-semibold text-left">Seller Email</div>
                </th>
                <th className="p-2 whitespace-nowrap">
                  <div className="font-semibold text-left">Starting Price</div>
                </th>
                <th className="p-2 whitespace-nowrap">
                  <div className="font-semibold text-left">Sold Price</div>
                </th>
                <th className="p-2 whitespace-nowrap">
                  <div className="font-semibold text-left">Actions</div>
                </th>
              </tr>
            </thead>
            {/* Table body */}
            <tbody className="text-sm divide-y divide-border-subtle">
              {orders.map((order) => (
                <tr key={order._id}>
                  <td className="p-2 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-10 h-10 shrink-0 mr-2 sm:mr-3">
                        <img
                          className="w-full h-full object-cover rounded-lg border border-border-subtle"
                          src={order.image}
                          width="40"
                          height="40"
                          alt={order.itemName}
                        />
                      </div>
                      <div className="font-medium text-foreground">
                        <div style={ellipsisStyle}>{order.itemName}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-2 whitespace-nowrap">
                    <div className="text-left text-foreground-secondary">
                      <div style={ellipsisStyle}>{order.userEmail}</div>
                    </div>
                  </td>
                  <td className="p-2 whitespace-nowrap">
                    <div className="text-left text-foreground-secondary">
                      <div style={ellipsisStyle}>{order.sellerEmail}</div>
                    </div>
                  </td>
                  <td className="p-2 whitespace-nowrap">
                    <div className="text-left font-medium font-numeric text-accent-dashboard">
                      <div style={ellipsisStyle}>{order.startingPrice}</div>
                    </div>
                  </td>
                  <td className="p-2 whitespace-nowrap">
                    <div className="text-left font-medium font-numeric text-status-success">
                      <div style={ellipsisStyle}>{order.soldPrice}</div>
                    </div>
                  </td>
                  <td className="p-2 whitespace-nowrap">
                    <button
                      onClick={() => handleViewDetails(order._id)} // Call handleViewDetails on click
                      className="px-3 py-1 bg-action-primary text-action-primary-foreground rounded-md hover:bg-action-primary-hover transition duration-200"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex justify-between items-center mt-4">
          <button
            onClick={() => paginate(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-4 py-2 bg-surface-subtle border border-border-subtle text-foreground rounded-md hover:bg-surface-raised disabled:opacity-50 disabled:cursor-not-allowed transition duration-200"
          >
            Previous
          </button>
          <span className="text-sm font-numeric text-foreground-secondary">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => paginate(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-4 py-2 bg-surface-subtle border border-border-subtle text-foreground rounded-md hover:bg-surface-raised disabled:opacity-50 disabled:cursor-not-allowed transition duration-200"
          >
            Next
          </button>
        </div>
      </div>

      {/* Modal for Order Details */}
      {selectedOrder && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50">
          <div className="bg-surface border border-border-subtle p-6 rounded-lg w-full max-w-md shadow-lg">
            {/* Modal Header */}
            <div className="flex justify-between items-center mb-6 border-b border-border-subtle pb-3">
              <h3 className="text-xl font-semibold text-foreground">
                Order Details
              </h3>
              <button
                onClick={handleCloseModal}
                className="text-foreground-muted hover:text-foreground transition duration-200 text-2xl leading-none"
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-4">
              {/* Item Image and Name */}
              <div className="flex items-center space-x-4">
                <img
                  className="w-12 h-12 rounded-full border border-border-subtle"
                  src={selectedOrder.image}
                  alt={selectedOrder.itemName}
                />
                <div>
                  <p className="text-lg font-semibold text-foreground">
                    {selectedOrder.itemName}
                  </p>
                  <p className="text-sm text-foreground-muted">
                    Sold to: {selectedOrder.userEmail}
                  </p>
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-foreground-muted">
                    User Email
                  </p>
                  <p className="text-sm font-medium text-foreground">
                    {selectedOrder.userEmail}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-foreground-muted">
                    Seller Email
                  </p>
                  <p className="text-sm font-medium text-foreground">
                    {selectedOrder.sellerEmail}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-foreground-muted">
                    Starting Price
                  </p>
                  <p className="text-sm font-medium font-numeric text-accent-dashboard">
                    {selectedOrder.startingPrice}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-foreground-muted">
                    Sold Price
                  </p>
                  <p className="text-sm font-medium font-numeric text-status-success">
                    {selectedOrder.soldPrice}
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="mt-6 flex justify-end">
              <button
                onClick={handleCloseModal}
                className="px-4 py-2 bg-surface-subtle border border-border-subtle text-foreground rounded-md hover:bg-surface-raised transition duration-200"
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

export default OrdersPage;
