const UserModel = require("../models/user.js");
const Otp = require("../models/otp.js");
const bcryptjs = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const sendOtpEmail = require("../../../common/utilities/emailSender.js");
const { sendLoginSecurityAlert } = require("../../../infrastructure/security/securityAlertService");
const {
  generateBase32Secret,
  generateTotpUri,
  generateQrCodeDataUrl,
  verifyTotp,
  generateRecoveryCodes,
  hashRecoveryCode,
  encryptSecret,
  decryptSecret,
} = require("../../../infrastructure/security/totpService");

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * GET /api/auth/2fa/status
 * Get the current 2FA status for the authenticated user.
 */
const get2faStatus = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const user = await UserModel.findById(userId).select("+password");

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.status(200).json({
      success: true,
      twoFactorEnabled: !!user.twoFactorEnabled,
      confirmedAt: user.twoFactorConfirmedAt || null,
      emailOtpLoginEnabled: !!user.emailOtpLoginEnabled,
      hasPassword: Boolean(user.password && user.password.length > 0),
      isOAuthUser: Boolean(user.isOAuthUser || (user.googlePhoto && user.googlePhoto.length > 0)),
    });
  } catch (error) {
    console.error("Error getting 2FA status:", error);
    return res.status(500).json({ success: false, message: "Failed to retrieve 2FA status" });
  }
};

/**
 * POST /api/auth/2fa/setup
 * Initiate 2FA enrollment. Generates a pending secret, QR code, and manual key.
 */
const setup2fa = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const user = await UserModel.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (user.twoFactorEnabled) {
      return res.status(400).json({
        success: false,
        message: "Two-factor authentication is already enabled on your account.",
      });
    }

    // Generate fresh Base32 secret (160-bit)
    const secret = generateBase32Secret(20);
    const encryptedSecret = encryptSecret(secret);

    // Save as pending temp secret
    user.twoFactorTempSecret = encryptedSecret;
    await user.save();

    // Create otpauth URI and QR Code Data URL
    const otpauthUri = generateTotpUri(secret, user.email, "AuctionX");
    const qrCode = await generateQrCodeDataUrl(otpauthUri);

    return res.status(200).json({
      success: true,
      qrCode,
      qrCodeDataUrl: qrCode,
      secret, // Sent to client ONLY during setup modal for manual key entry
      manualEntryKey: secret,
      message: "Scan the QR code in your authenticator app and enter the 6-digit code to complete setup.",
    });
  } catch (error) {
    console.error("Error setting up 2FA:", error);
    return res.status(500).json({ success: false, message: "Failed to initiate 2FA setup" });
  }
};

/**
 * POST /api/auth/2fa/confirm
 * Complete 2FA enrollment by verifying the first TOTP code.
 * Issues single-use recovery codes upon confirmation.
 */
const confirm2fa = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { code } = req.body;

    if (!code || typeof code !== "string") {
      return res.status(400).json({ success: false, message: "6-digit verification code is required" });
    }

    const user = await UserModel.findById(userId).select("+twoFactorTempSecret");
    if (!user || !user.twoFactorTempSecret) {
      return res.status(400).json({
        success: false,
        message: "No pending 2FA enrollment found. Please initiate setup first.",
      });
    }

    const decryptedSecret = decryptSecret(user.twoFactorTempSecret);
    const verification = verifyTotp(code, decryptedSecret, { window: 1 });

    if (!verification.valid) {
      return res.status(400).json({
        success: false,
        message: "Invalid verification code. Please check your authenticator app and try again.",
      });
    }

    // Generate single-use recovery codes
    const { plainCodes, hashedCodes } = generateRecoveryCodes(8);

    // Promote temp secret to active secret
    user.twoFactorSecret = user.twoFactorTempSecret;
    user.twoFactorTempSecret = null;
    user.twoFactorEnabled = true;
    user.twoFactorConfirmedAt = new Date();
    user.twoFactorLastVerifiedStep = verification.step;
    user.twoFactorRecoveryCodes = hashedCodes;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Two-factor authentication enabled successfully!",
      recoveryCodes: plainCodes, // Displayed to user ONCE
    });
  } catch (error) {
    console.error("Error confirming 2FA:", error);
    return res.status(500).json({ success: false, message: "Failed to confirm 2FA" });
  }
};

