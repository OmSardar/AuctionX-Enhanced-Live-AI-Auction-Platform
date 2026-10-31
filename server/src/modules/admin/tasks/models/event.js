const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    eventType: {
      type: String,
      required: true,
      enum: ["sale", "auction", "contest", "holiday", "maintenance", "other"],
      default: "sale",
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    backgroundColor: {
      type: String,
      default: "#3B82F6", // Default blue
    },
    textColor: {
      type: String,
      default: "#FFFFFF", // Default white
    },
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    notifyUsers: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      // required: true
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
eventSchema.index({ startDate: 1 });
eventSchema.index({ endDate: 1 });
eventSchema.index({ isActive: 1 });
eventSchema.index({ eventType: 1 });

const Event = mongoose.model("Event", eventSchema);

module.exports = Event;
