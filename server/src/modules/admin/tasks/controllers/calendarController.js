const Calendar = require("../models/calendar");

// Helper function to validate date
const isValidDate = (dateString) => {
  const date = new Date(dateString);
  return !isNaN(date.getTime());
};

exports.isValidDate = isValidDate;

exports.createCalendarEntry = async (req, res) => {
  try {
    const { title, date, startTime, endTime, description, type, location } =
      req.body;

    // Validate required fields
    if (!title || !date || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: "Title, date, startTime, and endTime are required fields",
      });
    }

    // Validate date format
    if (!isValidDate(date)) {
      return res.status(400).json({ success: false, message: "Invalid date format" });
    }

    // Create new calendar entry
    const newEntry = new Calendar({
      title,
      date: new Date(date),
      startTime,
      endTime,
      description: description || "",
      type: type || "auction",
      location: location || "",
    });

    await newEntry.validate();
    const savedEntry = await newEntry.save();

    return res.status(201).json({
      success: true,
      data: savedEntry,
    });
  } catch (err) {
    console.error("Error creating calendar entry:", err);

    if (err.name === "ValidationError") {
      const errors = Object.values(err.errors).map((val) => val.message);
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server error creating calendar entry",
    });
  }
};

exports.getAllCalendarEntries = async (req, res) => {
  try {
    const entries = await Calendar.find().sort({ date: 1, startTime: 1 });
    res.status(200).json({
      success: true,
      count: entries.length,
      data: entries,
    });
  } catch (err) {
    console.error("Error fetching calendar entries:", err);
    res.status(500).json({
      success: false,
      message: "Server error fetching calendar entries",
    });
  }
};

exports.updateCalendarEntry = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, date, startTime, endTime, description, type, location } = req.body;

    if (date && !isValidDate(date)) {
      return res.status(400).json({ success: false, message: "Invalid date format" });
    }

    const updates = {};
    if (title) updates.title = title;
    if (date) updates.date = new Date(date);
    if (startTime) updates.startTime = startTime;
    if (endTime) updates.endTime = endTime;
    if (description !== undefined) updates.description = description;
    if (type) updates.type = type;
    if (location !== undefined) updates.location = location;

    const updated = await Calendar.findByIdAndUpdate(id, updates, { new: true });
    if (!updated) {
      return res.status(404).json({ success: false, message: "Calendar entry not found" });
    }

    res.status(200).json({
      success: true,
      data: updated,
      message: "Calendar entry updated successfully",
    });
  } catch (err) {
    console.error("Error updating calendar entry:", err);
    res.status(500).json({ success: false, message: "Server error updating calendar entry" });
  }
};

exports.deleteCalendarEntry = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Calendar.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ success: false, message: "Calendar entry not found" });
    }

    res.status(200).json({
      success: true,
      message: "Calendar entry deleted successfully",
    });
  } catch (err) {
    console.error("Error deleting calendar entry:", err);
    res.status(500).json({ success: false, message: "Server error deleting calendar entry" });
  }
};
