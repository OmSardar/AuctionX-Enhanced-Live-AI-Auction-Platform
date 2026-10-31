const jwt = require("jsonwebtoken");
const UserModel = require("../../users/models/user");
const SellerModel = require("../../sellers/accounts/models/seller");
const AdminModel = require("../../admin/authentication/models/admin");
const bcrypt = require("bcrypt");
const JWT_SECRET = process.env.JWT_SECRET;

// Middleware to check if the user is an admin
const isAdmin = async (req, res, next) => {
  try {
    let token = req.cookies?.adminToken || req.cookies?.token;
    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized: No token provided" });
    }

    // Verify the token
    const decoded = jwt.verify(token, JWT_SECRET);

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
        message: "Unauthorized: User is not an admin",
      });
    }

    const adminId = decoded.id || decoded.userId || decoded._id;
    let user = null;
    if (adminId) {
      user = await AdminModel.findById(adminId);
      if (!user) {
        user = await UserModel.findOne({ _id: adminId, role: { $in: ["admin", "super-admin"] } });
      }
      // If an explicit ID was provided but no admin account matched, do NOT fallback to email
      if (!user) {
        return res.status(403).json({ success: false, message: "Unauthorized: User is not an admin" });
      }
    } else if (decoded.email) {
      user = await AdminModel.findOne({ email: decoded.email });
      if (!user) {
        user = await UserModel.findOne({ email: decoded.email, role: { $in: ["admin", "super-admin"] } });
      }
    }

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // 4. Check if the administrator is suspended or disabled
    if (user.status === "Suspended" || user.accountStatus === "suspended" || user.status === "Disabled") {
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
        message: `Account has been suspended${user.suspensionReason ? `: ${user.suspensionReason}` : ""}`,
        status: "Suspended",
      });
    }

    // 5. Check if the user has an authorized admin role
    const effectiveRole = user.role || (user instanceof AdminModel ? "admin" : null);
    if (!effectiveRole || !["admin", "super-admin", "editor"].includes(effectiveRole)) {
      return res
        .status(403)
        .json({ success: false, message: "Unauthorized: User is not an admin" });
    }

    // 6. Check if password was changed after token was issued
    if (
      user.passwordChangedAt &&
      decoded.iat < Math.floor(user.passwordChangedAt.getTime() / 1000)
    ) {
      return res
        .status(401)
        .json({ success: false, message: "Password recently changed, please login again" });
    }

    // Attach the user to the request object
    req.user = user;
    req.userId = (user._id || user.id).toString();
    req.admin = user;
    req.role = effectiveRole;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ success: false, message: "Unauthorized: Token expired" });
    }
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ success: false, message: "Unauthorized: Invalid token" });
    }
    console.error("Admin Middleware Error:", error.message);
    return res.status(401).json({ success: false, message: "Unauthorized: Authentication error" });
  }
};

