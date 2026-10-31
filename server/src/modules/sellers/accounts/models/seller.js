const mongoose = require("mongoose");

const sellerSchema = new mongoose.Schema(
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
    isOAuthUser: {
      type: Boolean,
      default: false,
      index: true,
    },
    password: {
      type: String,
      required: function () {
        if (this.isOAuthUser) {
          return false;
        }
        if (!this.isNew && !this.password) {
          return false;
        }
        return this.isNew;
      },
    },
    role: {
      type: String,
      enum: ["admin", "seller"],
      default: "seller",
    },
    isNewUser: {
      type: Boolean,
      default: true,
    },
    amount: {
      type: Number,
      required: false,
    },
    isVerified: {
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
    pinCode: {
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
    gender: {
      type: String,
      enum: ["male", "female", "other", ""],
      default: "",
    },
    storeName: {
      type: String,
      default: "",
    },
    storeDescription: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["Active", "Suspended", "Flagged", "Approved", "Pending"],
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
    subscriptionPlan: {
      type: String,
      default: "free",
    },
    subscriptionStatus: {
      type: String,
      default: "free",
    },
    subscriptionExpiresAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

const Seller = mongoose.model("Seller", sellerSchema);

module.exports = Seller;