/**
 * POST /api/auth/2fa/disable
 * Disable TOTP 2FA. Requires both current password and a valid TOTP code (or recovery code).
 * Does not silently disable email OTP if enabled.
 */
const disable2fa = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { password } = req.body;
    const code = req.body.code || req.body.recoveryCode;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Verification code is required to disable 2FA.",
      });
    }

    const user = await UserModel.findById(userId).select(
      "+password +twoFactorSecret +twoFactorRecoveryCodes +twoFactorLastVerifiedStep"
    );

    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      return res.status(400).json({
        success: false,
        message: "Two-factor authentication is not enabled on this account.",
      });
    }

    // 1. Verify password if account has a password (non-OAuth)
    if (user.password) {
      if (!password) {
        return res.status(400).json({
          success: false,
          message: "Password and verification code are required to disable 2FA.",
        });
      }
      const isPasswordValid = await bcryptjs.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ success: false, message: "Incorrect password." });
      }
    }

    // 2. Verify second factor (TOTP code or recovery code)
    let codeValid = false;
    const cleanCode = code.trim().toUpperCase();

    // Check TOTP code if 6 digits
    if (/^\d{6}$/.test(cleanCode)) {
      const decryptedSecret = decryptSecret(user.twoFactorSecret);
      const verification = verifyTotp(cleanCode, decryptedSecret, {
        window: 1,
        lastVerifiedStep: user.twoFactorLastVerifiedStep,
      });
      if (verification.valid) {
        codeValid = true;
      }
    }

    // If TOTP didn't pass, check if valid recovery code was provided
    if (!codeValid) {
      const targetHash = hashRecoveryCode(cleanCode);
      const matchingRecovery = user.twoFactorRecoveryCodes.find(
        (rc) => rc.codeHash === targetHash && !rc.used
      );
      if (matchingRecovery) {
        codeValid = true;
      }
    }

    if (!codeValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid verification code or recovery code.",
      });
    }

    // Disable TOTP factor only and clean up TOTP-specific security fields
    user.twoFactorEnabled = false;
    user.twoFactorSecret = null;
    user.twoFactorTempSecret = null;
    user.twoFactorRecoveryCodes = [];
    user.twoFactorConfirmedAt = null;
    user.twoFactorLastVerifiedStep = 0;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Two-factor authentication has been disabled.",
    });
  } catch (error) {
    console.error("Error disabling 2FA:", error);
    return res.status(500).json({ success: false, message: "Failed to disable 2FA" });
  }
};

/**
 * POST /api/auth/2fa/regenerate-recovery-codes
 * Generate new recovery codes when 2FA is active.
 * Requires password and current TOTP code.
 */
const regenerateRecoveryCodes = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { password, code } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Current authenticator code is required.",
      });
    }

    const user = await UserModel.findById(userId).select(
      "+password +twoFactorSecret +twoFactorRecoveryCodes +twoFactorLastVerifiedStep"
    );

    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      return res.status(400).json({
        success: false,
        message: "Two-factor authentication is not active.",
      });
    }

    // Verify password if account has a password (non-OAuth)
    if (user.password) {
      if (!password) {
        return res.status(400).json({
          success: false,
          message: "Current password is required to regenerate recovery codes.",
        });
      }
      const isPasswordValid = await bcryptjs.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ success: false, message: "Incorrect password." });
      }
    }

    // Verify TOTP code
    const decryptedSecret = decryptSecret(user.twoFactorSecret);
    const verification = verifyTotp(code, decryptedSecret, {
      window: 1,
      lastVerifiedStep: user.twoFactorLastVerifiedStep,
    });

    if (!verification.valid) {
      return res.status(400).json({ success: false, message: "Invalid authenticator code." });
    }

    // Generate new recovery codes
    const { plainCodes, hashedCodes } = generateRecoveryCodes(8);
    user.twoFactorRecoveryCodes = hashedCodes;
    user.twoFactorLastVerifiedStep = verification.step;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "New recovery codes generated. Previous codes are now invalid.",
      recoveryCodes: plainCodes,
    });
  } catch (error) {
    console.error("Error regenerating recovery codes:", error);
    return res.status(500).json({ success: false, message: "Failed to regenerate recovery codes" });
  }
};

