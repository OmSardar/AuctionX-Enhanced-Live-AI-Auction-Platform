const jwt = require('jsonwebtoken');
const Seller = require("../models/seller");
const User = require("../../../users/models/user");

exports.protectSellerRoute = async (req, res, next) => {
  try {
    let token;

    // Check for token in cookies or Authorization header
    if (req.cookies && (req.cookies.sellerToken || req.cookies.token)) {
      token = req.cookies.sellerToken || req.cookies.token;
    } else if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer ')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route: No token provided'
      });
    }

    // Verify token
    const secret = process.env.JWT_SECRET;
    const decoded = jwt.verify(token, secret);

    // Reject intermediate MFA / challenge tokens
    if (decoded.mfaPending || decoded.purpose === "mfa_challenge" || decoded.stage) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Incomplete authentication challenge",
      });
    }

    // Reject wrong-purpose tokens (e.g. password reset, email verification)
    if (decoded.purpose && !["auth", "login", "seller_session", "seller"].includes(decoded.purpose)) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Invalid token purpose",
      });
    }

    // Role check: Reject tokens explicitly declaring a non-seller role (e.g. ordinary buyer)
    if (decoded.role && !["seller", "admin", "super-admin"].includes(decoded.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied: Seller privileges required",
      });
    }

    // Check if seller exists in Seller or User collection
    let seller = null;
    const sellerId = decoded.id || decoded.userId || decoded._id;
    if (sellerId) {
      seller = await Seller.findById(sellerId).select("-password");
      if (!seller) {
        seller = await User.findOne({ _id: sellerId, $or: [{ role: "seller" }, { isSeller: true }] }).select("-password");
      }
      // If explicit ID was provided but no account matched, do NOT fall back to email
      if (!seller) {
        return res.status(404).json({
          success: false,
          message: "Seller not found",
        });
      }
    } else if (decoded.email) {
      seller = await Seller.findOne({ email: decoded.email }).select("-password");
      if (!seller) {
        seller = await User.findOne({ email: decoded.email, $or: [{ role: "seller" }, { isSeller: true }] }).select("-password");
      }
    }

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller not found'
      });
    }

    // Verify account has authorized seller status
    if (seller.role && !["seller", "admin", "super-admin"].includes(seller.role) && !seller.isSeller) {
      return res.status(403).json({
        success: false,
        message: "Access denied: Seller privileges required",
      });
    }

    // Authoritative suspension check
    if (seller.status === "Suspended") {
      const isProduction = process.env.NODE_ENV === "production";
      res.clearCookie("sellerToken", {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "None" : "Lax",
      });
      res.clearCookie("token", {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "None" : "Lax",
      });
      return res.status(403).json({
        success: false,
        message: `Seller account has been suspended${seller.suspensionReason ? `: ${seller.suspensionReason}` : ""}`,
        status: "Suspended",
        reason: seller.suspensionReason || "Account suspended by administrator",
      });
    }

    // Add seller and user to request object
    req.seller = seller;
    req.user = seller;
    req.userId = seller._id;

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }
    console.error('Seller auth middleware error:', error);
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route'
    });
  }
};