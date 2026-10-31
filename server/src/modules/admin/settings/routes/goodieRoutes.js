const express = require("express");
const router = express.Router();
const goodieController = require("../controllers/goodieControllers");
const adminAuthMiddleware = require("../../authentication/middleware/authAdminMiddleware");

// Public read endpoints
router.get("/", goodieController.getAllGoodies);
router.get("/category/:category", goodieController.getGoodiesByCategory);

// Admin-protected mutations
router.post("/", adminAuthMiddleware, goodieController.createGoodie);
router.patch("/:id", adminAuthMiddleware, goodieController.updateGoodie);
router.delete("/:id", adminAuthMiddleware, goodieController.deleteGoodie);

module.exports = router;

