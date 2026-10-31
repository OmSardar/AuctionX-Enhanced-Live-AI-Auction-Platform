const express = require("express");
const router = express.Router();
const calendarController = require("../controllers/calendarController");
const Calendar = require("../models/calendar");
const adminAuthMiddleware = require("../../authentication/middleware/authAdminMiddleware");

// Enforce admin authentication on calendar routes
router.use(adminAuthMiddleware);

// Create a new calendar entry
router.post("/", calendarController.createCalendarEntry);

// Get all calendar entries
router.get("/", calendarController.getAllCalendarEntries);

// Update a calendar entry
router.put("/:id", calendarController.updateCalendarEntry);

// Delete a calendar entry
router.delete("/:id", calendarController.deleteCalendarEntry);

// Get calendar entries for a specific date
router.get("/date/:date", async (req, res) => {
  try {
    if (!calendarController.isValidDate(req.params.date)) {
      return res.status(400).json({ message: "Invalid date format" });
    }

    const entries = await Calendar.find({
      date: new Date(req.params.date),
    }).sort({ startTime: 1 });

    res.status(200).json({
      success: true,
      count: entries.length,
      data: entries,
    });
  } catch (err) {
    console.error("Error fetching entries by date:", err);
    res.status(500).json({
      success: false,
      message: "Server error fetching entries by date",
    });
  }
});

module.exports = router;
