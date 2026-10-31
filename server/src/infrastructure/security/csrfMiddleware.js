/**
 * Custom CSRF Protection Middleware (Double-Submit Cookie Pattern)
 * Replaces the deprecated `csurf` package.
 *
 * How it works:
 * 1. GET /api/csrf-token → generates a token, sets it in a cookie AND returns it in JSON
 * 2. On POST/PUT/PATCH/DELETE requests, the client must send the token in the
 *    `X-CSRF-Token` header. The middleware compares it against the cookie value.
 */

const crypto = require("crypto");

const CSRF_COOKIE_NAME = "_csrf";
const CSRF_HEADER_NAME = "x-csrf-token";

// Methods that don't need CSRF protection
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Webhook, telemetry & authenticated GraphQL endpoints exempt from CSRF
const CSRF_EXEMPT_PATHS = [
  "/api/payment/webhook",
  "/api/webhooks/razorpay",
  "/api/seller/subscriptions/webhook",
  "/api/track",
  "/api/soap/transactions",
  "/api/graphql",
];

/**
 * Check if the current request is exempt from CSRF protection
 */
function isCsrfExempt(req) {
  const urlPath = req.originalUrl || req.path || "";
  return CSRF_EXEMPT_PATHS.some(
    (exemptPath) =>
      urlPath === exemptPath ||
      urlPath.startsWith(`${exemptPath}/`) ||
      urlPath.startsWith(`${exemptPath}?`)
  );
}

/**
 * Generate a cryptographically secure CSRF token
 */
function generateToken() {
  return crypto.randomUUID();
}

/**
 * Middleware: attach csrfToken() helper to the request object
 * and validate tokens on unsafe methods.
 */
function csrfProtection(req, res, next) {
  // Attach a helper to generate/retrieve the token
  let token = req.cookies[CSRF_COOKIE_NAME];

  req.csrfToken = () => {
    if (!token) {
      token = generateToken();
    }
    return token;
  };

  // Safe methods don't need validation
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  // Webhook endpoints are exempt from CSRF (authenticated via cryptographic signature)
  if (isCsrfExempt(req)) {
    return next();
  }

  // For unsafe methods, validate the token
  const cookieToken = req.cookies[CSRF_COOKIE_NAME];
  const headerToken = req.headers[CSRF_HEADER_NAME];

  if (!cookieToken || !headerToken) {
    return res.status(403).json({
      success: false,
      message: "CSRF token missing",
    });
  }

  // Constant-time comparison to prevent timing attacks
  if (cookieToken.length !== headerToken.length) {
    return res.status(403).json({
      success: false,
      message: "Invalid CSRF token",
    });
  }

  const cookieBuf = Buffer.from(cookieToken);
  const headerBuf = Buffer.from(headerToken);

  if (!crypto.timingSafeEqual(cookieBuf, headerBuf)) {
    return res.status(403).json({
      success: false,
      message: "Invalid CSRF token",
    });
  }

  next();
}

/**
 * Route handler: GET /api/csrf-token
 * Sets the CSRF cookie and returns the token in JSON.
 */
function csrfTokenRoute(req, res) {
  const token = req.csrfToken();

  const isProduction = process.env.NODE_ENV === "production";

  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false, // Must be readable by client-side JS
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 3600000, // 1 hour
  });

  // Also set it as XSRF-TOKEN for Angular/axios auto-detection
  res.cookie("XSRF-TOKEN", token, {
    httpOnly: false,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 3600000,
  });

  res.json({ csrfToken: token });
}

module.exports = {
  csrfProtection,
  csrfTokenRoute,
  isCsrfExempt,
  CSRF_EXEMPT_PATHS,
};
