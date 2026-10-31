// routes/OrderRoutes.js
const express = require("express");
const OrderRoutes = express.Router();
const orderController = require("../controllers/orderController");
const authUserMiddleware = require("../../users/middleware/authUserMiddleware");
const adminAuthMiddleware = require("../../admin/authentication/middleware/authAdminMiddleware");
const { validateObjectId } = require("../../../infrastructure/security/validationMiddleware");

// Route to create a new order (requires authentication)
OrderRoutes.post("/", authUserMiddleware, orderController.createOrder);

// Route to get all orders (admin only)
OrderRoutes.get("/", adminAuthMiddleware, orderController.getAllOrders);

// Route to get a specific order by ID (authenticated buyer, seller or admin)
OrderRoutes.get("/:id", validateObjectId("id"), authUserMiddleware, orderController.getOrderById);

// Route to get all orders by email (authenticated)
OrderRoutes.get("/orders", authUserMiddleware, orderController.getOrdersByUserEmail);

// Route to get orders by userEmail (authenticated & ownership checked)
OrderRoutes.get("/user/:email", authUserMiddleware, orderController.getOrdersByUserEmail);

// Route to get orders by sellerEmail (authenticated & ownership checked)
OrderRoutes.get("/seller/:email", authUserMiddleware, orderController.getOrdersBySellerEmail);

module.exports = OrderRoutes;
