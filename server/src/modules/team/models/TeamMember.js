const mongoose = require("mongoose");

const teamMemberSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Team member name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters long"],
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    role: {
      type: String,
      required: [true, "Role title is required"],
      trim: true,
      minlength: [2, "Role must be at least 2 characters long"],
      maxlength: [120, "Role cannot exceed 120 characters"],
    },
    bio: {
      type: String,
      required: [true, "Bio description is required"],
      trim: true,
      minlength: [10, "Bio must be at least 10 characters long"],
      maxlength: [600, "Bio cannot exceed 600 characters"],
    },
    imageUrl: {
      type: String,
      required: [true, "Profile photograph or avatar is required"],
      trim: true,
    },
    imagePublicId: {
      type: String,
      trim: true,
      default: null,
    },
    socialLinks: {
      linkedin: {
        type: String,
        trim: true,
        default: "",
      },
      github: {
        type: String,
        trim: true,
        default: "",
      },
      email: {
        type: String,
        trim: true,
        default: "",
      },
      twitter: {
        type: String,
        trim: true,
        default: "",
      },
    },
    displayOrder: {
      type: Number,
      default: 0,
      min: [0, "Display order must be a non-negative number"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for high performance public queries and deterministic ordering
teamMemberSchema.index({ isActive: 1, displayOrder: 1, createdAt: 1 });
teamMemberSchema.index({ displayOrder: 1 });

const TeamMember = mongoose.models.TeamMember || mongoose.model("TeamMember", teamMemberSchema);

module.exports = TeamMember;
