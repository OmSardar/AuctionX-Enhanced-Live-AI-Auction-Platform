const mongoose = require("mongoose");

const calendarSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
    },
    date: {
      type: Date,
      required: [true, "Date is required"],
      validate: {
        validator: function (value) {
          return !isNaN(value.getTime());
        },
        message: "Invalid date format",
      },
    },
    startTime: {
      type: String,
      required: [true, "Start time is required"],
      match: [
        /^([01]\d|2[0-3]):([0-5]\d)$/,
        "Please use HH:MM format in 24-hour time",
      ],
    },
    endTime: {
      type: String,
      required: [true, "End time is required"],
      match: [
        /^([01]\d|2[0-3]):([0-5]\d)$/,
        "Please use HH:MM format in 24-hour time",
      ],
      validate: {
        validator: function (value) {
          if (!this.startTime) return true;
          return value > this.startTime;
        },
        message: "End time must be after start time",
      },
    },
    description: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      enum: {
        values: ["auction", "meeting", "appointment", "other"],
        message: "{VALUE} is not a valid event type",
      },
      default: "auction",
    },
    location: {
      type: String,
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  }
);

// Remove any duplicate indexes if they exist
// calendarSchema.index({ title: 'text' }); // Example index, uncomment if needed

module.exports = mongoose.model("Calendar", calendarSchema);
