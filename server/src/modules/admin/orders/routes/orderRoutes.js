// routes/AdminRoutes/orderRoutes.js
const express = require("express");
const router = express.Router();
const orderController = require("../controllers/manageUserOrderController");

// Get all orders with pagination
router.get("/", orderController.getOrders);

// Get a single order by ID
router.get("/:id", orderController.getOrderById);

// Add a new order
router.post("/", orderController.addOrder);

// Update an order
router.put("/:id", orderController.updateOrder);

// Delete an order
router.delete("/:id", orderController.deleteOrder);

// Delete multiple orders
router.delete("/", orderController.deleteMultipleOrders);

module.exports = router;
