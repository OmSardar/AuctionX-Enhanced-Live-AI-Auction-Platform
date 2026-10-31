/**
 * AuctionX Chat Controller
 *
 * Handles authenticated chat endpoints:
 *  - POST /api/chat/message    — Send a message and get AI response
 *  - GET  /api/chat/history    — List user's conversations
 *  - GET  /api/chat/history/:id — Get a specific conversation
 *  - DELETE /api/chat/history  — Clear all chat history for the user
 *  - PATCH /api/chat/feedback  — Submit feedback on a bot message
 *  - GET  /api/chat/topics     — Get suggested topics for new conversations
 */

const crypto = require("crypto");
const uuidv4 = () => crypto.randomUUID();
const ChatHistory = require("../models/ChatHistory");
const { processMessage } = require("../services/chatService");
const {
  acquireRateLimitSlot,
  releaseRateLimitSlot,
  getUsageStats,
} = require("../services/chatRateLimiter");
const { searchKnowledgeBase } = require("../services/knowledgeBase");

/**
 * POST /api/chat/message
 * Send a message and receive an AI response.
 *
 * Body: { message: string, conversationId?: string }
 * Response: { reply: string, conversationId: string, actions: Array, source: string, usage: Object }
 */
exports.sendMessage = async (req, res) => {
  try {
    const userId = req.userId;
    const userName = req.user?.name || req.user?.email?.split("@")[0] || "User";
    const userRole = req.user?.role || "user";
    const { message, conversationId: existingConversationId } = req.body;

    // 1. Find or create conversation
    let conversation;
    let conversationId = existingConversationId;

    if (conversationId) {
      conversation = await ChatHistory.findOne({
        conversationId,
        userId,
      });

      if (!conversation) {
        return res.status(404).json({
          error: "Conversation not found or access denied.",
        });
      }
    }

    // 2. Synchronous Rate Limit & Capacity Reservation (prevents concurrency burst race)
    const currentTurnCount = conversation ? Math.floor(conversation.messages.length / 2) : 0;
    const slot = acquireRateLimitSlot(userId, message, currentTurnCount);

    if (!slot.allowed) {
      return res.status(slot.statusCode || 429).json({
        error: slot.error,
        retryAfterMs: slot.retryAfterMs || null,
        circuitBreaker: slot.circuitBreaker || false,
      });
    }

    const reservation = slot.reservation;

    try {
      // 3. Create new conversation if needed
      if (!conversation) {
        conversationId = uuidv4();
        conversation = new ChatHistory({
          userId,
          conversationId,
          messages: [],
          title: message.length > 80 ? message.substring(0, 77) + "..." : message,
        });
      }

      // 4. Add user message to history
      conversation.messages.push({
        role: "user",
        content: message.trim(),
      });

      // 5. Process with AI
      const userContext = { name: userName, role: userRole };
      const result = await processMessage(
        message.trim(),
        conversation.messages.slice(0, -1), // Pass history without the current message
        userContext
      );

      // 6. Add bot response to history
      conversation.messages.push({
        role: "assistant",
        content: result.reply,
        actions: result.actions || [],
        source: result.source,
      });

      // 7. Save conversation
      await conversation.save();

      // 8. Return response
      const usage = getUsageStats(userId);

      return res.json({
        reply: result.reply,
        conversationId,
        actions: result.actions || [],
        source: result.source,
        usage,
      });
    } catch (processError) {
      // Rollback reserved slot if processing or save failed before completion
      releaseRateLimitSlot(reservation);
      throw processError;
    }
  } catch (error) {
    console.error("Chat message error:", error);
    return res.status(500).json({
      error: "Failed to process your message. Please try again.",
    });
  }
};

/**
 * GET /api/chat/history
 * List all conversations for the authenticated user.
 *
 * Query: { page?: number, limit?: number }
 * Response: { conversations: Array, total: number, page: number }
 */
