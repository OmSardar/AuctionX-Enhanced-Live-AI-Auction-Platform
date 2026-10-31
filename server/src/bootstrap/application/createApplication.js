const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const passport = require("passport");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const axios = require("axios");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const crypto = require("crypto");
const path = require("path");

// Middleware & Security
const errorHandler = require("../../common/errors/errorHandler");
const { httpLogger } = require("../../infrastructure/logging/loggerMiddleware");
const { csrfProtection, csrfTokenRoute } = require("../../infrastructure/security/csrfMiddleware");
const { graphqlLimiter, telemetryLimiter } = require("../../infrastructure/security/rateLimiter");
const correlationIdMiddleware = require("../../infrastructure/security/correlationIdMiddleware");
const healthRoutes = require("../../infrastructure/observability/healthRoutes");
const { router: metricsRoutes, metricsMiddleware } = require("../../infrastructure/observability/metricsRoutes");
const configureGoogleStrategy = require("../../infrastructure/security/passportGoogleStrategy");

// Routes
const authRoutes = require("../../modules/users/routes/userAuthRoutes");
const sellerRoutes = require("../../modules/sellers/accounts/routes/sellerAuthRoutes");
const privacyRoutes = require("../../modules/communication/routes/privacyRequestsRoutes");
const contactRoutes = require("../../modules/communication/routes/contactRoutes");
const faqRoutes = require("../../modules/communication/routes/faqRoutes");
const feedbackRoutesUser = require("../../modules/feedback/routes/feedbackRoutes");
const productFeedbackRoutes = require("../../modules/feedback/routes/productFeedbackRoutes");
const scheduledBidRoutes = require("../../modules/bidding/routes/scheduledBidRoutes");
const chatRoutes = require("../../modules/chat/routes/chatRoutes");
const goodieRoutes = require("../../modules/admin/settings/routes/goodieRoutes");

// Admin Routes
const inventoryRoutes = require("../../modules/admin/listings/routes/inventoryRoutes");
const reportRoutesAdmin = require("../../modules/admin/moderation/routes/reportsRoutes");
const transactionRoutes = require("../../modules/admin/finance/routes/transactionRoutes");
const subscriptionRoutes = require("../../modules/admin/finance/routes/subscriptionRoutes");
const bannerRoutes = require("../../modules/admin/tasks/routes/bannerRoutes");
const eventRoutes = require("../../modules/admin/tasks/routes/eventsRoutes");
const calendarRoutes = require("../../modules/admin/tasks/routes/calendarRoutes");
const notificationRoutes = require("../../modules/admin/settings/routes/adminNotificationRoutes");
const adminSellerRoutes = require("../../modules/admin/sellers/routes/sellerManagementRoutes");
const adminNewRoutes = require("../../modules/admin/dashboard/routes/adminRoutes");
const teamRoutes = require("../../modules/team/routes/teamRoutes");
const adminManagementRoutes = require("../../modules/admin/settings/routes/adminManagementRoutes");
const { graphqlHandler } = require("../../modules/integrations/graphql/graphqlHandler");
const adminAuthMiddleware = require("../../modules/admin/authentication/middleware/authAdminMiddleware");

// Product, Payment & Integration Routes
const productRoutes = require("../../modules/products/routes/productRoutes");
const orderRoutes = require("../../modules/orders/routes/orderRoutes");
const sellerSubscriptionRoutes = require("../../modules/sellers/subscriptions/routes/sellerSubscriptionRoutes");
const paymentWebhookRoutes = require("../../modules/payments/routes/paymentWebhookRoutes");
const soapTransactionRoutes = require("../../modules/integrations/soap/soapTransactionRoutes");

const KNOWN_ALLOWED_ORIGINS = [
  "https://auction-x-enhanced-live-ai-auction.vercel.app",
  "https://auction-x-enhanced-live-ai-auction.onrender.com",
  "https://auctionx-client.onrender.com",
];

const VERCEL_AUCTIONX_REGEX = /^https:\/\/auction-x-enhanced-live-ai-auction.*\.vercel\.app$/;
const LOCALHOST_REGEX = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

