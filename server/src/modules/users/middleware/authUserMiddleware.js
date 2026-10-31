// /middleware/LoginMiddleware/authUserMiddleware.js

const jwt = require("jsonwebtoken");
const User = require("../models/user");
const Seller = require("../../sellers/accounts/models/seller");

const authUserMiddleware = async (req, res, next) => {
  try {
    let token;

    // 1. Try to get token from cookies with route-context awareness to prevent session collisions
    const isSellerContext =
      (req.baseUrl && req.baseUrl.includes("/seller")) ||
      (req.originalUrl && req.originalUrl.includes("/seller"));

    if (isSellerContext && req.cookies?.sellerToken) {
      token = req.cookies.sellerToken;
    } else if (req.cookies?.token) {
      token = req.cookies.token;
    } else if (req.cookies?.sellerToken) {
      token = req.cookies.sellerToken;
    }

    // 2. Fallback: Check Authorization header
    const authHeader = req.headers.authorization;
    if (!token && authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }

    if (!token) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized: No token provided" });
    }

    // 3. Verify the token
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
    if (decoded.purpose) {
      if (isSellerContext) {
        if (!["auth", "login", "seller_session", "seller"].includes(decoded.purpose)) {
          return res.status(401).json({
            success: false,
            message: "Unauthorized: Invalid token purpose",
          });
        }
      } else if (!["auth", "login", "user_session", "seller_session", "seller"].includes(decoded.purpose)) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized: Invalid token purpose",
        });
      }
    }

    // Role check for seller context: Reject tokens explicitly declaring a non-seller role
    if (isSellerContext && decoded.role && !["seller", "admin", "super-admin"].includes(decoded.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied: Seller privileges required",
      });
    }

    // 4. Find user or seller by ID or email
    let user = null;
    const userId = decoded.id || decoded.userId || decoded._id;
    if (userId) {
      if (isSellerContext) {
        user = await Seller.findById(userId).select("-password");
        if (!user) {
          user = await User.findOne({
            _id: userId,
            $or: [{ role: { $in: ["seller", "admin", "super-admin"] } }, { isSeller: true }],
          }).select("-password");
        }
      } else {
        user = await User.findById(userId).select("-password");
        if (!user) {
          user = await Seller.findById(userId).select("-password");
        }
      }
      // If explicit ID was provided but no account matched, do NOT fall back to email
      if (!user) {
        return res.status(404).json({ success: false, message: isSellerContext ? "Seller not found" : "User not found" });
      }
    } else if (decoded.email) {
      if (isSellerContext) {
        user = await Seller.findOne({ email: decoded.email }).select("-password");
        if (!user) {
          user = await User.findOne({
            email: decoded.email,
            $or: [{ role: { $in: ["seller", "admin", "super-admin"] } }, { isSeller: true }],
          }).select("-password");
        }
      } else {
        user = await User.findOne({ email: decoded.email }).select("-password");
        if (!user) {
          user = await Seller.findOne({ email: decoded.email }).select("-password");
        }
      }
    }

    if (!user) {
      return res.status(404).json({ success: false, message: isSellerContext ? "Seller not found" : "User not found" });
    }

    // Verify account has authorized seller status when in seller context
    if (isSellerContext && user.role && !["seller", "admin", "super-admin"].includes(user.role) && !user.isSeller) {
      return res.status(403).json({
        success: false,
        message: "Access denied: Seller privileges required",
      });
    }

    // 4.1 Authoritative suspension check
    if (user.status === "Suspended") {
      const isProduction = process.env.NODE_ENV === "production";
      res.clearCookie("token", {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "None" : "Lax",
      });
      res.clearCookie("sellerToken", {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "None" : "Lax",
      });
      return res.status(403).json({
        success: false,
        message: `Account has been suspended${user.suspensionReason ? `: ${user.suspensionReason}` : ""}`,
        status: "Suspended",
        reason: user.suspensionReason || "Account suspended by administrator",
      });
    }

    // 5. Attach user to request
    req.user = user;
    req.userId = user._id;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Token expired",
      });
    }
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Invalid token",
      });
    }

    console.error("Token verification error:", error.message);
    return res.status(401).json({
      success: false,
      message: "Unauthorized: Authentication failed",
      error: error.message,
    });
  }
};

const optionalAuthUserMiddleware = async (req, res, next) => {
  try {
    let token;

    if (req.cookies && (req.cookies.token || req.cookies.sellerToken)) {
      token = req.cookies.token || req.cookies.sellerToken;
    }

    const authHeader = req.headers.authorization;
    if (!token && authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }

    if (!token) {
      req.user = null;
      return next();
    }

    const secret = process.env.JWT_SECRET;
    const decoded = jwt.verify(token, secret);

    let user = null;
    if (decoded.id) {
      user = await User.findById(decoded.id).select("-password");
      if (!user) {
        user = await Seller.findById(decoded.id).select("-password");
      }
    }

    if (!user && decoded.email) {
      user = await User.findOne({ email: decoded.email }).select("-password");
      if (!user) {
        user = await Seller.findOne({ email: decoded.email }).select("-password");
      }
    }

    if (user && user.status === "Suspended") {
      const isProduction = process.env.NODE_ENV === "production";
      res.clearCookie("token", {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "None" : "Lax",
      });
      res.clearCookie("sellerToken", {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "None" : "Lax",
      });
      return res.status(403).json({
        success: false,
        message: `Account has been suspended${user.suspensionReason ? `: ${user.suspensionReason}` : ""}`,
        status: "Suspended",
        reason: user.suspensionReason || "Account suspended by administrator",
      });
    }

    req.user = user || null;
    req.userId = user?._id || null;
    next();
  } catch (error) {
    req.user = null;
    next();
  }
};

authUserMiddleware.optional = optionalAuthUserMiddleware;

module.exports = authUserMiddleware;
module.exports.authUserMiddleware = authUserMiddleware;
module.exports.optionalAuthUserMiddleware = optionalAuthUserMiddleware;
