const crypto = require("crypto");
const express = require("express");

const router = express.Router();

// Metric accumulators
const MAX_TRACKED_ROUTES = 500;
const httpRequestsTotal = new Map(); // key: "METHOD|STATUS|ROUTE|IS_PROBE" -> count
const httpDurationBuckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]; // seconds
const httpDurationCounts = new Map(); // key: "METHOD|ROUTE|LE" -> count
let httpDurationSum = 0;
let httpDurationCount = 0;
let httpRequestsInFlight = 0;

/**
 * Timing-safe token verification to prevent side-channel timing attacks
 */
function safeTokenMatch(supplied, expected) {
  if (typeof supplied !== "string" || typeof expected !== "string" || !supplied || !expected) {
    return false;
  }
  const bufSupplied = Buffer.from(supplied, "utf8");
  const bufExpected = Buffer.from(expected, "utf8");
  if (bufSupplied.length !== bufExpected.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufSupplied, bufExpected);
}

/**
 * Normalizes dynamic route parameters to avoid cardinality explosion in Prometheus metrics.
 * Ensures user IDs, emails, UUIDs, tokens, and query strings are never stored in metric labels.
 */
function normalizeRoute(url) {
  if (!url) return "/";
  const pathOnly = url.split("?")[0];
  return pathOnly
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, ":email") // Email addresses
    .replace(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g, ":uuid") // UUIDs
    .replace(/[0-9a-fA-F]{24}/g, ":id") // MongoDB ObjectIds
    .replace(/\bpay_[a-zA-Z0-9_-]+\b/g, ":paymentId") // Razorpay payment IDs
    .replace(/\border_[a-zA-Z0-9_-]+\b/g, ":orderId") // Razorpay order IDs
    .replace(/\b[0-9]{4,}\b/g, ":num"); // Long numeric identifiers
}

/**
 * Express middleware to record HTTP metrics on response completion
 */
function metricsMiddleware(req, res, next) {
  httpRequestsInFlight += 1;
  const startTime = process.hrtime.bigint();

  res.on("finish", () => {
    httpRequestsInFlight = Math.max(0, httpRequestsInFlight - 1);
    try {
      const endTime = process.hrtime.bigint();
      const durationSeconds = Number(endTime - startTime) / 1e9;

      const method = req.method || "GET";
      const rawRoute = req.baseUrl ? req.baseUrl + req.path : req.path;
      const route = normalizeRoute(rawRoute);
      const status = String(res.statusCode || 200);

      // Distinguish health / probe traffic from application traffic
      const isProbe =
        route === "/health" ||
        route === "/ready" ||
        route === "/api/health" ||
        route === "/api/ready" ||
        route === "/metrics" ||
        route === "/api/metrics" ||
        route === "/healthz" ||
        route === "/api/healthz" ||
        route === "/favicon.ico";

      // Guard against unbounded route cardinality in both total counts and duration buckets
      const isKnownRoute = httpRequestsTotal.has(`${method}|${status}|${route}|${isProbe}`);
      const canTrackNewRoute = httpRequestsTotal.size < MAX_TRACKED_ROUTES;
      const trackedRoute = canTrackNewRoute || isKnownRoute ? route : ":other";

      const counterKey = `${method}|${status}|${trackedRoute}|${isProbe}`;
      httpRequestsTotal.set(counterKey, (httpRequestsTotal.get(counterKey) || 0) + 1);

      // Record duration
      httpDurationSum += durationSeconds;
      httpDurationCount += 1;

      // Duration Buckets (bounded by trackedRoute)
      for (const bucket of httpDurationBuckets) {
        if (durationSeconds <= bucket) {
          const bucketKey = `${method}|${trackedRoute}|${bucket}`;
          httpDurationCounts.set(bucketKey, (httpDurationCounts.get(bucketKey) || 0) + 1);
        }
      }
      const infKey = `${method}|${trackedRoute}|+Inf`;
      httpDurationCounts.set(infKey, (httpDurationCounts.get(infKey) || 0) + 1);
    } catch (_) {
      // Metrics collection must never fail the application request
    }
  });

  next();
}

/**
 * Formats metrics in standard Prometheus exposition text format
 */
