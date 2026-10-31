// models/Item.js
const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, required: true },
  price: { type: String, required: true },
  email: { type: String, required: true },
  addedDate: { type: String, required: true },
  status: { type: String, required: true },
  image: { type: String, required: true }, // Store image URL or path
  visitors: { type: Number, required: true }, // New field
  revenue: { type: String, required: true }, // New field
  sellerRevenue: { type: String, required: true }, // New field
  totalRevenue: { type: String, required: true }, // New field
});

module.exports = mongoose.model("Item", itemSchema);
