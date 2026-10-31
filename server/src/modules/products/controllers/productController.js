const Product = require("../models/productSchema");
const {
  cloudinary,
  deleteFromCloudinary,
} = require("../../media/middleware/cloudinaryMiddleware");
const {
  getAuctionTimeStatus,
} = require("../../bidding/middleware/checkTimeRestriction");
const {
  placeBid: executePlaceBid,
  getBidHistory: fetchBidHistory,
  BidError,
} = require("../../bidding/services/bidService");
const {
  checkSellerListingEntitlement,
} = require("../../subscriptions/services/subscriptionService");

// Create a new product
exports.createProduct = async (req, res) => {
  try {
    const {
      name,
      category,
      description,
      mobileNumber,
      biddingStartDate,
      biddingStartTime,
      biddingStartPrice,
      email,
      hasBanner,
      bannerPlan,
    } = req.body;

    // Validate required fields
    if (
      !name ||
      !category ||
      !description ||
      !mobileNumber ||
      !biddingStartDate ||
      !biddingStartTime ||
      !biddingStartPrice
    ) {
      return res.status(400).json({
        success: false,
        message: "All required fields must be provided",
      });
    }

    // Enforce subscription active listing entitlement
    const sellerEmail = (req.user ? req.user.email : email || "").trim().toLowerCase();
    if (sellerEmail) {
      const entitlement = await checkSellerListingEntitlement(sellerEmail);
      if (!entitlement.allowed) {
        return res.status(403).json({
          success: false,
          code: "SUBSCRIPTION_LIMIT_EXCEEDED",
          message: entitlement.message,
          currentUsage: entitlement.currentCount,
          maxListings: entitlement.limit,
          planName: entitlement.planName,
        });
      }
    }

    // Validate that at least one product image is uploaded
    const imagesToSave = req.productImages || req.body.images;
    if (!imagesToSave || imagesToSave.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one product image is required",
      });
    }

    // Validate starting price
    const startPriceNum = Number(biddingStartPrice);
    if (isNaN(startPriceNum) || !isFinite(startPriceNum) || startPriceNum <= 0) {
      return res.status(400).json({
        success: false,
        message: "Starting price must be a positive finite number",
      });
    }

    // Convert bidding start time to UTC
    const startDateTimeLocal = new Date(
      `${biddingStartDate}T${biddingStartTime}:00`
    );
    if (isNaN(startDateTimeLocal.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid bidding start date or time format",
      });
    }
    const startDateTimeUTC = new Date(startDateTimeLocal.toISOString());

    // Calculate bidding end time in UTC
    const endDateTimeUTC = new Date(startDateTimeUTC.getTime() + 2 * 60 * 1000);
    const maxExtensionDeadline = new Date(
      endDateTimeUTC.getTime() + 15 * 60 * 1000
    );

    // Parse the description points and convert to JSON
    const descriptionPoints = JSON.parse(description);

    // Create product object with canonical and backward-compatible fields
    const productData = {
      name,
      category,
      description: descriptionPoints,
      mobileNumber,
      biddingStartDate: startDateTimeUTC.toISOString(),
      biddingStartTime: startDateTimeUTC.toISOString(),
      biddingStartPrice: startPriceNum,
      email: req.user ? req.user.email : email,
      images: imagesToSave,
      biddingEndTime: endDateTimeUTC.toISOString(),
      hasBanner: hasBanner === "true",

      // Authoritative Canonical Fields
      startingPrice: startPriceNum,
      currentPrice: startPriceNum,
      bidCount: 0,
      minIncrement: 50,
      startTime: startDateTimeUTC,
      originalEndTime: endDateTimeUTC,
      endTime: endDateTimeUTC,
      maxExtensionDeadline,
      antiSnipeCount: 0,
      status: req.body.status || "Active",
      highestBidder: null,
      highestBidderEmail: null,
      highestBidderName: null,
    };

    // If banner is selected, add banner info
    if (hasBanner === "true" && req.bannerImage) {
      productData.bannerImage = req.bannerImage;
      productData.bannerPlan = bannerPlan;
    }

    // Save the product to the database
    const newProduct = await Product.create(productData);

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      product: newProduct,
    });
  } catch (error) {
    console.error("Error creating product:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create product",
    });
  }
};

const jwt = require("jsonwebtoken");
const Admin = require("../../admin/authentication/models/admin");
const User = require("../../users/models/user");
const Seller = require("../../sellers/accounts/models/seller");

