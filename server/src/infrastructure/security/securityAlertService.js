const nodemailer = require("nodemailer");
const { resolveAuthenticClientIp } = require("../../common/utilities/ipResolver");

// Simple in-memory deduplication cache for login alert events (stores eventKey -> timestamp)
const recentAlertsCache = new Map();
const ALERT_DEDUPE_WINDOW_MS = 60 * 1000; // 60 seconds

// Cleanup cache every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of recentAlertsCache.entries()) {
    if (now - timestamp > ALERT_DEDUPE_WINDOW_MS) {
      recentAlertsCache.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();

/**
 * Escapes user-controlled inputs for safe insertion into HTML email templates.
 */
const escapeHtml = (str) => {
  if (!str || typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

/**
 * Parses a User-Agent header into a clean, human-readable summary.
 */
const parseUserAgent = (userAgent = "") => {
  if (!userAgent || typeof userAgent !== "string") {
    return { browser: "Unknown Browser", os: "Unknown OS", device: "Desktop / Device" };
  }

  let browser = "Web Browser";
  if (/edg\//i.test(userAgent)) browser = "Microsoft Edge";
  else if (/opr\/|opera/i.test(userAgent)) browser = "Opera";
  else if (/chrome|crios/i.test(userAgent)) browser = "Google Chrome";
  else if (/firefox|fxios/i.test(userAgent)) browser = "Mozilla Firefox";
  else if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) browser = "Apple Safari";

  let os = "Unknown OS";
  if (/iphone|ipad|ipod/i.test(userAgent)) os = "iOS";
  else if (/windows/i.test(userAgent)) os = "Windows";
  else if (/macintosh|mac os x/i.test(userAgent)) os = "macOS";
  else if (/android/i.test(userAgent)) os = "Android";
  else if (/linux/i.test(userAgent)) os = "Linux";

  let device = "Desktop";
  if (/mobi|android|iphone/i.test(userAgent)) device = "Mobile";
  else if (/ipad|tablet/i.test(userAgent)) device = "Tablet";

  return { browser, os, device };
};

/**
 * Resolves safe approximate location label without external paid geolocation APIs.
 */
const resolveApproximateLocation = (req) => {
  if (!req) return "Location details unavailable";
  const rawIp = resolveAuthenticClientIp(req);

  if (!rawIp) return "Location details unavailable";

  if (
    rawIp === "127.0.0.1" ||
    rawIp === "::1" ||
    rawIp === "::ffff:127.0.0.1" ||
    rawIp.startsWith("192.168.") ||
    rawIp.startsWith("10.") ||
    rawIp.startsWith("172.16.")
  ) {
    return "Local / Internal Network";
  }

  // Label approximate or unavailable rather than claiming unverified accuracy
  return "Location details unavailable (direct IP connection)";
};

/**
 * Sends a security alert email for a newly established session.
 * Guaranteed to be non-blocking and safe against credentials disclosure.
 *
 * @param {Object} user - The user document { email, name, _id }
 * @param {Object} options - { method, req, sessionId }
 */
const sendLoginSecurityAlert = async (user, options = {}) => {
  const { method = "Password Login", req = null, sessionId = null } = options;

  if (!user || !user.email) {
    return { success: false, reason: "No user email provided" };
  }

  // Deduplication guard
  const userKey = user._id ? user._id.toString() : user.email;
  const dedupeKey = sessionId ? `${userKey}_${sessionId}` : `${userKey}_${method}`;
  const now = Date.now();

  if (recentAlertsCache.has(dedupeKey)) {
    const lastSent = recentAlertsCache.get(dedupeKey);
    if (now - lastSent < ALERT_DEDUPE_WINDOW_MS) {
      return { success: true, deduplicated: true };
    }
  }

  recentAlertsCache.set(dedupeKey, now);

  const userAgentStr = req?.headers?.["user-agent"] || "";
  const { browser, os, device } = parseUserAgent(userAgentStr);
  const locationLabel = resolveApproximateLocation(req);
  const timestampIso = new Date().toISOString();
  const formattedDate = new Date().toUTCString();

  const safeName = escapeHtml(user.name || "AuctionX User");
  const safeMethod = escapeHtml(method);
  const safeBrowser = escapeHtml(browser);
  const safeOs = escapeHtml(os);
  const safeDevice = escapeHtml(device);
  const safeLocation = escapeHtml(locationLabel);

  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; background-color: #0b0f17; border: 1px solid #1e293b; border-radius: 12px; color: #f8fafc;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="color: #fae570; margin: 0 0 8px 0; font-size: 22px; font-weight: 700;">Security Alert: New Sign-in</h2>
        <p style="color: #94a3b8; font-size: 14px; margin: 0;">AuctionX Account Security Protection</p>
      </div>

      <p style="color: #e2e8f0; font-size: 15px; line-height: 1.5;">
        Hello <strong>${safeName}</strong>,
      </p>
      <p style="color: #cbd5e1; font-size: 14px; line-height: 1.5;">
        We detected a successful sign-in to your AuctionX account. Below are the details of this activity:
      </p>

      <div style="background-color: #111827; border: 1px solid #1f2937; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #e2e8f0;">
          <tr>
            <td style="padding: 6px 0; color: #94a3b8; width: 140px;">Sign-in Method:</td>
            <td style="padding: 6px 0; font-weight: 600; color: #fae570;">${safeMethod}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #94a3b8;">Time (UTC):</td>
            <td style="padding: 6px 0;">${formattedDate}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #94a3b8;">Device & Browser:</td>
            <td style="padding: 6px 0;">${safeBrowser} on ${safeOs} (${safeDevice})</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #94a3b8;">Location:</td>
            <td style="padding: 6px 0;">${safeLocation}</td>
          </tr>
        </table>
      </div>

      <div style="background-color: rgba(245, 158, 11, 0.1); border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 4px; margin: 20px 0;">
        <p style="margin: 0; color: #fbbf24; font-size: 13px; line-height: 1.5;">
          <strong>Didn't recognize this activity?</strong><br />
          If you did not initiate this login, your credentials may have been compromised. Please immediately reset your password and check your account security settings.
        </p>
      </div>

      <footer style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #1e293b; text-align: center; color: #64748b; font-size: 12px;">
        &copy; ${new Date().getFullYear()} AuctionX Security Team. This is an automated notification.
      </footer>
    </div>
  `;

  // Transporter fallback / mocked in test environment
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER || "security@auctionx.com",
      to: user.email,
      subject: `[Security Alert] New sign-in to AuctionX (${safeMethod})`,
      html: htmlContent,
    });

    return { success: true };
  } catch (err) {
    // Graceful error handling - never block the user's login session
    console.warn(`[SecurityAlert] Failed to send login security alert to ${user.email}: ${err.message}`);
    return { success: false, error: err.message };
  }
};

module.exports = {
  sendLoginSecurityAlert,
  parseUserAgent,
  resolveApproximateLocation,
  escapeHtml,
};
