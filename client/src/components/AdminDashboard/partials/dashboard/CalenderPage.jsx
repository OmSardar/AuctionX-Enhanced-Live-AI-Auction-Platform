import React, { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import axiosWithAuth from "../../../../redux/slices/axiosWithAuth";
import { fetchCsrfToken } from "../../../../redux/slices/csrfSecuritySlice";
import { toast } from "react-hot-toast";

function CalendarPage() {
  const dispatch = useDispatch();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: "",
    date: new Date().toISOString().substr(0, 10),
    startTime: "09:00",
    endTime: "10:00",
    description: "",
    type: "auction",
  });

  useEffect(() => {
    dispatch(fetchCsrfToken());
  }, [dispatch]);

  // Fetch calendar events from the backend
  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      try {
        const response = await axiosWithAuth.get("/calendar");
        if (response.data && Array.isArray(response.data.data)) {
          setEvents(response.data.data);
        } else if (Array.isArray(response.data)) {
          setEvents(response.data);
        } else if (response.data && response.data.events) {
          setEvents(response.data.events);
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

    fetchEvents();
  }, []);

  // Generate days for the current month
  const generateCalendarDays = () => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();

    // First day of the month
    const firstDay = new Date(year, month, 1);
    // Last day of the month
    const lastDay = new Date(year, month + 1, 0);

    // Get the day of the week for the first day (0 = Sunday, 6 = Saturday)
    const firstDayOfWeek = firstDay.getDay();

    // Calculate the number of days needed from previous month to fill the first row
    const daysFromPrevMonth = firstDayOfWeek;

    // Total number of days in the current month
    const daysInMonth = lastDay.getDate();

    // Calculate needed days from next month to complete the grid
    // We'll use a 6-row calendar grid (6 x 7 = 42 cells)
    const totalCells = 42;
    const daysFromNextMonth = totalCells - daysInMonth - daysFromPrevMonth;

    // Previous month last day
    const prevMonthLastDay = new Date(year, month, 0).getDate();

    const calendarDays = [];

    // Add days from previous month
    for (
      let i = prevMonthLastDay - daysFromPrevMonth + 1;
      i <= prevMonthLastDay;
      i++
    ) {
      calendarDays.push({
        day: i,
        currentMonth: false,
        date: new Date(year, month - 1, i),
        events: getEventsForDate(new Date(year, month - 1, i)),
      });
    }

    // Add days from current month
    for (let i = 1; i <= daysInMonth; i++) {
      calendarDays.push({
        day: i,
        currentMonth: true,
        date: new Date(year, month, i),
        events: getEventsForDate(new Date(year, month, i)),
        today: isToday(new Date(year, month, i)),
      });
    }

    // Add days from next month
    for (let i = 1; i <= daysFromNextMonth; i++) {
      calendarDays.push({
        day: i,
        currentMonth: false,
        date: new Date(year, month + 1, i),
        events: getEventsForDate(new Date(year, month + 1, i)),
      });
    }

    return calendarDays;
  };

  // Check if a date is today
  const isToday = (date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  // Get events for a specific date
  const getEventsForDate = (date) => {
    return events.filter((event) => {
      if (!event || !event.date) return false;
      const eventDate = new Date(event.date);
      if (isNaN(eventDate.getTime())) return false;
      return (
        eventDate.getDate() === date.getDate() &&
        eventDate.getMonth() === date.getMonth() &&
        eventDate.getFullYear() === date.getFullYear()
      );
    });
  };

  // Handle month navigation
  const navigateMonth = (direction) => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(newDate.getMonth() + direction);
    setSelectedDate(newDate);
  };

  // Handle viewing event details
  const handleViewEvent = (event) => {
    setSelectedEvent(event);
  };

  // Handle closing event modal
  const handleCloseEventModal = () => {
    setSelectedEvent(null);
  };

  // Handle deleting event
  const handleDeleteEvent = async () => {
    if (!selectedEvent || !selectedEvent._id) return;
    try {
      await axiosWithAuth.delete(`/calendar/${selectedEvent._id}`);
      setEvents((prev) => prev.filter((e) => e._id !== selectedEvent._id));
      toast.success("Event deleted successfully");
      handleCloseEventModal();
    } catch (err) {
      console.error("Error deleting event:", err);
      toast.error(
        err.response?.data?.message || "Failed to delete event. Please try again."
      );
    }
  };

  // Handle showing add event modal
  const handleShowAddEventModal = (date) => {
    // If a date is provided, set it as the new event date
    if (date) {
      setNewEvent({
        ...newEvent,
        date: date.toISOString().substr(0, 10),
      });
    }
    setShowAddEventModal(true);
  };

  // Handle closing add event modal
  const handleCloseAddEventModal = () => {
    setShowAddEventModal(false);
    // Reset form
    setNewEvent({
      title: "",
      date: new Date().toISOString().substr(0, 10),
      startTime: "09:00",
      endTime: "10:00",
      description: "",
      type: "auction",
    });
  };

  // Handle input change for new event
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewEvent({
      ...newEvent,
      [name]: value,
    });
  };

  // Handle submitting new event
  // Update your handleSubmitEvent function
  const handleSubmitEvent = async (e) => {
    e.preventDefault();
    try {
      // Format the data to match backend expectations
      const eventData = {
        title: newEvent.title,
        date: newEvent.date, // Should be in YYYY-MM-DD format
        startTime: newEvent.startTime, // Should be in HH:MM format
        endTime: newEvent.endTime, // Should be in HH:MM format
        description: newEvent.description,
        type: newEvent.type,
        location: newEvent.location || "", // Add if you have location field
      };

      // Make sure to use the correct endpoint
      const response = await axiosWithAuth.post(
        "/calendar",
        eventData,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      // Add the new event to the events list
      const savedEntry = response.data?.data || response.data;
      if (savedEntry) {
        setEvents((prev) => [...prev, savedEntry]);
      }
      toast.success("Event added successfully");
      // Close modal
      handleCloseAddEventModal();
    } catch (err) {
      console.error("Error adding event:", err);
      if (err.response) {
        // Backend returned an error response
        toast.error(
          `Failed to add event: ${
            err.response.data?.message || err.response.statusText
          }`
        );
      } else {
        toast.error("Failed to add event. Please check your connection.");
      }
    }
  };

  // Day names for calendar header
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Month names for navigation
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  return (
    <div className="col-span-full bg-white dark:bg-gray-800 shadow-xs rounded-xl">
      <header className="px-5 py-4 border-b border-gray-100 dark:border-gray-700/60 flex justify-between items-center">
        <h2 className="font-semibold text-gray-800 dark:text-gray-100">
          Calendar
        </h2>
        <button
          onClick={() => handleShowAddEventModal()}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition duration-200"
        >
          Add Event
        </button>
      </header>

      <div className="p-3">
        {/* Calendar Navigation */}
        <div className="flex justify-between items-center mb-4">
          <button
            onClick={() => navigateMonth(-1)}
            className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition duration-200"
          >
            &lt; Prev
          </button>
          <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
            {monthNames[selectedDate.getMonth()]} {selectedDate.getFullYear()}
          </h3>
          <button
            onClick={() => navigateMonth(1)}
            className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition duration-200"
          >
            Next &gt;
          </button>
        </div>

        {/* Loading indicator */}
        {loading ? (
          <div className="text-center py-4">
            <p className="text-gray-500 dark:text-gray-400">
              Loading calendar...
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {/* Day headers */}
            {dayNames.map((day) => (
              <div
                key={day}
                className="h-10 flex items-center justify-center bg-gray-100 dark:bg-gray-700 font-semibold text-sm text-gray-600 dark:text-gray-300"
              >
                {day}
              </div>
            ))}

            {/* Calendar days */}
            {generateCalendarDays().map((day, index) => (
              <div
                key={index}
                className={`min-h-24 border border-gray-200 dark:border-gray-700 p-1 ${
                  day.currentMonth
                    ? "bg-white dark:bg-gray-800"
                    : "bg-gray-50 dark:bg-gray-900/60 text-gray-400 dark:text-gray-500"
                } ${
                  day.today ? "ring-2 ring-blue-400 dark:ring-blue-600" : ""
                }`}
                onClick={() => handleShowAddEventModal(day.date)}
              >
                <div className="flex justify-between">
                  <span className="text-sm font-medium">{day.day}</span>
                  {day.events.length > 0 && (
                    <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-1 rounded-full">
                      {day.events.length}
                    </span>
                  )}
                </div>
                <div className="mt-1 space-y-1">
                  {day.events.slice(0, 2).map((event, eventIndex) => (
                    <div
                      key={eventIndex}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewEvent(event);
                      }}
                      className={`text-xs p-1 rounded truncate ${
                        event.type === "auction"
                          ? "bg-green-100 dark:bg-green-900/60 text-green-800 dark:text-green-200"
                          : "bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-200"
                      }`}
                    >
                      {event.title}
                    </div>
                  ))}
                  {day.events.length > 2 && (
                    <div
                      className="text-xs text-gray-500 dark:text-gray-400 cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        // You could show a modal with all events for this day
                      }}
                    >
                      + {day.events.length - 2} more
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal for Event Details */}
      {selectedEvent && (
        <div className="fixed inset-0 flex items-center justify-center backdrop-blur-sm z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg w-full max-w-md shadow-lg">
            {/* Modal Header */}
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
                Event Details
              </h3>
              <button
                onClick={handleCloseEventModal}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition duration-200"
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div
                  className={`w-3 h-3 rounded-full ${
                    selectedEvent.type === "auction"
                      ? "bg-green-500"
                      : "bg-purple-500"
                  }`}
                ></div>
                <div>
                  <p className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                    {selectedEvent.title}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {new Date(selectedEvent.date).toLocaleDateString()} |{" "}
                    {selectedEvent.startTime} - {selectedEvent.endTime}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                  Description
                </p>
                <p className="text-sm text-gray-800 dark:text-gray-100 p-3 bg-gray-100 dark:bg-gray-700 rounded-md">
                  {selectedEvent.description || "No description provided."}
                </p>
              </div>

              {selectedEvent.location && (
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                    Location
                  </p>
                  <p className="text-sm text-gray-800 dark:text-gray-100">
                    {selectedEvent.location}
                  </p>
                </div>
              )}

              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                  Event Type
                </p>
                <p
                  className={`inline-block px-2 py-1 rounded-full text-xs ${
                    selectedEvent.type === "auction"
                      ? "bg-green-100 text-green-800 dark:bg-green-900/60 dark:text-green-200"
                      : "bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-200"
                  }`}
                >
                  {selectedEvent.type.charAt(0).toUpperCase() +
                    selectedEvent.type.slice(1)}
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="mt-6 flex justify-between items-center">
              <button
                type="button"
                onClick={handleDeleteEvent}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-md transition duration-200"
              >
                Delete Event
              </button>
              <button
                type="button"
                onClick={handleCloseEventModal}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm font-medium rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition duration-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal for Adding Event */}
      {showAddEventModal && (
        <div className="fixed inset-0 flex items-center justify-center backdrop-blur-sm z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg w-full max-w-md shadow-lg">
            {/* Modal Header */}
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
                Add New Event
              </h3>
              <button
                onClick={handleCloseAddEventModal}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition duration-200"
              >
                &times;
              </button>
            </div>

            {/* Modal Body - Event Form */}
            <form onSubmit={handleSubmitEvent}>
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="title"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Event Title
                  </label>
                  <input
                    type="text"
                    id="title"
                    name="title"
                    value={newEvent.title}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="date"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Event Date
                  </label>
                  <input
                    type="date"
                    id="date"
                    name="date"
                    value={newEvent.date}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="startTime"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      Start Time
                    </label>
                    <input
                      type="time"
                      id="startTime"
                      name="startTime"
                      value={newEvent.startTime}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      required
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="endTime"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      End Time
                    </label>
                    <input
                      type="time"
                      id="endTime"
                      name="endTime"
                      value={newEvent.endTime}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="type"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Event Type
                  </label>
                  <select
                    id="type"
                    name="type"
                    value={newEvent.type}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    <option value="auction">Auction</option>
                    <option value="meeting">Meeting</option>
                    <option value="appointment">Appointment</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="description"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Description
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    value={newEvent.description}
                    onChange={handleInputChange}
                    rows="3"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  ></textarea>
                </div>

                <div>
                  <label
                    htmlFor="location"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Location (Optional)
                  </label>
                  <input
                    type="text"
                    id="location"
                    name="location"
                    value={newEvent.location || ""}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={handleCloseAddEventModal}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#C65D3A] text-white rounded-md hover:bg-[#B04E2E] transition duration-200"
                >
                  Save Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default CalendarPage;
