const mongoose = require("mongoose");

const sellerSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  phone: String,
  businessName: String,
  status: {
    type: String,
    enum: ["active", "pending_approval", "suspended"], // MUST match frontend
    default: "pending_approval", // Changed from "pending"
  },

  isVerified: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },

  // Now profilePic is an array of objects
  profilePic: [
    {
      secure_url: String,
      public_id: String,
    },
  ],
});

const Seller = mongoose.model("AdminSeller", sellerSchema);

module.exports = Seller;
