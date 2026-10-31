// controllers/orderController.js
const Order = require("../models/orderSchema");

// CREATE: Add a new order (HIGH-02: requires authenticated user)
exports.createOrder = async (req, res) => {
  const {
    title,
    sellerEmail,
    category,
    images,
    biddingStartPrice,
    highestBid,
    phoneNo,
    address,
  } = req.body;

  // Enforce authenticated user's email and name
  const userEmail = req.user ? req.user.email : req.body.userEmail;
  const name = (req.user && req.user.name) ? req.user.name : req.body.name;

  // Check required fields
  if (
    !title ||
    !name ||
    !userEmail ||
    !sellerEmail ||
    !category ||
    !images ||
    !biddingStartPrice ||
    !phoneNo ||
    !address
  ) {
    return res
      .status(400)
      .json({ error: "All required fields must be provided" });
  }

  try {
    const newOrder = new Order({
      title,
      name,
      userEmail,
      sellerEmail,
      category,
      images,
      biddingStartPrice,
      highestBid,
      phoneNo,
      address,
    });

    const savedOrder = await newOrder.save();
    res.status(201).json(savedOrder);
  } catch (error) {
    console.error("Error creating order:", error);
    res
      .status(500)
      .json({ error: "Failed to create order", details: error.message });
  }
};

// READ: Get all orders (Admin only)
exports.getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.status(200).json(orders);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch orders" });
  }
};

// READ: Get an order by ID (HIGH-02: Buyer, Seller, or Admin only)
exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Ownership check
    const isBuyer = req.user && (order.userEmail === req.user.email);
    const isSeller = req.user && (order.sellerEmail === req.user.email);
    const isAdmin = req.user && (req.user.role === "admin");

    if (!isBuyer && !isSeller && !isAdmin) {
      return res.status(403).json({ error: "Forbidden: Not authorized to view this order" });
    }

    res.status(200).json(order);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch order" });
  }
};

// READ: Get all orders by userEmail (HIGH-02: Only for authenticated user or admin)
exports.getOrdersByUserEmail = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Unauthorized: Authentication required",
      });
    }

    const targetEmail = req.params.email || req.query.userEmail || req.user.email;

    if (!targetEmail) {
      return res.status(400).json({
        message: "User email is required",
      });
    }

    const normalizedTarget = (targetEmail || "").trim().toLowerCase();
    const normalizedUserEmail = (req.user.email || "").trim().toLowerCase();
    const isAdmin = req.user.role === "admin";

    // Ownership check
    if (normalizedUserEmail !== normalizedTarget && !isAdmin) {
      return res.status(403).json({
        message: "Forbidden: Not authorized to view orders for this user",
      });
    }

    const orders = await Order.find({
      userEmail: { $in: [normalizedTarget, targetEmail.trim()] },
    })
      .sort({ createdAt: -1 })
      .lean();
    res.status(200).json(orders);
  } catch (error) {
    console.error("Error fetching user orders:", error);
    res.status(500).json({
      message: "Server error while fetching orders",
      error: error.message,
    });
  }
};

// READ: Get all orders by sellerEmail (HIGH-02: Only for authenticated seller or admin)
exports.getOrdersBySellerEmail = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Unauthorized: Authentication required",
      });
    }

    const targetEmail = req.params.email || req.query.sellerEmail || req.user.email;

    if (!targetEmail) {
      return res.status(400).json({
        message: "Seller email is required",
      });
    }

    const normalizedTarget = (targetEmail || "").trim().toLowerCase();
    const normalizedUserEmail = (req.user.email || "").trim().toLowerCase();
    const isAdmin = req.user.role === "admin";
    const isSeller = req.user.role === "seller" || req.user.isSeller;

    // Enforce seller or admin privilege
    if (!isSeller && !isAdmin) {
      return res.status(403).json({
        message: "Forbidden: Seller privileges required",
      });
    }

    // Ownership check
    if (normalizedUserEmail !== normalizedTarget && !isAdmin) {
      return res.status(403).json({
        message: "Forbidden: Not authorized to view orders for this seller",
      });
    }

    const orders = await Order.find({
      sellerEmail: { $in: [normalizedTarget, targetEmail.trim()] },
    })
      .sort({ createdAt: -1 })
      .lean();
    res.status(200).json(orders);
  } catch (error) {
    console.error("Error fetching seller orders:", error);
    res.status(500).json({
      error: "Failed to fetch seller orders",
      details: error.message,
    });
  }
};
