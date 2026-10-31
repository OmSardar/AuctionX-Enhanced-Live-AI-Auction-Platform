const express = require("express");

const {
  getProfilePicByEmail,
  getUserByEmail,
  updateUserProfile,
  uploadProfilePicture,
  updateUserProfileImage,
  resetProfileImage,
} = require("../controllers/userProfileController.js");

const {
  Login,
  Logout,
  register,
  changePassword,
} = require("../controllers/userLoginController.js");

const {
  get2faStatus,
  setup2fa,
  confirm2fa,
  disable2fa,
  regenerateRecoveryCodes,
  enableEmailOtp,
  disableEmailOtp,
  verify2faLogin,
  verifyEmailOtpLogin,
  resendLoginEmailOtp,
} = require("../controllers/twoFactorController.js");

const {
  updateAmount,
  getAmount,
  getAmountbyEmail
} = require("../controllers/userPaymentController.js");

const {
  CheckUser,
  updateGProfile,
  updateProfile,
  sendOtp,
  resendOtp,
  verifyOtp,
  verifyNormalUser,
  checkAuth,
  checkAdminByEmail,
} = require("../controllers/userVerificationController.js");

const {
  IsUser,
  IsGUser,
  checkUserByEmail,
  updatePassword,
} = require("../../authentication/middleware/authOtherMiddlewares.js");

const AuthRoutes = express.Router();
const loginLimiter = require("../../../infrastructure/security/rateLimiter.js");
const handleImageUploads = require("../../media/middleware/imageUploadMiddleware.js");
const authUserMiddleware = require("../middleware/authUserMiddleware.js");
const authAdminMiddleware = require("../../admin/authentication/middleware/authAdminMiddleware");
const passport = require("passport");
const {
  handleGoogleCallback,
} = require("../controllers/userGoogleLoginController.js");

// ========================= OWNERSHIP MIDDLEWARE (HIGH-04 fix) =========================

/**
 * Middleware to verify that the authenticated user is the owner of the email param.
 * Prevents IDOR attacks where an authenticated user modifies another user's profile.
 */
const verifyOwnership = (req, res, next) => {
  const paramEmail = req.params.email;
  const userEmail = req.user?.email;

  if (!paramEmail || !userEmail) {
    return res.status(400).json({ success: false, message: "Invalid request" });
  }

  if (paramEmail.toLowerCase() !== userEmail.toLowerCase()) {
    return res.status(403).json({
      success: false,
      message: "Forbidden: You can only modify your own profile",
    });
  }

  next();
};

// ========================= GOOGLE OAUTH =========================

AuthRoutes.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

AuthRoutes.get(
  "/auth/google/callback",
  (req, res, next) => {
    passport.authenticate("google", { session: false }, (err, userPayload, info) => {
      if (err) {
        if (err.status === 403 || err.name === "AccountSuspendedError") {
          const clientURL = process.env.CLIENT_URL;
          const wantsJson = req.headers.accept && req.headers.accept.includes("application/json");
          if (clientURL && !wantsJson) {
            return res.redirect(
              `${clientURL}/login?error=account_suspended&reason=${encodeURIComponent(err.suspensionReason || "")}`
            );
          }
          return res.status(403).json({
            success: false,
            message: err.message,
            status: "Suspended",
            reason: err.suspensionReason || "Account suspended by administrator",
          });
        }
        return next(err);
      }
      if (!userPayload) {
        return res.status(401).json({ success: false, message: info?.message || "Authentication failed" });
      }
      req.user = userPayload;
      handleGoogleCallback(req, res);
    })(req, res, next);
  }
);

// ========================= LOGIN / REGISTER =========================

// POST endpoint to create an account
AuthRoutes.post("/register", loginLimiter, register);

// POST endpoint to login
AuthRoutes.post("/login", loginLimiter, Login);

// POST endpoint to logout
AuthRoutes.post("/logout", Logout);

// POST endpoint to check a user by EMAIL
AuthRoutes.post("/check-user", checkUserByEmail, (req, res) => {
  return res.status(200).json({ message: "User found", user: req.user });
});

// Auth check
AuthRoutes.get("/check", checkAuth);

// ========================= OTP =========================

// POST endpoint to send OTP
AuthRoutes.post("/send-otp", loginLimiter, sendOtp);
AuthRoutes.post("/verify-otp", loginLimiter, verifyOtp);

// POST endpoint to resend OTP
AuthRoutes.post("/resend-otp", loginLimiter, resendOtp);

