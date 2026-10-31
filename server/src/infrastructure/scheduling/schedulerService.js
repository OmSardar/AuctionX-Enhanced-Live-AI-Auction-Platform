const { processLifecycleTransitions } = require("../../modules/auctions/services/lifecycleService");
const { logger } = require("../logging/loggerMiddleware");

let timerId = null;
let isProcessing = false;
let customTimeProvider = null;
let cachedIo = null;
let currentIntervalMs = 5000;
let consecutiveErrors = 0;
let lastCycleSummary = null;
let lastCycleTime = null;

/**
 * Gets the current authoritative timestamp (supports mock time injection in tests).
 * @returns {Date}
 */
function getCurrentTime() {
  if (typeof customTimeProvider === "function") {
    return customTimeProvider();
  }
  return new Date();
}

/**
 * Injects a custom time provider for deterministic testing.
 * @param {Function|null} provider - Function returning Date, or null to reset to system clock
 */
function setTimeProvider(provider) {
  customTimeProvider = typeof provider === "function" ? provider : null;
}

/**
 * Resets time provider to authoritative system clock.
 */
function resetTimeProvider() {
  customTimeProvider = null;
}

/**
 * Executes a single lifecycle reconciliation cycle with error handling and backoff.
 * Safe to call directly in unit/integration tests.
 *
 * @param {Object} options
 * @param {Date} [options.now]
 * @param {Object} [options.io]
 * @returns {Promise<Object|null>} Cycle execution summary
 */
async function triggerTickNow({ now = null, io = null } = {}) {
  if (isProcessing) {
    if (logger) {
      logger.debug("[Scheduler] Cycle skipped: previous cycle still in progress");
    }
    return null;
  }

  isProcessing = true;
  const executionTime = now || getCurrentTime();
  const socketIo = io || cachedIo;

  try {
    const summary = await processLifecycleTransitions({
      now: executionTime,
      batchSize: parseInt(process.env.SCHEDULER_BATCH_SIZE, 10) || 50,
      io: socketIo,
    });

    consecutiveErrors = 0;
    lastCycleTime = executionTime instanceof Date ? executionTime : new Date(executionTime);
    lastCycleSummary = summary;
    return summary;
  } catch (error) {
    consecutiveErrors++;
    lastCycleTime = executionTime instanceof Date ? executionTime : new Date(executionTime);
    lastCycleSummary = {
      error: error.message,
      consecutiveErrors,
      timestamp: lastCycleTime.toISOString(),
    };
    if (logger) {
      logger.error(
        `[Scheduler] Error during lifecycle cycle (failure count: ${consecutiveErrors}): ${error.message}`
      );
    }
    return {
      error: error.message,
      consecutiveErrors,
      timestamp: executionTime.toISOString(),
    };
  } finally {
    isProcessing = false;
  }
}

/**
 * Internal recursive scheduler tick with backoff support.
 */
function scheduleNextTick() {
  if (!timerId) return;

  // Exponential backoff if consecutive database errors occur (max 30s)
  const backoffMultiplier = Math.min(Math.pow(1.5, consecutiveErrors), 6);
  const nextDelay = Math.round(currentIntervalMs * backoffMultiplier);

  timerId = setTimeout(async () => {
    if (!timerId) return;
    await triggerTickNow();
    scheduleNextTick();
  }, nextDelay);

  // Unref timer in Node so it doesn't prevent process exit if running as a background task
  if (timerId && typeof timerId.unref === "function") {
    timerId.unref();
  }
}

/**
 * Starts the lifecycle scheduler background worker.
 * Idempotent: calling startScheduler when already running is a safe no-op.
 *
 * @param {Object} options
 * @param {number} [options.intervalMs] - Polling interval in ms (default 5000ms or env)
 * @param {Object} [options.io] - Socket.IO server instance
 * @returns {boolean} True if started, false if already running
 */
function startScheduler({ intervalMs = null, io = null } = {}) {
  if (timerId !== null) {
    return false; // Already running
  }

  if (io) {
    cachedIo = io;
  }

  const envInterval = parseInt(process.env.SCHEDULER_INTERVAL_MS, 10);
  currentIntervalMs = intervalMs || envInterval || 5000;
  consecutiveErrors = 0;

  if (logger) {
    logger.info(
      `[Scheduler] Starting Auction Lifecycle Scheduler (polling interval: ${currentIntervalMs}ms)`
    );
  }

  // Trigger immediate catch-up cycle on startup (recovery from downtime / restarts)
  triggerTickNow().catch((err) => {
    if (logger) {
      logger.warn(`[Scheduler] Initial recovery cycle encountered error: ${err.message}`);
    }
  });

  // Start scheduled recurring ticks
  timerId = setTimeout(async () => {
    if (!timerId) return;
    await triggerTickNow();
    scheduleNextTick();
  }, currentIntervalMs);

  if (timerId && typeof timerId.unref === "function") {
    timerId.unref();
  }

  return true;
}

/**
 * Stops the lifecycle scheduler gracefully.
 * Clears timers and waits for any active cycle to finish.
 *
 * @returns {Promise<boolean>}
 */
async function stopScheduler() {
  if (timerId !== null) {
    clearTimeout(timerId);
    timerId = null;
  }

  // Wait if an active cycle is currently running
  let waitCount = 0;
  while (isProcessing && waitCount < 20) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    waitCount++;
  }

  if (logger) {
    logger.info("[Scheduler] Auction Lifecycle Scheduler stopped");
  }

  return true;
}

/**
 * Checks whether the scheduler loop is currently active.
 * @returns {boolean}
 */
function isSchedulerRunning() {
  return timerId !== null;
}

/**
 * Returns operational health, interval, and last execution summary of the scheduler.
 * @returns {Object}
 */
function getSchedulerHealth() {
  return {
    isRunning: timerId !== null,
    isProcessing,
    intervalMs: currentIntervalMs,
    consecutiveErrors,
    lastCycleTime: lastCycleTime ? lastCycleTime.toISOString() : null,
    lastCycleSummary,
  };
}

module.exports = {
  startScheduler,
  stopScheduler,
  isSchedulerRunning,
  getSchedulerHealth,
  triggerTickNow,
  setTimeProvider,
  resetTimeProvider,
  getCurrentTime,
};
