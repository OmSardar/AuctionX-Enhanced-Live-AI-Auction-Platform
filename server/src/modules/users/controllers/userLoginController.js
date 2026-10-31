const UserModel = require("../models/user.js");
const Otp = require("../models/otp.js");
const jwt = require("jsonwebtoken");
const bcryptjs = require("bcryptjs");
const crypto = require("crypto");
const sendOtpEmail = require("../../../common/utilities/emailSender.js");
const { sendLoginSecurityAlert } = require("../../../infrastructure/security/securityAlertService");
const auditService = require("../../analytics/services/auditService.js");
const JWT_SECRET = process.env.JWT_SECRET;

const register = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      address = "",
      phoneNo = "",
      gender = "",
      alternativePhoneNo = "",
      city = "",
      state = "",
      pinCode = "",
      country = "",
    } = req.body;



    // Check if user already exists
    const existUser = await UserModel.findOne({ email });
    if (existUser) {
      return res
        .status(409)
        .json({ success: false, message: "User already exists" });
    }



    // Hash the password
    const hashedPassword = await bcryptjs.hash(password, 10);


    // Create new user with isVerified: false
    const newUser = new UserModel({
      name,
      email,
      password: hashedPassword,
      address,
      phoneNo,
      gender,
      alternativePhoneNo,
      city,
      state,
      pinCode,
      country,
      isVerified: false, // Explicitly set verification status
    });

    // Save the new user
    await newUser.save();


    // Generate a JWT token
    const token = jwt.sign(
      { id: newUser._id, email: newUser.email, name: newUser.name },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    // Set the token in an HTTP-only cookie
    const isProduction =
      process.env.NODE_ENV === "production" ||
      req.secure ||
      req.headers["x-forwarded-proto"] === "https";
    res.cookie("token", token, {
      httpOnly: true,
      secure: isProduction,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: isProduction ? "None" : "Lax",
    });

    auditService.recordEvent({
      action: "AUTH_REGISTER",
      category: "AUTH",
      actorType: "user",
      actorId: newUser._id,
      actorEmail: newUser.email,
      actorRole: newUser.role || "user",
      outcome: "SUCCESS",
      req,
    });

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      token,
      newUser: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        isVerified: newUser.isVerified,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const Login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (
      !email ||
      !password ||
      typeof email !== "string" ||
      typeof password !== "string"
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Email and password are required" });
    }

    const user = await UserModel.findOne({ email });
    if (!user) {
      auditService.recordEvent({
        action: "AUTH_LOGIN_FAILED",
        category: "AUTH",
        actorType: "user",
        actorEmail: email,
        outcome: "FAILURE",
        reason: "User not found",
        req,
      });
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    const hasLocalPassword = Boolean(user.password && user.password.length > 0);
    const isGoogleAccount = Boolean(user.isOAuthUser || (user.googlePhoto && user.googlePhoto.length > 0));

    if (!hasLocalPassword && isGoogleAccount) {
      return res.status(400).json({
        success: false,
        code: "GOOGLE_AUTH_ONLY",
        message:
          "This account uses Google sign-in and does not have a password set. Please continue with Google to access your account.",
      });
    }

    const isPasswordValid = await bcryptjs.compare(password, user.password || "");
    if (!isPasswordValid) {
      auditService.recordEvent({
        action: "AUTH_LOGIN_FAILED",
        category: "AUTH",
        actorType: "user",
        actorId: user._id,
        actorEmail: user.email,
        outcome: "FAILURE",
        reason: "Invalid password",
        req,
      });
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    if (user.status === "Suspended") {
      auditService.recordEvent({
        action: "AUTH_LOGIN_BLOCKED",
        category: "AUTH",
        actorType: "user",
        actorId: user._id,
        actorEmail: user.email,
        outcome: "FAILURE",
        reason: user.suspensionReason || "Account suspended",
        req,
      });
      return res.status(403).json({
        success: false,
        message: `Your account has been suspended. Reason: ${user.suspensionReason || "Violation of platform policies"}`,
      });
    }

    // Intercept with intermediate MFA challenge if TOTP or Email OTP is active
    if (user.twoFactorEnabled) {
      const challengeToken = jwt.sign(
        {
          id: user._id,
          email: user.email,
          stage: "AWAITING_TOTP",
          mfaPending: true, // for backwards compatibility
          requiresTotp: true,
          requiresEmailOtp: !!user.emailOtpLoginEnabled,
          purpose: "mfa_challenge",
          sessionId: crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex"),
        },
        JWT_SECRET,
        { expiresIn: "5m" }
      );
      return res.status(200).json({
        success: true,
        mfaRequired: true,
        stage: "AWAITING_TOTP",
        challengeToken,
        mfaToken: challengeToken, // backward compatibility
        requiresTotp: true,
        requiresEmailOtp: !!user.emailOtpLoginEnabled,
        message: "Two-factor authentication required. Please enter your code.",
      });
    }

    if (user.emailOtpLoginEnabled) {
      // Direct Email OTP challenge when TOTP is not enabled
      const otp = crypto.randomInt(100000, 999999);
      await Otp.findOneAndUpdate(
        { email: user.email },
        { otp, createdAt: new Date() },
        { upsert: true, new: true }
      );

      try {
        await sendOtpEmail(user.email, otp);
      } catch (mailError) {
        console.warn(`[Login OTP] Email delivery failed for ${user.email}: ${mailError.message}`);
        const isProduction = process.env.NODE_ENV === "production";
        const isResend = (process.env.EMAIL_PROVIDER || "").toLowerCase() === "resend";
        if (isProduction || isResend) {
          await Otp.deleteOne({ email: user.email, otp });
          return res.status(500).json({
            success: false,
            message: "Failed to send login verification code. Please try again.",
          });
        }
      }

      const challengeToken = jwt.sign(
        {
          id: user._id,
          email: user.email,
          stage: "AWAITING_EMAIL_OTP",
          mfaPending: true,
          requiresTotp: false,
          requiresEmailOtp: true,
          purpose: "mfa_challenge",
          sessionId: crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex"),
        },
        JWT_SECRET,
        { expiresIn: "5m" }
      );

      return res.status(200).json({
        success: true,
        mfaRequired: true,
        stage: "AWAITING_EMAIL_OTP",
        challengeToken,
        mfaToken: challengeToken,
        requiresTotp: false,
        requiresEmailOtp: true,
        message: "Email verification required. A one-time code has been sent to your email.",
      });
    }

    const token = jwt.sign(
      { id: user._id, email: user.email, name: user.name, role: user.role },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    const isProduction =
      process.env.NODE_ENV === "production" ||
      req.secure ||
      req.headers["x-forwarded-proto"] === "https";
    res.cookie("token", token, {
      httpOnly: true,
      secure: isProduction,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: isProduction ? "None" : "Lax",
    });

    // Non-blocking login security alert email
    sendLoginSecurityAlert(user, { method: "Password Login", req }).catch((err) => {
      console.warn("[SecurityAlert] Error sending login alert:", err.message);
    });

    auditService.recordEvent({
      action: "AUTH_LOGIN_SUCCESS",
      category: "AUTH",
      actorType: "user",
      actorId: user._id,
      actorEmail: user.email,
      actorRole: user.role || "user",
      outcome: "SUCCESS",
      metadata: { method: "password" },
      req,
    });

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profilePic: user.profilePic || [],
        googlePhoto: user.googlePhoto || "",
        selectedAvatar: user.selectedAvatar || "",
        role: user.role,
        isVerified: user.isVerified,
        isNewUser: user.isNewUser || false,
        address: user.address || "",
        phoneNo: user.phoneNo || "",
        twoFactorEnabled: !!user.twoFactorEnabled,
        emailOtpLoginEnabled: !!user.emailOtpLoginEnabled,
        hasPassword: true,
        isOAuthUser: isGoogleAccount,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// authController.js
const Logout = async (req, res) => {
  try {
    const isProduction = process.env.NODE_ENV === "production";
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "None" : "Lax",
      path: "/",
    };

    // Clear the HTTP-only cookie with matching flags and path
    res.clearCookie("token", cookieOptions);
    res.clearCookie("adminToken", cookieOptions);
    res.clearCookie("sellerToken", cookieOptions);
    res.clearCookie("seller_token", cookieOptions);
    // Also clear default path fallback
    res.clearCookie("token");
    res.clearCookie("adminToken");

    return res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, email } = req.body;

    // Input validation
    if (!email || !currentPassword || !newPassword) {
      return res.status(400).json({ 
        success: false,
        message: "Email, current password and new password are required" 
      });
    }

    // Find user by email
    const user = await UserModel.findOne({ email });
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: "User not found with this email" 
      });
    }

    // Verify current password
    const isMatch = await bcryptjs.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ 
        success: false,
        message: "Current password is incorrect" 
      });
    }

    // Validate new password strength
    if (newPassword.length < 8) {
      return res.status(400).json({ 
        success: false,
        message: "Password must be at least 8 characters long" 
      });
    }

    // Check if new password is same as current password
    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: "New password must be different from current password"
      });
    }

    // Hash the new password
    const salt = await bcryptjs.genSalt(10);
    const hashedPassword = await bcryptjs.hash(newPassword, salt);

    // Update password
    user.password = hashedPassword;
    user.passwordLastChanged = new Date();
    await user.save();

    res.status(200).json({ 
      success: true,
      message: "Password updated successfully" 
    });

  } catch (error) {
    console.error("Error updating password:", error);
    res.status(500).json({ 
      success: false,
      message: "Internal server error" 
    });
  }
};

module.exports = {
  register,
  Login,
  Logout,
  changePassword
};
