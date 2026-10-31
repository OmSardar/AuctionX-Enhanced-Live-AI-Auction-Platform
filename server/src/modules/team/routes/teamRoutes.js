const express = require("express");
const router = express.Router();
const teamController = require("../controllers/teamController");
const handleImageUploads = require("../../media/middleware/imageUploadMiddleware");
const adminAuthMiddleware = require("../../admin/authentication/middleware/authAdminMiddleware");

// Configure secure image upload middleware for team avatars
const uploadTeamImage = handleImageUploads([
  {
    name: "image",
    folder: "team",
    transformation: { width: 600, height: 600, crop: "fill" },
  },
]);

// Public endpoint: Fetch enabled, active team members
router.get("/", teamController.getActiveTeamMembers);

// Admin endpoint: Fetch all team members (including draft/disabled)
router.get("/admin", adminAuthMiddleware, teamController.getAllTeamMembersAdmin);

// Admin endpoint: Create a new team member (supports image file upload)
router.post("/", adminAuthMiddleware, uploadTeamImage, teamController.createTeamMember);

// Admin endpoint: Batch reorder display order
router.put("/reorder", adminAuthMiddleware, teamController.reorderTeamMembers);

// Admin endpoint: Update an existing team member
router.put("/:id", adminAuthMiddleware, uploadTeamImage, teamController.updateTeamMember);

// Admin endpoint: Fast toggle for public visibility
router.patch("/:id/toggle-active", adminAuthMiddleware, teamController.toggleMemberActive);

// Admin endpoint: Delete team member and associated assets
router.delete("/:id", adminAuthMiddleware, teamController.deleteTeamMember);

module.exports = router;
