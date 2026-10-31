// models/Customer.js
const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  location: { type: String, required: true },
  spent: { type: String, required: true },
  joinedDate: { type: Date, default: Date.now },
  status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
  image: { type: String, required: true }, // URL to the image
});

module.exports = mongoose.model("Customer", customerSchema);