// Middleware to check if the user is authenticated
const IsUser = async (req, res, next) => {
  try {
    let token = req.cookies?.token;
    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res
        .status(401)
        .json({ message: "Unauthorized: No token provided" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    // Reject intermediate MFA / challenge tokens
    if (decoded.mfaPending || decoded.purpose === "mfa_challenge" || decoded.stage) {
      return res.status(401).json({
        message: "Unauthorized: Incomplete authentication challenge",
      });
    }

    // Reject wrong-purpose tokens (e.g. password reset, email verification)
    if (decoded.purpose && !["auth", "login", "user_session"].includes(decoded.purpose)) {
      return res.status(401).json({
        message: "Unauthorized: Invalid token purpose",
      });
    }

    const user = await UserModel.findById(decoded.id || decoded.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.status === "Suspended") {
      const isProduction = process.env.NODE_ENV === "production";
      res.clearCookie("token", {
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

    req.user = user; // Attach user to request
    return next();
  } catch (error) {
    console.error("JWT Verification Error:", error);
    return res
      .status(401)
      .json({ message: "Unauthorized: Invalid or expired token" });
  }
};

// Middleware to check if the user is authenticated
const IsSeller = async (req, res, next) => {
  try {
    let token = req.cookies?.sellerToken || req.cookies?.token;
    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res
        .status(401)
        .json({ message: "Unauthorized: No token provided" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    // Reject intermediate MFA / challenge tokens
    if (decoded.mfaPending || decoded.purpose === "mfa_challenge" || decoded.stage) {
      return res.status(401).json({
        message: "Unauthorized: Incomplete authentication challenge",
      });
    }

    // Reject wrong-purpose tokens (e.g. password reset, email verification)
    if (decoded.purpose && !["auth", "login", "seller_session", "seller"].includes(decoded.purpose)) {
      return res.status(401).json({
        message: "Unauthorized: Invalid token purpose",
      });
    }

    const user = await SellerModel.findById(decoded.id || decoded.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

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
        message: `Seller account has been suspended${user.suspensionReason ? `: ${user.suspensionReason}` : ""}`,
        status: "Suspended",
        reason: user.suspensionReason || "Account suspended by administrator",
      });
    }

    req.user = user; // Attach user to request
    return next();
  } catch (error) {
    console.error("JWT Verification Error:", error);
    return res
      .status(401)
      .json({ message: "Unauthorized: Invalid or expired token" });
  }
};

// Middleware to check if the user is authenticated via Google
const IsGUser = async (req, res, next) => {
  try {
    let token = req.cookies?.token;
    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({ message: "Unauthorized: No token provided" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await UserModel.findById(decoded.id || decoded.userId || decoded._id);
    if (user && user.status === "Suspended") {
      const isProduction = process.env.NODE_ENV === "production";
      res.clearCookie("token", {
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

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Unauthorized: Invalid token" });
  }
};

// Middleware to check if a user exists by email
const checkUserByEmail = async (req, res, next) => {
  const { email } = req.body;

  try {
    // Find the user by email
    const user = await UserModel.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.status === "Suspended") {
      return res.status(403).json({
        success: false,
        message: `Account has been suspended${user.suspensionReason ? `: ${user.suspensionReason}` : ""}`,
        status: "Suspended",
      });
    }

    // Attach the user to the request object
    req.user = user;
    next();
  } catch (error) {
    console.error("Check User By Email Error:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

// Middleware to check if a user exists by email
const checkSellerByEmail = async (req, res, next) => {
  const { email } = req.body;

  try {
    // Find the user by email
    const user = await SellerModel.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.status === "Suspended") {
      return res.status(403).json({
        success: false,
        message: `Seller account has been suspended${user.suspensionReason ? `: ${user.suspensionReason}` : ""}`,
        status: "Suspended",
      });
    }

    // Attach the user to the request object
    req.user = user;
    next();
  } catch (error) {
    console.error("Check User By Email Error:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

// Middleware to update user password (requires authentication — CRIT-02 fix)
const updatePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const authUser = req.user; // Retrieved from authUserMiddleware

  try {
    if (!authUser) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Check if newPassword is valid
    if (!newPassword) {
      return res.status(400).json({ message: "New password is required" });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters long" });
    }

    // Retrieve user/seller with password hash included (authUserMiddleware strips password)
    let user = null;
    if (authUser.role === "seller") {
      user = await SellerModel.findById(authUser._id).select("+password");
    } else {
      user = await UserModel.findById(authUser._id).select("+password");
    }
    if (!user) {
      user = await SellerModel.findById(authUser._id).select("+password");
    }
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // If user does not have a local password (Google sign-in only), reject password change
    if (!user.password || user.password.length === 0) {
      return res.status(400).json({
        message: "Password management is unavailable for Google sign-in accounts.",
      });
    }

    if (!currentPassword) {
      return res.status(400).json({ message: "Current password is required" });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({ message: "New password must be different from current password" });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update the user's password
    user.password = hashedPassword;
    await user.save();

    return res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Update Password Error:", error.message);
    return res
      .status(500)
      .json({ message: "Server error" });
  }
};

module.exports = {
  isAdmin,
  IsUser,
  IsSeller,
  IsGUser,
  checkUserByEmail,
  checkSellerByEmail,
  updatePassword,
};