/**
 * Validates whether an incoming HTTP/WS request Origin header is permitted by CORS policy.
 * Supports explicit configured origins, known production domains, dynamic Vercel deployments,
 * and standard local development ports.
 *
 * @param {string|undefined} origin
 * @param {string[]} [explicitAllowedOrigins]
 * @returns {boolean}
 */
function isOriginAllowed(origin, explicitAllowedOrigins = []) {
  if (!origin) return true; // Server-to-server, curl, Postman, native mobile
  const normalized = origin.trim().replace(/\/+$/, "");

  // 1. Direct match against explicitly configured origins (env or options)
  if (explicitAllowedOrigins.some((o) => o && o.trim().replace(/\/+$/, "") === normalized)) {
    return true;
  }

  // 2. Direct match against known production domains
  if (KNOWN_ALLOWED_ORIGINS.some((o) => o.replace(/\/+$/, "") === normalized)) {
    return true;
  }

  // 3. Match any AuctionX Vercel production or preview deployment branch URL
  if (VERCEL_AUCTIONX_REGEX.test(normalized)) {
    return true;
  }

  // 4. In development/testing environments, permit all localhost / loopback ports
  if (process.env.NODE_ENV !== "production") {
    if (LOCALHOST_REGEX.test(normalized)) {
      return true;
    }
  }

  return false;
}

function getAllowedOrigins() {
  const configuredOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim().replace(/\/+$/, ""))
    : [];

  const devOrigins =
    process.env.NODE_ENV !== "production"
      ? [
          "http://localhost:3000",
          "http://127.0.0.1:3000",
          "http://localhost:4173",
          "http://127.0.0.1:4173",
          "http://localhost:5173",
          "http://127.0.0.1:5173",
        ]
      : [];

  const clientUrl = process.env.CLIENT_URL ? process.env.CLIENT_URL.trim().replace(/\/+$/, "") : null;

  return Array.from(
    new Set([
      ...KNOWN_ALLOWED_ORIGINS,
      ...configuredOrigins,
      ...devOrigins,
      clientUrl,
    ].filter(Boolean))
  );
}

