const express = require("express");
const productRoutes = express.Router();
const {
  createProduct,
  patchProduct,
  updateProductStatus,
  deleteSuccessProduct,
  getAllProducts,
  getProductsByEmail,
  getProductById,
  getProductsByCategory,
  updateProduct,
  deleteProduct,
  deleteMultipleProducts,
  deleteImage,
  submitFeedback,
  placeBid,
  getBidHistory,
} = require("../controllers/productController");

const checkTimeRestriction = require("../../bidding/middleware/checkTimeRestriction");
const {
  handleImageUploads,
} = require("../../media/middleware/cloudinaryMiddleware");
const handleContactSubmission = require("../../../common/utilities/contactUsEmailSender");
const authUserMiddleware = require("../../users/middleware/authUserMiddleware");
const {
  validateObjectId,
  validatePositiveNumber,
} = require("../../../infrastructure/security/validationMiddleware");

//-------------------Product-------------------//

// POST endpoint to create a product (requires authentication)
productRoutes.post("/", authUserMiddleware, handleImageUploads, createProduct);

// GET endpoint to get all products (public marketplace browsing)
productRoutes.get("/", getAllProducts);

// GET endpoint to get a product by EMAIL
productRoutes.get("/email/:email", getProductsByEmail);

// GET endpoint to get a product by ID
productRoutes.get("/:id", validateObjectId("id"), getProductById);

productRoutes.get("/category/:category", getProductsByCategory);

// PUT endpoint to update a product by ID (requires authentication & ownership)
productRoutes.put(
  "/:id",
  validateObjectId("id"),
  authUserMiddleware,
  checkTimeRestriction,
  handleImageUploads,
  updateProduct
);

// Status update (requires authentication & ownership)
productRoutes.patch(
  "/statuspatch/:id",
  validateObjectId("id"),
  authUserMiddleware,
  updateProductStatus
);

// DELETE endpoint to delete a product by ID (requires authentication & ownership)
productRoutes.delete(
  "/:id",
  validateObjectId("id"),
  authUserMiddleware,
  checkTimeRestriction,
  deleteProduct
);

productRoutes.delete("/delete-multiple", authUserMiddleware, deleteMultipleProducts);

// DELETE endpoint to delete a successful product (requires authentication & ownership)
productRoutes.delete(
  "/deleteSuccessProduct/:id",
  validateObjectId("id"),
  authUserMiddleware,
  deleteSuccessProduct
);

// DELETE endpoint to delete a product's cloudinary Image by ID (requires authentication & ownership)
productRoutes.delete("/delete-image", authUserMiddleware, deleteImage);

//-------------------Feedback-------------------//

// POST endpoint to submit feedback (requires authentication)
productRoutes.post("/submit", authUserMiddleware, submitFeedback);

//-------------------Bidding-------------------//

// POST endpoint to place an authoritative bid (requires authentication)
productRoutes.post(
  "/:id/bid",
  authUserMiddleware,
  validateObjectId("id"),
  validatePositiveNumber("amount", { required: true }),
  placeBid
);

// GET endpoint to view bid history for an auction
productRoutes.get("/:id/bids", validateObjectId("id"), getBidHistory);

// PATCH endpoint to update temporary bidding data (DEPRECATED — returns 403)
productRoutes.patch(
  "/tempdata/:id",
  validateObjectId("id"),
  validatePositiveNumber("tempamount", { required: false }),
  patchProduct
);

//-------------------Contact-Us-------------------//

// POST endpoint for contact form submissions (public)
productRoutes.post("/contact-us", handleContactSubmission);

module.exports = productRoutes;
