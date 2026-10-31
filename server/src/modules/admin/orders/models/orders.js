// models/AdminModels/Orders.js
const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  image: { type: String, required: true },
  itemName: { type: String, required: true },
  userEmail: { type: String, required: true },
  sellerEmail: { type: String, required: true },
  startingPrice: { type: String, required: true },
  soldPrice: { type: String, required: true },
});

// Check if the model already exists before compiling it
const Order = mongoose.models.AdminOrder || mongoose.model("AdminOrder", orderSchema);

module.exports = Order;