/**
 * POST /api/auth/2fa/email-otp/enable
 * Enable email OTP requirement on password login.
 */
const enableEmailOtp = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const user = await UserModel.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    user.emailOtpLoginEnabled = true;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Email OTP verification enabled for login.",
      emailOtpLoginEnabled: true,
    });
  } catch (error) {
    console.error("Error enabling email OTP:", error);
    return res.status(500).json({ success: false, message: "Failed to enable email OTP" });
  }
};

/**
 * POST /api/auth/2fa/email-otp/disable
 * Disable email OTP requirement. Requires current password verification.
 * Does not silently disable TOTP if enabled.
 */
const disableEmailOtp = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { password } = req.body;

    const user = await UserModel.findById(userId).select("+password");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Verify password if account has a password (non-OAuth)
    if (user.password) {
      if (!password) {
        return res.status(400).json({
          success: false,
          message: "Current password is required to disable email OTP verification.",
        });
      }
      const isPasswordValid = await bcryptjs.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ success: false, message: "Incorrect password." });
      }
    }

    user.emailOtpLoginEnabled = false;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Email OTP verification has been disabled.",
      emailOtpLoginEnabled: false,
    });
  } catch (error) {
    console.error("Error disabling email OTP:", error);
    return res.status(500).json({ success: false, message: "Failed to disable email OTP" });
  }
};

/**
 * POST /api/auth/2fa/verify-login
 * Complete the TOTP step of login for users with 2FA enabled.
 * If emailOtpLoginEnabled is active, transitions to stage AWAITING_EMAIL_OTP instead of issuing final token.
 */
