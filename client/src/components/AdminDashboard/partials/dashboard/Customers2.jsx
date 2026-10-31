import React, { useState, useEffect } from "react";
import axiosWithAuth from "../../../../redux/slices/axiosWithAuth";

function Customers() {
  const [selectedCustomer, setSelectedCustomer] = useState(null); // State for selected customer (modal)
  const [currentPage, setCurrentPage] = useState(1); // State for current page
  const [customers, setCustomers] = useState([]); // State for customers fetched from the backend
  const customersPerPage = 5; // Number of customers to display per page

  // Fetch customers from the backend
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const response = await axiosWithAuth.get("/admin/customers");

        // Check if the response has the expected structure
        if (response.data.success && Array.isArray(response.data.data)) {
          setCustomers(response.data.data); // Use the nested array
        } else if (Array.isArray(response.data)) {
          setCustomers(response.data);
        } else {
          console.error("Invalid data format: Expected an array of customers.");
          setCustomers([]); // Set to empty array if data is invalid
        }
      } catch (error) {
        console.error("Error fetching customers:", error);
        setCustomers([]); // Set to empty array on error
      }
    };
    fetchCustomers();
  }, []);


  // Function to handle "View" button click
  const handleViewDetails = (customerId) => {
    const customer = customers.find((c) => c._id === customerId); // Find the selected customer
    setSelectedCustomer(customer); // Set the selected customer in state
  };

  // Function to close the modal
  const handleCloseModal = () => {
    setSelectedCustomer(null); // Reset the selected customer
  };

  // Pagination logic
  const indexOfLastCustomer = currentPage * customersPerPage;
  const indexOfFirstCustomer = indexOfLastCustomer - customersPerPage;
  const currentCustomers = Array.isArray(customers)
    ? customers.slice(indexOfFirstCustomer, indexOfLastCustomer)
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
      </header>
      <div className="p-3">
        {/* Table */}
        <div className="overflow-x-auto">
          <table className="table-auto w-full">
            {/* Table header */}
            <thead className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="p-2 whitespace-nowrap">
                  <div className="font-semibold text-left">Name</div>
                </th>
                <th className="p-2 whitespace-nowrap">
                  <div className="font-semibold text-left">Email</div>
                </th>
                <th className="p-2 whitespace-nowrap">
                  <div className="font-semibold text-left">Spent</div>
                </th>
                <th className="p-2 whitespace-nowrap">
                  <div className="font-semibold text-left">Country</div>
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
                  <td colSpan="5" className="text-center py-4">
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
            {Math.ceil(customers.length / customersPerPage)}
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
                    Spent
                  </p>
                  <p className="text-sm font-medium text-green-500">
                    {selectedCustomer.spent}
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
