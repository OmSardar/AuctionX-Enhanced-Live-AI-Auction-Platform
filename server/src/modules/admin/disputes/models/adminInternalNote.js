const mongoose = require("mongoose");

/**
 * AdminInternalNote Schema
 * Durable internal investigation notes for dispute and complaint cases.
 * Strictly restricted to authorized administrators; never exposed to buyers or sellers.
 */
const adminInternalNoteSchema = new mongoose.Schema(
  {
    caseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ReportAdmin",
      required: true,
      index: true,
    },
    authorId: {
      type: String,
      required: true,
    },
    authorEmail: {
      type: String,
      required: true,
    },
    authorRole: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 2000,
    },
    ipAddress: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Immutable timestamp
  }
);

adminInternalNoteSchema.index({ caseId: 1, createdAt: -1 });

module.exports =
  mongoose.models.AdminInternalNote ||
  mongoose.model("AdminInternalNote", adminInternalNoteSchema);
