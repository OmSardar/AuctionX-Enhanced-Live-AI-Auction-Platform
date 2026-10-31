/**
 * Chat Rate Limiter & Generation Guard
 *
 * Enforces multi-tier controls:
 *  1. Input length validation (max 500 characters)
 *  2. Per-conversation turn limit (50 turns = 100 total messages)
 *  3. Per-user sliding-window rate limit (20 messages / minute)
 *  4. Per-user rolling daily limit (100 messages / day)
 *  5. Configurable server-side global request budget (default 1000 calls / day)
 *  6. Fast-tripping circuit breaker on upstream 429/quota or repeated failures
 *  7. Synchronous reservation to eliminate concurrent burst race conditions
 *
 * Process-Local Limitation:
 *  Counters and circuit breakers reside in-memory. In a single-node deployment (Render web service),
 *  they provide strict local protection. If the process restarts or scales horizontally, counters
 *  reset or partition across instances. A durable Redis-backed implementation should be used if
 *  multi-instance deployment is introduced.
 */

const MAX_PER_MINUTE = 20;
const MAX_PER_DAY = 100;
const MAX_INPUT_LENGTH = 500;
const MAX_CONVERSATION_TURNS = 50; // 50 user turns = 100 messages in conversation

// Global platform-wide generation budget (configurable via env)
const GLOBAL_DAILY_BUDGET = parseInt(process.env.CHAT_GLOBAL_DAILY_BUDGET, 10) || 1000;

// Circuit breaker parameters
const CIRCUIT_BREAKER_FAIL_THRESHOLD = 5;
const CIRCUIT_BREAKER_COOLDOWN_MS = 60 * 1000; // 60 seconds

// In-memory window tracking
const minuteWindow = new Map(); // { userId: [timestamp, ...] }
const dayWindow = new Map(); // { userId: [timestamp, ...] }
let globalDayTimestamps = []; // [timestamp, ...]

// Circuit breaker state
let consecutiveProviderFailures = 0;
let circuitBreakerOpenUntil = 0;

// Periodic cleanup: purge entries older than their window
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  const oneMinuteAgo = now - 60 * 1000;
  const oneDayAgo = now - 24 * 60 * 60 * 1000;

  for (const [userId, timestamps] of minuteWindow.entries()) {
    const filtered = timestamps.filter((t) => t > oneMinuteAgo);
    if (filtered.length === 0) minuteWindow.delete(userId);
    else minuteWindow.set(userId, filtered);
  }

  for (const [userId, timestamps] of dayWindow.entries()) {
    const filtered = timestamps.filter((t) => t > oneDayAgo);
    if (filtered.length === 0) dayWindow.delete(userId);
    else dayWindow.set(userId, filtered);
  }

  globalDayTimestamps = globalDayTimestamps.filter((t) => t > oneDayAgo);
}, CLEANUP_INTERVAL_MS);

if (cleanupInterval.unref) cleanupInterval.unref();

/**
 * Synchronously acquire a rate limit slot for a user request.
 * Automatically checks:
 *  - Message validity and character cap
 *  - Conversation turn limits
 *  - Circuit breaker status
 *  - Global platform budget
 *  - Per-user minute and daily limits
 *
 * If allowed, synchronously registers the reservation so concurrent requests
 * in flight cannot race the rate limiter.
 *
 * @param {string} userId - Authenticated user ID
 * @param {string} message - User query text
 * @param {number} currentTurnCount - Number of user turns in conversation
 * @returns {{ allowed: boolean, error?: string, retryAfterMs?: number, reservation?: Object }}
 */
