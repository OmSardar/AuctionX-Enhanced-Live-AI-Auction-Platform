const express = require("express");
const chatController = require("../controllers/chatController");
const authUserMiddleware = require("../../users/middleware/authUserMiddleware");

const router = express.Router();

// Public / optional auth: Suggested topics
router.get("/topics", authUserMiddleware.optional, chatController.getTopics);

// Authenticated routes: full chat functionality
router.post("/message", authUserMiddleware, chatController.sendMessage);
router.get("/history", authUserMiddleware, chatController.getHistory);
router.get("/history/:conversationId", authUserMiddleware, chatController.getConversation);
router.delete("/history", authUserMiddleware, chatController.clearHistory);
router.patch("/feedback", authUserMiddleware, chatController.submitFeedback);

module.exports = router;
