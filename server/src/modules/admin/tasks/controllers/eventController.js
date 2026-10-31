const Event = require("../models/event");
const User = require("../../../users/models/user");

// Get all events with pagination
const getAllEvents = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const skip = (page - 1) * limit;

    const events = await Event.find()
      .sort({ startDate: 1 })
      .skip(skip)
      .limit(limit)
      .populate("participants", "name email")
      .lean();

    const totalEvents = await Event.countDocuments();
    const totalPages = Math.ceil(totalEvents / limit);

    res.json({
      success: true,
      events,
      totalPages,
      currentPage: page,
    });
  } catch (err) {
    console.error("Error fetching events:", err);
    res.status(500).json({
      success: false,
      message: "Server error while fetching events",
    });
  }
};

// Create a new event
const createEvent = async (req, res) => {
  try {
    console.log("Request body:", req.body); // Add this line

    const {
      title,
      description,
      eventType,
      startDate,
      endDate,
      isActive,
      backgroundColor,
      textColor,
      participants,
      notifyUsers,
    } = req.body;

    // Add validation logging
    console.log("StartDate:", startDate, "EndDate:", endDate);
    if (new Date(startDate) >= new Date(endDate)) {
      console.log("Date validation failed");
      return res.status(400).json({
        success: false,
        message: "End date must be after start date",
      });
    }

    const eventData = {
      title,
      description,
      eventType,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      isActive,
      backgroundColor,
      textColor,
      participants: participants || [],
      notifyUsers: notifyUsers || false,
      createdBy: req.user?._id || null, // Make this optional for debugging
    };

    console.log("Event data to save:", eventData); // Add this line

    const event = new Event(eventData);
    await event.save();

    console.log("Event saved successfully:", event); // Add this line

    res.status(201).json({
      success: true,
      event,
      message: "Event created successfully",
    });
  } catch (err) {
    console.error("Detailed error creating event:", {
      message: err.message,
      stack: err.stack,
      errors: err.errors, // Mongoose validation errors
    });
    res.status(500).json({
      success: false,
      message: "Server error while creating event",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

// Update an event
const updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Validate dates if both are provided
    if (updates.startDate && updates.endDate) {
      if (new Date(updates.startDate) >= new Date(updates.endDate)) {
        return res.status(400).json({
          success: false,
          message: "End date must be after start date",
        });
      }
    }

    const event = await Event.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    res.json({
      success: true,
      event,
      message: "Event updated successfully",
    });
  } catch (err) {
    console.error("Error updating event:", err);
    res.status(500).json({
      success: false,
      message: "Server error while updating event",
    });
  }
};

// Delete an event
const deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const event = await Event.findByIdAndDelete(id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    res.json({
      success: true,
      message: "Event deleted successfully",
    });
  } catch (err) {
    console.error("Error deleting event:", err);
    res.status(500).json({
      success: false,
      message: "Server error while deleting event",
    });
  }
};

// Get single event
const getEventById = async (req, res) => {
  try {
    const { id } = req.params;
    const event = await Event.findById(id).populate(
      "participants",
      "name email"
    );

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    res.json({
      success: true,
      event,
    });
  } catch (err) {
    console.error("Error fetching event:", err);
    res.status(500).json({
      success: false,
      message: "Server error while fetching event",
    });
  }
};

// Export them correctly (using module.exports)
module.exports = {
  getAllEvents,
  createEvent,
  getEventById,
  updateEvent,
  deleteEvent,
};
