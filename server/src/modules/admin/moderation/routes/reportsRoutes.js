const express = require("express");
const router = express.Router();
const reportController = require("../controllers/manageUserReportController");
const handleImageUploads = require("../../../media/middleware/imageUploadMiddleware"); // Adjust path as needed
const adminAuthMiddleware = require("../../authentication/middleware/authAdminMiddleware");

// Get all reports (admin only)
router.get("/reports", adminAuthMiddleware, reportController.getAllReports);

// Get a single report by ID (admin only)
router.get("/reports/:id", adminAuthMiddleware, reportController.getReportById);

// Create a new report with image upload (user submission)
router.post("/reports", 
  handleImageUploads([
    { 
      name: 'attachments', 
      folder: 'reports', 
      transformation: { 
        width: 1000, 
        height: 1000, 
        crop: 'limit',
        quality: 'auto'
      } 
    }
  ]), 
  reportController.createReport
);

// Update a report (admin only)
router.put("/reports/:id", adminAuthMiddleware, reportController.updateReport);

// Delete a report (admin only)
router.delete("/reports/:id", adminAuthMiddleware, reportController.deleteReport);

module.exports = router;