function generatePrometheusOutput(app) {
  const lines = [];

  // Uptime
  lines.push("# HELP process_uptime_seconds The process uptime in seconds.");
  lines.push("# TYPE process_uptime_seconds gauge");
  lines.push(`process_uptime_seconds ${process.uptime().toFixed(2)}`);

  // In-flight requests
  lines.push("# HELP http_requests_in_flight Current number of HTTP requests being processed.");
  lines.push("# TYPE http_requests_in_flight gauge");
  lines.push(`http_requests_in_flight ${httpRequestsInFlight}`);

  // Memory
  const mem = process.memoryUsage();
  lines.push("# HELP nodejs_memory_heap_used_bytes Process heap used in bytes.");
  lines.push("# TYPE nodejs_memory_heap_used_bytes gauge");
  lines.push(`nodejs_memory_heap_used_bytes ${mem.heapUsed}`);

  lines.push("# HELP nodejs_memory_heap_total_bytes Process heap total in bytes.");
  lines.push("# TYPE nodejs_memory_heap_total_bytes gauge");
  lines.push(`nodejs_memory_heap_total_bytes ${mem.heapTotal}`);

  lines.push("# HELP nodejs_memory_rss_bytes Process resident set size in bytes.");
  lines.push("# TYPE nodejs_memory_rss_bytes gauge");
  lines.push(`nodejs_memory_rss_bytes ${mem.rss}`);

  // Socket.io connections
  const io = app.get("io");
  const activeSockets = io && io.engine ? io.engine.clientsCount || 0 : 0;
  lines.push("# HELP auctionx_active_socket_connections Number of currently connected Socket.io clients.");
  lines.push("# TYPE auctionx_active_socket_connections gauge");
  lines.push(`auctionx_active_socket_connections ${activeSockets}`);

  // HTTP Request Counters
  lines.push("# HELP http_requests_total Total number of HTTP requests processed.");
  lines.push("# TYPE http_requests_total counter");
  for (const [key, count] of httpRequestsTotal.entries()) {
    const [method, status, route, isProbe] = key.split("|");
    lines.push(`http_requests_total{method="${method}",status="${status}",route="${route}",is_probe="${isProbe}"} ${count}`);
  }

  // HTTP Request Duration Summary
  lines.push("# HELP http_request_duration_seconds Latency of HTTP requests in seconds.");
  lines.push("# TYPE http_request_duration_seconds summary");
  lines.push(`http_request_duration_seconds_sum ${httpDurationSum.toFixed(4)}`);
  lines.push(`http_request_duration_seconds_count ${httpDurationCount}`);

  return lines.join("\n") + "\n";
}

const METRICS_PATHS = ["/metrics", "/metrics/", "/api/metrics", "/api/metrics/"];

/**
 * Route handler for /metrics (and /api/metrics)
 *
 * Security:
 * - Production: Fails closed (HTTP 401) if METRICS_AUTH_TOKEN is missing or empty.
 * - Non-production: Allows open access when METRICS_AUTH_TOKEN is not configured to preserve developer workflows.
 * - Authenticated: Requires timing-safe match against Bearer header or token query parameter.
 */
router.get(METRICS_PATHS, (req, res) => {
  const isProduction = process.env.NODE_ENV === "production";
  const requiredToken = (process.env.METRICS_AUTH_TOKEN || "").trim();

  // Production Safety Gate: Metrics cannot be exposed unauthenticated in production
  if (isProduction && !requiredToken) {
    return res.status(401).json({
      error: "Unauthorized: Metrics authentication required in production (METRICS_AUTH_TOKEN not configured)",
    });
  }

  // Enforce token authentication when configured (or always in production)
  if (requiredToken || isProduction) {
    const authHeader = req.headers.authorization || "";
    const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
    const queryToken = req.query.token ? String(req.query.token).trim() : null;
    const suppliedToken = bearerToken || queryToken;

    if (!suppliedToken || !safeTokenMatch(suppliedToken, requiredToken)) {
      return res.status(401).json({ error: "Unauthorized: Invalid or missing metrics authentication token" });
    }
  }

  if (req.query.format === "json") {
    const mem = process.memoryUsage();
    const io = req.app.get("io");
    return res.json({
      uptime_seconds: process.uptime(),
      requests_in_flight: httpRequestsInFlight,
      memory: {
        heapUsed: mem.heapUsed,
        heapTotal: mem.heapTotal,
        rss: mem.rss,
      },
      activeSockets: io && io.engine ? io.engine.clientsCount || 0 : 0,
      requests_total: httpDurationCount,
      duration_sum_seconds: httpDurationSum,
      average_latency_ms: httpDurationCount > 0 ? (httpDurationSum / httpDurationCount) * 1000 : 0,
    });
  }

  const textMetrics = generatePrometheusOutput(req.app);
  res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
  res.status(200).send(textMetrics);
});

router.all(METRICS_PATHS, (req, res) => {
  res.setHeader("Allow", "GET, HEAD");
  return res.status(405).json({ error: "Method Not Allowed: Metrics endpoint only supports GET and HEAD requests" });
});

module.exports = {
  router,
  metricsMiddleware,
  normalizeRoute,
};

