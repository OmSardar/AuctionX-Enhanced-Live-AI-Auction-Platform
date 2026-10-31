const mongoose = require("mongoose");

// Define the user schema
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    role: {
      type: String,
      enum: ["admin", "user"],
      default: "user",
    },
    isOAuthUser: {
      type: Boolean,
      default: false,
      index: true,
    },
    password: {
      type: String,
      required: function () {
        // OAuth users do not have a local password
        if (this.isOAuthUser || (this.googlePhoto && this.googlePhoto.length > 0)) {
          return false;
        }
        // Existing records created without a password should never fail validation on updates
        if (!this.isNew && !this.password) {
          return false;
        }
        // Direct non-OAuth registrations require a password
        return this.isNew;
      },
    },
    address: {
      type: String,
      default: "",
    },
    phoneNo: {
      type: String,
      default: "",
    },
    alternativePhoneNo: {
      type: String,
      default: "",
    },
    city: {
      type: String,
      default: "",
    },
    state: {
      type: String,
      default: "",
    },
    country: {
      type: String,
      default: "",
    },
    pinCode: {
      type: String,
      default: "",
    },
    gender: {
      type: String,
      enum: ["male", "female", "other", ""],
      default: "",
    },
    isNewUser: {
      // New field to check if user is new
      type: Boolean,
      default: true,
    },
    amount: {
      type: Number,
      required: false,
    },
    creditedPayments: {
      type: [String],
      default: [],
    },
    isVerified: {
      // New field to check if user is new
      type: Boolean,
      default: false,
    },
    profilePic: [
      {
        secure_url: { type: String, required: false },
        public_id: { type: String, required: false },
      },
    ],
    googlePhoto: {
      type: String,
      default: "",
    },
    selectedAvatar: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["Active", "Suspended", "Flagged"],
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
    // Two-Factor Authentication (2FA / TOTP)
    twoFactorEnabled: {
      type: Boolean,
      default: false,
      index: true,
    },
    // Email OTP on Login
    emailOtpLoginEnabled: {
      type: Boolean,
      default: false,
      index: true,
    },
    twoFactorSecret: {
      type: String,
      select: false,
      default: null,
    },
    twoFactorTempSecret: {
      type: String,
      select: false,
      default: null,
    },
    twoFactorRecoveryCodes: {
      type: [
        {
          codeHash: { type: String, required: true },
          used: { type: Boolean, default: false },
          usedAt: { type: Date, default: null },
        },
      ],
      select: false,
      default: [],
    },
    twoFactorLastVerifiedStep: {
      type: Number,
      select: false,
      default: 0,
    },
    twoFactorConfirmedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Check if the model already exists
const UserModel = mongoose.models.User || mongoose.model("User", userSchema);

// Export the model
module.exports = UserModel;
