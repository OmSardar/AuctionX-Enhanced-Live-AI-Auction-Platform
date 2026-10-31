// FILE: models/Admin.js
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const AdminSchema = new Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please enter a valid email address",
      ],
    },
    phone: {
      type: String,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
    },
    role: {
      type: String,
      enum: ["super-admin", "admin", "editor"],
      default: "admin",
    },
    status: {
      type: String,
      enum: ["Active", "Suspended"],
      default: "Active",
      index: true,
    },
    suspensionReason: {
      type: String,
      default: "",
    },
    statusChangedAt: {
      type: Date,
      default: null,
    },
    statusChangedBy: {
      type: String,
      default: null,
    },
    avatar: {
      type: String,
      default: "/default-avatar.png",
    },
    joinDate: {
      type: Date,
      default: Date.now,
    },
    lastLogin: {
      type: Date,
      default: Date.now,
    },
    passwordChangedAt: {
      type: Date,
    },
    notificationPreferences: {
      emailAlerts: {
        type: Boolean,
        default: true,
      },
      loginAlerts: {
        type: Boolean,
        default: true,
      },
      systemUpdates: {
        type: Boolean,
        default: false,
      },
      weeklyReports: {
        type: Boolean,
        default: true,
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Admin", AdminSchema);
