const express = require("express");

const {
  getProfilePicByEmail,
  getUserByEmail,
  updateUserProfile,
  uploadProfilePicture,
  updateUserProfileImage,
  resetProfileImage,
} = require("../controllers/sellerProfileController.js");

const {
  Login,
  Logout,
  register,
} = require("../controllers/sellerLoginController.js");

const {
  updateAmount,
  getAmount,
} = require("../controllers/sellerPaymentController.js");

const {
  verifyNormalUser,
  CheckUser,
  updateGProfile,
  updateProfile,
  sendOtp,
  resendOtp,
  verifyOtp,
  checkAuth,
  checkSellerBySellerEmail,
} = require("../controllers/sellerVerificationController.js");

const {
  IsUser,
  IsSeller,
  IsGUser,
  checkUserByEmail,
  checkSellerByEmail,
  updatePassword,
} = require("../../../authentication/middleware/authOtherMiddlewares.js");
const authUserMiddleware = require("../../../users/middleware/authUserMiddleware.js");

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

const SellerRoutes = express.Router();
//-------------------------Testing---------------------------//
const loginLimiter = require("../../../../infrastructure/security/rateLimiter.js");
const handleImageUploads = require("../../../media/middleware/imageUploadMiddleware.js");
const passport = require("passport");
const {
  handleGoogleCallback,
} = require("../controllers/sellerGoogleLoginController.js");

//-------------------LOGIN-CRUD------------------//

SellerRoutes.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

SellerRoutes.get(
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

// POST endpoint to create a account
SellerRoutes.post("/register", register);

// POST endpoint to login into a account
SellerRoutes.post("/login", loginLimiter, Login);

// POST endpoint to logout from a account
SellerRoutes.post("/logout", Logout);

// POST endpoint to check a seller account by EMAIL
SellerRoutes.post("/check-user", checkSellerByEmail, (req, res) => {
  return res.status(200).json({ message: "User found", user: req.user });
});

SellerRoutes.get("/check", checkAuth);

// POST endpoint to send OTP
SellerRoutes.post("/send-otp", sendOtp);
SellerRoutes.post("/verify-otp", verifyOtp);

// POST endpoint to resend OTP
SellerRoutes.post("/resend-otp", resendOtp);

// GET endpoint to check a valid seller
SellerRoutes.get("/checkUser", IsSeller, CheckUser);

// REMOVED: GET /get-otp/:email — OTPs must never be returned via API (CRIT-01)

// GET endpoint to get a user by EMAIL
SellerRoutes.get(
  "/user/:email",
  authUserMiddleware.optional || authUserMiddleware,
  getUserByEmail
);

// GET endpoint to get a user profile picture by EMAIL
SellerRoutes.get("/profile-pic", getProfilePicByEmail);

// PATCH endpoint to update user profile (GOOGLE SIGN IN)
SellerRoutes.patch("/updateGProfile", IsGUser, updateGProfile);

// PATCH endpoint to update user profile (NORMAL SIGN IN)
SellerRoutes.patch("/updateProfile", IsSeller, updateProfile);

// PATCH endpoint to update user password by email (requires JWT auth)
SellerRoutes.patch("/update-password", authUserMiddleware, updatePassword);

// PATCH endpoint to update user profile by email (requires JWT auth & ownership verification)
SellerRoutes.patch(
  "/updateUserProfile/:email",
  authUserMiddleware,
  verifyOwnership,
  updateUserProfile
);

// POST endpoint for uploading profile pictures with authentication and avatar rate limiting
SellerRoutes.post(
  "/upload-profile-pic",
  authUserMiddleware,
  loginLimiter.avatarUploadLimiter,
  handleImageUploads([
    {
      name: "profilePic", // Must match frontend field name
      folder: "Auction X/Components/Profile", // Your Cloudinary folder
      transformation: [
        { width: 300, height: 300, crop: "fill", gravity: "face", format: "webp", flags: "strip_profile" },
      ],
    },
  ]),
  uploadProfilePicture
);

SellerRoutes.patch(
  "/updateUserProfileImage/:email",
  authUserMiddleware,
  verifyOwnership,
  updateUserProfileImage
);

SellerRoutes.patch(
  "/resetProfileImage/:email",
  authUserMiddleware,
  verifyOwnership,
  resetProfileImage
);

// PATCH endpoint to verify user by email
SellerRoutes.patch("/verify-user", verifyNormalUser);
SellerRoutes.post("/check-seller", checkSellerBySellerEmail);

//-------------------MONEY-CRUD------------------//

// GET get user amount details
SellerRoutes.get("/get-amount", authUserMiddleware, getAmount);

// PATCH update user amount
SellerRoutes.patch("/update-amount", authUserMiddleware, updateAmount);

module.exports = SellerRoutes;