function createApplication(options = {}) {
  const app = express();
  const allowedOrigins = options.allowedOrigins || getAllowedOrigins();

  // Reverse Proxy Trust Configuration
  const shouldTrustProxy =
    process.env.NODE_ENV === "production" ||
    process.env.NODE_ENV === "staging" ||
    process.env.ENVIRONMENT === "staging" ||
    process.env.ENVIRONMENT === "production" ||
    process.env.TRUST_PROXY === "true" ||
    process.env.TRUST_PROXY === "1";

  if (shouldTrustProxy) {
    if (process.env.TRUST_PROXY && process.env.TRUST_PROXY !== "true" && process.env.TRUST_PROXY !== "1") {
      const numericHops = parseInt(process.env.TRUST_PROXY, 10);
      app.set("trust proxy", isNaN(numericHops) ? process.env.TRUST_PROXY : numericHops);
    } else {
      app.set("trust proxy", 1);
    }
  }

  // Request Correlation ID and Prometheus Metrics tracking (registered first)
  app.use(correlationIdMiddleware);
  app.use(metricsMiddleware);

  // HTTP request logging
  app.use(httpLogger);

  // Security headers with robust Content-Security-Policy and cross-origin policies
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            "'unsafe-inline'",
            "'unsafe-eval'",
            "https://checkout.razorpay.com",
          ],
          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            "https://fonts.googleapis.com",
          ],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: [
            "'self'",
            "data:",
            "blob:",
            "https://res.cloudinary.com",
            "https://lh3.googleusercontent.com",
            "https://cdn-icons-png.flaticon.com",
            "https://avatars.githubusercontent.com",
          ],
          connectSrc: [
            "'self'",
            ...allowedOrigins,
            "https://api.razorpay.com",
            "https://lumberjack.razorpay.com",
            "https://res.cloudinary.com",
            "wss:",
            "ws:",
          ],
          frameSrc: ["'self'", "https://api.razorpay.com"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: process.env.NODE_ENV === "production" ? [] : null,
        },
      },
      crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  );

  // Explicit Permissions-Policy to restrict sensitive browser APIs
  app.use((req, res, next) => {
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    next();
  });

  // Cache-Control protection for sensitive and authenticated API responses
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.set("Pragma", "no-cache");
    next();
  });

  // Body parsing: Capture raw request body for webhook and SOAP endpoints before JSON parsing
  app.use(
    ["/api/payment/webhook", "/api/webhooks/razorpay", "/api/soap/transactions"],
    express.raw({ type: "*/*" }),
    (req, res, next) => {
      if (Buffer.isBuffer(req.body)) {
        req.rawBody = req.body;
      }
      next();
    }
  );

  // Standard JSON body parsing with raw body verification backup
  app.use(
    express.json({
      limit: "10mb",
      verify: (req, res, buf) => {
        if (
          req.originalUrl &&
          (req.originalUrl.includes("/webhook") || req.originalUrl.includes("/webhooks"))
        ) {
          req.rawBody = buf;
        }
      },
    })
  );
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // CORS — robust cross-origin support for production Vercel frontend, local dev, and API consumers
  const corsOptions = {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin, allowedOrigins)) {
        callback(null, true);
      } else {
        if (logger) {
          logger.warn(`[CORS] Rejected request from unauthorized origin: ${origin}`);
        }
        callback(null, false);
      }
    },
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "x-csrf-token",
      "X-CSRF-Token",
      "Authorization",
      "x-idempotency-key",
      "idempotency-key",
      "x-requested-with",
      "Accept",
      "Origin",
    ],
    exposedHeaders: ["x-csrf-token", "X-CSRF-Token", "Content-Disposition"],
    credentials: true,
    maxAge: 86400,
  };

  app.use(cors(corsOptions));
  app.options("*", cors(corsOptions));

  // NoSQL injection protection
  app.use(
    mongoSanitize({
      replaceWith: "_",
    })
  );

  // Operational Health, Readiness, and Prometheus Telemetry Routes (mounted before CSRF)
  app.use(healthRoutes);
  app.use("/api", healthRoutes);
  app.use(metricsRoutes);

  // Serve public static assets (e.g. demo product photographs)
  app.use(express.static(path.join(__dirname, "../../../public")));

  // CSRF Protection
  app.use(csrfProtection);
  app.get("/api/csrf-token", csrfTokenRoute);

  // Passport
  app.use(passport.initialize());
  configureGoogleStrategy();

  // Test route
  app.get("/", (req, res) => {
    res.send("Server is running!");
  });

  // E2E Test-Only Readiness & Database Target Verification Route
  if (process.env.NODE_ENV === "test") {
    app.get("/api/test/e2e-readiness", (req, res) => {
      res.json({
        status: "ready",
        nodeEnv: process.env.NODE_ENV,
        database: mongoose.connection?.name || null,
        readyState: mongoose.connection?.readyState || 0,
      });
    });
  }

  // Login & User Routes
  app.use(authRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/auth/user", authRoutes);
  app.use("/api/auth/seller", sellerRoutes);
  app.use("/api", faqRoutes);

  app.use("/api/privacy", privacyRoutes);
  app.use("/api/contact", contactRoutes);
  app.use("/api/feedback/user", feedbackRoutesUser);
  app.use("/api/goodies", goodieRoutes);
  app.use("/api/product-feedback", productFeedbackRoutes);
  app.use("/api/scheduled-bids", scheduledBidRoutes);
  app.use("/api/chat", chatRoutes);

  // Admin Routes
  app.use("/api/admin", reportRoutesAdmin);
  app.use("/api/transactions", transactionRoutes);
  app.use("/api/subscriptions", subscriptionRoutes);
  app.use("/api/banners", bannerRoutes);
  app.use("/api/events", eventRoutes);
  app.use("/api/calendar", calendarRoutes);
  app.use("/api/items", inventoryRoutes);
  app.use("/api/notifications", notificationRoutes);
  app.use("/api/sellers", adminSellerRoutes);
  app.use("/api/admin", adminNewRoutes);
  app.use("/api/team", teamRoutes);
  app.use("/api/admins", adminManagementRoutes);
  app.post("/api/graphql", graphqlLimiter, adminAuthMiddleware, graphqlHandler);

  // Product & Payment Routes
  app.use("/api/products", productRoutes);
  app.use("/api/seller/subscriptions", sellerSubscriptionRoutes);
  app.use("/api/orders", orderRoutes);
  app.use("/api/payment", paymentWebhookRoutes);
  app.use("/api/webhooks/razorpay", (req, res, next) => {
    req.url = "/webhook";
    paymentWebhookRoutes(req, res, next);
  });
  app.use("/verify-payment", (req, res, next) => {
    req.url = "/wallet/verify";
    paymentWebhookRoutes(req, res, next);
  });
  app.use("/api/soap/transactions", soapTransactionRoutes);

  // Recommendation Proxy & Telemetry
  setupRecommendationRoutes(app);

  // 404 handler for unknown routes
  app.use((req, res) => {
    res.status(404).json({ success: false, message: "Route not found" });
  });

  // Global error handler (must be the very last middleware)
  app.use(errorHandler);

  return app;
}

