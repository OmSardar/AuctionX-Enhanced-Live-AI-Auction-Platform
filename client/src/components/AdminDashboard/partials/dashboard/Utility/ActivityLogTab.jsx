import React, { useState, useEffect } from "react";

function ActivityLogTab({ activityLogs, csrfToken, API_BASE_URL, getRequestConfig, showStatusMessage }) {
  // State for pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [logsPerPage] = useState(5);

  // Calculate current logs to display
  const indexOfLastLog = currentPage * logsPerPage;
  const indexOfFirstLog = indexOfLastLog - logsPerPage;
  const currentLogs = activityLogs.slice(indexOfFirstLog, indexOfLastLog);

  // Change page
  const paginate = (pageNumber) => {
    if (pageNumber < 1 || pageNumber > Math.ceil(activityLogs.length / logsPerPage)) {
      return;
    }
    setCurrentPage(pageNumber);
  };

  // Handle download report
  const handleDownloadReport = async () => {
    try {
      // You would implement actual download logic here
      showStatusMessage("Downloading activity report...", "success");
      
      // Example implementation (in a real app you'd make an API request):
      // const response = await axios.get(`${API_BASE_URL}/api/admin/download-activity-report`, getRequestConfig());
      // // Process response to download file
      
    } catch (error) {
      console.error("Error downloading report:", error);
      showStatusMessage("Failed to download report", "error");
    }
  };

  return (
    <div>
      <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">
        Recent Activity
      </h3>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-700/50">
            <tr>
              <th className="p-2 whitespace-nowrap text-left">
                Activity
              </th>
              <th className="p-2 whitespace-nowrap text-left">
                IP Address
              </th>
              <th className="p-2 whitespace-nowrap text-left">Device</th>
              <th className="p-2 whitespace-nowrap text-left">
                Date & Time
              </th>
            </tr>
          </thead>
          <tbody className="text-sm divide-y divide-gray-100 dark:divide-gray-700/60">
            {currentLogs.map((log) => (
              <tr key={log.id}>
                <td className="p-2 whitespace-nowrap">
                  <div className="flex items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center mr-2 ${
                        log.type === "login"
                          ? "bg-green-100 text-green-600"
                          : log.type === "update"
                          ? "bg-blue-100 text-blue-600"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {log.type === "login" ? (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                          />
                        </svg>
                      ) : log.type === "update" ? (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                          />
                        </svg>
                      ) : (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-800 dark:text-gray-100">
                        {log.activity}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="p-2 whitespace-nowrap">
                  <div className="text-gray-800 dark:text-gray-100">
                    {log.ipAddress}
                  </div>
                </td>
                <td className="p-2 whitespace-nowrap">
                  <div className="text-gray-800 dark:text-gray-100">
                    {log.device}
                  </div>
                </td>
                <td className="p-2 whitespace-nowrap">
                  <div className="text-gray-800 dark:text-gray-100">
                    {log.timestamp}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination for logs */}
      {activityLogs.length > logsPerPage && (
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
            {Math.ceil(activityLogs.length / logsPerPage)}
          </span>
          <button
            onClick={() => paginate(currentPage + 1)}
            disabled={
              currentPage === Math.ceil(activityLogs.length / logsPerPage)
            }
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition duration-200 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      <div className="mt-6">
        <button 
          onClick={handleDownloadReport}
          className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 font-medium flex items-center"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 mr-1"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          Download Full Activity Report
        </button>
      </div>
    </div>
  );
}

export default ActivityLogTab;