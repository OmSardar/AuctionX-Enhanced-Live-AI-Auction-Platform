import React, { useState, useEffect } from "react";
import axiosWithAuth from "../../../../redux/slices/axiosWithAuth";
import { formatCurrency } from "../../../../lib/utils";

function DepositePage() {
  const [selectedDeposit, setSelectedDeposit] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [deposits, setDeposits] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const depositsPerPage = 5;

  // Fetch deposits from the backend using the new endpoint
  useEffect(() => {
    const fetchDeposits = async () => {
      setLoading(true);
      try {
        const response = await axiosWithAuth.get("/transactions/type/deposit");

        if (Array.isArray(response.data)) {
          // Calculate pagination
          const totalItems = response.data.length;
          const startIndex = (currentPage - 1) * depositsPerPage;
          const endIndex = startIndex + depositsPerPage;
          const paginatedData = response.data.slice(startIndex, endIndex);

          setDeposits(paginatedData);
          setTotalPages(Math.ceil(totalItems / depositsPerPage));
        } else {
          console.error("Invalid response format:", response.data);
          setDeposits([]);
          setTotalPages(1);
        }
      } catch (err) {
        console.error("Error fetching deposits:", err);
        setDeposits([]);
        setTotalPages(1);
      } finally {
        setLoading(false);
      }
    };

    fetchDeposits();
  }, [currentPage]);

  // Function to handle "View" button click
  const handleViewDetails = (depositId) => {
    const deposit = deposits.find((d) => d._id === depositId);
    setSelectedDeposit(deposit);
  };

  // Function to close the modal
  const handleCloseModal = () => {
    setSelectedDeposit(null);
  };

  // Function to change page
  const paginate = (pageNumber) => setCurrentPage(pageNumber);



  // Inline styles for ellipsis
  const ellipsisStyle = {
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: "130px",
  };

  return (
    <div className="col-span-full xl:col-span-6 bg-white dark:bg-gray-800 shadow-xs rounded-xl">
      <header className="px-5 py-4 border-b border-gray-100 dark:border-gray-700/60 flex justify-between items-center">
        <h2 className="font-semibold text-gray-800 dark:text-gray-100">
          Deposits
        </h2>
      </header>
      <div className="p-3">
        {/* Loading indicator */}
        {loading ? (
          <div className="text-center py-4">
            <p className="text-gray-500 dark:text-gray-400">
              Loading deposits...
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
                      <div className="font-semibold text-left">
                        Transaction ID
                      </div>
                    </th>
                    <th className="p-2 whitespace-nowrap">
                      <div className="font-semibold text-left">User</div>
                    </th>
                    <th className="p-2 whitespace-nowrap">
                      <div className="font-semibold text-left">Name</div>
                    </th>
                    <th className="p-2 whitespace-nowrap">
                      <div className="font-semibold text-left">Amount</div>
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
                  {deposits && deposits.length > 0 ? (
                    deposits.map((deposit) => (
                      <tr key={deposit._id}>
                        <td className="p-2 whitespace-nowrap">
                          <div className="text-left font-medium text-gray-800 dark:text-gray-100">
                            <div style={ellipsisStyle}>
                              {deposit._id.substring(0, 8)}...
                            </div>
                          </div>
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          <div className="text-left">
                            <div style={ellipsisStyle}>{deposit.userEmail}</div>
                          </div>
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          <div className="text-left">
                            <div style={ellipsisStyle}>
                              {deposit.name || "N/A"}
                            </div>
                          </div>
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          <div className="text-left font-medium text-blue-500">
                            {formatCurrency(deposit.amount)}
                          </div>
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          <div className="text-left text-gray-500 dark:text-gray-400">
                            {new Date(
                              deposit.date || deposit.createdAt
                            ).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          <div className="flex space-x-1">
                            <button
                              onClick={() => handleViewDetails(deposit._id)}
                              className="px-2 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition duration-200 text-xs"
                            >
                              View
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan="6"
                        className="p-4 text-center text-gray-500 dark:text-gray-400"
                      >
                        No deposits found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination - only show if there are deposits */}
            {deposits && deposits.length > 0 && (
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

      {/* Modal for Deposit Details */}
      {selectedDeposit && (
        <div className="fixed inset-0 flex items-center justify-center backdrop-blur-sm z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg w-full max-w-md shadow-lg">
            {/* Modal Header */}
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
                Deposit Details
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
              {/* Transaction ID */}
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Transaction ID
                </p>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  {selectedDeposit._id}
                </p>
              </div>

              {/* User Information */}
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  User Email
                </p>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  {selectedDeposit.userEmail || "N/A"}
                </p>
              </div>

              {/* Name */}
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Name</p>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  {selectedDeposit.name || "N/A"}
                </p>
              </div>

              {/* Amount */}
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Amount
                </p>
                <p className="text-sm font-medium text-blue-500">
                  {formatCurrency(selectedDeposit.amount)}
                </p>
              </div>

              {/* Type */}
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Type</p>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  {selectedDeposit.type || "deposit"}
                </p>
              </div>

              {/* Date */}
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Date</p>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  {new Date(
                    selectedDeposit.date || selectedDeposit.createdAt
                  ).toLocaleString()}
                </p>
              </div>

              {/* Created At */}
              {selectedDeposit.createdAt && (
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Created At
                  </p>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    {new Date(selectedDeposit.createdAt).toLocaleString()}
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={handleCloseModal}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition duration-200 text-sm"
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

export default DepositePage;
