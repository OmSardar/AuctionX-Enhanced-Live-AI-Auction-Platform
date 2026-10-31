/**
 * Recommendation Tracking Service — Durable Authoritative Event Outbox & Dispatcher
 *
 * Implements a MongoDB-backed Transactional Outbox pattern for authoritative business
 * interactions (successful bids, settled purchases). Ensures interaction signals are
 * durably persisted across process restarts, and dispatches to the recommendation engine
 * with internal service credentials, bounded retries, and exponential backoff.
 *
 * Guaranteed Invariant: Telemetry failures NEVER block, fail, or roll back business transactions.
 */

const axios = require("axios");
const RecommendationOutbox = require("./models/recommendationOutbox");
const { logger } = require("../logging/loggerMiddleware");

let outboxWorkerTimer = null;

const getCleanRecommendationUrl = () => {
  const raw = process.env.RECOMMENDATION_SERVICE_URL;
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim().replace(/\/+$/, "");
  return trimmed.endsWith("/api") ? trimmed.slice(0, -4) : trimmed;
};

/**
 * Resolves the internal service authentication secret.
 * Enforces fail-closed semantics in all non-test environments.
 */
const getInternalServiceKey = () => {
  const configured = (process.env.INTERNAL_SERVICE_KEY || "").trim();
  if (configured) return configured;

  const env = (process.env.NODE_ENV || process.env.ENVIRONMENT || "development").trim().toLowerCase();
  if (env === "test") {
    return "test_internal_auctionx_secret_key";
  }

  // Fail closed in staging, production, and non-test environments
  return null;
};

/**
 * Dispatches an HTTP payload with bounded exponential backoff retries.
 */
