const TeamMember = require("../models/TeamMember");
const { deleteFromCloudinary } = require("../../../common/utilities/cloudinaryConfig");

/**
 * Validate and sanitize URL scheme
 * Only http, https, and mailto (for email) are allowed.
 */
const isValidUrl = (url, allowMailto = false) => {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (allowMailto && trimmed.startsWith("mailto:")) {
    const emailPart = trimmed.replace("mailto:", "").trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailPart);
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

/**
 * Strip potential HTML tags and malicious characters from plain-text fields
 */
const sanitizeText = (text) => {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(/<[^>]*>?/gm, "") // Strip HTML tags
    .replace(/[<>'"&]/g, (char) => {
      // Escape critical HTML entities
      switch (char) {
        case "<": return "&lt;";
        case ">": return "&gt;";
        case "'": return "&#39;";
        case "\"": return "&quot;";
        case "&": return "&amp;";
        default: return char;
      }
    })
    .trim();
};

/**
 * GET /api/team
 * Public: Get all active team members sorted deterministically by displayOrder and createdAt
 */
exports.getActiveTeamMembers = async (req, res) => {
  try {
    const members = await TeamMember.find({ isActive: true })
      .sort({ displayOrder: 1, createdAt: 1 })
      .select("name role bio imageUrl socialLinks displayOrder createdAt")
      .lean();

    return res.status(200).json({
      success: true,
      count: members.length,
      data: members,
    });
  } catch (error) {
    console.error("Error fetching active team members:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch team members",
    });
  }
};

/**
 * GET /api/team/admin
 * Admin: Get all team members (including inactive) for management
 */
exports.getAllTeamMembersAdmin = async (req, res) => {
  try {
    const members = await TeamMember.find()
      .sort({ displayOrder: 1, createdAt: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: members.length,
      data: members,
    });
  } catch (error) {
    console.error("Error fetching all team members for admin:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch team members for administration",
    });
  }
};

/**
 * POST /api/team
 * Admin: Create a new team member
 */
exports.createTeamMember = async (req, res) => {
  try {
    const { name, role, bio, imageUrl, socialLinks, displayOrder, isActive } = req.body;

    // 1. Validate required fields
    if (!name || typeof name !== "string" || name.trim().length < 2 || name.trim().length > 100) {
      return res.status(400).json({
        success: false,
        message: "Name is required and must be between 2 and 100 characters",
      });
    }

    if (!role || typeof role !== "string" || role.trim().length < 2 || role.trim().length > 120) {
      return res.status(400).json({
        success: false,
        message: "Role is required and must be between 2 and 120 characters",
      });
    }

    if (!bio || typeof bio !== "string" || bio.trim().length < 10 || bio.trim().length > 600) {
      return res.status(400).json({
        success: false,
        message: "Bio is required and must be between 10 and 600 characters",
      });
    }

    // 2. Resolve image: file upload takes precedence over provided URL
    let finalImageUrl = imageUrl ? imageUrl.trim() : "";
    let finalImagePublicId = null;

    if (req.cloudinaryUploads && req.cloudinaryUploads.image && req.cloudinaryUploads.image[0]) {
      finalImageUrl = req.cloudinaryUploads.image[0].secure_url;
      finalImagePublicId = req.cloudinaryUploads.image[0].public_id;
    }

    if (!finalImageUrl) {
      return res.status(400).json({
        success: false,
        message: "Profile image is required (either via file upload or valid URL)",
      });
    }

    if (!finalImageUrl.startsWith("data:") && !finalImageUrl.startsWith("/") && !isValidUrl(finalImageUrl)) {
      return res.status(400).json({
        success: false,
        message: "Image URL must be a valid http or https URL",
      });
    }

    // 3. Validate and sanitize social links
    const sanitizedSocialLinks = {
      linkedin: "",
      github: "",
      email: "",
      twitter: "",
    };

    if (socialLinks && typeof socialLinks === "object") {
      if (socialLinks.linkedin && typeof socialLinks.linkedin === "string" && socialLinks.linkedin.trim()) {
        const link = socialLinks.linkedin.trim();
        if (!isValidUrl(link)) {
          return res.status(400).json({ success: false, message: "Invalid LinkedIn URL" });
        }
        sanitizedSocialLinks.linkedin = link;
      }
      if (socialLinks.github && typeof socialLinks.github === "string" && socialLinks.github.trim()) {
        const link = socialLinks.github.trim();
        if (!isValidUrl(link)) {
          return res.status(400).json({ success: false, message: "Invalid GitHub URL" });
        }
        sanitizedSocialLinks.github = link;
      }
      if (socialLinks.twitter && typeof socialLinks.twitter === "string" && socialLinks.twitter.trim()) {
        const link = socialLinks.twitter.trim();
        if (!isValidUrl(link)) {
          return res.status(400).json({ success: false, message: "Invalid Twitter/X URL" });
        }
        sanitizedSocialLinks.twitter = link;
      }
      if (socialLinks.email && typeof socialLinks.email === "string" && socialLinks.email.trim()) {
        const link = socialLinks.email.trim();
        if (!isValidUrl(link, true) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(link)) {
          return res.status(400).json({ success: false, message: "Invalid email address" });
        }
        sanitizedSocialLinks.email = link;
      }
    }

    // 4. Determine display order
    let parsedOrder = 0;
    if (displayOrder !== undefined && displayOrder !== null) {
      parsedOrder = parseInt(displayOrder, 10);
      if (isNaN(parsedOrder) || parsedOrder < 0) {
        return res.status(400).json({
          success: false,
          message: "Display order must be a non-negative number",
        });
      }
    } else {
      // Default to end of list
      const highestMember = await TeamMember.findOne().sort({ displayOrder: -1 }).select("displayOrder");
      parsedOrder = highestMember && typeof highestMember.displayOrder === "number" ? highestMember.displayOrder + 1 : 0;
    }

    const newMember = new TeamMember({
      name: sanitizeText(name),
      role: sanitizeText(role),
      bio: sanitizeText(bio),
      imageUrl: finalImageUrl,
      imagePublicId: finalImagePublicId,
      socialLinks: sanitizedSocialLinks,
      displayOrder: parsedOrder,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
    });

    await newMember.save();

    return res.status(201).json({
      success: true,
      message: "Team member created successfully",
      data: newMember,
    });
  } catch (error) {
    console.error("Error creating team member:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create team member",
    });
  }
};

