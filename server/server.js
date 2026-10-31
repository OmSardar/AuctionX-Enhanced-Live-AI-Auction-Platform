/**
 * AuctionX Server Entry Point (Bootstrap Delegate)
 * 
 * Provides deterministic environment initialization and delegates application assembly,
 * HTTP/Socket.IO lifecycle, and graceful shutdown to modular bootstrap components.
 * 
 * Completely preserves backward-compatible exports for all test suites, workers, and deployment targets.
 */

const path = require("path");

// ============================================================================
// Deterministic Environment Configuration Loading Order
// ============================================================================
if (process.env.NODE_ENV === "test") {
  require("dotenv").config({ path: path.resolve(__dirname, "../.env"), override: false });
  require("dotenv").config({ path: path.resolve(__dirname, ".env"), override: false });
} else {
  require("dotenv").config({ path: path.resolve(__dirname, "../.env"), override: false });
  require("dotenv").config({ path: path.resolve(__dirname, ".env"), override: true });
}
const { validateEnv } = require("./src/config/environment/validateEnv.js");

// Validate environment configuration safely at load
validateEnv();

const { createApplication, getAllowedOrigins } = require("./src/bootstrap/application/createApplication");
const { createServer } = require("./src/bootstrap/server/createServer");
const { setupGracefulShutdown } = require("./src/bootstrap/shutdown/gracefulShutdown");
const { logger } = require("./src/infrastructure/logging/loggerMiddleware");

const allowedOrigins = getAllowedOrigins();
const app = createApplication({ allowedOrigins });
const {
  server,
  io,
  startServer,
  startScheduler,
  stopScheduler,
  startOutboxWorker,
  stopOutboxWorker,
} = createServer(app, { allowedOrigins });

setupGracefulShutdown({ server, stopScheduler, stopOutboxWorker, logger });

if (require.main === module) {
  startServer();
}

module.exports = {
  app,
  server,
  io,
  startServer,
  startScheduler,
  stopScheduler,
  startOutboxWorker,
  stopOutboxWorker,
};
