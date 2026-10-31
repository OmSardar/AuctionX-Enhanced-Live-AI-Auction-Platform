const express = require("express");
const router = express.Router();
const bannerController = require("../controllers/bannerController");
const handleImageUploads = require("../../../media/middleware/imageUploadMiddleware");
const adminAuthMiddleware = require("../../authentication/middleware/authAdminMiddleware");

// Configure image upload middleware specifically for banners
const uploadBannerImage = handleImageUploads([
  {
    name: "image",
    folder: "banners",
    transformation: { width: 1200, height: 400, crop: "fill" },
  },
]);

// GET /api/banners - Get all banners (public with optional ?activeOnly=true)
router.get("/", bannerController.getAllBanners);

// POST /api/banners - Create new banner (admin only)
router.post("/", adminAuthMiddleware, uploadBannerImage, bannerController.createBanner);

// PUT /api/banners/:id - Update full banner (admin only)
router.put("/:id", adminAuthMiddleware, uploadBannerImage, bannerController.updateBanner);

// PATCH /api/banners/:id - Update banner status (admin only)
router.patch("/:id", adminAuthMiddleware, bannerController.updateBannerStatus);

// DELETE /api/banners/:id - Delete banner (admin only)
router.delete("/:id", adminAuthMiddleware, bannerController.deleteBanner);

module.exports = router;
