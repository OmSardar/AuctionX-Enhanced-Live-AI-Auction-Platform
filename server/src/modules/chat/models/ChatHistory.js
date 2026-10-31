const mongoose = require("mongoose");

const chatMessageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["user", "assistant"],
      required: true,
    },
    content: {
      type: String,
      required: true,
      maxlength: 5000,
    },
    actions: [
      {
        type: {
          type: String,
          enum: ["navigate"],
          default: "navigate",
        },
        path: { type: String, required: true },
        label: { type: String, required: true },
      },
    ],
    feedback: {
      type: String,
      enum: ["positive", "negative", null],
      default: null,
    },
    source: {
      type: String,
      enum: ["knowledge_base", "gemini", "fallback", "pre_filter_refusal"],
      default: "fallback",
    },
  },
  { _id: false, timestamps: false }
);

const chatHistorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    conversationId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    messages: {
      type: [chatMessageSchema],
      default: [],
      validate: {
        validator: function (arr) {
          return arr.length <= 100; // Max 100 messages per conversation
        },
        message: "Conversation has reached the maximum message limit.",
      },
    },
    title: {
      type: String,
      default: "New Conversation",
      maxlength: 120,
    },
  },
  {
    timestamps: true,
  }
);

// Auto-expire conversations after 30 days
chatHistorySchema.index({ updatedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

// Compound index for efficient per-user queries
chatHistorySchema.index({ userId: 1, updatedAt: -1 });

const ChatHistory = mongoose.model("ChatHistory", chatHistorySchema);

module.exports = ChatHistory;