const isAuthorizedAdminRequest = async (req) => {
  if (req.user && (["admin", "super-admin"].includes(req.user.role) || req.role === "admin")) {
    return true;
  }
  let token = req.cookies?.adminToken || req.cookies?.token;
  const authHeader = req.headers?.authorization;
  if (!token && authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  }
  if (!token) return false;
  try {
    const secret = process.env.JWT_SECRET;
    const decoded = jwt.verify(token, secret);
    if (decoded.mfaPending || decoded.purpose === "mfa_challenge" || decoded.stage) return false;
    if (decoded.purpose && !["auth", "login", "admin_session"].includes(decoded.purpose)) return false;
    if (decoded.role && !["admin", "super-admin", "editor"].includes(decoded.role)) return false;
    if (decoded.id) {
      const admin = await Admin.findById(decoded.id);
      if (admin && admin.status !== "Suspended") return true;
      const user = await User.findOne({ _id: decoded.id, role: { $in: ["admin", "super-admin"] } });
      if (user && user.status !== "Suspended") return true;
    }
    if (decoded.email) {
      const admin = await Admin.findOne({ email: decoded.email });
      if (admin && admin.status !== "Suspended") return true;
      const user = await User.findOne({ email: decoded.email, role: { $in: ["admin", "super-admin"] } });
      if (user && user.status !== "Suspended") return true;
    }
  } catch (e) {
    return false;
  }
  return false;
};

const resolveCallerIdentity = async (req) => {
  if (req.user) return req.user;
  let token = req.cookies?.token || req.cookies?.sellerToken || req.cookies?.adminToken;
  const authHeader = req.headers?.authorization;
  if (!token && authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  }
  if (!token) return null;
  try {
    const secret = process.env.JWT_SECRET;
    const decoded = jwt.verify(token, secret);
    if (decoded.mfaPending || decoded.purpose === "mfa_challenge" || decoded.stage) return null;
    if (decoded.purpose && !["auth", "login", "user_session", "seller_session", "seller", "admin_session"].includes(decoded.purpose)) return null;
    if (decoded.id) {
      const admin = await Admin.findById(decoded.id);
      if (admin && admin.status !== "Suspended") return admin;
      const user = await User.findById(decoded.id);
      if (user && user.status !== "Suspended") return user;
      const seller = await Seller.findById(decoded.id);
      if (seller && seller.status !== "Suspended") return seller;
    }
    if (decoded.email) {
      const admin = await Admin.findOne({ email: decoded.email });
      if (admin && admin.status !== "Suspended") return admin;
      const user = await User.findOne({ email: decoded.email });
      if (user && user.status !== "Suspended") return user;
      const seller = await Seller.findOne({ email: decoded.email });
      if (seller && seller.status !== "Suspended") return seller;
    }
  } catch (e) {
    return null;
  }
  return null;
};

// Get all products (supports optional status filtering, e.g., ?status=SCHEDULED, and select projection)
exports.getAllProducts = async (req, res) => {
  try {
    const filter = {};
    if (req?.query?.status) {
      filter.status = req.query.status;
    }
    // Public discovery excludes moderated/removed listings unless explicitly requested by authorized admin
    const isAdmin = await isAuthorizedAdminRequest(req);
    if (!isAdmin || !req.query?.includeModerated) {
      filter.isModerated = { $ne: true };
      filter.moderationStatus = { $nin: ["REMOVED", "SUSPENDED"] };
    }

    let query = Product.find(filter);
    if (req.query?.select && typeof req.query.select === "string") {
      const allowedFields = [
        "name",
        "category",
        "status",
        "startingPrice",
        "currentPrice",
        "biddingStartPrice",
        "createdAt",
        "endTime",
        "biddingEndTime",
      ];
      const requestedFields = req.query.select
        .split(",")
        .map((f) => f.trim())
        .filter((f) => allowedFields.includes(f));
      if (requestedFields.length > 0) {
        query = query.select(requestedFields.join(" "));
      }
    }

    const products = await query.sort({ createdAt: -1 }).lean();
    res.status(200).json({
      success: true,
      count: products.length,
      products,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch products",
    });
  }
};

// Get products by email
exports.getProductsByEmail = async (req, res) => {
  try {
    const { email } = req.params;
    const filter = { email };

    // Check if the caller is the seller themself or an admin
    const caller = await resolveCallerIdentity(req);
    const isOwner = caller && caller.email && caller.email.toLowerCase() === email.toLowerCase();
    const isAdmin = caller && (["admin", "super-admin"].includes(caller.role) || (caller instanceof Admin));

    // If not the owner and not an admin (i.e. public visitor), exclude moderated listings
    if (!isOwner && !isAdmin) {
      filter.isModerated = { $ne: true };
      filter.moderationStatus = { $nin: ["REMOVED", "SUSPENDED"] };
    }

    const products = await Product.find(filter).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: products.length,
      products,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch products",
    });
  }
};

