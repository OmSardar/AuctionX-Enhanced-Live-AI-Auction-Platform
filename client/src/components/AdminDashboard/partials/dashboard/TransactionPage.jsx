import React, { useState, useEffect } from "react";
import axiosWithAuth from "../../../../redux/slices/axiosWithAuth";
import { formatCurrency } from "../../../../lib/utils";

function TransactionPage() {
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [transactions, setTransactions] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const transactionsPerPage = 5;

  // Fetch transactions from the backend
  useEffect(() => {
    const fetchTransactions = async () => {
      setLoading(true);
      try {
        const response = await axiosWithAuth.get("/transactions");

        if (Array.isArray(response.data)) {
          setTransactions(response.data);
          setTotalPages(Math.ceil(response.data.length / transactionsPerPage));
        } else if (response.data && response.data.transactions) {
          setTransactions(response.data.transactions);
          setTotalPages(response.data.totalPages || 1);
        } else {
          console.error("Invalid response format:", response.data);
          setTransactions([]);
        }
      } catch (err) {
        console.error("Error fetching transactions:", err);
        setTransactions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [currentPage]);


  // Function to handle "View" button click
  const handleViewDetails = (transactionId) => {
    const transaction = transactions.find((t) => t._id === transactionId);
    setSelectedTransaction(transaction);
  };

  // Function to close the modal
  const handleCloseModal = () => {
    setSelectedTransaction(null);
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
      <header className="px-5 py-4 border-b border-gray-100 dark:border-gray-700/60">
        <h2 className="font-semibold text-gray-800 dark:text-gray-100">
          Transactions
        </h2>
      </header>
      <div className="p-3">
        {/* Loading indicator */}
        {loading ? (
          <div className="text-center py-4">
            <p className="text-gray-500 dark:text-gray-400">
              Loading transactions...
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
                      <div className="font-semibold text-left">Name</div>
                    </th>
                    <th className="p-2 whitespace-nowrap">
                      <div className="font-semibold text-left">User</div>
                    </th>
                    <th className="p-2 whitespace-nowrap">
                      <div className="font-semibold text-left">Type</div>
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
                  {transactions && transactions.length > 0 ? (
                    transactions.map((transaction) => (
                      <tr key={transaction._id}>
                        <td className="p-2 whitespace-nowrap">
                          <div className="text-left font-medium text-gray-800 dark:text-gray-100">
                            <div style={ellipsisStyle}>
                              {transaction._id.substring(0, 8)}...
                            </div>
                          </div>
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          <div className="text-left">
                            <div style={ellipsisStyle}>{transaction.name}</div>
                          </div>
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          <div className="text-left">
                            <div style={ellipsisStyle}>
                              {transaction.userEmail}
                            </div>
                          </div>
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          <div className="text-left">
                            <span
                              className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${
                                transaction.type === "deposit"
                                  ? "bg-green-100 text-green-800 dark:bg-green-700/20 dark:text-green-400"
                                  : "bg-red-100 text-red-800 dark:bg-red-700/20 dark:text-red-400"
                              }`}
                            >
                              {transaction.type.charAt(0).toUpperCase() +
                                transaction.type.slice(1)}
                            </span>
                          </div>
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          <div className="text-left font-medium text-blue-500">
                            {formatCurrency(transaction.amount)}
                          </div>
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          <div className="text-left text-gray-500 dark:text-gray-400">
                            {new Date(transaction.date).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          <button
                            onClick={() => handleViewDetails(transaction._id)}
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
                        colSpan="7"
                        className="p-4 text-center text-gray-500 dark:text-gray-400"
                      >
                        No transactions found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination - only show if there are transactions */}
            {transactions && transactions.length > 0 && (
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

      {/* Modal for Transaction Details */}
      {selectedTransaction && (
        <div className="fixed inset-0 flex items-center justify-center backdrop-blur-sm z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg w-full max-w-md shadow-lg">
            {/* Modal Header */}
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
                Transaction Details
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
              {/* Transaction ID */}
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Transaction ID
                </p>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100 break-all">
                  {selectedTransaction._id}
                </p>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Name
                  </p>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                    {selectedTransaction.name}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    User Email
                  </p>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                    {selectedTransaction.userEmail}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Type
                  </p>
                  <p
                    className={`text-sm font-medium ${
                      selectedTransaction.type === "deposit"
                        ? "text-green-500"
                        : "text-red-500"
                    }`}
                  >
                    {selectedTransaction.type.charAt(0).toUpperCase() +
                      selectedTransaction.type.slice(1)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Amount
                  </p>
                  <p className="text-sm font-medium text-blue-500">
                    {formatCurrency(selectedTransaction.amount)}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Date
                  </p>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                    {new Date(selectedTransaction.date).toLocaleString()}
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

export default TransactionPage;