/**
 * PUT /api/team/:id
 * Admin: Update a team member's details
 */
exports.updateTeamMember = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, role, bio, imageUrl, socialLinks, displayOrder, isActive } = req.body;

    const member = await TeamMember.findById(id);
    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Team member not found",
      });
    }

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 100) {
        return res.status(400).json({
          success: false,
          message: "Name must be between 2 and 100 characters",
        });
      }
      member.name = sanitizeText(name);
    }

    if (role !== undefined) {
      if (typeof role !== "string" || role.trim().length < 2 || role.trim().length > 120) {
        return res.status(400).json({
          success: false,
          message: "Role must be between 2 and 120 characters",
        });
      }
      member.role = sanitizeText(role);
    }

    if (bio !== undefined) {
      if (typeof bio !== "string" || bio.trim().length < 10 || bio.trim().length > 600) {
        return res.status(400).json({
          success: false,
          message: "Bio must be between 10 and 600 characters",
        });
      }
      member.bio = sanitizeText(bio);
    }

    // Image replacement
    if (req.cloudinaryUploads && req.cloudinaryUploads.image && req.cloudinaryUploads.image[0]) {
      const oldPublicId = member.imagePublicId;
      member.imageUrl = req.cloudinaryUploads.image[0].secure_url;
      member.imagePublicId = req.cloudinaryUploads.image[0].public_id;

      if (oldPublicId) {
        try {
          await deleteFromCloudinary(oldPublicId);
        } catch (cleanupErr) {
          console.warn("Failed to delete superseded team member image from Cloudinary:", cleanupErr.message);
        }
      }
    } else if (imageUrl !== undefined && imageUrl.trim()) {
      const trimmed = imageUrl.trim();
      if (!trimmed.startsWith("data:") && !trimmed.startsWith("/") && !isValidUrl(trimmed)) {
        return res.status(400).json({
          success: false,
          message: "Image URL must be a valid http or https URL",
        });
      }
      member.imageUrl = trimmed;
    }

    // Social links update
    if (socialLinks && typeof socialLinks === "object") {
      if (socialLinks.linkedin !== undefined) {
        const link = (socialLinks.linkedin || "").trim();
        if (link && !isValidUrl(link)) {
          return res.status(400).json({ success: false, message: "Invalid LinkedIn URL" });
        }
        member.socialLinks.linkedin = link;
      }
      if (socialLinks.github !== undefined) {
        const link = (socialLinks.github || "").trim();
        if (link && !isValidUrl(link)) {
          return res.status(400).json({ success: false, message: "Invalid GitHub URL" });
        }
        member.socialLinks.github = link;
      }
      if (socialLinks.twitter !== undefined) {
        const link = (socialLinks.twitter || "").trim();
        if (link && !isValidUrl(link)) {
          return res.status(400).json({ success: false, message: "Invalid Twitter/X URL" });
        }
        member.socialLinks.twitter = link;
      }
      if (socialLinks.email !== undefined) {
        const link = (socialLinks.email || "").trim();
        if (link && !isValidUrl(link, true) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(link)) {
          return res.status(400).json({ success: false, message: "Invalid email address" });
        }
        member.socialLinks.email = link;
      }
    }

    if (displayOrder !== undefined) {
      const parsedOrder = parseInt(displayOrder, 10);
      if (isNaN(parsedOrder) || parsedOrder < 0) {
        return res.status(400).json({
          success: false,
          message: "Display order must be a non-negative number",
        });
      }
      member.displayOrder = parsedOrder;
    }

    if (isActive !== undefined) {
      member.isActive = Boolean(isActive);
    }

    await member.save();

    return res.status(200).json({
      success: true,
      message: "Team member updated successfully",
      data: member,
    });
  } catch (error) {
    console.error("Error updating team member:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update team member",
    });
  }
};