const verify2faLogin = async (req, res) => {
  try {
    const { mfaToken, challengeToken, code, recoveryCode } = req.body;
    const tokenStr = challengeToken || mfaToken;

    if (!tokenStr) {
      return res.status(400).json({ success: false, message: "MFA challenge token is required" });
    }

    if (!code && !recoveryCode) {
      return res.status(400).json({
        success: false,
        message: "Please enter your 6-digit authenticator code or recovery code.",
      });
    }

    // 1. Verify intermediate challenge token
    let decoded;
    try {
      decoded = jwt.verify(tokenStr, JWT_SECRET);
      if (!decoded.mfaPending && decoded.stage !== "AWAITING_TOTP") {
        return res.status(401).json({ success: false, message: "Invalid MFA session" });
      }
    } catch {
      return res.status(401).json({
        success: false,
        message: "MFA session expired. Please log in again.",
      });
    }

    // 2. Fetch user with sensitive security fields
    const user = await UserModel.findById(decoded.id).select(
      "+twoFactorSecret +twoFactorRecoveryCodes +twoFactorLastVerifiedStep"
    );

    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      return res.status(400).json({ success: false, message: "Invalid 2FA account state" });
    }

    if (user.status === "Suspended") {
      return res.status(403).json({
        success: false,
        message: `Your account has been suspended. Reason: ${user.suspensionReason || "Violation of platform policies"}`,
      });
    }

    let authenticated = false;

    // 3. Check Recovery Code first if provided
    if (recoveryCode && typeof recoveryCode === "string") {
      const targetHash = hashRecoveryCode(recoveryCode);
      const matchIndex = user.twoFactorRecoveryCodes.findIndex(
        (rc) => rc.codeHash === targetHash && !rc.used
      );

      if (matchIndex === -1) {
        return res.status(400).json({
          success: false,
          message: "Invalid or already used recovery code.",
        });
      }

      // Mark recovery code as used
      user.twoFactorRecoveryCodes[matchIndex].used = true;
      user.twoFactorRecoveryCodes[matchIndex].usedAt = new Date();
      authenticated = true;
    }
    // 4. Otherwise verify TOTP code
    else if (code && typeof code === "string") {
      const decryptedSecret = decryptSecret(user.twoFactorSecret);
      const verification = verifyTotp(code, decryptedSecret, {
        window: 1,
        lastVerifiedStep: user.twoFactorLastVerifiedStep,
      });

      if (!verification.valid) {
        const msg = verification.isReplay
          ? "This code has already been used. Please wait for the next code."
          : "Invalid verification code. Please check your authenticator app.";
        return res.status(400).json({ success: false, message: msg });
      }

      user.twoFactorLastVerifiedStep = verification.step;
      authenticated = true;
    }

    if (!authenticated) {
      return res.status(400).json({ success: false, message: "Verification failed." });
    }

    await user.save();

    // Check if Email OTP is also enabled on this account (Dual 2FA)
    const requiresEmailOtp = Boolean(decoded.requiresEmailOtp || user.emailOtpLoginEnabled);
    if (requiresEmailOtp) {
      // Transition to Stage 2: AWAITING_EMAIL_OTP
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
      }

      const nextChallengeToken = jwt.sign(
        {
          id: user._id,
          email: user.email,
          stage: "AWAITING_EMAIL_OTP",
          mfaPending: true,
          requiresTotp: false,
          requiresEmailOtp: true,
          totpVerified: true,
          purpose: "mfa_challenge",
          sessionId: decoded.sessionId || (crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex")),
        },
        JWT_SECRET,
        { expiresIn: "5m" }
      );

      return res.status(200).json({
        success: true,
        mfaRequired: true,
        stage: "AWAITING_EMAIL_OTP",
        challengeToken: nextChallengeToken,
        mfaToken: nextChallengeToken,
        message: "Authenticator code verified. An email OTP has been sent to your email address.",
      });
    }

    // 5. If no further factor required, issue full authenticated session JWT token
    const token = jwt.sign(
      { id: user._id, email: user.email, name: user.name, role: user.role },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    const isProduction = process.env.NODE_ENV === "production";
    res.cookie("token", token, {
      httpOnly: true,
      secure: isProduction,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: isProduction ? "None" : "Lax",
    });

    // Non-blocking login security alert email
    sendLoginSecurityAlert(user, {
      method: "Password Login (with Authenticator 2FA)",
      req,
      sessionId: decoded.sessionId,
    }).catch((err) => {
      console.warn("[SecurityAlert] Error sending login alert:", err.message);
    });

    return res.status(200).json({
      success: true,
      message: "Login successful",
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
        hasPassword: Boolean(user.password && user.password.length > 0),
        isOAuthUser: Boolean(user.isOAuthUser || (user.googlePhoto && user.googlePhoto.length > 0)),
      },
    });
  } catch (error) {
    console.error("Error verifying 2FA login:", error);
    return res.status(500).json({ success: false, message: "Internal server error during 2FA verification" });
  }
};

/**
 * POST /api/auth/2fa/verify-email-otp
 * Complete the email OTP step of login.
 * Validates intermediate challenge token and 6-digit OTP, then issues final session.
 */
