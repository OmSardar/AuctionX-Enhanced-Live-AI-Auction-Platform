const Banner = require("../models/banner");
const {
  deleteFromCloudinary,
} = require("../../../../common/utilities/cloudinaryConfig");

// Get all banners with optional activeOnly & position filters
exports.getAllBanners = async (req, res) => {
  try {
    const query = {};

    if (req.query.activeOnly === "true") {
      query.isActive = true;
      const now = new Date();
      query.$and = [
        { $or: [{ startDate: null }, { startDate: { $lte: now } }] },
        { $or: [{ endDate: null }, { endDate: { $gte: now } }] },
      ];
    }

    if (req.query.position) {
      query.position = req.query.position;
    }

    const banners = await Banner.find(query).sort({ createdAt: -1 });
    res.json({
      success: true,
      data: banners,
    });
  } catch (err) {
    console.error("Error fetching banners:", err);
    res.status(500).json({
      success: false,
      message: "Server error while fetching banners",
    });
  }
};

// Create a new banner
exports.createBanner = async (req, res) => {
  try {
    const { title, description, link, position, startDate, endDate, isActive } =
      req.body;

    let imageUrl =
      req.cloudinaryUploads?.image?.[0]?.secure_url || req.body.imageUrl;
    let imagePublicId =
      req.cloudinaryUploads?.image?.[0]?.public_id || req.body.imagePublicId || "";

    if (!imageUrl) {
      return res.status(400).json({
        success: false,
        message: "Banner image is required",
      });
    }

    const banner = new Banner({
      title,
      description: description || "",
      link: link || "",
      position: position || "top",
      imageUrl,
      imagePublicId,
      startDate: startDate || null,
      endDate: endDate || null,
      isActive: isActive === "true" || isActive === true,
    });

    await banner.save();

    res.status(201).json({
      success: true,
      data: banner,
      message: "Banner created successfully",
    });
  } catch (err) {
    console.error("Error creating banner:", err);
    res.status(500).json({
      success: false,
      message: "Server error while creating banner",
    });
  }
};

// Update entire banner
exports.updateBanner = async (req, res) => {
  try {
    const { title, description, link, position, startDate, endDate, isActive } =
      req.body;
    const banner = await Banner.findById(req.params.id);

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found",
      });
    }

    if (title) banner.title = title;
    if (description !== undefined) banner.description = description;
    if (link !== undefined) banner.link = link;
    if (position) banner.position = position;
    if (startDate !== undefined) banner.startDate = startDate || null;
    if (endDate !== undefined) banner.endDate = endDate || null;
    if (isActive !== undefined) {
      banner.isActive = isActive === "true" || isActive === true;
    }

    if (req.cloudinaryUploads?.image?.[0]?.secure_url) {
      if (banner.imagePublicId) {
        try {
          await deleteFromCloudinary(banner.imagePublicId);
        } catch (e) {
          console.warn("Cloudinary cleanup warning:", e.message);
        }
      }
      banner.imageUrl = req.cloudinaryUploads.image[0].secure_url;
      banner.imagePublicId = req.cloudinaryUploads.image[0].public_id;
    } else if (req.body.imageUrl) {
      banner.imageUrl = req.body.imageUrl;
      if (req.body.imagePublicId) banner.imagePublicId = req.body.imagePublicId;
    }

    banner.updatedAt = new Date();
    await banner.save();

    res.json({
      success: true,
      data: banner,
      message: "Banner updated successfully",
    });
  } catch (err) {
    console.error("Error updating banner:", err);
    res.status(500).json({
      success: false,
      message: "Server error while updating banner",
    });
  }
};

// Update banner status
exports.updateBannerStatus = async (req, res) => {
  try {
    const { isActive } = req.body;
    const banner = await Banner.findByIdAndUpdate(
      req.params.id,
      { isActive: isActive === true || isActive === "true" },
      { new: true }
    );

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found",
      });
    }

    res.json({
      success: true,
      data: banner,
      message: "Banner status updated successfully",
    });
  } catch (err) {
    console.error("Error updating banner status:", err);
    res.status(500).json({
      success: false,
      message: "Server error while updating banner status",
    });
  }
};

// Delete a banner
exports.deleteBanner = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found",
      });
    }

    // Delete image from Cloudinary if stored
    if (banner.imagePublicId) {
      try {
        await deleteFromCloudinary(banner.imagePublicId);
      } catch (e) {
        console.warn("Cloudinary cleanup warning:", e.message);
      }
    }

    await Banner.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: "Banner deleted successfully",
    });
  } catch (err) {
    console.error("Error deleting banner:", err);
    res.status(500).json({
      success: false,
      message: "Server error while deleting banner",
    });
  }
};
