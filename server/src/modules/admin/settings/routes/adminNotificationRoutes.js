const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/adminNotificationController");
const adminAuthMiddleware = require("../../authentication/middleware/authAdminMiddleware");

// Enforce admin authentication on notification routes
router.use(adminAuthMiddleware);

router
  .route("/")
  .get(notificationController.getNotifications)
  .post(notificationController.createNotification);

router
  .route("/:id")
  .patch(notificationController.markAsRead)
  .delete(notificationController.deleteNotification);

router.route("/:id/read").patch(notificationController.markAsRead);

module.exports = router;

