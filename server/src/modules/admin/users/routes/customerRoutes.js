// routes/customerRoutes.js
const express = require("express");
const router = express.Router();
const customerController = require("../controllers/manageUserCustomerController");

// Get all customers
router.get("/", customerController.getAllCustomers);

// Get a single customer by ID
router.get("/:id", customerController.getCustomerById);

// Update a customer by ID
router.put("/:id", customerController.updateCustomer);

// Delete a customer by ID
router.delete("/:id", customerController.deleteCustomer);

// Add this route for bulk delete
router.delete("/", customerController.deleteMultipleCustomers);

module.exports = router;
