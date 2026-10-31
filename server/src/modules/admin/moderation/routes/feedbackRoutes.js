const express = require("express");
const router = express.Router();
const feedbackController = require("../controllers/manageUserFeedbackController");

// Feedback routes
router.get("/", feedbackController.getAllFeedbacks);
router.get("/:id", feedbackController.getFeedbackById);
router.post("/", feedbackController.addFeedback);
router.put("/:id", feedbackController.updateFeedback);
router.delete("/:id", feedbackController.deleteFeedback);

module.exports = router;
