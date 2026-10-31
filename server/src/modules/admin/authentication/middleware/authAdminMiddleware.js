const jwt = require("jsonwebtoken");
const Admin = require("../models/admin");
const User = require("../../../users/models/user");

// Admin authentication middleware
const adminAuthMiddleware = async (req, res, next) => {
  try {
    let token;

    // 1. Try to get token from cookies
    if (req.cookies && (req.cookies.token || req.cookies.adminToken)) {
      token = req.cookies.adminToken || req.cookies.token;
    }

    // 2. Fallback: Check Authorization header
    const authHeader = req.headers.authorization;
    if (!token && authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({ success: false, message: "Authentication required: No token provided" });
    }

    const secret = process.env.JWT_SECRET;
    const decoded = jwt.verify(token, secret);

    // 1. Reject intermediate MFA / challenge tokens
    if (decoded.mfaPending || decoded.purpose === "mfa_challenge" || decoded.stage) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Incomplete authentication challenge",
      });
    }

    // 2. Reject wrong-purpose tokens (e.g. password reset, email verification)
    if (decoded.purpose && !["auth", "login", "admin_session"].includes(decoded.purpose)) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Invalid token purpose",
      });
    }

    // 3. Reject non-admin role tokens immediately (prevent user or seller token elevation)
    if (decoded.role && !["admin", "super-admin", "editor"].includes(decoded.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied: Admin privileges required",
      });
    }

    // 4. Find admin in Admin collection or User collection with role 'admin'
    let admin = null;
    const adminId = decoded.id || decoded.userId || decoded._id;
    if (adminId) {
      admin = await Admin.findById(adminId);
      if (!admin) {
        admin = await User.findOne({ _id: adminId, role: { $in: ["admin", "super-admin"] } }).select("-password");
      }
      // If an explicit ID was provided but no admin account matched, do NOT fallback to email
      if (!admin) {
        return res.status(403).json({ success: false, message: "Access denied: Admin privileges required" });
      }
    } else if (decoded.email) {
      admin = await Admin.findOne({ email: decoded.email });
      if (!admin) {
        admin = await User.findOne({ email: decoded.email, role: { $in: ["admin", "super-admin"] } }).select("-password");
      }
    }

    if (!admin) {
      return res.status(403).json({ success: false, message: "Access denied: Admin privileges required" });
    }

    // 5. Check if administrator account is suspended or disabled
    if (admin.status === "Suspended" || admin.accountStatus === "suspended" || admin.status === "Disabled") {
      const isProduction = process.env.NODE_ENV === "production";
      const cookieOptions = {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "None" : "Lax",
        path: "/",
      };
      res.clearCookie("adminToken", cookieOptions);
      res.clearCookie("token", cookieOptions);
      return res.status(403).json({
        success: false,
        message: "Access denied: Administrator account has been suspended",
      });
    }

    // 6. Check if password was changed after token was issued
    if (
      admin.passwordChangedAt &&
      decoded.iat < Math.floor(admin.passwordChangedAt.getTime() / 1000)
    ) {
      return res
        .status(401)
        .json({ success: false, message: "Password recently changed, please login again" });
    }

    const adminModel = admin instanceof Admin ? "Admin" : "User";

    req.userId = (admin._id || admin.id).toString();
    req.user = admin;
    req.admin = admin;
    req.role = admin.role || "admin";
    req.adminModel = adminModel;
    req.adminEmail = admin.email;

    if (
      admin instanceof Admin &&
      admin._id &&
      (!admin.lastLogin || Date.now() - new Date(admin.lastLogin).getTime() > 15 * 60 * 1000)
    ) {
      const now = new Date();
      const cutoff = new Date(now.getTime() - 15 * 60 * 1000);
      admin.lastLogin = now;
      Admin.updateOne(
        {
          _id: admin._id,
          $or: [
            { lastLogin: { $exists: false } },
            { lastLogin: null },
            { lastLogin: { $lt: cutoff } },
          ],
        },
        { $set: { lastLogin: now } }
      ).catch((err) => {
        console.warn("Throttled admin lastLogin update notice:", err.message);
      });
    }

    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ success: false, message: "Invalid authentication token" });
    }
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ success: false, message: "Authentication token expired" });
    }

    console.error("Admin auth middleware error:", error.message);
    return res.status(401).json({ success: false, message: "Unauthorized: Authentication error" });
  }
};

module.exports = adminAuthMiddleware;
