const mongoose = require("mongoose");

// Custom validator to check for empty strings
const nonEmptyString = {
  validator: function (value) {
    return value && value.trim().length > 0;
  },
  message: "Field cannot be empty or contain only whitespace",
};

const reportSchema = new mongoose.Schema({
  userName: {
    type: String,
    required: [true, "User name is required"],
    validate: nonEmptyString,
  },
  userEmail: {
    type: String,
    required: [true, "User email is required"],
    validate: [
      nonEmptyString,
      {
        validator: function (email) {
          return /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(email);
        },
        message: "Please enter a valid email address",
      },
    ],
  },
  reportType: {
    type: String,
    required: [true, "Report type is required"],
    validate: nonEmptyString,
    enum: {
      values: [
        "delivery",
        "illegal",
        "payment-deposit",
        "payment-withdraw",
        "other",
      ],
      message:
        "Report type must be one of: delivery, illegal, payment-deposit, payment-withdraw, other",
    },
  },
  orderId: {
    type: String,
    required: false, // Made optional since it's optional in the form
    validate: {
      validator: function (value) {
        // Only validate if value is provided
        return !value || value.trim().length > 0;
      },
      message: "Order ID cannot be empty if provided",
    },
  },
  report: {
    type: String,
    required: [true, "Report details are required"],
    validate: nonEmptyString,
    minlength: [10, "Report details must be at least 10 characters long"],
  },
  date: {
    type: Date,
    default: Date.now,
  },
  attachments: [
    {
      secure_url: { type: String, required: true },
      public_id: { type: String, required: true },
    },
  ], // Changed to array to handle multiple attachments
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    default: null,
    index: true,
  },
  sellerEmail: {
    type: String,
    default: null,
    index: true,
  },
  reason: {
    type: String,
    default: "",
  },
  customReason: {
    type: String,
    default: "",
  },
  resolutionNote: {
    type: String,
    default: "",
  },
  resolvedBy: {
    type: String,
    default: null,
  },
  resolvedAt: {
    type: Date,
    default: null,
  },
  status: {
    type: String,
    enum: ["pending", "in-progress", "resolved", "closed", "rejected"],
    default: "pending",
    index: true,
  },
});

reportSchema.index({ status: 1, date: -1 });
reportSchema.index({ productId: 1, date: -1 });

// Pre-save middleware to trim strings and remove empty fields
reportSchema.pre("save", function (next) {
  // Trim string fields
  if (this.userName) this.userName = this.userName.trim();
  if (this.userEmail) this.userEmail = this.userEmail.trim();
  if (this.reportType) this.reportType = this.reportType.trim();
  if (this.orderId) this.orderId = this.orderId.trim();
  if (this.report) this.report = this.report.trim();

  // Remove orderId if it's empty
  if (!this.orderId || this.orderId === "") {
    this.orderId = undefined;
  }

  next();
});

module.exports = mongoose.model("ReportAdmin", reportSchema);
