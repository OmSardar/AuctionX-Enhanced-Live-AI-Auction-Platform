const express = require("express");
const { 
  submitContact, 
  getAllContacts, 
  getContactById,
  updateContactStatus,
  deleteContact
} = require("../controllers/contactController");
const adminAuthMiddleware = require("../../admin/authentication/middleware/authAdminMiddleware");

const router = express.Router();

// Public submission
router.post("/", submitContact);

// Admin-protected review and management
router.get("/", adminAuthMiddleware, getAllContacts);
router.get("/:id", adminAuthMiddleware, getContactById);
router.patch("/:id/status", adminAuthMiddleware, updateContactStatus);
router.delete("/:id", adminAuthMiddleware, deleteContact);

module.exports = router;