exports.getHistory = async (req, res) => {
  try {
    const userId = req.userId;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const [conversations, total] = await Promise.all([
      ChatHistory.find({ userId })
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("conversationId title messages updatedAt createdAt")
        .lean(),
      ChatHistory.countDocuments({ userId }),
    ]);

    // Return lightweight summaries (only last message preview + message count)
    const summaries = conversations.map((c) => ({
      conversationId: c.conversationId,
      title: c.title,
      messageCount: c.messages.length,
      lastMessage:
        c.messages.length > 0
          ? {
              role: c.messages[c.messages.length - 1].role,
              preview:
                c.messages[c.messages.length - 1].content.substring(0, 100) +
                (c.messages[c.messages.length - 1].content.length > 100
                  ? "..."
                  : ""),
            }
          : null,
      updatedAt: c.updatedAt,
      createdAt: c.createdAt,
    }));

    return res.json({
      conversations: summaries,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Chat history list error:", error);
    return res.status(500).json({ error: "Failed to load chat history." });
  }
};

/**
 * GET /api/chat/history/:conversationId
 * Get full messages for a specific conversation.
 */
exports.getConversation = async (req, res) => {
  try {
    const userId = req.userId;
    const { conversationId } = req.params;

    const conversation = await ChatHistory.findOne({
      conversationId,
      userId,
    }).lean();

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found." });
    }

    return res.json({
      conversationId: conversation.conversationId,
      title: conversation.title,
      messages: conversation.messages,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    });
  } catch (error) {
    console.error("Chat conversation fetch error:", error);
    return res.status(500).json({ error: "Failed to load conversation." });
  }
};

/**
 * DELETE /api/chat/history
 * Clear all chat history for the authenticated user.
 */
exports.clearHistory = async (req, res) => {
  try {
    const userId = req.userId;
    const result = await ChatHistory.deleteMany({ userId });

    return res.json({
      success: true,
      message: `Cleared ${result.deletedCount} conversation(s).`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("Chat history clear error:", error);
    return res.status(500).json({ error: "Failed to clear chat history." });
  }
};

/**
 * PATCH /api/chat/feedback
 * Submit feedback (thumbs up/down) on a bot message.
 *
 * Body: { conversationId: string, messageIndex: number, feedback: "positive" | "negative" }
 */
exports.submitFeedback = async (req, res) => {
  try {
    const userId = req.userId;
    const { conversationId, messageIndex, feedback } = req.body;

    if (!conversationId || messageIndex === undefined || !feedback) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    if (!["positive", "negative"].includes(feedback)) {
      return res
        .status(400)
        .json({ error: 'Feedback must be "positive" or "negative".' });
    }

    const conversation = await ChatHistory.findOne({
      conversationId,
      userId,
    });

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found." });
    }

    const parsedIndex = parseInt(messageIndex, 10);
    if (
      isNaN(parsedIndex) ||
      parsedIndex < 0 ||
      parsedIndex >= conversation.messages.length ||
      !conversation.messages[parsedIndex] ||
      conversation.messages[parsedIndex].role !== "assistant"
    ) {
      return res.status(400).json({ error: "Invalid message index." });
    }

    conversation.messages[parsedIndex].feedback = feedback;
    await conversation.save();

    return res.json({ success: true });
  } catch (error) {
    console.error("Chat feedback error:", error);
    return res.status(500).json({ error: "Failed to save feedback." });
  }
};

/**
 * GET /api/chat/topics
 * Get suggested conversation starter topics.
 * Returns a curated list of popular topics the user can click to start chatting.
 */
exports.getTopics = async (req, res) => {
  try {
    const suggestedTopics = [
      {
        id: "bidding",
        label: "How does bidding work?",
        icon: "🔨",
        query: "How do I place a bid on AuctionX?",
      },
      {
        id: "schedule",
        label: "Schedule a bid",
        icon: "⏰",
        query: "How can I schedule a bid in advance?",
      },
      {
        id: "payment",
        label: "Payments & Orders",
        icon: "💳",
        query: "How do payments work when I win an auction?",
      },
      {
        id: "selling",
        label: "Start selling",
        icon: "🏪",
        query: "How do I become a seller and list items?",
      },
      {
        id: "account",
        label: "Account & Profile",
        icon: "👤",
        query: "How do I manage my account and profile?",
      },
      {
        id: "security",
        label: "Security & Privacy",
        icon: "🔒",
        query: "How is my account and data protected?",
      },
    ];

    // Include usage stats if user is authenticated
    const usage = req.userId ? getUsageStats(req.userId) : null;

    return res.json({ topics: suggestedTopics, usage });
  } catch (error) {
    console.error("Chat topics error:", error);
    return res.status(500).json({ error: "Failed to load topics." });
  }
};
