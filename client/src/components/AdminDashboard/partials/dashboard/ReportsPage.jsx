import React, { useState, useEffect } from "react";
import axiosWithAuth from "../../../../redux/slices/axiosWithAuth";
import { toast } from "react-toastify";

function AdminReports() {
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const reportsPerPage = 5;

  // Fetch reports from the backend
  const fetchReports = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axiosWithAuth.get("/admin/reports");

      // Handle the response structure from your backend
      if (response.data.success && response.data.data) {
        setReports(response.data.data);
      } else if (Array.isArray(response.data)) {
        setReports(response.data);
      } else {
        setReports([]);
      }
    } catch (error) {
      console.error("Error fetching reports:", error);
      setError("Failed to fetch reports. Please try again later.");
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  // Pagination logic
  const indexOfLastReport = currentPage * reportsPerPage;
  const indexOfFirstReport = indexOfLastReport - reportsPerPage;
  const currentReports = reports.slice(indexOfFirstReport, indexOfLastReport);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  const handleViewDetails = (reportId) => {
    const report = reports.find((r) => r._id === reportId);
    setSelectedReport(report);
  };

  const handleCloseModal = () => {
    setSelectedReport(null);
  };

  const handleUpdateStatus = async (reportId, newStatus) => {
    try {
      const response = await axiosWithAuth.put(
        `/admin/reports/${reportId}`,
        { status: newStatus }
      );

      if (response.data.success) {
        // Update the reports list with the new status
        setReports(
          reports.map((report) =>
            report._id === reportId ? { ...report, status: newStatus } : report
          )
        );

        // Update selected report if it's the one being updated
        if (selectedReport && selectedReport._id === reportId) {
          setSelectedReport({ ...selectedReport, status: newStatus });
        }
        toast.success(`Report status updated to ${newStatus}`);
      }
    } catch (error) {
      console.error("Error updating report status:", error);
      toast.error("Failed to update report status");
    }
  };


  if (loading) {
    return (
      <div className="col-span-full xl:col-span-6 bg-white dark:bg-gray-800 shadow-xs rounded-xl">
        <div className="p-6 text-center">
          <p className="text-gray-500 dark:text-gray-400">Loading reports...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="col-span-full xl:col-span-6 bg-white dark:bg-gray-800 shadow-xs rounded-xl">
        <div className="p-6 text-center">
          <p className="text-red-500 dark:text-red-400">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const ellipsisStyle = {
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: "130px",
  };

  const statusColor = (status) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "in-progress":
        return "bg-blue-100 text-blue-800";
      case "resolved":
        return "bg-green-100 text-green-800";
      case "closed":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatReportType = (type) => {
    return type.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  return (
    <div className="col-span-full xl:col-span-6 bg-white dark:bg-gray-800 shadow-xs rounded-xl">
      <header className="px-5 py-4 border-b border-gray-100 dark:border-gray-700/60">
        <h2 className="font-semibold text-gray-800 dark:text-gray-100">
          User Reports ({reports.length})
        </h2>
      </header>
      <div className="p-3">
        {/* Table */}
        {reports.length === 0 ? (
          <p className="text-center text-gray-500 dark:text-gray-400 py-8">
            No reports found.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-auto w-full">
              {/* Table header */}
              <thead className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="p-2 whitespace-nowrap">
                    <div className="font-semibold text-left">User</div>
                  </th>
                  <th className="p-2 whitespace-nowrap">
                    <div className="font-semibold text-left">Report Type</div>
                  </th>
                  <th className="p-2 whitespace-nowrap">
                    <div className="font-semibold text-left">Date</div>
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
                {currentReports.map((report) => (
                  <tr key={report._id}>
                    <td className="p-2 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 shrink-0 mr-2 sm:mr-3">
                          <div className="w-full h-full flex items-center justify-center bg-gray-200 dark:bg-gray-700 rounded-full">
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                              {report.userName
                                ? report.userName.charAt(0).toUpperCase()
                                : "U"}
                            </span>
                          </div>
                        </div>
                        <div>
                          <div className="font-medium text-gray-800 dark:text-gray-100">
                            <div style={ellipsisStyle} title={report.userName}>
                              {report.userName || "Unknown User"}
                            </div>
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            <div style={ellipsisStyle} title={report.userEmail}>
                              {report.userEmail || "No email"}
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-2 whitespace-nowrap">
                      <div className="text-left">
                        {formatReportType(report.reportType)}
                      </div>
                    </td>
                    <td className="p-2 whitespace-nowrap">
                      <div className="text-left">
                        {new Date(report.date).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="p-2 whitespace-nowrap">
                      <div className="text-left">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full capitalize ${statusColor(
                            report.status
                          )}`}
                        >
                          {report.status}
                        </span>
                      </div>
                    </td>
                    <td className="p-2 whitespace-nowrap">
                      <button
                        onClick={() => handleViewDetails(report._id)}
                        className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition duration-200"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {reports.length > reportsPerPage && (
          <div className="flex justify-between items-center mt-4">
            <button
              onClick={() => paginate(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Page {currentPage} of {Math.ceil(reports.length / reportsPerPage)}
            </span>
            <button
              onClick={() => paginate(currentPage + 1)}
              disabled={
                currentPage === Math.ceil(reports.length / reportsPerPage)
              }
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Modal for Report Details */}
      {selectedReport && (
        <div className="fixed inset-0 flex items-center justify-center backdrop-blur-sm z-50 p-4">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg w-full max-w-2xl shadow-lg max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
                Report Details
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
              {/* User Info */}
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 flex items-center justify-center bg-gray-200 dark:bg-gray-700 rounded-full">
                  <span className="text-lg font-medium text-gray-600 dark:text-gray-300">
                    {selectedReport.userName
                      ? selectedReport.userName.charAt(0).toUpperCase()
                      : "U"}
                  </span>
                </div>
                <div>
                  <p className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                    {selectedReport.userName || "Unknown User"}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {selectedReport.userEmail || "No email provided"}
                  </p>
                </div>
              </div>

              {/* Report Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Report Type
                  </p>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                    {formatReportType(selectedReport.reportType)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Current Status
                  </p>
                  <span
                    className={`inline-block px-2 py-1 text-xs font-medium rounded-full capitalize ${statusColor(
                      selectedReport.status
                    )}`}
                  >
                    {selectedReport.status}
                  </span>
                </div>
                {selectedReport.orderId && (
                  <div className="md:col-span-2">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Order ID
                    </p>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                      {selectedReport.orderId}
                    </p>
                  </div>
                )}
              </div>

              {/* Report Details */}
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                  Report Details
                </p>
                <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-md">
                  <p className="text-sm text-gray-800 dark:text-gray-100 whitespace-pre-line">
                    {selectedReport.report}
                  </p>
                </div>
              </div>

              {/* Attachments */}
              {selectedReport.attachments?.length > 0 && (
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                    Attachments ({selectedReport.attachments.length})
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {selectedReport.attachments.map((attachment, index) => (
                      <a
                        key={index}
                        href={attachment.secure_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors text-sm text-center"
                      >
                        📎 Attachment {index + 1}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Date */}
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Submitted on
                </p>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                  {new Date(selectedReport.date).toLocaleString()}
                </p>
              </div>

              {/* Status Update Section */}
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                  Update Status
                </p>
                <div className="flex flex-wrap gap-2">
                  {["pending", "in-progress", "resolved", "closed"].map(
                    (status) => (
                      <button
                        key={status}
                        onClick={() =>
                          handleUpdateStatus(selectedReport._id, status)
                        }
                        disabled={selectedReport.status === status}
                        className={`px-3 py-1 text-xs font-medium rounded-full capitalize transition duration-200 ${
                          selectedReport.status === status
                            ? statusColor(status) +
                              " opacity-50 cursor-not-allowed"
                            : "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600"
                        }`}
                      >
                        {status.replace("-", " ")}
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

export default AdminReports;
