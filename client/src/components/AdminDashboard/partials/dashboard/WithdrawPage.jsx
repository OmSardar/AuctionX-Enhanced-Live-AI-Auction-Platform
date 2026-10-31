import React, { useState, useEffect } from "react";
import axiosWithAuth from "../../../../redux/slices/axiosWithAuth";
import { formatCurrency } from "../../../../lib/utils";
import { toast } from "react-toastify";

// Get status badge class
const getStatusBadgeClass = (status) => {
  const statusLower = (status || "pending").toLowerCase();
  switch (statusLower) {
    case "completed":
      return "bg-green-100 text-green-800 dark:bg-green-700/20 dark:text-green-400";
    case "pending":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-700/20 dark:text-yellow-400";
    case "rejected":
      return "bg-red-100 text-red-800 dark:bg-red-700/20 dark:text-red-400";
    case "processing":
      return "bg-blue-100 text-blue-800 dark:bg-blue-700/20 dark:text-blue-400";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-700/20 dark:text-gray-400";
  }
};

function WithdrawPage() {
  const [selectedWithdrawal, setSelectedWithdrawal] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [withdrawals, setWithdrawals] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const withdrawalsPerPage = 5;

  // Fetch withdrawals from the backend using the new endpoint
  useEffect(() => {
    const fetchWithdrawals = async () => {
      setLoading(true);
      try {
        const response = await axiosWithAuth.get("/transactions/type/withdrawal");

        if (Array.isArray(response.data)) {
          // Calculate pagination
          const totalItems = response.data.length;
          const startIndex = (currentPage - 1) * withdrawalsPerPage;
          const endIndex = startIndex + withdrawalsPerPage;
          const paginatedData = response.data.slice(startIndex, endIndex);

          setWithdrawals(paginatedData);
          setTotalPages(Math.ceil(totalItems / withdrawalsPerPage));
        } else {
          console.error("Invalid response format:", response.data);
          setWithdrawals([]);
          setTotalPages(1);
        }
      } catch (err) {
        console.error("Error fetching withdrawals:", err);
        setWithdrawals([]);
        setTotalPages(1);
      } finally {
        setLoading(false);
      }
    };

    fetchWithdrawals();
  }, [currentPage]);

  // Function to handle "View" button click
  const handleViewDetails = (withdrawalId) => {
    const withdrawal = withdrawals.find((w) => w._id === withdrawalId);
    setSelectedWithdrawal(withdrawal);
  };

  // Function to handle status update
  const handleStatusUpdate = async (withdrawalId, newStatus) => {
    try {
      await axiosWithAuth.put(`/transactions/${withdrawalId}`, {
        status: newStatus,
      });

      // Update local state
      setWithdrawals(
        withdrawals.map((withdrawal) =>
          withdrawal._id === withdrawalId
            ? { ...withdrawal, status: newStatus }
            : withdrawal
        )
      );

      // If modal is open with this withdrawal, update it too
      if (selectedWithdrawal && selectedWithdrawal._id === withdrawalId) {
        setSelectedWithdrawal({ ...selectedWithdrawal, status: newStatus });
      }

      toast.success(`Withdrawal status updated to ${newStatus}`);
    } catch (err) {
      console.error("Error updating withdrawal status:", err);
      toast.error("Failed to update withdrawal status");
    }
  };


  // Function to close the modal
  const handleCloseModal = () => {
    setSelectedWithdrawal(null);
  };

  // Function to change page
  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  // Get status badge class
  const getStatusBadgeClass = (status) => {
    const statusLower = (status || "pending").toLowerCase();
    switch (statusLower) {
      case "completed":
        return "bg-green-100 text-green-800 dark:bg-green-700/20 dark:text-green-400";
      case "pending":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-700/20 dark:text-yellow-400";
      case "rejected":
        return "bg-red-100 text-red-800 dark:bg-red-700/20 dark:text-red-400";
      case "processing":
        return "bg-blue-100 text-blue-800 dark:bg-blue-700/20 dark:text-blue-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-700/20 dark:text-gray-400";
    }
  };



  // Format account number (hide middle digits) - since Transaction model doesn't have this field
  const formatAccountNumber = (accountNumber) => {
    if (!accountNumber) return "N/A";
    if (accountNumber.length <= 8) return "****" + accountNumber.slice(-4);
    return accountNumber.slice(0, 4) + "****" + accountNumber.slice(-4);
  };

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
          Withdrawals
        </h2>
      </header>
      <div className="p-3">
        {/* Loading indicator */}
        {loading ? (
          <div className="text-center py-4">
            <p className="text-gray-500 dark:text-gray-400">
              Loading withdrawals...
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
                  {withdrawals && withdrawals.length > 0 ? (
                    withdrawals.map((withdrawal) => (
                      <tr key={withdrawal._id}>
                        <td className="p-2 whitespace-nowrap">
                          <div className="text-left font-medium text-gray-800 dark:text-gray-100">
                            <div style={ellipsisStyle}>
                              {withdrawal._id.substring(0, 8)}...
                            </div>
                          </div>
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          <div className="text-left">
                            <div style={ellipsisStyle}>
                              {withdrawal.userEmail}
                            </div>
                          </div>
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          <div className="text-left">
                            <div style={ellipsisStyle}>
                              {withdrawal.name || "N/A"}
                            </div>
                          </div>
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          <div className="text-left font-medium text-blue-500">
                            {formatCurrency(withdrawal.amount)}
                          </div>
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          <div className="text-left text-gray-500 dark:text-gray-400">
                            {new Date(
                              withdrawal.date || withdrawal.createdAt
                            ).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          <div className="flex space-x-1">
                            <button
                              onClick={() => handleViewDetails(withdrawal._id)}
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
                        No withdrawals found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination - only show if there are withdrawals */}
            {withdrawals && withdrawals.length > 0 && (
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

      {/* Modal for Withdrawal Details */}
      {selectedWithdrawal && (
        <div className="fixed inset-0 flex items-center justify-center backdrop-blur-sm z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg w-full max-w-md shadow-lg">
            {/* Modal Header */}
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
                Withdrawal Details
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
                  {selectedWithdrawal._id}
                </p>
              </div>

              {/* User Information */}
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  User Email
                </p>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  {selectedWithdrawal.userEmail || "N/A"}
                </p>
              </div>

              {/* Name */}
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Name</p>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  {selectedWithdrawal.name || "N/A"}
                </p>
              </div>

              {/* Amount */}
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Amount
                </p>
                <p className="text-sm font-medium text-blue-500">
                  {formatCurrency(selectedWithdrawal.amount)}
                </p>
              </div>

              {/* Type */}
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Type</p>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  {selectedWithdrawal.type || "withdrawal"}
                </p>
              </div>

              {/* Date */}
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Date</p>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  {new Date(
                    selectedWithdrawal.date || selectedWithdrawal.createdAt
                  ).toLocaleString()}
                </p>
              </div>

              {/* Created At */}
              {selectedWithdrawal.createdAt && (
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Created At
                  </p>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    {new Date(selectedWithdrawal.createdAt).toLocaleString()}
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

export default WithdrawPage;