// Get product by ID
exports.getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id).lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // If product is moderated or removed, forbid public access unless requester is an admin
    if (product.isModerated || ["REMOVED", "SUSPENDED"].includes(product.moderationStatus)) {
      const isAdmin = await isAuthorizedAdminRequest(req);
      if (!isAdmin) {
        return res.status(404).json({
          success: false,
          message: "Product not found or has been removed by moderation",
        });
      }
    }

    res.status(200).json({
      success: true,
      product,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch product",
    });
  }
};

exports.getProductsByCategory = async (req, res) => {
  try {
    const { category } = req.params;

    // Find products by category excluding moderated items
    const products = await Product.find({
      category: category,
      status: "Active", // Only fetch active products
      isModerated: { $ne: true },
      moderationStatus: { $nin: ["REMOVED", "SUSPENDED"] },
    });

    if (!products || products.length === 0) {
      return res.status(404).json({
        message: `No products found in category: ${category}`,
      });
    }

    res.status(200).json(products);
  } catch (error) {
    console.error("Error fetching products by category:", error);
    res.status(500).json({
      message: "Server error while fetching products",
      error: error.message,
    });
  }
};

// Update product
exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // HIGH-02: Ownership check
    const isOwner = req.user && (product.email === req.user.email);
    const isAdmin = req.user && (["admin", "super-admin"].includes(req.user.role) || req.role === "admin");
    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You do not own this product",
      });
    }

    // Disallow editing moderated listings by non-admins
    if (!isAdmin && (product.isModerated || ["REMOVED", "SUSPENDED"].includes(product.moderationStatus))) {
      return res.status(403).json({
        success: false,
        code: "LISTING_MODERATED",
        message: "Cannot edit a product that has been suspended or removed by moderation",
      });
    }

    // Prevent changing product ownership or tampering with moderation state
    delete updateData.email;
    delete updateData.isModerated;
    delete updateData.moderationStatus;
    delete updateData.moderationReason;
    delete updateData.moderatedAt;
    delete updateData.moderatedBy;
    delete updateData.moderationHistory;
    delete updateData.reconciliationRequired;

    // Prevent activating or re-listing via generic update if listing quota is exceeded
    if (updateData.status === "Active" && product.status !== "Active") {
      const entitlement = await checkSellerListingEntitlement(product.email);
      if (!entitlement.allowed) {
        return res.status(403).json({
          success: false,
          code: "SUBSCRIPTION_LIMIT_EXCEEDED",
          message: entitlement.message,
          currentCount: entitlement.currentCount,
          limit: entitlement.limit,
          planName: entitlement.planName,
        });
      }
    }

    // If there are new images uploaded, add them to the product
    if (req.files && req.files.length > 0) {
      const newImages = req.files.map((file) => ({
        secure_url: file.path,
        public_id: file.filename,
      }));

      updateData.images = [...product.images, ...newImages];
    }

    // If there's a new banner image
    if (updateData.hasBanner === "true" && req.file) {
      // Delete old banner image if exists
      if (product.bannerImage && product.bannerImage.public_id) {
        await deleteFromCloudinary(product.bannerImage.public_id);
      }

      updateData.bannerImage = {
        secure_url: req.file.path,
        public_id: req.file.filename,
      };
    }

    // Parse description if it's provided as a string
    if (updateData.description && typeof updateData.description === "string") {
      updateData.description = JSON.parse(updateData.description);
    }

    const updatedProduct = await Product.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      product: updatedProduct,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update product",
    });
  }
};

// Update product status
exports.updateProductStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !["Active", "Closed"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Valid status is required",
      });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // HIGH-02: Ownership check
    const isOwner = req.user && (product.email === req.user.email);
    const isAdmin = req.user && (["admin", "super-admin"].includes(req.user.role) || req.role === "admin");
    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You do not have permission to update this product status",
      });
    }

    // Prevent re-activating a moderated listing
    if (status === "Active" && (product.isModerated || ["REMOVED", "SUSPENDED"].includes(product.moderationStatus))) {
      return res.status(403).json({
        success: false,
        code: "LISTING_MODERATED",
        message: "Cannot activate a product that has been suspended or removed by moderation",
      });
    }

    // Enforce subscription listing limit when activating or re-listing a product
    if (status === "Active" && product.status !== "Active") {
      const entitlement = await checkSellerListingEntitlement(product.email);
      if (!entitlement.allowed) {
        return res.status(403).json({
          success: false,
          code: "SUBSCRIPTION_LIMIT_EXCEEDED",
          message: entitlement.message,
          currentCount: entitlement.currentCount,
          limit: entitlement.limit,
          planName: entitlement.planName,
        });
      }
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: "Product status updated successfully",
      product: updatedProduct,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update product status",
    });
  }
};

