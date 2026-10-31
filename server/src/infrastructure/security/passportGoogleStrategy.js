const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../../modules/users/models/user");
const Seller = require("../../modules/sellers/accounts/models/seller");
const jwt = require("jsonwebtoken");

const verifyGoogleProfile = async (accessToken, refreshToken, profile, done) => {
  try {
    const userEmail = profile.emails && profile.emails[0] ? profile.emails[0].value : "";
    const existingUser = await User.findOne({
      email: userEmail,
    });
    let existingSeller = null;
    if (!existingUser) {
      existingSeller = await Seller.findOne({ email: userEmail });
    }

    // Authoritative suspension check: Block suspended users/sellers from OAuth login
    const existingAccount = existingUser || existingSeller;
    if (existingAccount && existingAccount.status === "Suspended") {
      const suspensionReason = existingAccount.suspensionReason || "Account suspended by administrator";
      const err = new Error(`Account has been suspended: ${suspensionReason}`);
      err.name = "AccountSuspendedError";
      err.status = 403;
      err.suspensionReason = suspensionReason;
      return done(err, false);
    }

    const googlePhotoUrl =
      profile.photos && profile.photos[0] ? profile.photos[0].value : "";

    let user;
    let isNewUser = existingUser ? (existingUser.isNewUser || !existingUser.isVerified) : true;

    if (existingUser) {
      const updateFields = {
        googlePhoto: googlePhotoUrl,
        isOAuthUser: true,
      };

      // Precedence rule:
      // 1. If user explicitly selected a predefined/custom avatar (URL) or reset to hardcoded default ("default"),
      //    preserve that deliberate choice across future Google logins!
      // 2. If user explicitly chose 'google', keep active profilePic synced with latest googlePhotoUrl.
      // 3. If user has never made an explicit choice (!selectedAvatar):
      //    - Legacy migration: if existing user already had an active profilePic differing from googlePhoto
      //      and not containing googleusercontent.com, preserve it as their selectedAvatar!
      //    - Otherwise, use Google photo fallback.
      const hasLegacyCustomAvatar =
        !existingUser.selectedAvatar &&
        existingUser.profilePic?.[0]?.secure_url &&
        existingUser.profilePic[0].secure_url !== googlePhotoUrl &&
        !existingUser.profilePic[0].secure_url.includes("googleusercontent.com");

      if (existingUser.selectedAvatar === "google") {
        // Explicit Google photo choice: keep synced with latest photo
        updateFields.profilePic = [
          {
            secure_url: googlePhotoUrl,
            public_id: "",
          },
        ];
      } else if (existingUser.selectedAvatar === "default" || existingUser.selectedAvatar) {
        // Deliberate choice ("default" or specific avatar URL): do NOT overwrite active profilePic!
      } else if (hasLegacyCustomAvatar) {
        // Migrate legacy deliberate avatar safely without overwriting
        updateFields.selectedAvatar = existingUser.profilePic[0].secure_url;
      } else {
        // No deliberate choice made: use Google photo fallback
        updateFields.profilePic = [
          {
            secure_url: googlePhotoUrl,
            public_id: "",
          },
        ];
      }

      user = await User.findOneAndUpdate(
        { email: profile.emails[0].value },
        { $set: updateFields },
        { new: true }
      );
    } else {
      user = new User({
        name: profile.displayName,
        email: profile.emails[0].value,
        googlePhoto: googlePhotoUrl,
        selectedAvatar: "",
        profilePic: [
          {
            secure_url: googlePhotoUrl,
            public_id: "",
          },
        ],
        role: "user",
        password: "",
        isOAuthUser: true,
        isNewUser: true,
        isVerified: false, // New Google users must complete profile on VerifyProfilePage
      });
      await user.save();
    }

    const token = jwt.sign(
      {
        id: user._id, // Include user ID in JWT
        email: user.email,
        name: user.name,
        role: user.role,
        isNewUser,
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    done(null, {
      token,
      user: {
        _id: user._id, // Ensure _id is passed
        name: user.name,
        email: user.email,
        profilePic: user.profilePic,
        googlePhoto: user.googlePhoto || "",
        selectedAvatar: user.selectedAvatar || "",
        role: user.role,
        isNewUser,
        isVerified: user.isVerified || false,
      },
    });
  } catch (error) {
    done(error);
  }
};

let logger;
try {
  ({ logger } = require("../logging/winstonLogger"));
} catch (_) {
  // Logger middleware may not be initialized in isolated unit tests
}

/**
 * Fallback strategy used when Google OAuth credentials are not provided (e.g. CI, tests, or unconfigured dev).
 * Prevents application startup crashes while returning structured 501 / redirect responses if invoked.
 */
class UnconfiguredGoogleStrategy extends passport.Strategy {
  constructor() {
    super();
    this.name = "google";
  }

  authenticate(req, options) {
    const clientURL = process.env.CLIENT_URL;
    const wantsJson =
      req.headers &&
      req.headers.accept &&
      req.headers.accept.includes("application/json");

    if (clientURL && !wantsJson && typeof this.redirect === "function") {
      return this.redirect(`${clientURL}/login?error=oauth_unconfigured`);
    }

    const error = new Error(
      "Google OAuth is not configured on this server (GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing)"
    );
    error.status = 501;
    this.error(error);
  }
}

const configureGoogleStrategy = (options = {}) => {
  const clientID = (options.clientID || process.env.GOOGLE_CLIENT_ID || "").trim();
  const clientSecret = (options.clientSecret || process.env.GOOGLE_CLIENT_SECRET || "").trim();
  const callbackURL =
    options.callbackURL ||
    process.env.GOOGLE_CALLBACK_URL ||
    "/auth/google/callback";

  if (!clientID || !clientSecret) {
    const message =
      "Google OAuth credentials not configured (GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET missing); Google authentication strategy is disabled.";
    if (logger && typeof logger.info === "function") {
      if (process.env.NODE_ENV === "production") {
        logger.warn(`[OAuth Warning] ${message}`);
      } else {
        logger.info(`[OAuth Info] ${message}`);
      }
    }
    passport.use(new UnconfiguredGoogleStrategy());
    return false;
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID,
        clientSecret,
        callbackURL,
      },
      verifyGoogleProfile
    )
  );
  return true;
};

configureGoogleStrategy.isConfigured = () => {
  const clientID = (process.env.GOOGLE_CLIENT_ID || "").trim();
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || "").trim();
  return Boolean(clientID && clientSecret);
};

configureGoogleStrategy.UnconfiguredGoogleStrategy = UnconfiguredGoogleStrategy;
configureGoogleStrategy.verifyGoogleProfile = verifyGoogleProfile;
module.exports = configureGoogleStrategy;