async function dispatchWithRetry(url, payload, serviceKey, maxRetries = 3) {
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.post(`${url}/api/track`, payload, {
        headers: {
          "Content-Type": "application/json",
          "x-internal-service-key": serviceKey,
        },
        timeout: 2500, // 2.5s bounded timeout per attempt
      });

      return { success: true, data: response.data, attempt };
    } catch (err) {
      lastError = err;
      const status = err.response?.status;

      // Fail fast on client errors (400, 401, 403, 404, 409) — retries will not resolve schema or auth rejection
      if (status && status >= 400 && status < 500) {
        break;
      }

      // Exponential backoff before next attempt for transient network/5xx errors
      if (attempt < maxRetries) {
        const delayMs = attempt * 150;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  return { success: false, error: lastError?.response?.data?.detail || lastError?.message || "Unknown delivery failure" };
}

/**
 * Dispatches a single outbox document to the recommendation service.
 * Employs atomic lease locking to guarantee safe concurrency across workers.
 *
 * @param {string|mongoose.Types.ObjectId} outboxId
 * @returns {Promise<Object>} Outcome of dispatch
 */
async function dispatchOutboxDoc(outboxId, options = {}) {
  const now = new Date();
  const leaseTimeoutMs = options.leaseTimeoutMs || 30000;
  const leaseCutoff = new Date(now.getTime() - leaseTimeoutMs);

  // Atomic lease claim: transitions if PENDING, eligible retry, or PROCESSING with expired lease
  const doc = await RecommendationOutbox.findOneAndUpdate(
    {
      _id: outboxId,
      $or: [
        { status: { $in: ["PENDING", "FAILED"] } },
        { status: "PROCESSING", lastAttemptAt: { $lte: leaseCutoff } },
      ],
      attempts: { $lt: 5 },
    },
    {
      $set: { status: "PROCESSING", lastAttemptAt: now },
      $inc: { attempts: 1 },
    },
    { new: true }
  );

  if (!doc) {
    // Document already claimed by another worker or max attempts exceeded
    return { success: false, reason: "ALREADY_CLAIMED_OR_EXHAUSTED" };
  }

  const recUrl = getCleanRecommendationUrl();
  const serviceKey = getInternalServiceKey();

  if (!recUrl || !serviceKey) {
    const errorMsg = !recUrl
      ? "RECOMMENDATION_SERVICE_NOT_CONFIGURED"
      : "INTERNAL_SERVICE_KEY_NOT_CONFIGURED";

    if (logger) {
      logger.warn(`[RecommendationTracking] Outbox dispatch suspended: ${errorMsg}`);
    }

    await RecommendationOutbox.updateOne(
      { _id: doc._id },
      {
        $set: {
          status: "FAILED",
          error: errorMsg,
        },
      }
    );
    return { success: false, error: errorMsg };
  }

  try {
    const response = await axios.post(`${recUrl}/api/track`, doc.payload, {
      headers: {
        "Content-Type": "application/json",
        "x-internal-service-key": serviceKey,
      },
      timeout: 2500,
    });

    await RecommendationOutbox.updateOne(
      { _id: doc._id },
      {
        $set: {
          status: "DELIVERED",
          deliveredAt: new Date(),
          error: null,
        },
      }
    );

    return { success: true, data: response.data };
  } catch (err) {
    const status = err.response?.status;
    const errorMsg = err.response?.data?.detail || err.message || "Dispatch failed";

    // Client errors (400, 401, 403, 404, 409) are permanent rejections: do not retry
    const isPermanentRejection = status && status >= 400 && status < 500;
    const isExhausted = doc.attempts >= (doc.maxAttempts || 5);

    if (isPermanentRejection || isExhausted) {
      await RecommendationOutbox.updateOne(
        { _id: doc._id },
        {
          $set: {
            status: "FAILED",
            error: errorMsg,
          },
        }
      );
    } else {
      // Exponential backoff for transient failures (2s, 4s, 8s, 16s, 32s, capped at 60s)
      const delayMs = Math.min(60000, Math.pow(2, doc.attempts) * 1000);
      await RecommendationOutbox.updateOne(
        { _id: doc._id },
        {
          $set: {
            status: "PENDING",
            nextAttemptAt: new Date(Date.now() + delayMs),
            error: errorMsg,
          },
        }
      );
    }

    if (logger) {
      logger.warn(
        `[RecommendationTracking] Outbox event ${doc.eventId} (${doc.eventType}) dispatch failure (attempt ${doc.attempts}): ${errorMsg}`
      );
    }

    return { success: false, error: errorMsg };
  }
}

/**
 * Enqueues an authoritative business event durably into the MongoDB RecommendationOutbox.
 * Supports passing a Mongoose session for multi-document ACID transactions on replica sets.
 *
 * @param {Object} params
 * @param {string} params.email - Verified user email
 * @param {string|mongoose.Types.ObjectId} params.productId - Product MongoDB ObjectId
 * @param {string} params.interactionType - 'bid' or 'purchase'
 * @param {string} [params.eventId] - Unique idempotency identifier derived from business entity
 * @param {Object} [options]
 * @param {mongoose.ClientSession} [options.session] - Optional transaction session
 * @returns {Promise<Object>} Outcome of enqueueing
 */
async function enqueueAuthoritativeEvent(
  { email, productId, interactionType, eventId = null },
  options = {}
) {
  if (!email || !productId || !interactionType) {
    return { success: false, reason: "MISSING_REQUIRED_FIELDS" };
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const pidStr = productId.toString().trim();
  const resolvedEventId = eventId
    ? String(eventId).trim()
    : `${interactionType}:${pidStr}:${cleanEmail}:${Date.now()}`;

  const payload = {
    email: cleanEmail,
    product_id: pidStr,
    interaction_type: interactionType,
    event_id: resolvedEventId,
    timestamp: new Date().toISOString(),
  };

  const session = options.session || null;

  try {
    let outboxDoc;

    if (session) {
      // Atomic transactional enqueue (Replica Set Topology)
      const docs = await RecommendationOutbox.create(
        [
          {
            eventId: resolvedEventId,
            eventType: interactionType,
            email: cleanEmail,
            productId: pidStr,
            payload,
            status: "PENDING",
            nextAttemptAt: new Date(),
          },
        ],
        { session }
      );
      outboxDoc = docs[0];
    } else {
      // Standalone or non-session write: handle concurrent duplicate eventId safely
      try {
        outboxDoc = await RecommendationOutbox.create({
          eventId: resolvedEventId,
          eventType: interactionType,
          email: cleanEmail,
          productId: pidStr,
          payload,
          status: "PENDING",
          nextAttemptAt: new Date(),
        });
      } catch (insertErr) {
        if (insertErr.code === 11000) {
          // Event already enqueued durably
          outboxDoc = await RecommendationOutbox.findOne({ eventId: resolvedEventId });
        } else {
          throw insertErr;
        }
      }
    }

    // Trigger immediate non-blocking dispatch attempt if not in an uncommitted transaction
    if (!session && outboxDoc?._id) {
      setImmediate(() => {
        dispatchOutboxDoc(outboxDoc._id).catch(() => {});
      });
    }

    return {
      success: true,
      eventId: resolvedEventId,
      outboxId: outboxDoc?._id,
    };
  } catch (err) {
    if (logger) {
      logger.error(`[RecommendationTracking] Failed to enqueue outbox event ${resolvedEventId}: ${err.message}`);
    }
    return { success: false, error: err.message };
  }
}

/**
 * Sweeper reconciling pending, retryable, and lease-expired outbox events.
 *
 * @param {Object} [params]
 * @param {number} [params.limit=50] - Batch size
 * @param {number} [params.leaseTimeoutMs=30000] - Lease expiration window in ms
 * @returns {Promise<Object>} Reconciliation summary
 */
async function reconcileOutboxEvents({ limit = 50, leaseTimeoutMs = 30000 } = {}) {
  try {
    const now = new Date();
    const leaseCutoff = new Date(now.getTime() - leaseTimeoutMs);

    // 1. Reclaim or fail stranded PROCESSING documents whose worker lease has expired
    await RecommendationOutbox.updateMany(
      {
        status: "PROCESSING",
        lastAttemptAt: { $lte: leaseCutoff },
        attempts: { $gte: 5 },
      },
      {
        $set: {
          status: "FAILED",
          error: "Worker lease expired and retry attempts exhausted",
        },
      }
    );

    await RecommendationOutbox.updateMany(
      {
        status: "PROCESSING",
        lastAttemptAt: { $lte: leaseCutoff },
        attempts: { $lt: 5 },
      },
      {
        $set: {
          status: "PENDING",
          nextAttemptAt: now,
        },
      }
    );

    // 2. Fetch eligible PENDING candidates
    const candidates = await RecommendationOutbox.find({
      status: "PENDING",
      nextAttemptAt: { $lte: now },
      attempts: { $lt: 5 },
    })
      .sort({ nextAttemptAt: 1 })
      .limit(limit);

    let dispatchedCount = 0;
    let deliveredCount = 0;

    for (const doc of candidates) {
      dispatchedCount++;
      const result = await dispatchOutboxDoc(doc._id, { leaseTimeoutMs });
      if (result.success) {
        deliveredCount++;
      }
    }

    return { success: true, evaluated: candidates.length, dispatchedCount, deliveredCount };
  } catch (err) {
    if (logger) {
      logger.warn(`[RecommendationTracking] Error during outbox reconciliation: ${err.message}`);
    }
    return { success: false, error: err.message };
  }
}

/**
 * Starts the background outbox reconciliation worker.
 *
 * @param {number} [intervalMs=10000] - Polling interval in ms
 */
function startOutboxWorker(intervalMs = 10000) {
  if (outboxWorkerTimer) return;

  outboxWorkerTimer = setInterval(async () => {
    try {
      await reconcileOutboxEvents();
    } catch (_) {}
  }, intervalMs);

  if (outboxWorkerTimer.unref) {
    outboxWorkerTimer.unref();
  }
}

/**
 * Stops the background outbox reconciliation worker for graceful shutdown.
 */
function stopOutboxWorker() {
  if (outboxWorkerTimer) {
    clearInterval(outboxWorkerTimer);
    outboxWorkerTimer = null;
  }
}

/**
 * Backward-compatible drop-in wrapper for existing callers.
 * Enqueues to durable outbox and executes non-blocking delivery.
 */
async function recordAuthoritativeInteraction(params) {
  return enqueueAuthoritativeEvent(params);
}

module.exports = {
  recordAuthoritativeInteraction,
  enqueueAuthoritativeEvent,
  dispatchOutboxDoc,
  reconcileOutboxEvents,
  startOutboxWorker,
  stopOutboxWorker,
  getInternalServiceKey,
  dispatchWithRetry,
};