// REMOVED: GET /get-otp/:email — OTPs must never be returned via API (CRIT-01)
// PATCH endpoint to confirm user verification status
AuthRoutes.patch("/verify-user", verifyNormalUser);

// ========================= ADMIN ROUTES =========================

// MED-03 fix: /check-admin now requires admin authentication
AuthRoutes.post("/check-admin", authAdminMiddleware, checkAdminByEmail);
AuthRoutes.put("/change-password", authAdminMiddleware, changePassword);

// ========================= USER VERIFICATION =========================

// GET endpoint to check a valid user
AuthRoutes.get("/checkUser", IsUser, CheckUser);

// /user/:email returns full data if authenticated owner, safe public data otherwise
AuthRoutes.get(
  "/user/:email",
  authUserMiddleware.optional || authUserMiddleware,
  getUserByEmail
);

// Support direct /:email on /api/auth/user/:email without double user segment
AuthRoutes.get(
  "/:email",
  (req, res, next) => {
    if (req.params.email && req.params.email.includes("@")) {
      return (authUserMiddleware.optional || authUserMiddleware)(req, res, () =>
        getUserByEmail(req, res, next)
      );
    }
    next();
  }
);

// GET endpoint to get a user profile picture by EMAIL
AuthRoutes.get("/profile-pic", getProfilePicByEmail);

// PATCH endpoint to update user profile (GOOGLE SIGN IN)
AuthRoutes.patch("/updateGProfile", IsGUser, loginLimiter, updateGProfile);

// PATCH endpoint to update user profile (NORMAL SIGN IN)
AuthRoutes.patch("/updateProfile", IsUser, loginLimiter, updateProfile);

// CRIT-02 fix: Password update now requires JWT authentication
AuthRoutes.patch("/update-password", authUserMiddleware, updatePassword);

// HIGH-04 fix: Profile update routes now include ownership verification
AuthRoutes.patch(
  "/updateUserProfile/:email",
  authUserMiddleware,
  verifyOwnership,
  updateUserProfile
);

// Update the upload-profile-pic route with authentication and avatar rate limiting
AuthRoutes.post(
  "/upload-profile-pic",
  authUserMiddleware,
  loginLimiter.avatarUploadLimiter,
  handleImageUploads([
    {
      name: "profilePic",
      folder: "Auction X/Components/Profile",
      transformation: [
        { width: 300, height: 300, crop: "fill", gravity: "face", format: "webp", flags: "strip_profile" },
      ],
    },
  ]),
  uploadProfilePicture
);

// HIGH-04 fix: Profile image routes now include ownership verification
AuthRoutes.patch(
  "/updateUserProfileImage/:email",
  authUserMiddleware,
  verifyOwnership,
  updateUserProfileImage
);

AuthRoutes.patch(
  "/resetProfileImage/:email",
  authUserMiddleware,
  verifyOwnership,
  resetProfileImage
);

// ========================= MONEY =========================

// GET user amount details
AuthRoutes.get("/get-amount", authUserMiddleware, getAmount);
AuthRoutes.get("/get-amount-by-email/:email", authUserMiddleware, getAmountbyEmail);

// PATCH update user amount
AuthRoutes.patch("/update-amount", authUserMiddleware, updateAmount);

// ========================= TWO-FACTOR AUTHENTICATION (2FA) =========================

AuthRoutes.get("/2fa/status", authUserMiddleware, get2faStatus);
AuthRoutes.post("/2fa/setup", authUserMiddleware, loginLimiter, setup2fa);
AuthRoutes.post("/2fa/confirm", authUserMiddleware, loginLimiter, confirm2fa);
AuthRoutes.post("/2fa/disable", authUserMiddleware, loginLimiter, disable2fa);
AuthRoutes.post(
  "/2fa/regenerate-recovery-codes",
  authUserMiddleware,
  loginLimiter,
  regenerateRecoveryCodes
);
AuthRoutes.post("/2fa/verify-login", loginLimiter, verify2faLogin);
AuthRoutes.post("/2fa/verify-email-otp", loginLimiter, verifyEmailOtpLogin);
AuthRoutes.post("/2fa/resend-email-otp", loginLimiter, resendLoginEmailOtp);
AuthRoutes.post("/2fa/email-otp/enable", authUserMiddleware, loginLimiter, enableEmailOtp);
AuthRoutes.post("/2fa/email-otp/disable", authUserMiddleware, loginLimiter, disableEmailOtp);

module.exports = AuthRoutes;