function acquireRateLimitSlot(userId, message, currentTurnCount = 0) {
  const userIdStr = String(userId);
  const now = Date.now();

  // 1. Input message validation
  if (!message || typeof message !== "string") {
    return { allowed: false, error: "Message is required.", statusCode: 400 };
  }
  if (message.trim().length === 0) {
    return { allowed: false, error: "Message cannot be empty.", statusCode: 400 };
  }
  if (message.length > MAX_INPUT_LENGTH) {
    return {
      allowed: false,
      error: `Message too long. Maximum ${MAX_INPUT_LENGTH} characters allowed (you sent ${message.length}).`,
      statusCode: 400,
    };
  }

  // 2. Conversation turn limit (50 user turns = 100 messages)
  if (currentTurnCount >= MAX_CONVERSATION_TURNS) {
    return {
      allowed: false,
      error: `This conversation has reached the maximum of ${MAX_CONVERSATION_TURNS} turns (100 messages). Please start a new conversation.`,
      statusCode: 400,
    };
  }

  // 3. Circuit breaker check
  if (circuitBreakerOpenUntil > now) {
    const remainingMs = circuitBreakerOpenUntil - now;
    return {
      allowed: false,
      error: `AI generation service is temporarily in cooldown due to upstream rate limits. Please try again in ${Math.ceil(remainingMs / 1000)}s.`,
      retryAfterMs: remainingMs,
      statusCode: 503,
      circuitBreaker: true,
      isCircuitOpen: true,
    };
  }

  // 4. Global daily budget check
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  globalDayTimestamps = globalDayTimestamps.filter((t) => t > oneDayAgo);
  if (globalDayTimestamps.length >= GLOBAL_DAILY_BUDGET) {
    return {
      allowed: false,
      error: "Platform daily chat capacity reached. Please try again tomorrow or contact support.",
      retryAfterMs: 60 * 60 * 1000,
      statusCode: 429,
      isBudgetExceeded: true,
    };
  }

  // 5. Per-minute rate limit (sliding window)
  const oneMinuteAgo = now - 60 * 1000;
  const userMinuteList = (minuteWindow.get(userIdStr) || []).filter((t) => t > oneMinuteAgo);
  if (userMinuteList.length >= MAX_PER_MINUTE) {
    const oldestInWindow = userMinuteList[0];
    const retryAfterMs = oldestInWindow + 60 * 1000 - now;
    return {
      allowed: false,
      error: `Rate limit exceeded. Maximum ${MAX_PER_MINUTE} messages per minute. Try again in ${Math.ceil(retryAfterMs / 1000)} seconds.`,
      retryAfterMs,
      statusCode: 429,
    };
  }

  // 6. Per-day rate limit (rolling 24h window)
  const userDayList = (dayWindow.get(userIdStr) || []).filter((t) => t > oneDayAgo);
  if (userDayList.length >= MAX_PER_DAY) {
    const oldestInWindow = userDayList[0];
    const retryAfterMs = oldestInWindow + 24 * 60 * 60 * 1000 - now;
    const retryMinutes = Math.ceil(retryAfterMs / 60000);
    return {
      allowed: false,
      error: `Daily limit exceeded. Maximum ${MAX_PER_DAY} messages per day. Try again in ~${retryMinutes} minutes.`,
      retryAfterMs,
      statusCode: 429,
    };
  }

  // 7. Synchronous reservation: immediately claim slot before asynchronous work
  userMinuteList.push(now);
  minuteWindow.set(userIdStr, userMinuteList);

  userDayList.push(now);
  dayWindow.set(userIdStr, userDayList);

  globalDayTimestamps.push(now);

  return {
    allowed: true,
    reservation: {
      userId: userIdStr,
      timestamp: now,
    },
  };
}

/**
 * Release a previously reserved rate limit slot.
 * Call this if request processing fails before reaching external provider,
 * or if query was handled by local pre-filter without billable work.
 *
 * @param {Object} reservation
 */
