const SellerModel = require("../models/seller.js");
const Otp = require("../../../users/models/otp.js"); // Updated OTP model
const sendOtpEmail = require("../../../../common/utilities/emailSender.js"); // Assuming you have a utility for sending emails
const { isProductionEnvironment } = require("../../../../common/utilities/email");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const CheckUser = async (req, res) => {
  try {
    const user = req.user; // Access the authenticated user
    if (!user) {
      return res.status(404).json({ message: "User not found" }); // Added return here
    }
    res.status(200).json(user);
  } catch (error) {
    console.error("Check User Error:", error); // Log the error for debugging
    res.status(500).json({ message: "Internal server error" });
  }
};

const checkAuth = async (req, res) => {
  try {
    let token = req.cookies?.sellerToken || req.cookies?.token;
    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(200).json({
        authenticated: false,
        message: "Not authenticated",
      });
    }

    const secret = process.env.JWT_SECRET;
    const decoded = jwt.verify(token, secret);

    // Reject intermediate MFA / challenge tokens
    if (decoded.mfaPending || decoded.purpose === "mfa_challenge" || decoded.stage) {
      return res.status(200).json({
        authenticated: false,
        mfaPending: true,
        message: "Authentication challenge in progress",
      });
    }

    // Reject wrong-purpose tokens
    if (decoded.purpose && !["auth", "login", "seller_session", "seller"].includes(decoded.purpose)) {
      return res.status(200).json({
        authenticated: false,
        message: "Invalid token purpose",
      });
    }

    // Reject tokens declaring non-seller role
    if (decoded.role && !["seller", "admin", "super-admin"].includes(decoded.role)) {
      return res.status(200).json({
        authenticated: false,
        message: "Seller privileges required",
      });
    }

    const user = await SellerModel.findById(decoded.id).select("+password");
    if (!user) {
      const isProduction = isProductionEnvironment();
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
      return res.status(200).json({
        authenticated: false,
        message: "Seller not found",
      });
    }

    // Authoritative suspension check
    if (user.status === "Suspended") {
      const isProduction = isProductionEnvironment();
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
        authenticated: false,
        status: "Suspended",
        message: `Seller account has been suspended${user.suspensionReason ? `: ${user.suspensionReason}` : ""}`,
        reason: user.suspensionReason || "Account suspended by administrator",
      });
    }

    if (user.role && !["seller", "admin", "super-admin"].includes(user.role)) {
      return res.status(200).json({
        authenticated: false,
        message: "Seller privileges required",
      });
    }

    const hasPassword = Boolean(user.password && user.password.length > 0);
    const isOAuthUser = Boolean(user.isOAuthUser || (user.googlePhoto && user.googlePhoto.length > 0));

    return res.status(200).json({
      authenticated: true,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        isVerified: user.isVerified || false,
        profilePic: user.profilePic || [],
        googlePhoto: user.googlePhoto || "",
        selectedAvatar: user.selectedAvatar || "",
        hasPassword,
        isOAuthUser,
      },
    });
  } catch (error) {
    // Clear stale or invalid token cookie
    const isProduction = isProductionEnvironment();
    res.clearCookie("token", {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "None" : "Lax",
    });
    return res.status(200).json({
      authenticated: false,
      message: "Invalid or expired token",
    });
  }
};

const verifyNormalUser = async (req, res) => {
  const email = req.user?.email || req.body?.email;

  try {
    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const user = await SellerModel.findOne({ email: email });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // CRIT-03 guard: Unverified accounts cannot bypass OTP verification via this endpoint
    if (!user.isVerified) {
      return res.status(403).json({
        success: false,
        message: "Account is not verified. Please complete OTP verification.",
      });
    }

    res.status(200).json({
      success: true,
      message: "User verified successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        profilePic: user.profilePic || [],
      },
    });
  } catch (error) {
    console.error("verifyNormalUser error:", error);
    res.status(500).json({ success: false, message: "An error occurred", error: error.message });
  }
};

