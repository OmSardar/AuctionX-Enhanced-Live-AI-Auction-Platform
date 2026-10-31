// controllers/AdminControllers/orderController.js
const Order = require("../models/orders");

// Get all orders with pagination
const getOrders = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 5;

  try {
    const totalOrders = await Order.countDocuments();
    const orders = await Order.find()
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({
      orders,
      currentPage: page,
      totalPages: Math.ceil(totalOrders / limit),
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Get a single order by ID
const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Add a new order
const addOrder = async (req, res) => {
  const { image, itemName, userEmail, sellerEmail, startingPrice, soldPrice } =
    req.body;

  try {
    const newOrder = new Order({
      image,
      itemName,
      userEmail,
      sellerEmail,
      startingPrice,
      soldPrice,
    });
    await newOrder.save();
    res.status(201).json(newOrder);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Update an order
const updateOrder = async (req, res) => {
  const { id } = req.params;
  const { image, itemName, userEmail, sellerEmail, startingPrice, soldPrice } =
    req.body;

  try {
    const updatedOrder = await Order.findByIdAndUpdate(
      id,
      { image, itemName, userEmail, sellerEmail, startingPrice, soldPrice },
      { new: true }
    );
    if (!updatedOrder) {
      return res.status(404).json({ message: "Order not found" });
    }
    res.json(updatedOrder);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Delete an order
const deleteOrder = async (req, res) => {
  const { id } = req.params;

  try {
    const deletedOrder = await Order.findByIdAndDelete(id);
    if (!deletedOrder) {
      return res.status(404).json({ message: "Order not found" });
    }
    res.json({ message: "Order deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Delete multiple orders
const deleteMultipleOrders = async (req, res) => {
  const { ids } = req.body;

  try {
    const result = await Order.deleteMany({ _id: { $in: ids } });
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "No orders found to delete" });
    }
    res.json({ message: `${result.deletedCount} orders deleted successfully` });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

module.exports = {
  getOrders,
  getOrderById,
  addOrder,
  updateOrder,
  deleteOrder,
  deleteMultipleOrders,
};
