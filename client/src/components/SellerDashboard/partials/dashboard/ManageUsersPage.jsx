import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import axiosWithAuth from "../../../../redux/slices/axiosWithAuth";

function Customers() {
  const [selectedCustomer, setSelectedCustomer] = useState(null); // State for selected customer (modal)
  const [currentPage, setCurrentPage] = useState(1); // State for current page
  const [selectedCustomers, setSelectedCustomers] = useState([]); // State for selected customers
  const [customers, setCustomers] = useState([]); // State for customers fetched from the backend
  const customersPerPage = 5; // Number of customers to display per page
  const [searchTerm, setSearchTerm] = useState(""); // State for search term

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

  // Filter customers based on search term
  const filteredCustomers = customers.filter((customer) =>
    (customer.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (customer.email || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Fetch customers from seller orders
  useEffect(() => {
    let isMounted = true;

    const fetchCustomers = async () => {
      if (!sellerEmail) {
        setCustomers([]);
        return;
      }

      try {
        const res = await axiosWithAuth.get(
          `/orders/seller/${encodeURIComponent(sellerEmail)}`
        );
        if (!isMounted) return;

        const orders = Array.isArray(res.data)
          ? res.data
          : Array.isArray(res.data?.orders)
          ? res.data.orders
          : [];

        const buyerMap = new Map();
        orders.forEach((order) => {
          const email = (order.userEmail || order.email || "").toLowerCase();
          if (!email) return;

          const existing = buyerMap.get(email);
          const totalSpent =
            (existing?.totalSpent || 0) +
            (Number(order.highestBid) || Number(order.biddingStartPrice) || 0);
          const orderCount = (existing?.ordersCount || 0) + 1;

          buyerMap.set(email, {
            _id: email,
            name: order.name || order.userName || email.split("@")[0],
            email,
            phone: order.phoneNo || order.phone || "N/A",
            location: order.address || order.shippingAddress || "N/A",
            ordersCount: orderCount,
            totalSpent,
            lastOrderDate: order.createdAt || new Date().toISOString(),
          });
        });

        setCustomers(Array.from(buyerMap.values()));
      } catch (error) {
        if (!isMounted) return;
        console.error("Error fetching seller customers:", error);
        setCustomers([]);
      }
    };

    fetchCustomers();

    return () => {
      isMounted = false;
    };
  }, [sellerEmail]);

  // Function to handle "View" button click
  const handleViewDetails = (customerId) => {
    const customer = customers.find((c) => c._id === customerId); // Find the selected customer
    setSelectedCustomer(customer); // Set the selected customer in state
  };

  // Function to close the modal
  const handleCloseModal = () => {
    setSelectedCustomer(null); // Reset the selected customer
  };

  // Function to handle individual customer selection
  const handleSelectCustomer = (customerId) => {
    if (selectedCustomers.includes(customerId)) {
      setSelectedCustomers(selectedCustomers.filter((id) => id !== customerId)); // Unselect customer
    } else {
      setSelectedCustomers([...selectedCustomers, customerId]); // Select customer
    }
  };

  // Function to handle "Select All" action
  const handleSelectAll = () => {
    if (selectedCustomers.length === customers.length) {
      setSelectedCustomers([]); // Unselect all
    } else {
      setSelectedCustomers(customers.map((customer) => customer._id)); // Select all
    }
  };

  // Function to handle "Delete" action - sellers cannot delete customer records
  const handleDelete = async () => {
    alert("Customer deletion is restricted to platform administrators.");
    setSelectedCustomers([]);
  };

  // Pagination logic
  const indexOfLastCustomer = currentPage * customersPerPage;
  const indexOfFirstCustomer = indexOfLastCustomer - customersPerPage;
  const currentCustomers = Array.isArray(filteredCustomers)
    ? filteredCustomers.slice(indexOfFirstCustomer, indexOfLastCustomer)
    : [];

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
    <div className="col-span-full xl:col-span-6 bg-white dark:bg-gray-800 shadow-xs rounded-xl">
      <header className="px-5 py-4 border-b border-gray-100 dark:border-gray-700/60 flex justify-between items-center">
        <h2 className="font-semibold text-gray-800 dark:text-gray-100">
          Customers
        </h2>
        <div className="flex items-center space-x-4">
          {/* Search Input */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
            <svg
              className="absolute left-3 top-2.5 h-5 w-5 text-gray-400 dark:text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>

          {/* Existing buttons */}
          {selectedCustomers.length > 0 && (
            <button
              onClick={handleDelete}
              className="px-3 py-1 bg-red-500 text-white rounded-md hover:bg-red-600 transition duration-200"
            >
              Delete
            </button>
          )}
          <button
            onClick={handleSelectAll}
            className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition duration-200"
          >
            {selectedCustomers.length === customers.length
              ? "Unselect All"
              : "Select All"}
          </button>
        </div>
      </header>
      <div className="p-3">
        {/* Table */}
        <div className="overflow-x-auto">
          <table className="table-auto w-full">
            {/* Table header */}
            <thead className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="p-2 whitespace-nowrap">
                  <div className="font-semibold text-left">Select</div>
                </th>
                <th className="p-2 whitespace-nowrap">
                  <div className="font-semibold text-left">Name</div>
                </th>
                <th className="p-2 whitespace-nowrap">
                  <div className="font-semibold text-left">Email</div>
                </th>
                <th className="p-2 whitespace-nowrap">
                  <div className="font-semibold text-left">Phone</div>
                </th>
                <th className="p-2 whitespace-nowrap">
                  <div className="font-semibold text-left">Spent</div>
                </th>
                <th className="p-2 whitespace-nowrap">
                  <div className="font-semibold text-left">Country</div>
                </th>
                <th className="p-2 whitespace-nowrap">
                  <div className="font-semibold text-left">Joined Date</div>
                </th>
                <th className="p-2 whitespace-nowrap">
                  <div className="font-semibold text-left">Status</div>
                </th>
                <th className="p-2 whitespace-nowrap">
                  <div className="font-semibold text-left">Actions</div>
                </th>
              </tr>
            </thead>
            {/* Table body */}
            <tbody className="text-sm divide-y divide-gray-100 dark:divide-gray-700/60">
              {currentCustomers.length > 0 ? (
                currentCustomers.map((customer) => (
                  <tr key={customer._id}>
                    <td className="p-2 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedCustomers.includes(customer._id)}
                        onChange={() => handleSelectCustomer(customer._id)}
                        className="form-checkbox h-4 w-4 text-blue-600 transition duration-200"
                      />
                    </td>
                    <td className="p-2 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 shrink-0 mr-2 sm:mr-3">
                          <img
                            className="w-full h-full object-cover rounded-full"
                            src={customer.image}
                            width="40"
                            height="40"
                            alt={customer.name}
                          />
                        </div>
                        <div className="font-medium text-gray-800 dark:text-gray-100">
                          <div style={ellipsisStyle}>{customer.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-2 whitespace-nowrap">
                      <div style={ellipsisStyle}>{customer.email}</div>
                    </td>
                    <td className="p-2 whitespace-nowrap">
                      <div style={ellipsisStyle}>{customer.phone}</div>
                    </td>
                    <td className="p-2 whitespace-nowrap">
                      <div
                        style={ellipsisStyle}
                        className="font-medium text-green-500"
                      >
                        {customer.spent}
                      </div>
                    </td>
                    <td className="p-2 whitespace-nowrap">
                      <div style={ellipsisStyle}>{customer.location}</div>
                    </td>
                    <td className="p-2 whitespace-nowrap">
                      <div style={ellipsisStyle}>{customer.joinedDate}</div>
                    </td>
                    <td className="p-2 whitespace-nowrap">
                      <div style={ellipsisStyle}>
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${
                            customer.status === "Active"
                              ? "bg-green-100 text-green-600"
                              : "bg-red-100 text-red-600"
                          }`}
                        >
                          {customer.status}
                        </span>
                      </div>
                    </td>
                    <td className="p-2 whitespace-nowrap">
                      <button
                        onClick={() => handleViewDetails(customer._id)}
                        className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition duration-200"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="9" className="text-center py-4">
                    No customers found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex justify-between items-center mt-4">
          <button
            onClick={() => paginate(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition duration-200"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Page {currentPage} of{" "}
            {Math.ceil(filteredCustomers.length / customersPerPage)}
          </span>
          <button
            onClick={() => paginate(currentPage + 1)}
            disabled={
              currentPage === Math.ceil(customers.length / customersPerPage)
            }
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition duration-200"
          >
            Next
          </button>
        </div>
      </div>

      {/* Modal for Customer Details */}
      {selectedCustomer && (
        <div className="fixed inset-0 flex items-center justify-center backdrop-blur-sm z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg w-full max-w-md shadow-lg">
            {/* Modal Header */}
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
                Customer Details
              </h3>
              <button
                onClick={handleCloseModal}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition duration-200"
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-4">
              {/* Customer Image and Name */}
              <div className="flex items-center space-x-4">
                <img
                  className="w-12 h-12 rounded-full"
                  src={selectedCustomer.image}
                  alt={selectedCustomer.name}
                />
                <div>
                  <p className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                    {selectedCustomer.name}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {selectedCustomer.email}
                  </p>
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Phone
                  </p>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                    {selectedCustomer.phone}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Country
                  </p>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                    {selectedCustomer.country}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Spent
                  </p>
                  <p className="text-sm font-medium text-green-500">
                    {selectedCustomer.spent}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Joined Date
                  </p>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                    {selectedCustomer.joinedDate}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Status
                  </p>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        selectedCustomer.status === "Active"
                          ? "bg-green-100 text-green-600"
                          : "bg-red-100 text-red-600"
                      }`}
                    >
                      {selectedCustomer.status}
                    </span>
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

export default Customers;