function setupRecommendationRoutes(app) {
  const getCleanRecommendationUrl = () => {
    const raw = process.env.RECOMMENDATION_SERVICE_URL;
    if (!raw || typeof raw !== "string") return null;
    const trimmed = raw.trim().replace(/\/+$/, "");
    return trimmed.endsWith("/api") ? trimmed.slice(0, -4) : trimmed;
  };

  let hmacFallbackWarned = false;
  const getPseudonymousUserId = (email) => {
    if (!email || typeof email !== "string") return null;
    const dedicated = process.env.RECOMMENDATION_HMAC_SECRET;
    if (!dedicated && !hmacFallbackWarned) {
      console.warn(
        "[SECURITY WARNING] RECOMMENDATION_HMAC_SECRET is not configured; falling back to secondary secret or development default."
      );
      hmacFallbackWarned = true;
    }
    const secret =
      dedicated ||
      process.env.JWT_SECRET ||
      "auctionx_telemetry_pseudonym_secret";
    return crypto
      .createHmac("sha256", secret)
      .update(email.trim().toLowerCase())
      .digest("hex");
  };

  app.post("/api/track", telemetryLimiter, async (req, res) => {
    try {
      const recUrl = getCleanRecommendationUrl();
      if (!recUrl) {
        return res.json({ status: "skipped", message: "Recommendation service URL not configured" });
      }

      const CLIENT_ALLOWED_INTERACTIONS = ["view", "click", "impression"];

      let verifiedEmail = null;
      const token =
        req.cookies?.token ||
        req.cookies?.sellerToken ||
        (req.headers.authorization?.startsWith("Bearer ")
          ? req.headers.authorization.split(" ")[1]
          : null);

      if (token && process.env.JWT_SECRET) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          if (decoded?.email) {
            verifiedEmail = decoded.email.trim().toLowerCase();
          }
        } catch (tokenErr) {
          return res.status(401).json({
            status: "error",
            code: "INVALID_AUTH_TOKEN",
            message: "Provided authentication token could not be verified",
          });
        }
      }

      const rawSessionId = req.body?.session_id
        ? String(req.body.session_id).trim()
        : (Array.isArray(req.body?.batch) && req.body.batch[0]?.session_id)
          ? String(req.body.batch[0].session_id).trim()
          : null;
      const sessionId = (rawSessionId && /^[a-zA-Z0-9_-]{8,64}$/.test(rawSessionId)) ? rawSessionId : null;

      if (!verifiedEmail && !sessionId) {
        return res.status(401).json({
          status: "error",
          code: "AUTHENTICATION_REQUIRED",
          message: "Verified authentication or a valid session_id is required to record user interaction telemetry",
        });
      }

      const pseudonymousId = verifiedEmail ? getPseudonymousUserId(verifiedEmail) : null;

      if (req.body?.batch && Array.isArray(req.body.batch)) {
        if (req.body.batch.length > 25) {
          return res.status(400).json({ status: "error", message: "Batch size exceeds maximum limit of 25 interactions" });
        }

        const validatedBatch = [];
        for (const item of req.body.batch) {
          const itemType = (item?.interaction_type || "impression").toString().toLowerCase().trim();
          if (!CLIENT_ALLOWED_INTERACTIONS.includes(itemType)) {
            return res.status(403).json({
              status: "error",
              code: "FORBIDDEN_INTERACTION_TYPE",
              message: `Clients may only report ${CLIENT_ALLOWED_INTERACTIONS.join(", ")} events. Authoritative business events (bid, purchase) cannot be submitted by clients.`,
            });
          }
          const pid = item?.product_id ? String(item.product_id).trim() : "";
          if (!pid || pid.length > 64) {
            return res.status(400).json({ status: "error", message: "A valid product_id string (max 64 chars) is required for each batch item" });
          }

          const validItem = {
            product_id: pid,
            interaction_type: itemType,
          };
          if (verifiedEmail) {
            validItem.email = verifiedEmail;
            validItem.user_id = pseudonymousId;
          } else {
            validItem.session_id = sessionId;
          }
          const recId = item?.recommendation_id ? String(item.recommendation_id).trim() : null;
          if (recId && /^[a-zA-Z0-9_-]{8,64}$/.test(recId)) {
            validItem.recommendation_id = recId;
          }
          if (item?.position !== undefined && Number.isInteger(Number(item.position))) {
            validItem.position = Number(item.position);
          }
          if (item?.surface) {
            validItem.surface = String(item.surface).trim().slice(0, 32);
          }
          validatedBatch.push(validItem);
        }

        const response = await axios.post(`${recUrl}/api/track/batch`, { interactions: validatedBatch }, {
          timeout: 4000,
          headers: { "Content-Type": "application/json" },
        });
        return res.status(response.status).json(response.data);
      }

      const requestedType = (req.body?.interaction_type || "view").toString().toLowerCase().trim();
      if (!CLIENT_ALLOWED_INTERACTIONS.includes(requestedType)) {
        return res.status(403).json({
          status: "error",
          code: "FORBIDDEN_INTERACTION_TYPE",
          message: `Clients may only report ${CLIENT_ALLOWED_INTERACTIONS.join(", ")} events. Authoritative business events (bid, purchase) cannot be submitted by clients.`,
        });
      }

      const productId = req.body?.product_id ? String(req.body.product_id).trim() : "";
      if (!productId || productId.length > 64) {
        return res.status(400).json({ status: "error", message: "A valid product_id string (max 64 chars) is required" });
      }

      const payload = {
        product_id: productId,
        interaction_type: requestedType,
      };

      if (verifiedEmail) {
        payload.email = verifiedEmail;
        payload.user_id = pseudonymousId;
      } else {
        payload.session_id = sessionId;
      }

      const recId = req.body?.recommendation_id ? String(req.body.recommendation_id).trim() : null;
      if (recId && /^[a-zA-Z0-9_-]{8,64}$/.test(recId)) {
        payload.recommendation_id = recId;
      }

      if (req.body?.position !== undefined && Number.isInteger(Number(req.body.position))) {
        payload.position = Number(req.body.position);
      }
      if (req.body?.surface) {
        payload.surface = String(req.body.surface).trim().slice(0, 32);
      }

      const trackingHeaders = { "Content-Type": "application/json" };
      if (req.id || req.correlationId) {
        trackingHeaders["X-Request-ID"] = req.id || req.correlationId;
        trackingHeaders["X-Correlation-ID"] = req.correlationId || req.id;
      }

      const response = await axios.post(`${recUrl}/api/track`, payload, {
        timeout: 3000,
        headers: trackingHeaders,
      });
      return res.status(response.status).json(response.data);
    } catch (error) {
      const upstreamStatus = error.response?.status;
      if (upstreamStatus && upstreamStatus >= 400 && upstreamStatus < 500) {
        return res.status(upstreamStatus).json(error.response?.data || { status: "error" });
      }
      return res.json({ status: "ok", tracked: false });
    }
  });

  const handleRecommendationsRoute = async (req, res) => {
    try {
      const recUrl = getCleanRecommendationUrl();
      if (!recUrl) {
        return res.status(503).json({ error: "Recommendation service URL not configured" });
      }

      const { count = 10, fallback } = req.query;

      let verifiedEmail = null;
      const authHeader = req.headers.authorization;
      const token =
        authHeader && authHeader.startsWith("Bearer ")
          ? authHeader.split(" ")[1]
          : req.cookies?.token;

      if (token) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET || "test_jwt_secret");
          if (decoded && decoded.email) {
            verifiedEmail = decoded.email.trim().toLowerCase();
          }
        } catch (_) {
          // Unverified token: treat as guest
        }
      }

      const targetEmail = verifiedEmail || null;
      const rawSessionId = req.query?.session_id || req.headers["x-session-id"];
      const sessionId = (rawSessionId && typeof rawSessionId === "string" && /^[a-zA-Z0-9_-]{8,64}$/.test(rawSessionId.trim()))
        ? rawSessionId.trim()
        : null;

      const queryParams = { count };
      if (!targetEmail && sessionId) {
        queryParams.session_id = sessionId;
      }

      const upstreamUrl = targetEmail
        ? `${recUrl}/api/recommendations/${encodeURIComponent(targetEmail)}`
        : `${recUrl}/api/recommendations`;

      const headers = {};
      if (targetEmail) {
        const internalKey =
          (process.env.INTERNAL_SERVICE_KEY || "").trim() ||
          (process.env.NODE_ENV === "test" ? "test_internal_auctionx_secret_key" : "");
        if (internalKey) {
          headers["x-internal-service-key"] = internalKey;
        }
      }

      if (req.id || req.correlationId) {
        headers["X-Request-ID"] = req.id || req.correlationId;
        headers["X-Correlation-ID"] = req.correlationId || req.id;
      }

      let response;
      try {
        response = await axios.get(upstreamUrl, {
          params: queryParams,
          headers,
          timeout: 5000,
        });
      } catch (upstreamErr) {
        if (fallback === "true") {
          try {
            const Product = mongoose.models.Product || require("../../modules/products/models/productSchema");
            const fallbackProducts = await Product.find({
              status: "Active",
              isModerated: { $ne: true },
              moderationStatus: { $nin: ["REMOVED", "SUSPENDED"] },
            })
              .sort({ bidCount: -1, createdAt: -1 })
              .limit(Math.min(parseInt(count) || 10, 50))
              .lean();

            return res.json({
              products: fallbackProducts,
              recommendations: fallbackProducts,
              count: fallbackProducts.length,
              personalized: false,
              fallback: true,
            });
          } catch (dbErr) {
            console.error("Database fallback error:", dbErr.message);
          }
        }
        throw upstreamErr;
      }

      let data = response.data;
      if (data && Array.isArray(data.products)) {
        data.products = data.products.filter(
          (p) => !p.isModerated && !["REMOVED", "SUSPENDED"].includes(p.moderationStatus)
        );
      }

      res.json(data);
    } catch (error) {
      console.error("Error fetching recommendations:", error.message);
      const statusCode = error.response?.status || 500;
      const errorMessage =
        error.response?.data?.error || "Failed to fetch recommendations";
      res.status(statusCode).json({ error: errorMessage });
    }
  };

  app.get("/api/recommendations", handleRecommendationsRoute);
  app.get("/api/recommendations/:email", handleRecommendationsRoute);
}

module.exports = { createApplication, getAllowedOrigins, isOriginAllowed, KNOWN_ALLOWED_ORIGINS };
