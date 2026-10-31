// FILE: models/ActivityLog.js
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const ActivityLogSchema = new Schema({
  adminId: {
    type: Schema.Types.ObjectId,
    ref: "Admin",
    required: true,
  },
  activity: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ["login", "logout", "update", "security", "report", "other"],
    default: "other",
  },
  ipAddress: {
    type: String,
  },
  device: {
    type: String,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

// Index for faster queries
ActivityLogSchema.index({ adminId: 1, timestamp: -1 });

module.exports = mongoose.model("ActivityLog", ActivityLogSchema);
