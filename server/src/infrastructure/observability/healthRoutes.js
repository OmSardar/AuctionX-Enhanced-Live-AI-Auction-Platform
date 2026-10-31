const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();

/**
 * Liveness Probe: GET /health (and /api/health)
 *
 * Lightweight probe that verifies the Node.js/Express process is responsive.
 * Used by container orchestrators (Docker, Kubernetes) and hosting providers (Render)
 * to determine whether the process should remain alive or be restarted.
 */
router.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    service: "auctionx-server",
  });
});

/**
 * Readiness Probe: GET /ready (and /api/ready, /health/ready)
 *
 * Comprehensive dependency probe that verifies the server can safely handle live traffic.
 * Checks MongoDB connection state and executes a non-destructive database ping.
 *
 * Returns:
 * - HTTP 200 OK when all critical dependencies are ready.
 * - HTTP 503 Service Unavailable when database is disconnected or ping times out.
 *
 * Security: Strictly omits credentials, connection strings, hostnames, and internal network topologies.
 */
router.get(["/ready", "/health/ready"], async (req, res) => {
  const isConnected = mongoose.connection && mongoose.connection.readyState === 1;

  let pingMs = null;
  let dbError = null;

  if (isConnected) {
    try {
      const start = process.hrtime.bigint();
      // Safe, lightweight admin ping with 2000ms timeout
      await Promise.race([
        mongoose.connection.db.admin().ping(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Database ping timed out")), 2000)
        ),
      ]);
      const end = process.hrtime.bigint();
      pingMs = Number(end - start) / 1e6; // Milliseconds with fractional precision
    } catch (err) {
      dbError = err.message || "Ping failed";
    }
  }

  const mem = process.memoryUsage();
  const memorySummary = {
    heapUsedMb: Math.round((mem.heapUsed / 1024 / 1024) * 10) / 10,
    heapTotalMb: Math.round((mem.heapTotal / 1024 / 1024) * 10) / 10,
    rssMb: Math.round((mem.rss / 1024 / 1024) * 10) / 10,
  };

  const isReady = isConnected && !dbError;
  const statusCode = isReady ? 200 : 503;

  const payload = {
    status: isReady ? "ready" : "degraded",
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    database: {
      status: isReady ? "connected" : "disconnected",
      ...(pingMs !== null ? { pingMs: Math.round(pingMs * 100) / 100 } : {}),
      ...(dbError ? { error: "Database unreachable or ping timeout" } : {}),
    },
    memory: memorySummary,
  };

  res.status(statusCode).json(payload);
});

module.exports = router;
