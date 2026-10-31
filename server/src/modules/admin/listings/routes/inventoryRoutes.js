// routes/itemRoutes.js
const express = require("express");
const router = express.Router();
const itemController = require("../controllers/manageUserInventoryController");
const adminAuthMiddleware = require("../../authentication/middleware/authAdminMiddleware");

// Enforce admin authentication on all inventory operations
router.use(adminAuthMiddleware);

// Get all items
router.get("/", itemController.getItems);

// Get a single item by ID
router.get("/:id", itemController.getItemById);

// Add a new item
router.post("/", itemController.addItem);

// Update an item
router.put("/:id", itemController.updateItem);

// Delete an item
router.delete("/:id", itemController.deleteItem);

// Delete multiple items
router.delete("/", itemController.deleteMultipleItems);

module.exports = router;