const verifyEmailOtpLogin = async (req, res) => {
  try {
    const { challengeToken, mfaToken, otp } = req.body;
    const tokenStr = challengeToken || mfaToken;

    if (!tokenStr) {
      return res.status(400).json({ success: false, message: "Challenge token is required" });
    }

    if (!otp) {
      return res.status(400).json({ success: false, message: "6-digit verification code is required" });
    }

    let decoded;
    try {
      decoded = jwt.verify(tokenStr, JWT_SECRET);
      if (decoded.stage !== "AWAITING_EMAIL_OTP") {
        return res.status(401).json({
          success: false,
          message: "Invalid authentication stage. Preceding security challenges must be completed first.",
        });
      }
    } catch {
      return res.status(401).json({
        success: false,
        message: "Email OTP session expired. Please log in again.",
      });
    }

    const numericOtp = parseInt(otp, 10);
    const otpEntry = await Otp.findOne({ email: decoded.email });

    if (!otpEntry) {
      return res.status(404).json({ success: false, message: "OTP not found or expired. Please request a new code." });
    }

    const OTP_EXPIRY_MS = 10 * 60 * 1000;
    if (Date.now() - new Date(otpEntry.createdAt).getTime() > OTP_EXPIRY_MS) {
      await Otp.deleteOne({ email: decoded.email });
      return res.status(400).json({ success: false, message: "OTP has expired. Please request a new code." });
    }

    if (otpEntry.otp !== numericOtp) {
      return res.status(400).json({ success: false, message: "Invalid verification code. Please check and try again." });
    }

    // Invalidate consumed OTP immediately to prevent replay
    await Otp.deleteOne({ email: decoded.email });

    const user = await UserModel.findById(decoded.id).select("+password");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (user.status === "Suspended") {
      return res.status(403).json({
        success: false,
        message: `Your account has been suspended. Reason: ${user.suspensionReason || "Violation of platform policies"}`,
      });
    }

    // Issue final session
    const token = jwt.sign(
      { id: user._id, email: user.email, name: user.name, role: user.role },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    const isProduction = process.env.NODE_ENV === "production";
    res.cookie("token", token, {
      httpOnly: true,
      secure: isProduction,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: isProduction ? "None" : "Lax",
    });

    const authMethod = decoded.totpVerified
      ? "Password Login (with TOTP + Email OTP)"
      : "Password Login (with Email OTP)";

    sendLoginSecurityAlert(user, {
      method: authMethod,
      req,
      sessionId: decoded.sessionId,
    }).catch((err) => {
      console.warn("[SecurityAlert] Error sending login alert:", err.message);
    });

    return res.status(200).json({
      success: true,
      message: "Login successful",
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
        hasPassword: Boolean(user.password && user.password.length > 0),
        isOAuthUser: Boolean(user.isOAuthUser || (user.googlePhoto && user.googlePhoto.length > 0)),
      },
    });
  } catch (error) {
    console.error("Error verifying email OTP login:", error);
    return res.status(500).json({ success: false, message: "Internal server error during email OTP verification" });
  }
};

/**
 * POST /api/auth/2fa/resend-email-otp
 * Resend email OTP during login challenge. Implements 60-second cooldown.
 */
const resendLoginEmailOtp = async (req, res) => {
  try {
    const { challengeToken, mfaToken } = req.body;
    const tokenStr = challengeToken || mfaToken;

    if (!tokenStr) {
      return res.status(400).json({ success: false, message: "Challenge token is required" });
    }

    let decoded;
    try {
      decoded = jwt.verify(tokenStr, JWT_SECRET);
      if (decoded.stage !== "AWAITING_EMAIL_OTP") {
        return res.status(401).json({ success: false, message: "Invalid authentication stage" });
      }
    } catch {
      return res.status(401).json({ success: false, message: "Session expired. Please log in again." });
    }

    // Cooldown check (60s)
    const existingOtp = await Otp.findOne({ email: decoded.email });
    if (existingOtp && Date.now() - new Date(existingOtp.createdAt).getTime() < 60 * 1000) {
      const waitSec = Math.ceil((60 * 1000 - (Date.now() - new Date(existingOtp.createdAt).getTime())) / 1000);
      return res.status(429).json({
        success: false,
        message: `Please wait ${waitSec} seconds before requesting a new code.`,
      });
    }

    const newOtp = crypto.randomInt(100000, 999999);
    await Otp.findOneAndUpdate(
      { email: decoded.email },
      { otp: newOtp, createdAt: new Date() },
      { upsert: true, new: true }
    );

    try {
      await sendOtpEmail(decoded.email, newOtp);
    } catch (mailError) {
      console.warn(`[Login OTP Resend] Delivery error for ${decoded.email}: ${mailError.message}`);
    }

    return res.status(200).json({
      success: true,
      message: "A new verification code has been sent to your email.",
    });
  } catch (error) {
    console.error("Error resending login email OTP:", error);
    return res.status(500).json({ success: false, message: "Failed to resend code" });
  }
};

module.exports = {
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
};
