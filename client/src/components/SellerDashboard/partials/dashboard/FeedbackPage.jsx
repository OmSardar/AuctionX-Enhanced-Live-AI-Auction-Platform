import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import axios from "axios";
function ProductFeedback() {
  const [feedbacks, setFeedbacks] = useState([]);
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const feedbackPerPage = 5;

  // Get seller email from Redux
  const email = useSelector((state) => state.auth.user?.email);
  const API_URL = import.meta.env.VITE_API_URL;

  // Fetch product feedbacks from the backend
  useEffect(() => {
    if (!email) return; // Don't fetch if email is still undefined

    const fetchProductFeedbacks = async () => {
      try {
        const response = await axios.get(
          `${API_URL}/api/product-feedback/seller/${encodeURIComponent(email)}`
        );

        setFeedbacks(response.data.feedbacks || []);
      } catch (error) {
        console.error("Error fetching product feedbacks:", error);
        if (error.response && error.response.status === 404) {
          setFeedbacks([]);
        } else {
          setError(
            "Failed to fetch product feedbacks. Please try again later."
          );
        }
      } finally {
        setLoading(false);
      }
    };

    fetchProductFeedbacks();
  }, [email]);

  // Function to handle "View" button click
  const handleViewDetails = (feedbackId) => {
    const feedback = feedbacks.find((f) => f._id === feedbackId);
    setSelectedFeedback(feedback);
  };

  // Function to close the modal
  const handleCloseModal = () => {
    setSelectedFeedback(null);
  };

  // Function to render stars based on rating
  const renderStars = (rating) => {
    const numRating =
      typeof rating === "number" ? rating : parseInt(rating) || 0;
    return Array.from({ length: 5 }, (_, index) => (
      <span
        key={index}
        className={`text-lg ${
          index < numRating ? "text-yellow-500" : "text-gray-300"
        }`}
      >
        ★
      </span>
    ));
  };

  // Pagination logic
  const indexOfLastFeedback = currentPage * feedbackPerPage;
  const indexOfFirstFeedback = indexOfLastFeedback - feedbackPerPage;
  const currentFeedbacks = feedbacks.slice(
    indexOfFirstFeedback,
    indexOfLastFeedback
  );

  // Function to change page
  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  // Display loading state
  if (loading) {
    return (
      <div className="col-span-full xl:col-span-6 bg-white dark:bg-gray-800 shadow-lg rounded-xl p-5">
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-2 text-gray-600 dark:text-gray-300">
            Loading product feedbacks...
          </span>
        </div>
      </div>
    );
  }

  // Display error state
  if (error) {
    return (
      <div className="col-span-full xl:col-span-6 bg-white dark:bg-gray-800 shadow-lg rounded-xl p-5">
        <div className="text-center py-8">
          <div className="text-red-500 text-lg mb-2">⚠️</div>
          <p className="text-red-500 dark:text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  // Inline styles for ellipsis
  const ellipsisStyle = {
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: "150px",
  };

  return (
    <div className="col-span-full xl:col-span-6 bg-white dark:bg-gray-800 shadow-lg rounded-xl">
      <header className="px-5 py-4 border-b border-gray-100 dark:border-gray-700/60">
        <h2 className="font-semibold text-gray-800 dark:text-gray-100">
          Product Feedback ({feedbacks.length})
        </h2>
      </header>

      <div className="p-3">
        {feedbacks.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-400 text-4xl mb-2">⭐</div>
            <p className="text-gray-500 dark:text-gray-400">
              No product feedback available yet.
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
                      <div className="font-semibold text-left">Product</div>
                    </th>
                    <th className="p-2 whitespace-nowrap">
                      <div className="font-semibold text-left">
                        Customer Email
                      </div>
                    </th>
                    <th className="p-2 whitespace-nowrap">
                      <div className="font-semibold text-left">Rating</div>
                    </th>
                    <th className="p-2 whitespace-nowrap">
                      <div className="font-semibold text-left">Review</div>
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
                  {currentFeedbacks.map((feedback) => (
                    <tr
                      key={feedback._id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/25"
                    >
                      <td className="p-2 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-10 h-10 shrink-0 mr-3 rounded-md overflow-hidden bg-gray-100 dark:bg-gray-700">
                            <img
                              src={feedback.productImage}
                              alt={feedback.productName}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.src =
                                  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0xMiAxNkwyOCAyNE0yOCAxNkwxMiAyNCIgc3Ryb2tlPSIjOUI5QkE2IiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgo8L3N2Zz4K";
                              }}
                            />
                          </div>
                          <div className="font-medium text-gray-800 dark:text-gray-100">
                            <div
                              style={ellipsisStyle}
                              title={feedback.productName}
                            >
                              {feedback.productName}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-2 whitespace-nowrap">
                        <div className="text-left">
                          <div style={ellipsisStyle} title={feedback.userEmail}>
                            {feedback.userEmail}
                          </div>
                        </div>
                      </td>
                      <td className="p-2 whitespace-nowrap">
                        <div className="text-left">
                          {renderStars(feedback.rating)}
                        </div>
                      </td>
                      <td className="p-2 whitespace-nowrap">
                        <div className="text-left">
                          <div
                            style={{ ...ellipsisStyle, maxWidth: "200px" }}
                            title={feedback.reviewText}
                          >
                            {feedback.reviewText}
                          </div>
                        </div>
                      </td>
                      <td className="p-2 whitespace-nowrap">
                        <div className="text-left text-gray-500 dark:text-gray-400">
                          {new Date(feedback.createdAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="p-2 whitespace-nowrap">
                        <button
                          onClick={() => handleViewDetails(feedback._id)}
                          className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors duration-200 text-xs font-medium"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-100 dark:border-gray-700/60">
              <button
                onClick={() => paginate(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Page {currentPage} of{" "}
                {Math.ceil(feedbacks.length / feedbackPerPage)}
              </span>
              <button
                onClick={() => paginate(currentPage + 1)}
                disabled={
                  currentPage === Math.ceil(feedbacks.length / feedbackPerPage)
                }
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>

      {/* Modal for Product Feedback Details */}
      {selectedFeedback && (
        <div className="fixed inset-0 flex items-center justify-center  bg-opacity-50 backdrop-blur-sm z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg w-full max-w-2xl shadow-xl m-4 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
                Product Feedback Details
              </h3>
              <button
                onClick={handleCloseModal}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors duration-200 text-2xl"
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-6">
              {/* Product Info */}
              <div className="flex items-center space-x-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 shrink-0">
                  <img
                    src={selectedFeedback.productImage}
                    alt={selectedFeedback.productName}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.src =
                        "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yMCAyNEw0NCAzNk00NCAyNEwyMCAzNiIgc3Ryb2tlPSIjOUI5QkE2IiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgo8L3N2Zz4K";
                    }}
                  />
                </div>
                <div>
                  <p className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                    {selectedFeedback.productName}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Order ID: {selectedFeedback.orderId}
                  </p>
                </div>
              </div>

              {/* Customer Info */}
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                  Customer Email
                </p>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                  {selectedFeedback.userEmail}
                </p>
              </div>

              {/* Submission Date */}
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                  Submitted On
                </p>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                  {new Date(selectedFeedback.createdAt).toLocaleDateString(
                    "en-US",
                    {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    }
                  )}
                </p>
              </div>

              {/* Rating */}
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                  Rating
                </p>
                <div className="flex items-center space-x-2">
                  {renderStars(selectedFeedback.rating)}
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    ({selectedFeedback.rating}/5)
                  </span>
                </div>
              </div>

              {/* Review Text */}
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                  Customer Review
                </p>
                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-gray-800 dark:text-gray-100 leading-relaxed">
                    {selectedFeedback.reviewText}
                  </p>
                </div>
              </div>

              {/* Additional Photos */}
              {selectedFeedback.additionalPhotos &&
                selectedFeedback.additionalPhotos.length > 0 && (
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                      Additional Photos
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {selectedFeedback.additionalPhotos.map((photo, index) => (
                        <div
                          key={index}
                          className="aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700"
                        >
                          <img
                            src={photo}
                            alt={`Additional photo ${index + 1}`}
                            className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => window.open(photo, "_blank")}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>

            {/* Modal Footer */}
            <div className="mt-6 flex justify-end">
              <button
                onClick={handleCloseModal}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors duration-200"
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

export default ProductFeedback;
