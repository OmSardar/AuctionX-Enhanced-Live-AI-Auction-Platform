import React, { useState, useEffect } from "react";
import axiosWithAuth from "../../../../redux/slices/axiosWithAuth";

function AdminFeedback() {
  const [feedbacks, setFeedbacks] = useState([]);
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const feedbackPerPage = 5;

  // Fetch feedbacks from the backend
  useEffect(() => {
    const fetchFeedbacks = async () => {
      try {
        const response = await axiosWithAuth.get("/feedback/user");
        const data = Array.isArray(response.data) ? response.data : [];
        setFeedbacks(data);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching feedbacks:", error);
        setError("Failed to fetch feedbacks. Please try again later.");
        setLoading(false);
      }
    };

    fetchFeedbacks();
  }, []);


  // Function to handle "View" button click
  const handleViewDetails = (feedbackId) => {
    const feedback = feedbacks.find((f) => f._id === feedbackId);
    setSelectedFeedback(feedback);
  };

  // Function to close the modal
  const handleCloseModal = () => {
    setSelectedFeedback(null);
  };

  // Function to convert rating text to stars
  const getStarsFromRating = (rating) => {
    switch (rating?.toLowerCase()) {
      case "excellent":
        return 5;
      case "good":
        return 4;
      case "bad":
        return 2;
      default:
        return 0;
    }
  };

  // Function to render stars based on rating
  const renderStars = (rating) => {
    const stars =
      typeof rating === "string" ? getStarsFromRating(rating) : rating;
    return Array.from({ length: 5 }, (_, index) => (
      <span
        key={index}
        className={`text-lg ${
          index < stars ? "text-yellow-500" : "text-gray-300"
        }`}
      >
        ★
      </span>
    ));
  };

  // Function to calculate overall rating from checkbox values
  const calculateOverallRating = (checkboxValues) => {
    if (!checkboxValues || checkboxValues.length === 0) return 0;

    const totalStars = checkboxValues.reduce((sum, rating) => {
      return sum + getStarsFromRating(rating);
    }, 0);

    return Math.round(totalStars / checkboxValues.length);
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
            Loading feedbacks...
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

  // Feedback questions for reference
  const feedbackQuestions = [
    "How easy was it to place a bid on items?",
    "Was it easy to find the items you were looking for?",
    "How would you rate the support you received from our team?",
    "Please rate your overall experience.",
  ];

  return (
    <div className="col-span-full xl:col-span-6 bg-white dark:bg-gray-800 shadow-lg rounded-xl">
      <header className="px-5 py-4 border-b border-gray-100 dark:border-gray-700/60">
        <h2 className="font-semibold text-gray-800 dark:text-gray-100">
          User Feedback ({feedbacks.length})
        </h2>
      </header>

      <div className="p-3">
        {feedbacks.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-400 text-4xl mb-2">📝</div>
            <p className="text-gray-500 dark:text-gray-400">
              No feedback available yet.
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
                      <div className="font-semibold text-left">User Name</div>
                    </th>
                    <th className="p-2 whitespace-nowrap">
                      <div className="font-semibold text-left">User Email</div>
                    </th>
                    <th className="p-2 whitespace-nowrap">
                      <div className="font-semibold text-left">
                        Phone Number
                      </div>
                    </th>
                    <th className="p-2 whitespace-nowrap">
                      <div className="font-semibold text-left">
                        Overall Rating
                      </div>
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
                          <div className="w-8 h-8 shrink-0 mr-2 sm:mr-3 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                            <span className="text-blue-600 dark:text-blue-300 font-semibold text-sm">
                              {feedback.name?.charAt(0)?.toUpperCase() || "U"}
                            </span>
                          </div>
                          <div className="font-medium text-gray-800 dark:text-gray-100">
                            <div style={ellipsisStyle} title={feedback.name}>
                              {feedback.name}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-2 whitespace-nowrap">
                        <div className="text-left">
                          <div style={ellipsisStyle} title={feedback.email}>
                            {feedback.email}
                          </div>
                        </div>
                      </td>
                      <td className="p-2 whitespace-nowrap">
                        <div className="text-left">
                          <div style={ellipsisStyle} title={feedback.phone}>
                            {feedback.phone}
                          </div>
                        </div>
                      </td>
                      <td className="p-2 whitespace-nowrap">
                        <div className="text-left">
                          {renderStars(
                            calculateOverallRating(feedback.checkbox_values)
                          )}
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

      {/* Modal for Feedback Details */}
      {selectedFeedback && (
        <div className="fixed inset-0 flex items-center justify-center  bg-opacity-50 backdrop-blur-sm z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg w-full max-w-lg shadow-xl m-4 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
                Feedback Details
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
              {/* User Info */}
              <div className="flex items-center space-x-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 dark:text-blue-300 font-semibold text-lg">
                    {selectedFeedback.name?.charAt(0)?.toUpperCase() || "U"}
                  </span>
                </div>
                <div>
                  <p className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                    {selectedFeedback.name}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {selectedFeedback.email}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    📞 {selectedFeedback.phone}
                  </p>
                </div>
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

              {/* Overall Rating */}
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                  Overall Rating
                </p>
                <div className="flex items-center space-x-2">
                  {renderStars(
                    calculateOverallRating(selectedFeedback.checkbox_values)
                  )}
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    ({calculateOverallRating(selectedFeedback.checkbox_values)}
                    /5)
                  </span>
                </div>
              </div>

              {/* Detailed Ratings */}
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                  Detailed Feedback
                </p>
                <div className="space-y-3">
                  {feedbackQuestions.map((question, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                    >
                      <div className="flex-1 pr-4">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                          {question}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="flex">
                          {renderStars(
                            selectedFeedback.checkbox_values[index] || "bad"
                          )}
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                          {selectedFeedback.checkbox_values[index] || "N/A"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
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

export default AdminFeedback;
