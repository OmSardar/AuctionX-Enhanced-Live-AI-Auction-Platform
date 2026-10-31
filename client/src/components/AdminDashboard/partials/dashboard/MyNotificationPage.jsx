import React, { useState, useEffect } from "react";
import axiosWithAuth from "../../../../redux/slices/axiosWithAuth";
import { toast } from "react-toastify";

function MyNotificationPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [filter, setFilter] = useState("all"); // all, read, unread

  // Form states for composing notifications
  const [formData, setFormData] = useState({
    title: "",
    message: "",
    recipientType: "all", // all, admins, users, sellers
    priority: "normal", // low, normal, high, urgent
  });

  const [formErrors, setFormErrors] = useState({});
  const [submitStatus, setSubmitStatus] = useState(null);
  const notificationsPerPage = 8;

  // Fetch notifications from the backend
  useEffect(() => {
    const fetchNotifications = async () => {
      setLoading(true);
      try {
        const response = await axiosWithAuth.get("/notifications", {
          params: { page: currentPage, filter, limit: notificationsPerPage }
        });

        if (Array.isArray(response.data)) {
          setNotifications(response.data);
          setTotalPages(Math.ceil(response.data.length / notificationsPerPage));
        } else if (response.data && response.data.notifications) {
          setNotifications(response.data.notifications);
          setTotalPages(response.data.totalPages || 1);
        } else {
          console.error("Invalid response format:", response.data);
          setNotifications([]);
        }
      } catch (err) {
        console.error("Error fetching notifications:", err);
        setNotifications([]);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, [currentPage, filter]);


  // Function to handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });

    // Clear error for this field when user starts typing
    if (formErrors[name]) {
      setFormErrors({
        ...formErrors,
        [name]: "",
      });
    }
  };

  // Function to validate form
  const validateForm = () => {
    const errors = {};

    if (!formData.title.trim()) errors.title = "Title is required";
    if (!formData.message.trim()) errors.message = "Message is required";

    return errors;
  };

  // Function to handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate form
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    // Submit form data
    setSubmitStatus("submitting");
    try {
      await axiosWithAuth.post("/notifications", formData);

      // Success - reset form and show success message
      setFormData({
        title: "",
        message: "",
        recipientType: "all",
        priority: "normal",
      });
      setSubmitStatus("success");
      toast.success("Notification broadcast successfully");

      // Close modal after short delay
      setTimeout(() => {
        setShowComposeModal(false);
        setSubmitStatus(null);
      }, 1500);
    } catch (error) {
      console.error("Error sending notification:", error);
      setSubmitStatus("error");
      toast.error("Failed to send notification");
    }
  };

  // Function to handle pagination
  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  // Function to handle notification selection
  const handleViewNotification = async (notificationId) => {
    const notification = notifications.find((n) => n._id === notificationId);
    setSelectedNotification(notification);

    // Mark as read if unread
    if (!notification.read) {
      try {
        await axiosWithAuth.patch(`/notifications/${notificationId}`, {
          read: true,
        });

        // Update local state
        setNotifications(
          notifications.map((n) =>
            n._id === notificationId ? { ...n, read: true } : n
          )
        );
      } catch (error) {
        console.error("Error marking notification as read:", error);
      }
    }
  };

  // Function to handle notification deletion
  const handleDeleteNotification = async (notificationId) => {
    try {
      await axiosWithAuth.delete(`/notifications/${notificationId}`);

      // Update notification list
      setNotifications(notifications.filter((n) => n._id !== notificationId));

      // Close modal if the deleted notification was being viewed
      if (selectedNotification && selectedNotification._id === notificationId) {
        setSelectedNotification(null);
      }
      toast.success("Notification deleted");
    } catch (error) {
      console.error("Error deleting notification:", error);
      toast.error("Failed to delete notification");
    }
  };


  // Function to close modal
  const handleCloseModal = () => {
    setSelectedNotification(null);
    setShowComposeModal(false);
    setSubmitStatus(null);
    setFormErrors({});
  };

  // Function to format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();

    // If today, show only time
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    // If this year, show month and day
    if (date.getFullYear() === now.getFullYear()) {
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    }

    // Otherwise show full date
    return date.toLocaleDateString();
  };

  return (
    <div className="col-span-full xl:col-span-6 bg-white dark:bg-gray-800 shadow-xs rounded-xl">
      <header className="px-5 py-4 border-b border-gray-100 dark:border-gray-700/60 flex justify-between items-center">
        <h2 className="font-semibold text-gray-800 dark:text-gray-100">
          Notifications
        </h2>
        <div className="flex space-x-2">
          <div className="relative">
            <select
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setCurrentPage(1); // Reset to first page on filter change
              }}
              className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 pl-3 pr-8 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">All notifications</option>
              <option value="read">Read</option>
              <option value="unread">Unread</option>
            </select>
          </div>
          <button
            onClick={() => setShowComposeModal(true)}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition duration-200"
          >
            Compose
          </button>
        </div>
      </header>

      <div className="p-3">
        {/* Loading indicator */}
        {loading ? (
          <div className="text-center py-4">
            <p className="text-gray-500 dark:text-gray-400">
              Loading notifications...
            </p>
          </div>
        ) : (
          <>
            {/* Notifications list */}
            <div className="overflow-y-auto max-h-96">
              {notifications && notifications.length > 0 ? (
                <ul className="divide-y divide-gray-100 dark:divide-gray-700/60">
                  {notifications.map((notification) => (
                    <li
                      key={notification._id}
                      className={`p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition duration-150 cursor-pointer ${
                        !notification.read
                          ? "bg-blue-50 dark:bg-blue-900/20"
                          : ""
                      }`}
                      onClick={() => handleViewNotification(notification._id)}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex items-start">
                          {/* Priority indicator */}
                          <div className="mr-3 mt-1">
                            {notification.priority === "urgent" && (
                              <span className="flex h-3 w-3">
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                              </span>
                            )}
                            {notification.priority === "high" && (
                              <span className="flex h-3 w-3">
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span>
                              </span>
                            )}
                            {notification.priority === "normal" && (
                              <span className="flex h-3 w-3">
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                              </span>
                            )}
                            {notification.priority === "low" && (
                              <span className="flex h-3 w-3">
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-gray-400"></span>
                              </span>
                            )}
                          </div>

                          <div className="flex-1 overflow-hidden">
                            <div className="flex items-center justify-between">
                              <p
                                className={`text-sm font-medium ${
                                  !notification.read
                                    ? "text-gray-900 dark:text-white"
                                    : "text-gray-600 dark:text-gray-300"
                                }`}
                              >
                                {notification.title}
                              </p>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                              {notification.message}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col items-end ml-2">
                          <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                            {formatDate(notification.createdAt)}
                          </span>
                          {!notification.read && (
                            <span className="mt-1 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                              New
                            </span>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500 dark:text-gray-400">
                    No notifications found
                  </p>
                  <button
                    onClick={() => setShowComposeModal(true)}
                    className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition duration-200"
                  >
                    Create Notification
                  </button>
                </div>
              )}
            </div>

            {/* Pagination - only show if there are multiple pages */}
            {notifications && notifications.length > 0 && totalPages > 1 && (
              <div className="flex justify-between items-center mt-4">
                <button
                  onClick={() => paginate(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition duration-200 disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => paginate(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition duration-200 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal for Notification Details */}
      {selectedNotification && (
        <div className="fixed inset-0 flex items-center justify-center backdrop-blur-sm z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg w-full max-w-lg shadow-lg">
            {/* Modal Header */}
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
                {selectedNotification.title}
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
              <div className="flex justify-between items-center text-sm text-gray-500 dark:text-gray-400">
                <div className="flex items-center space-x-2">
                  <span>
                    {new Date(selectedNotification.createdAt).toLocaleString()}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs ${
                      selectedNotification.priority === "urgent"
                        ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                        : selectedNotification.priority === "high"
                        ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
                        : selectedNotification.priority === "normal"
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                        : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                    }`}
                  >
                    {selectedNotification.priority.charAt(0).toUpperCase() +
                      selectedNotification.priority.slice(1)}
                  </span>
                </div>
                <div>
                  <span className="mr-2">
                    To: {selectedNotification.recipientType || "All"}
                  </span>
                </div>
              </div>

              <div className="border-t border-gray-100 dark:border-gray-700/60 pt-4">
                <div className="prose dark:prose-invert max-w-none">
                  <p className="text-gray-700 dark:text-gray-200 whitespace-pre-line">
                    {selectedNotification.message}
                  </p>
                </div>
              </div>

              {selectedNotification.attachment && (
                <div className="mt-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                    Attachment:
                  </p>
                  <div className="flex items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-md flex items-center justify-center text-blue-500 dark:text-blue-300 mr-3">
                      <span>📎</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                        {selectedNotification.attachment.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {selectedNotification.attachment.size}
                      </p>
                    </div>
                    <a
                      href="#"
                      className="ml-auto text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      Download
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="mt-6 flex justify-end space-x-2">
              <button
                onClick={() =>
                  handleDeleteNotification(selectedNotification._id)
                }
                className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition duration-200"
              >
                Delete
              </button>
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

      {/* Modal for Composing New Notification */}
      {showComposeModal && (
        <div className="fixed inset-0 flex items-center justify-center backdrop-blur-sm z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg w-full max-w-lg shadow-lg">
            {/* Modal Header */}
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
                Compose Notification
              </h3>
              <button
                onClick={handleCloseModal}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition duration-200"
              >
                &times;
              </button>
            </div>

            {/* Status Messages */}
            {submitStatus === "success" && (
              <div className="mb-4 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 p-3 rounded-md">
                Notification sent successfully!
              </div>
            )}

            {submitStatus === "error" && (
              <div className="mb-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 p-3 rounded-md">
                Failed to send notification. Please try again.
              </div>
            )}

            {/* Modal Body - Form */}
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    htmlFor="title"
                  >
                    Title
                  </label>
                  <input
                    type="text"
                    id="title"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    className={`w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 ${
                      formErrors.title
                        ? "border-red-500 dark:border-red-500"
                        : "border-gray-300"
                    }`}
                    placeholder="Enter notification title"
                  />
                  {formErrors.title && (
                    <p className="text-red-500 text-xs mt-1">
                      {formErrors.title}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                      htmlFor="recipientType"
                    >
                      Recipients
                    </label>
                    <select
                      id="recipientType"
                      name="recipientType"
                      value={formData.recipientType}
                      onChange={handleInputChange}
                      className="w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600"
                    >
                      <option value="all">All</option>
                      <option value="admins">Admins Only</option>
                      <option value="users">Users Only</option>
                      <option value="sellers">Sellers Only</option>
                    </select>
                  </div>

                  <div>
                    <label
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                      htmlFor="priority"
                    >
                      Priority
                    </label>
                    <select
                      id="priority"
                      name="priority"
                      value={formData.priority}
                      onChange={handleInputChange}
                      className="w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600"
                    >
                      <option value="low">Low</option>
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    htmlFor="message"
                  >
                    Message
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleInputChange}
                    rows="6"
                    className={`w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 ${
                      formErrors.message
                        ? "border-red-500 dark:border-red-500"
                        : "border-gray-300"
                    }`}
                    placeholder="Enter notification message..."
                  ></textarea>
                  {formErrors.message && (
                    <p className="text-red-500 text-xs mt-1">
                      {formErrors.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      <input type="file" className="hidden" />
                      <span className="px-3 py-2 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600 transition duration-200">
                        Attach File (Optional)
                      </span>
                    </span>
                  </label>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="mt-6 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitStatus === "submitting"}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition duration-200 disabled:opacity-50"
                >
                  {submitStatus === "submitting"
                    ? "Sending..."
                    : "Send Notification"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default MyNotificationPage;
