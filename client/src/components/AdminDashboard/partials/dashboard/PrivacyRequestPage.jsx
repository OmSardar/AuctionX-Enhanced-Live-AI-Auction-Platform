import React, { useState, useEffect } from "react";
import axiosWithAuth from "../../../../redux/slices/axiosWithAuth";
import { toast } from "react-toastify";

function AdminPrivacyRequest() {
  const [privacyRequests, setPrivacyRequests] = useState([]); // State for privacy request data
  const [selectedRequest, setSelectedRequest] = useState(null); // State for selected request (modal)
  const [currentPage, setCurrentPage] = useState(1); // State for current page
  const [loading, setLoading] = useState(true); // State for loading
  const [error, setError] = useState(null); // State for error
  const [statusFilter, setStatusFilter] = useState("all"); // State for status filter
  const requestsPerPage = 5; // Number of requests to display per page

  // Fetch privacy requests from the backend
  useEffect(() => {
    const fetchPrivacyRequests = async () => {
      try {
        const response = await axiosWithAuth.get("/privacy/");
        const list = response.data?.data || (Array.isArray(response.data) ? response.data : []);
        setPrivacyRequests(list);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching privacy requests:", error);
        setError("Failed to fetch privacy requests. Please try again later.");
        setLoading(false);
      }
    };

    fetchPrivacyRequests();
  }, []);

  // Function to handle "View" button click
  const handleViewDetails = (requestId) => {
    const request = privacyRequests.find((r) => r._id === requestId); // Find the selected request
    setSelectedRequest(request); // Set the selected request in state
  };

  // Function to close the modal
  const handleCloseModal = () => {
    setSelectedRequest(null); // Reset the selected request
  };

  // Function to update request status
  const handleStatusUpdate = async (requestId, newStatus) => {
    try {
      const response = await axiosWithAuth.put(`/privacy/${requestId}`, {
        status: newStatus,
      });

      const updatedRecord = response.data?.data || response.data;

      // Update local state with the updated request from response
      setPrivacyRequests((prevRequests) =>
        prevRequests.map((request) =>
          request._id === requestId ? updatedRecord : request
        )
      );

      // Update selected request if it's the one being modified
      if (selectedRequest && selectedRequest._id === requestId) {
        setSelectedRequest(updatedRecord);
      }

      toast.success("Status updated successfully!");
    } catch (error) {
      console.error("Error updating request status:", error);
      toast.error("Failed to update request status. Please try again.");
    }
  };


  // Function to get status badge color
  const getStatusColor = (status) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
      case "in-progress":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "completed":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "rejected":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    }
  };

  // Function to format request type for display
  const formatRequestType = (type) => {
    const typeMap = {
      access: "Data Access",
      delete: "Data Deletion",
      correct: "Data Correction",
      optout: "Opt Out",
      other: "Other",
      "Bidding Issues": "Bidding Issues",
      "Payment Issues": "Payment Issues",
      "Account Questions": "Account Questions",
      "Item Questions": "Item Questions",
      "Shipping & Delivery": "Shipping & Delivery",
      Other: "Other",
    };
    return typeMap[type] || type;
  };

  // Filter requests based on status
  const filteredRequests =
    statusFilter === "all"
      ? privacyRequests
      : privacyRequests.filter((request) => request.status === statusFilter);

  // Ensure filteredRequests is always an array
  const safeFilteredRequests = Array.isArray(filteredRequests)
    ? filteredRequests
    : [];

  // Pagination logic
  const indexOfLastRequest = currentPage * requestsPerPage;
  const indexOfFirstRequest = indexOfLastRequest - requestsPerPage;
  const currentRequests = safeFilteredRequests.slice(
    indexOfFirstRequest,
    indexOfLastRequest
  );

  // Function to change page
  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  // Display loading state
  if (loading) {
    return (
      <div className="col-span-full xl:col-span-6 bg-white dark:bg-gray-800 shadow-xs rounded-xl p-5">
        <p>Loading privacy requests...</p>
      </div>
    );
  }

  // Display error state
  if (error) {
    return (
      <div className="col-span-full xl:col-span-6 bg-white dark:bg-gray-800 shadow-xs rounded-xl p-5">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  // Inline styles for ellipsis
  const ellipsisStyle = {
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: "150px", // Adjust the width as needed
  };
  return (
    <div className="col-span-full xl:col-span-6 bg-white dark:bg-gray-800 shadow-xs rounded-xl">
      <header className="px-5 py-4 border-b border-gray-100 dark:border-gray-700/60">
        <div className="flex justify-between items-center">
          <h2 className="font-semibold text-gray-800 dark:text-gray-100">
            Privacy Requests
          </h2>
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1); // Reset to first page when filtering
            }}
            className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="in-progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="rejected">Rejected</option>
          </select>
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
                  <div className="font-semibold text-left">Full Name</div>
                </th>
                <th className="p-2 whitespace-nowrap">
                  <div className="font-semibold text-left">Email</div>
                </th>
                <th className="p-2 whitespace-nowrap">
                  <div className="font-semibold text-left">Request Type</div>
                </th>
                <th className="p-2 whitespace-nowrap">
                  <div className="font-semibold text-left">Status</div>
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
              {currentRequests.map((request) => (
                <tr key={request._id}>
                  <td className="p-2 whitespace-nowrap">
                    <div className="font-medium text-gray-800 dark:text-gray-100">
                      <div style={ellipsisStyle}>{request.fullName}</div>
                    </div>
                  </td>
                  <td className="p-2 whitespace-nowrap">
                    <div className="text-left">
                      <div style={ellipsisStyle}>{request.email}</div>
                    </div>
                  </td>
                  <td className="p-2 whitespace-nowrap">
                    <div className="text-left">
                      <div style={ellipsisStyle}>
                        {formatRequestType(request.requestType)}
                      </div>
                    </div>
                  </td>
                  <td className="p-2 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                        request.status
                      )}`}
                    >
                      {request.status.charAt(0).toUpperCase() +
                        request.status.slice(1)}
                    </span>
                  </td>
                  <td className="p-2 whitespace-nowrap">
                    <div className="text-left text-gray-600 dark:text-gray-400">
                      {new Date(request.createdAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="p-2 whitespace-nowrap">
                    <button
                      onClick={() => handleViewDetails(request._id)}
                      className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition duration-200 mr-2"
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
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition duration-200 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Page {currentPage} of{" "}
            {Math.ceil(safeFilteredRequests.length / requestsPerPage)}
          </span>
          <button
            onClick={() => paginate(currentPage + 1)}
            disabled={
              currentPage ===
              Math.ceil(safeFilteredRequests.length / requestsPerPage)
            }
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition duration-200 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>

      {/* Modal for Privacy Request Details */}
      {selectedRequest && (
        <div className="fixed inset-0 flex items-center justify-center backdrop-blur-sm z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg w-full max-w-2xl shadow-lg max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
                Privacy Request Details
              </h3>
              <button
                onClick={handleCloseModal}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition duration-200 text-2xl"
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                    Full Name
                  </p>
                  <p className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                    {selectedRequest.fullName}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                    Email
                  </p>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                    {selectedRequest.email}
                  </p>
                </div>
              </div>

              {/* Request Type and Status */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                    Request Type
                  </p>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                    {formatRequestType(selectedRequest.requestType)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                    Current Status
                  </p>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                      selectedRequest.status
                    )}`}
                  >
                    {selectedRequest.status.charAt(0).toUpperCase() +
                      selectedRequest.status.slice(1)}
                  </span>
                </div>
              </div>

              {/* Date Created */}
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                  Date Submitted
                </p>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                  {new Date(selectedRequest.createdAt).toLocaleString()}
                </p>
              </div>

              {/* Request Details */}
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                  Request Details
                </p>
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <p className="text-sm text-gray-800 dark:text-gray-100 whitespace-pre-wrap">
                    {selectedRequest.details}
                  </p>
                </div>
              </div>

              {/* Status Update Section */}
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                  Update Status
                </p>
                <div className="flex gap-2 flex-wrap">
                  {["pending", "in-progress", "completed", "rejected"].map(
                    (status) => (
                      <button
                        key={status}
                        onClick={() =>
                          handleStatusUpdate(selectedRequest._id, status)
                        }
                        className={`px-3 py-1 rounded-md text-sm font-medium transition duration-200 ${
                          selectedRequest.status === status
                            ? "bg-blue-500 text-white"
                            : "bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-500"
                        }`}
                      >
                        {status.charAt(0).toUpperCase() +
                          status.slice(1).replace("-", " ")}
                      </button>
                    )
                  )}
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

export default AdminPrivacyRequest;
