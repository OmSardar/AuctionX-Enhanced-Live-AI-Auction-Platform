const express = require("express");
const router = express.Router();
const adminManagementController = require("../controllers/adminManagementController");
const adminAuthMiddleware = require("../../authentication/middleware/authAdminMiddleware");

// Enforce admin authentication
router.use(adminAuthMiddleware);

router.get("/", adminManagementController.getAllAdmins);
router.post("/", adminManagementController.createAdmin);
router.delete("/:id", adminManagementController.deleteAdmin);

module.exports = router;