/**
 * PATCH /api/team/:id/toggle-active
 * Admin: Fast toggle for public visibility
 */
exports.toggleMemberActive = async (req, res) => {
  try {
    const { id } = req.params;
    const member = await TeamMember.findById(id);

    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Team member not found",
      });
    }

    member.isActive = !member.isActive;
    await member.save();

    return res.status(200).json({
      success: true,
      message: `Team member ${member.isActive ? "activated" : "deactivated"} successfully`,
      data: member,
    });
  } catch (error) {
    console.error("Error toggling team member active status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to toggle team member visibility",
    });
  }
};

/**
 * DELETE /api/team/:id
 * Admin: Safe removal with Cloudinary image cleanup
 */
exports.deleteTeamMember = async (req, res) => {
  try {
    const { id } = req.params;
    const member = await TeamMember.findById(id);

    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Team member not found",
      });
    }

    // Clean up image if hosted on Cloudinary
    if (member.imagePublicId) {
      try {
        await deleteFromCloudinary(member.imagePublicId);
      } catch (cleanupErr) {
        console.warn("Failed to delete team member image from Cloudinary during removal:", cleanupErr.message);
      }
    }

    await TeamMember.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Team member deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting team member:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete team member",
    });
  }
};

/**
 * PUT /api/team/reorder
 * Admin: Batch reorder team members
 * Accepts: { orders: [{ id: "...", displayOrder: 0 }, ...] } or { orderIds: ["id1", "id2", ...] }
 */
exports.reorderTeamMembers = async (req, res) => {
  try {
    const { orders, orderIds } = req.body;

    if (Array.isArray(orderIds)) {
      const bulkOps = orderIds.map((id, index) => ({
        updateOne: {
          filter: { _id: id },
          update: { $set: { displayOrder: index } },
        },
      }));
      if (bulkOps.length > 0) {
        await TeamMember.bulkWrite(bulkOps);
      }
    } else if (Array.isArray(orders)) {
      const bulkOps = orders.map((item) => ({
        updateOne: {
          filter: { _id: item.id },
          update: { $set: { displayOrder: parseInt(item.displayOrder, 10) || 0 } },
        },
      }));
      if (bulkOps.length > 0) {
        await TeamMember.bulkWrite(bulkOps);
      }
    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid reorder payload. Provide 'orderIds' array or 'orders' array with {id, displayOrder}",
      });
    }

    const updatedMembers = await TeamMember.find().sort({ displayOrder: 1, createdAt: 1 }).lean();

    return res.status(200).json({
      success: true,
      message: "Team members reordered successfully",
      data: updatedMembers,
    });
  } catch (error) {
    console.error("Error reordering team members:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to reorder team members",
    });
  }
};
