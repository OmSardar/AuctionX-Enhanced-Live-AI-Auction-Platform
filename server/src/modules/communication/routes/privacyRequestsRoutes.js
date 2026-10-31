const express = require("express");
const router = express.Router();
const privacyRequestController = require("../controllers/privacyRequestController");
const adminAuthMiddleware = require("../../admin/authentication/middleware/authAdminMiddleware");

// Public user submission for privacy & support inquiries
router.post("/", privacyRequestController.createPrivacyRequest);

// Administrative review endpoints (protected by role authorization)
router.get("/", adminAuthMiddleware, privacyRequestController.getAllPrivacyRequests);
router.get("/:id", adminAuthMiddleware, privacyRequestController.getPrivacyRequestById);
router.put("/:id", adminAuthMiddleware, privacyRequestController.updatePrivacyRequestStatus);
router.delete("/:id", adminAuthMiddleware, privacyRequestController.deletePrivacyRequest);

module.exports = router;