// Patch product for temporary data (DISABLED/DEPRECATED in Stage 2)
// Direct unvalidated mutation of auction price/bidder is replaced by authoritative bidService
exports.patchProduct = async (req, res) => {
  return res.status(403).json({
    success: false,
    code: "ENDPOINT_DEPRECATED",
    message: "Direct mutation of temporary bidding data is disabled. Use authoritative POST /api/products/:id/bid.",
  });
};

/**
 * Authoritative HTTP Bid Placement Handler
 * POST /api/products/:id/bid
 */
exports.placeBid = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { amount, idempotencyKey } = req.body;

    const result = await executePlaceBid({
      productId: id,
      bidder: req.user,
      amount,
      ipAddress: req.ip,
      idempotencyKey,
    });

    // Real-time broadcast if socket instance is attached to app
    const io = req.app.get("io");
    if (io) {
      io.to(id).emit("productData", result.broadcastData);
      io.to(id).emit("bidPlaced", {
        productId: id,
        currentBid: result.broadcastData.currentBid,
        bidderName: result.broadcastData.bidderName,
        bidCount: result.broadcastData.bidCount,
      });
      if (result.wasExtended) {
        io.to(id).emit("auctionExtended", {
          productId: id,
          newEndTime: result.broadcastData.biddingEndTime,
        });
      }
    }

    res.status(200).json({
      success: true,
      message: "Bid placed successfully",
      data: {
        productId: id,
        currentPrice: result.product.currentPrice,
        bidCount: result.product.bidCount,
        biddingEndTime: result.broadcastData.biddingEndTime,
        wasExtended: result.wasExtended,
        bid: result.bid,
      },
    });
  } catch (error) {
    if (error instanceof BidError) {
      return res.status(error.statusCode).json({
        success: false,
        code: error.code,
        message: error.message,
        details: error.details,
      });
    }
    next(error);
  }
};

/**
 * Bid History Handler
 * GET /api/products/:id/bids
 */
exports.getBidHistory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { limit, skip } = req.query;

    const history = await fetchBidHistory(id, {
      limit: limit ? parseInt(limit, 10) : 50,
      skip: skip ? parseInt(skip, 10) : 0,
    });

    res.status(200).json(history);
  } catch (error) {
    if (error instanceof BidError) {
      return res.status(error.statusCode).json({
        success: false,
        code: error.code,
        message: error.message,
      });
    }
    next(error);
  }
};

// Delete product
exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
        error: "Product not found",
      });
    }

    // HIGH-02: Ownership check
    const isOwner = req.user && (product.email === req.user.email);
    const isAdmin = req.user && (req.user.role === "admin");
    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You do not have permission to delete this product",
        error: "Forbidden: You do not have permission to delete this product",
      });
    }

    // Integrity: Disallow deleting listing if bids have already been placed
    if ((product.bidCount && product.bidCount > 0) || product.highestBidder) {
      return res.status(403).json({
        success: false,
        code: "LISTING_HAS_BIDS",
        message: "Operation not allowed: Bids have already been placed on this listing.",
        error: "Operation not allowed: Bids have already been placed on this listing.",
      });
    }

    // Integrity: Disallow deleting listing if auction has ended or closed
    const nonDeletableStatuses = ["Closed", "ENDED", "SETTLED", "AWAITING_PAYMENT"];
    if (nonDeletableStatuses.includes(product.status)) {
      return res.status(403).json({
        success: false,
        code: "AUCTION_ENDED",
        message: "Operation not allowed, auction has ended.",
        error: "Operation not allowed, auction has ended.",
      });
    }

    // Time restriction check
    const rawEndTime = product.biddingEndTime || product.bidEndTime || product.endTime;
    if (rawEndTime) {
      const bidEndTime = new Date(rawEndTime);
      if (!isNaN(bidEndTime.getTime()) && new Date() > bidEndTime) {
        return res.status(403).json({
          success: false,
          code: "BIDDING_TIME_PASSED",
          message: "Operation not allowed, bidding time has passed.",
          error: "Operation not allowed, bidding time has passed.",
        });
      }
    }

    // Delete all associated images from Cloudinary
    const deletePromises = [];

    // Delete product images
    if (product.images && product.images.length > 0) {
      product.images.forEach((image) => {
        if (image.public_id) {
          deletePromises.push(deleteFromCloudinary(image.public_id));
        }
      });
    }

    // Delete banner image if exists
    if (
      product.hasBanner &&
      product.bannerImage &&
      product.bannerImage.public_id
    ) {
      deletePromises.push(deleteFromCloudinary(product.bannerImage.public_id));
    }

    await Promise.all(deletePromises);

    // Delete product from database
    await Product.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to delete product",
      error: error.message || "Failed to delete product",
    });
  }
};

