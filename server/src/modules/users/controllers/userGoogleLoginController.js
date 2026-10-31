const jwt = require("jsonwebtoken");
const { sendLoginSecurityAlert } = require("../../../infrastructure/security/securityAlertService");

/**
 * Handle Google OAuth callback.
 * POLICY EXCEPTION: Google OAuth logins are deliberately exempt from application TOTP/Email OTP challenges,
 * as Google OAuth already provides robust hardware/device-level authentication.
 * Google OAuth immediately establishes the authenticated session cookie, triggers a login security alert email,
 * and delegates profile-completion checks (VerifyProfilePage) for new/incomplete accounts.
 */
const handleGoogleCallback = (req, res) => {
  if (!req.user || req.user.user?.status === "Suspended") {
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

    const clientURL = process.env.CLIENT_URL;
    const reason = req.user?.user?.suspensionReason || "Account suspended by administrator";
    if (clientURL) {
      return res.redirect(`${clientURL}/login?error=account_suspended&reason=${encodeURIComponent(reason)}`);
    }
    return res.status(403).json({
      success: false,
      message: `Account has been suspended: ${reason}`,
      status: "Suspended",
    });
  }

  const { token, user } = req.user;

  // Set the JWT in an HTTP-only cookie
  const isProduction = process.env.NODE_ENV === "production";
  res.cookie("token", token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "None" : "Lax",
    maxAge: 24 * 60 * 60 * 1000, // 24 hours (MED-05: standardized)
  });

  // Non-blocking login security alert email for Google OAuth
  sendLoginSecurityAlert(user, { method: "Google OAuth", req }).catch((err) => {
    console.warn("[SecurityAlert] Google OAuth login alert error:", err.message);
  });

  // HIGH-05 fix: Only pass minimal, non-sensitive data in the redirect URL.
  // The frontend should use the cookie-based JWT (via /api/auth/check) to
  // retrieve the full user profile securely.
  const clientURL = process.env.CLIENT_URL;

  // Create a short-lived token (30s) just for the redirect handshake
  const secret = process.env.JWT_SECRET;
  const redirectToken = jwt.sign(
    { id: user._id, isNewUser: user.isNewUser || false },
    secret,
    { expiresIn: "30s" }
  );

  const profilePicStr = JSON.stringify(user.profilePic || []);
  const googlePhotoStr = user.googlePhoto || "";
  const selectedAvatarStr = user.selectedAvatar || "";

  const hasPasswordStr = Boolean(user.password && user.password.length > 0) ? "true" : "false";

  res.redirect(
    `${clientURL}/login?authToken=${redirectToken}&id=${user._id}&name=${encodeURIComponent(user.name || "")}&email=${encodeURIComponent(user.email || "")}&profilePic=${encodeURIComponent(profilePicStr)}&googlePhoto=${encodeURIComponent(googlePhotoStr)}&selectedAvatar=${encodeURIComponent(selectedAvatarStr)}&role=${user.role || "user"}&isNewUser=${user.isNewUser ? "true" : "false"}&verified=${user.isVerified ? "true" : "false"}&isOAuthUser=true&hasPassword=${hasPasswordStr}`
  );
};

module.exports = {
  handleGoogleCallback,
};