const updateProfile = async (req, res) => {
  try {
    const {
      name,
      email,
      address,
      phoneNo,
      gender,
      profilePic,
      alternativePhoneNo,
      city,
      state,
      pinCode,
      country,
      storeName,
      storeDescription,
    } = req.body;
    const userId = req.user._id; // Bound strictly to authenticated principal

    const updateFields = {};
    if (name) updateFields.name = name;
    if (address !== undefined) updateFields.address = address;
    if (phoneNo !== undefined) updateFields.phoneNo = phoneNo;
    if (gender !== undefined) updateFields.gender = gender;
    if (alternativePhoneNo !== undefined) updateFields.alternativePhoneNo = alternativePhoneNo;
    if (city !== undefined) updateFields.city = city;
    if (state !== undefined) updateFields.state = state;
    if (pinCode !== undefined) updateFields.pinCode = pinCode;
    if (country !== undefined) updateFields.country = country;
    if (storeName !== undefined) updateFields.storeName = storeName;
    if (storeDescription !== undefined) updateFields.storeDescription = storeDescription;

    // Only update profilePic if a valid non-empty array with image is provided
    if (
      profilePic &&
      Array.isArray(profilePic) &&
      profilePic.length > 0 &&
      profilePic[0]?.secure_url
    ) {
      updateFields.profilePic = profilePic;
      updateFields.selectedAvatar = profilePic[0].secure_url;
    }

    // Update user information
    const updatedUser = await SellerModel.findByIdAndUpdate(
      userId,
      { $set: updateFields },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "Seller not found" });
    }
    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: updatedUser,
      profilePic: updatedUser.profilePic,
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const updateGProfile = async (req, res) => {
  try {
    const {
      address,
      phoneNo,
      gender,
      alternativePhoneNo,
      city,
      state,
      pinCode,
      country,
    } = req.body;
    const userEmail = req.user.email; // Get the user email from the authenticated user

    // Update the user's address, phoneNo, and gender based on email
    const updatedUser = await SellerModel.findOneAndUpdate(
      { email: userEmail }, // Find user by email
      {
        address,
        phoneNo,
        gender,
        alternativePhoneNo,
        city,
        state,
        pinCode,
        country,
      },
      { new: true } // Return the updated user
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res
      .status(200)
      .json({ message: "Profile updated successfully", updatedUser });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};
const sendOtp = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  try {
    // Generate a cryptographically secure 6-digit OTP
    const otp = crypto.randomInt(100000, 999999);

    // Create and save OTP entry in the database
    await Otp.findOneAndUpdate(
      { email },
      { otp, createdAt: new Date() },
      { upsert: true, new: true }
    );

    // Send OTP email with production failure enforcement
    try {
      await sendOtpEmail(email, otp);
    } catch (mailError) {
      console.warn(`[OTP] Email delivery failed for ${email}: ${mailError.message}`);
      const isProduction = isProductionEnvironment();
      const isResend = (process.env.EMAIL_PROVIDER || "").toLowerCase() === "resend";

      if (isProduction || isResend) {
        // In production, do not leak OTP and do not return false-positive HTTP 200
        await Otp.deleteOne({ email, otp });
        return res.status(500).json({
          success: false,
          message: "Failed to send verification email. Please try again later.",
        });
      }

      if (process.env.NODE_ENV === "development") {
        console.log(`[DEV OTP] For ${email}: ${otp}`);
      }
    }

    res.status(200).json({ success: true, message: "OTP sent successfully" });
  } catch (error) {
    console.error("Error sending OTP:", error);
    res
      .status(500)
      .json({ message: "Error sending OTP", error: error.message });
  }
};

// In your verifyOtp backend function:
const verifyOtp = async (req, res) => {
  let { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ message: "Email and OTP are required" });
  }

  try {
    if (typeof otp === "string") {
      otp = parseInt(otp, 10);
    }

    const otpEntry = await Otp.findOne({ email });

    console.log("OTP Entry:", otpEntry);
    console.log("Received OTP:", otp, "Type:", typeof otp);
    console.log("Stored OTP:", otpEntry?.otp, "Type:", typeof otpEntry?.otp);

    if (!otpEntry) {
      return res.status(404).json({ message: "OTP not found or expired" });
    }

    if (otpEntry.otp != otp) {
      return res.status(400).json({
        message: "Invalid OTP",
        debug: {
          received: otp,
          stored: otpEntry.otp,
        },
      });
    }

    // Update user verification status
    const updatedUser = await SellerModel.findOneAndUpdate(
      { email },
      { isVerified: true },
      { new: true }
    );

    await Otp.deleteOne({ email });

    res.status(200).json({
      success: true,
      message: "OTP verified successfully",
      isVerified: true,
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        isVerified: updatedUser.isVerified,
        profilePic: updatedUser.profilePic || [],
      },
    });
  } catch (error) {
    console.error("OTP verification error:", error);
    res
      .status(500)
      .json({ message: "Error verifying OTP", error: error.message });
  }
};

// REMOVED: getOtp endpoint — OTPs must never be returned via API (CRIT-01)
const resendOtp = async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  try {
    const newOtp = crypto.randomInt(100000, 999999);
    await Otp.findOneAndUpdate(
      { email },
      { otp: newOtp, createdAt: new Date() },
      { new: true, upsert: true }
    );
    try {
      await sendOtpEmail(email, newOtp);
    } catch (mailError) {
      console.warn(`[OTP] Resend email delivery failed for ${email}: ${mailError.message}`);
      const isProduction = isProductionEnvironment();
      const isResend = (process.env.EMAIL_PROVIDER || "").toLowerCase() === "resend";

      if (isProduction || isResend) {
        // In production, do not leak OTP and do not return false-positive HTTP 200
        await Otp.deleteOne({ email, otp: newOtp });
        return res.status(500).json({
          success: false,
          message: "Failed to send verification email. Please try again later.",
        });
      }

      if (process.env.NODE_ENV === "development") {
        console.log(`[DEV OTP RESEND] For ${email}: ${newOtp}`);
      }
    }
    res.status(200).json({ success: true, message: "OTP resent successfully" });
  } catch (error) {
    console.error("Error in resendOtp:", error.message);
    res
      .status(500)
      .json({ message: "Failed to resend OTP. Please try again." });
  }
};

const checkSellerBySellerEmail = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const normalizedEmail = (email || "").trim().toLowerCase();
    const seller = await SellerModel.findOne({ email: normalizedEmail }).select("role status isVerified name email");

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: "Seller not found",
      });
    }

    const isSeller = seller.role === "seller";

    return res.status(200).json({
      success: true,
      isSeller,
      isAdmin: false,
      message: isSeller ? "User is a verified seller" : "User is not a seller",
      role: seller.role,
      status: seller.status,
      isVerified: seller.isVerified,
    });
  } catch (error) {
    console.error("Error checking seller status:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

module.exports = {
  CheckUser,
  updateProfile,
  updateGProfile,
  sendOtp,
  resendOtp,
  verifyOtp,
  verifyNormalUser,
  checkAuth,
  checkSellerBySellerEmail,
};
