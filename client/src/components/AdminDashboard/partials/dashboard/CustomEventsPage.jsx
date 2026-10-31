import React, { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import axiosWithAuth from "../../../../redux/slices/axiosWithAuth";
import { fetchCsrfToken } from "../../../../redux/slices/csrfSecuritySlice";

function CustomEvents() {
  const dispatch = useDispatch();

  // State for events data
  const [events, setEvents] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const eventsPerPage = 5;

  // Selected event for editing/viewing
  const [selectedEvent, setSelectedEvent] = useState(null);

  // Form data for creating/editing events
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    eventType: "sale", // Default type
    startDate: "",
    endDate: "",
    isActive: true,
    backgroundColor: "#3B82F6", // Default blue color
    textColor: "#FFFFFF", // Default white color
    participants: [], // Empty array for participants
    notifyUsers: false, // Do not notify users by default
  });

  // UI states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });

  useEffect(() => {
    dispatch(fetchCsrfToken());
  }, [dispatch]);

  // Fetch events on component mount and when page changes
  useEffect(() => {
    fetchEvents();
  }, [currentPage]);

  // Function to fetch events from the API
  const fetchEvents = async () => {
    setLoading(true);
    try {
      const response = await axiosWithAuth.get(
        `/events?page=${currentPage}&limit=${eventsPerPage}`
      );

      if (Array.isArray(response.data)) {
        setEvents(response.data);
        setTotalPages(Math.ceil(response.data.length / eventsPerPage));
      } else if (response.data && response.data.events) {
        setEvents(response.data.events);
        setTotalPages(response.data.totalPages || 1);
      } else {
        console.error("Invalid response format:", response.data);
        setEvents([]);
      }
    } catch (err) {
      console.error("Error fetching events:", err);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  // Reset form to default values
  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      eventType: "sale",
      startDate: "",
      endDate: "",
      isActive: true,
      backgroundColor: "#3B82F6",
      textColor: "#FFFFFF",
      participants: [],
      notifyUsers: false,
    });
    setIsEditMode(false);
    setSelectedEvent(null);
  };

  // Handle opening the form for adding a new event
  const handleAddEvent = () => {
    resetForm();
    setIsFormOpen(true);
  };

  // Handle opening the form for editing an existing event
  const handleEditEvent = (event) => {
    setFormData({
      title: event.title,
      description: event.description || "",
      eventType: event.eventType || "sale",
      startDate: event.startDate
        ? new Date(event.startDate).toISOString().split("T")[0]
        : "",
      endDate: event.endDate
        ? new Date(event.endDate).toISOString().split("T")[0]
        : "",
      isActive: event.isActive !== undefined ? event.isActive : true,
      backgroundColor: event.backgroundColor || "#3B82F6",
      textColor: event.textColor || "#FFFFFF",
      participants: event.participants || [],
      notifyUsers: event.notifyUsers || false,
    });
    setSelectedEvent(event);
    setIsEditMode(true);
    setIsFormOpen(true);
  };

  // Handle view event details
  const handleViewEvent = (event) => {
    setSelectedEvent(event);
  };

  // Handle closing the event details modal
  const handleCloseModal = () => {
    setSelectedEvent(null);
  };

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  // Handle form submission (create or update)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ text: "", type: "" });

    try {
      if (isEditMode && selectedEvent) {
        // Update existing event
        await axiosWithAuth.put(`/events/${selectedEvent._id}`, formData);
        setMessage({ text: "Event updated successfully!", type: "success" });
      } else {
        // Create new event
        await axiosWithAuth.post("/events", formData);
        setMessage({ text: "Event created successfully!", type: "success" });
      }

      // Refresh events list and close form
      fetchEvents();
      setIsFormOpen(false);
      resetForm();
    } catch (err) {
      console.error("Error saving event:", err);
      setMessage({
        text: err.response?.data?.message || "Failed to save event",
        type: "error",
      });
    }
  };

  // Handle event deletion
  const handleDeleteEvent = async (eventId) => {
    if (window.confirm("Are you sure you want to delete this event?")) {
      try {
        await axiosWithAuth.delete(`/events/${eventId}`);
        setEvents(events.filter((event) => event._id !== eventId));
        setMessage({ text: "Event deleted successfully!", type: "success" });
      } catch (err) {
        console.error("Error deleting event:", err);
        setMessage({
          text: err.response?.data?.message || "Failed to delete event",
          type: "error",
        });
      }
    }
  };

  // Function to handle pagination
  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  // Helper function to format date nicely
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString();
  };

  // Helper function to get event type badge color
  const getEventTypeColor = (type) => {
    switch (type) {
      case "sale":
        return "bg-blue-100 text-blue-800 dark:bg-blue-800/20 dark:text-blue-400";
      case "auction":
        return "bg-purple-100 text-purple-800 dark:bg-purple-800/20 dark:text-purple-400";
      case "contest":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-800/20 dark:text-yellow-400";
      case "holiday":
        return "bg-green-100 text-green-800 dark:bg-green-800/20 dark:text-green-400";
      case "maintenance":
        return "bg-red-100 text-red-800 dark:bg-red-800/20 dark:text-red-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
    }
  };

  return (
    <div className="col-span-full xl:col-span-6 bg-white dark:bg-gray-800 shadow-xs rounded-xl">
      <header className="px-5 py-4 border-b border-gray-100 dark:border-gray-700/60">
        <h2 className="font-semibold text-lg text-gray-800 dark:text-gray-100">
          Custom Events Management
        </h2>
      </header>

      <div className="p-5">
        {/* Status message */}
        {message.text && (
          <div
            className={`mb-4 p-3 rounded ${
              message.type === "success"
                ? "bg-green-100 text-green-700 dark:bg-green-800/20 dark:text-green-400"
                : "bg-red-100 text-red-700 dark:bg-red-800/20 dark:text-red-400"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Add Event Button */}
        <div className="mb-4">
          <button
            onClick={handleAddEvent}
            className="px-4 py-2 bg-blue-500 text-white rounded-md shadow-sm hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-200"
          >
            Add New Event
          </button>
        </div>

        {/* Event Form (Add/Edit) */}
        {isFormOpen && (
          <div className="mb-8 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
            <h3 className="text-md font-semibold mb-4 text-gray-800 dark:text-gray-100">
              {isEditMode ? "Edit Event" : "Create New Event"}
            </h3>

            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Event Title
                  </label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    required
                  />
                </div>

                {/* Event Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Event Type
                  </label>
                  <select
                    name="eventType"
                    value={formData.eventType}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="sale">Sale</option>
                    <option value="auction">Auction</option>
                    <option value="contest">Contest</option>
                    <option value="holiday">Holiday</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                {/* Description */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows="3"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  ></textarea>
                </div>

                {/* Start Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    name="startDate"
                    value={formData.startDate}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    required
                  />
                </div>

                {/* End Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    name="endDate"
                    value={formData.endDate}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>

                {/* Background Color */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Background Color
                  </label>
                  <div className="flex items-center">
                    <input
                      type="color"
                      name="backgroundColor"
                      value={formData.backgroundColor}
                      onChange={handleInputChange}
                      className="w-10 h-10 rounded-md cursor-pointer"
                    />
                    <span className="ml-2 text-sm text-gray-600 dark:text-gray-300">
                      {formData.backgroundColor}
                    </span>
                  </div>
                </div>

                {/* Text Color */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Text Color
                  </label>
                  <div className="flex items-center">
                    <input
                      type="color"
                      name="textColor"
                      value={formData.textColor}
                      onChange={handleInputChange}
                      className="w-10 h-10 rounded-md cursor-pointer"
                    />
                    <span className="ml-2 text-sm text-gray-600 dark:text-gray-300">
                      {formData.textColor}
                    </span>
                  </div>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Status
                  </label>
                  <div className="mt-1">
                    <label className="inline-flex items-center">
                      <input
                        type="checkbox"
                        name="isActive"
                        checked={formData.isActive}
                        onChange={handleInputChange}
                        className="rounded border-gray-300 text-blue-500 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                      />
                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                        Active Event
                      </span>
                    </label>
                  </div>
                </div>

                {/* Notify Users */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Notifications
                  </label>
                  <div className="mt-1">
                    <label className="inline-flex items-center">
                      <input
                        type="checkbox"
                        name="notifyUsers"
                        checked={formData.notifyUsers}
                        onChange={handleInputChange}
                        className="rounded border-gray-300 text-blue-500 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                      />
                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                        Notify Users
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Form Actions */}
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsFormOpen(false);
                    resetForm();
                  }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  {isEditMode ? "Update Event" : "Create Event"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Events Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex justify-center items-center py-10">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-6 text-gray-500 dark:text-gray-400">
              No events found. Create your first event!
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                  >
                    Title
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                  >
                    Type
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                  >
                    Dates
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                  >
                    Status
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {events.map((event) => (
                  <tr
                    key={event._id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div
                          className="flex-shrink-0 h-4 w-4 rounded-full"
                          style={{ backgroundColor: event.backgroundColor }}
                        ></div>
                        <div className="ml-4">
                          <div
                            className="text-sm font-medium text-gray-900 dark:text-white"
                            style={{ color: event.textColor }}
                          >
                            {event.title}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">
                            {event.description}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getEventTypeColor(
                          event.eventType
                        )}`}
                      >
                        {event.eventType}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      <div>Start: {formatDate(event.startDate)}</div>
                      <div>End: {formatDate(event.endDate) || "N/A"}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          event.isActive
                            ? "bg-green-100 text-green-800 dark:bg-green-800/20 dark:text-green-400"
                            : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                        }`}
                      >
                        {event.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleViewEvent(event)}
                        className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 mr-3"
                      >
                        View
                      </button>
                      <button
                        onClick={() => handleEditEvent(event)}
                        className="text-indigo-500 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 mr-3"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteEvent(event._id)}
                        className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-4 flex justify-center">
            <nav
              className="inline-flex rounded-md shadow-sm -space-x-px"
              aria-label="Pagination"
            >
              <button
                onClick={() => paginate(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className={`px-3 py-2 rounded-l-md border border-gray-300 dark:border-gray-600 text-sm font-medium ${
                  currentPage === 1
                    ? "bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500 cursor-not-allowed"
                    : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
              >
                Previous
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                (number) => (
                  <button
                    key={number}
                    onClick={() => paginate(number)}
                    className={`px-3 py-2 border-t border-b border-gray-300 dark:border-gray-600 text-sm font-medium ${
                      currentPage === number
                        ? "bg-blue-500 text-white dark:bg-blue-600"
                        : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                    }`}
                  >
                    {number}
                  </button>
                )
              )}
              <button
                onClick={() => paginate(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className={`px-3 py-2 rounded-r-md border border-gray-300 dark:border-gray-600 text-sm font-medium ${
                  currentPage === totalPages
                    ? "bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500 cursor-not-allowed"
                    : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
              >
                Next
              </button>
            </nav>
          </div>
        )}
      </div>

      {/* Event Details Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Event Details
                </h3>
                <button
                  onClick={handleCloseModal}
                  className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                >
                  <span className="sr-only">Close</span>
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              <div className="mt-4 space-y-4">
                <div>
                  <h4
                    className="text-xl font-medium"
                    style={{
                      color: selectedEvent.textColor,
                      backgroundColor: selectedEvent.backgroundColor,
                      padding: "0.5rem",
                      borderRadius: "0.25rem",
                    }}
                  >
                    {selectedEvent.title}
                  </h4>
                </div>

                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Type
                  </p>
                  <p className="mt-1">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getEventTypeColor(
                        selectedEvent.eventType
                      )}`}
                    >
                      {selectedEvent.eventType}
                    </span>
                  </p>
                </div>

                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Description
                  </p>
                  <p className="mt-1 text-gray-700 dark:text-gray-300">
                    {selectedEvent.description || "No description provided"}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Start Date
                    </p>
                    <p className="mt-1 text-gray-700 dark:text-gray-300">
                      {formatDate(selectedEvent.startDate)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      End Date
                    </p>
                    <p className="mt-1 text-gray-700 dark:text-gray-300">
                      {formatDate(selectedEvent.endDate) || "N/A"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Status
                    </p>
                    <p className="mt-1">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          selectedEvent.isActive
                            ? "bg-green-100 text-green-800 dark:bg-green-800/20 dark:text-green-400"
                            : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                        }`}
                      >
                        {selectedEvent.isActive ? "Active" : "Inactive"}
                      </span>
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Participants
                    </p>
                    <p className="mt-1 text-gray-700 dark:text-gray-300">
                      {selectedEvent.participants?.length > 0
                        ? selectedEvent.participants.join(", ")
                        : "No participants"}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Colors
                  </p>
                  <div className="mt-1 flex space-x-4">
                    <div className="flex items-center">
                      <div
                        className="w-6 h-6 rounded-md mr-2 border border-gray-300 dark:border-gray-600"
                        style={{
                          backgroundColor: selectedEvent.backgroundColor,
                        }}
                      ></div>
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        Background: {selectedEvent.backgroundColor}
                      </span>
                    </div>
                    <div className="flex items-center">
                      <div
                        className="w-6 h-6 rounded-md mr-2 border border-gray-300 dark:border-gray-600"
                        style={{ backgroundColor: selectedEvent.textColor }}
                      ></div>
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        Text: {selectedEvent.textColor}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={handleCloseModal}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CustomEvents;
