const rateLimit = require("express-rate-limit");

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === "test" ? 1000 : 15, // Raised in test suite to avoid false-positive 429s during automated integration runs
  message: "Too many login attempts. Please try again later.",
});

// Bounded telemetry rate limiter: protects /api/track against automated request flooding
const telemetryLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: process.env.NODE_ENV === "test" ? 1000 : 60, // 60 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "error",
    code: "RATE_LIMIT_EXCEEDED",
    message: "Telemetry tracking rate limit exceeded. Please throttle client interaction events.",
  },
});

// Avatar upload rate limiter: enforces 10 uploads per 15-minute window per authenticated account
const avatarUploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.RATE_LIMIT_AVATAR_MAX
    ? parseInt(process.env.RATE_LIMIT_AVATAR_MAX, 10)
    : 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Determine account type exclusively from trusted server route or middleware context.
    // Client-supplied body or query fields are strictly ignored to prevent quota spoofing.
    const isSellerContext =
      (req.originalUrl && req.originalUrl.includes("/seller")) ||
      (req.baseUrl && req.baseUrl.includes("/seller")) ||
      req.seller ||
      req.user?.role === "seller";

    if (isSellerContext) {
      const sellerId = req.seller?._id || req.user?._id;
      if (sellerId) {
        return `seller:${sellerId.toString()}`;
      }
    }

    if (req.user?._id) {
      return `user:${req.user._id.toString()}`;
    }

    // Fallback for unauthenticated requests: bind to client IP; never grant a privileged or shared key
    return `ip:${req.ip}`;
  },
  handler: (req, res) => {
    const retryAfter = Math.ceil(15 * 60);
    res.set("Retry-After", retryAfter.toString());
    return res.status(429).json({
      success: false,
      status: "error",
      code: "RATE_LIMIT_EXCEEDED",
      message: "Too many avatar upload attempts. Please try again after 15 minutes.",
      retryAfter,
    });
  },
});

// Bounded GraphQL rate limiter: protects /api/graphql against abusive query flooding
const graphqlLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: process.env.NODE_ENV === "test" ? 1000 : 120, // 120 operations per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    errors: [
      {
        message: "Rate limit exceeded for administrative GraphQL operations. Please throttle requests.",
      },
    ],
  },
});

loginLimiter.loginLimiter = loginLimiter;
loginLimiter.telemetryLimiter = telemetryLimiter;
loginLimiter.avatarUploadLimiter = avatarUploadLimiter;
loginLimiter.graphqlLimiter = graphqlLimiter;

module.exports = loginLimiter;