// Delete multiple products by IDs
exports.deleteMultipleProducts = async (req, res) => {
  try {
    const { ids } = req.body; // Expecting an array of product IDs

    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({
        success: false,
        message: "Invalid request. Please provide an array of product IDs",
      });
    }

    // HIGH-02: Only delete products owned by user unless admin
    const filter = (req.user && req.user.role === "admin")
      ? { _id: { $in: ids } }
      : { _id: { $in: ids }, email: req.user.email };

    const products = await Product.find(filter);

    if (products.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No matching products found to delete",
      });
    }

    // Filter out products with bids or ended auctions
    const deletableProducts = products.filter((p) => {
      const hasBids = (p.bidCount && p.bidCount > 0) || p.highestBidder;
      const isEnded = ["Closed", "ENDED", "SETTLED", "AWAITING_PAYMENT"].includes(p.status);
      const rawEndTime = p.biddingEndTime || p.bidEndTime || p.endTime;
      const timePassed = rawEndTime && !isNaN(new Date(rawEndTime).getTime()) && new Date() > new Date(rawEndTime);
      return !hasBids && !isEnded && !timePassed;
    });

    if (deletableProducts.length === 0) {
      return res.status(403).json({
        success: false,
        code: "LISTINGS_NOT_DELETABLE",
        message: "Selected products cannot be deleted because bidding has started, ended, or has active bids.",
        error: "Selected products cannot be deleted because bidding has started, ended, or has active bids.",
      });
    }

    // Delete all associated images from Cloudinary
    const deletePromises = [];

    deletableProducts.forEach((product) => {
      if (product.images && product.images.length > 0) {
        product.images.forEach((image) => {
          if (image.public_id) {
            deletePromises.push(deleteFromCloudinary(image.public_id));
          }
        });
      }

      if (
        product.hasBanner &&
        product.bannerImage &&
        product.bannerImage.public_id
      ) {
        deletePromises.push(
          deleteFromCloudinary(product.bannerImage.public_id)
        );
      }
    });

    await Promise.all(deletePromises);

    const authorizedIds = deletableProducts.map((p) => p._id);
    await Product.deleteMany({ _id: { $in: authorizedIds } });

    res.status(200).json({
      success: true,
      message: `${authorizedIds.length} products deleted successfully`,
      deletedCount: authorizedIds.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to delete products",
      error: error.message || "Failed to delete products",
    });
  }
};

// Delete successful product (after auction ends)
exports.deleteSuccessProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // HIGH-02: Ownership check
    const isOwner = req.user && (product.email === req.user.email);
    const isAdmin = req.user && (req.user.role === "admin");
    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You do not own this product",
      });
    }

    await Product.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to delete product",
    });
  }
};

// Delete specific image
exports.deleteImage = async (req, res) => {
  try {
    const { productId, imageId, public_id } = req.body;

    if (!productId || !imageId || !public_id) {
      return res.status(400).json({
        success: false,
        message: "Product ID, image ID, and public_id are required",
      });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // HIGH-02: Ownership check
    const isOwner = req.user && (product.email === req.user.email);
    const isAdmin = req.user && (req.user.role === "admin");
    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You do not own this product",
      });
    }

    // Delete from Cloudinary
    await deleteFromCloudinary(public_id);

    // Remove image from product document
    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      { $pull: { images: { _id: imageId } } },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: "Image deleted successfully",
      product: updatedProduct,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to delete image",
    });
  }
};

// Submit feedback
exports.submitFeedback = async (req, res) => {
  try {
    // Implement feedback submission logic
    // This can be connected to a separate feedback model if needed
    const { name, email, message } = req.body;

    // Validate required fields
    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        message: "Name, email and message are required",
      });
    }

    // Here you would typically save to a Feedback model
    // For now, we'll just return success

    res.status(200).json({
      success: true,
      message: "Feedback submitted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to submit feedback",
    });
  }
};