function releaseRateLimitSlot(reservation) {
  if (!reservation || !reservation.userId || !reservation.timestamp) return;

  const { userId, timestamp } = reservation;

  const userMinuteList = minuteWindow.get(userId) || [];
  const minIdx = userMinuteList.lastIndexOf(timestamp);
  if (minIdx !== -1) {
    userMinuteList.splice(minIdx, 1);
    minuteWindow.set(userId, userMinuteList);
  }

  const userDayList = dayWindow.get(userId) || [];
  const dayIdx = userDayList.lastIndexOf(timestamp);
  if (dayIdx !== -1) {
    userDayList.splice(dayIdx, 1);
    dayWindow.set(userId, userDayList);
  }

  const globalIdx = globalDayTimestamps.lastIndexOf(timestamp);
  if (globalIdx !== -1) {
    globalDayTimestamps.splice(globalIdx, 1);
  }
}

/**
 * Record a successful provider invocation to reset circuit breaker.
 */
function recordProviderSuccess() {
  consecutiveProviderFailures = 0;
  circuitBreakerOpenUntil = 0;
}

/**
 * Record a provider failure to trip or advance circuit breaker.
 * @param {boolean} isQuotaError - If true (HTTP 429/403), trips immediately
 */
function recordProviderFailure(isQuotaError = false) {
  consecutiveProviderFailures++;
  if (isQuotaError || consecutiveProviderFailures >= CIRCUIT_BREAKER_FAIL_THRESHOLD) {
    circuitBreakerOpenUntil = Date.now() + CIRCUIT_BREAKER_COOLDOWN_MS;
  }
}

/**
 * Legacy compatibility wrapper for checkRateLimit.
 */
function checkRateLimit(userId, message, currentTurnCount = 0) {
  const result = acquireRateLimitSlot(userId, message, currentTurnCount);
  if (!result.allowed) {
    return { error: result.error, retryAfterMs: result.retryAfterMs };
  }
  // For legacy checkRateLimit, release slot since legacy caller will call recordMessage later
  releaseRateLimitSlot(result.reservation);
  return null;
}

/**
 * Legacy compatibility wrapper for recordMessage.
 */
function recordMessage(userId) {
  const userIdStr = String(userId);
  const now = Date.now();

  const mList = minuteWindow.get(userIdStr) || [];
  mList.push(now);
  minuteWindow.set(userIdStr, mList);

  const dList = dayWindow.get(userIdStr) || [];
  dList.push(now);
  dayWindow.set(userIdStr, dList);

  globalDayTimestamps.push(now);
}

/**
 * Get current usage stats for a user (for UI display).
 */
function getUsageStats(userId) {
  const userIdStr = String(userId);
  const now = Date.now();

  const oneMinuteAgo = now - 60 * 1000;
  const oneDayAgo = now - 24 * 60 * 60 * 1000;

  const minuteUsed = (minuteWindow.get(userIdStr) || []).filter((t) => t > oneMinuteAgo).length;
  const dayUsed = (dayWindow.get(userIdStr) || []).filter((t) => t > oneDayAgo).length;

  return {
    minuteUsed,
    minuteLimit: MAX_PER_MINUTE,
    dayUsed,
    dayLimit: MAX_PER_DAY,
    globalBudgetUsed: globalDayTimestamps.filter((t) => t > oneDayAgo).length,
    globalBudgetLimit: GLOBAL_DAILY_BUDGET,
    circuitBreakerActive: circuitBreakerOpenUntil > now,
  };
}

/**
 * Reset all rate limiting state (for automated testing only).
 */
function resetRateLimiter() {
  minuteWindow.clear();
  dayWindow.clear();
  globalDayTimestamps = [];
  consecutiveProviderFailures = 0;
  circuitBreakerOpenUntil = 0;
}

module.exports = {
  acquireRateLimitSlot,
  releaseRateLimitSlot,
  recordProviderSuccess,
  recordProviderFailure,
  checkRateLimit,
  recordMessage,
  getUsageStats,
  resetRateLimiter,
  MAX_PER_MINUTE,
  MAX_PER_DAY,
  MAX_INPUT_LENGTH,
  MAX_CONVERSATION_TURNS,
  GLOBAL_DAILY_BUDGET,
};
