const express = require("express");
const router = express.Router();
const sellerController = require("../controllers/sellerManagementController");
const adminAuthMiddleware = require("../../authentication/middleware/authAdminMiddleware");

// Enforce admin authentication on admin seller management routes
router.use(adminAuthMiddleware);

// Seller management routes
router.get("/", sellerController.getAllSellers); // Get all sellers with pagination
router.get("/stats", sellerController.getSellerStats); // Get seller statistics
router.get("/:id", sellerController.getSeller); // Get single seller details
router.patch("/:id/status", sellerController.updateStatus); // Update seller status
router.patch("/:id/verify", sellerController.verifySeller); // Verify seller

// Get seller transaction history with pagination
router.get("/history", sellerController.getSellerHistory);

// Get single transaction details
router.get("/history/:id", sellerController.getTransactionDetails);

module.exports = router;
