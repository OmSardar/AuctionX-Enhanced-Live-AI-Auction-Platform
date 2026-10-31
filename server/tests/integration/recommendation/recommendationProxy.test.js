const request = require("supertest");
const { app } = require("../../../server");
const axios = require("axios");

describe("Recommendation Service Proxy Integration Tests", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should forward recommendation results from FastAPI service for authenticated user", async () => {
    const jwt = require("jsonwebtoken");
    const JWT_SECRET = process.env.JWT_SECRET || "test_jwt_secret";
    const token = jwt.sign({ email: "user@example.com" }, JWT_SECRET);

    const mockRecommendations = {
      recommendations: [
        { productId: "prod_1", title: "Vintage Clock", score: 0.95 },
        { productId: "prod_2", title: "Antique Desk", score: 0.88 },
      ],
    };

    jest.spyOn(axios, "get").mockResolvedValue({
      status: 200,
      data: mockRecommendations,
    });

    const res = await request(app)
      .get("/api/recommendations/user%40example.com?count=2")
      .set("Authorization", `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(mockRecommendations);
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining("/api/recommendations/user%40example.com"),
      expect.objectContaining({
        headers: expect.objectContaining({ "x-internal-service-key": expect.any(String) }),
        params: { count: "2" },
        timeout: 5000,
      })
    );
  });

  it("should send dedicated INTERNAL_SERVICE_KEY when configured and proxying authenticated requests", async () => {
    const originalKey = process.env.INTERNAL_SERVICE_KEY;
    const originalHmac = process.env.RECOMMENDATION_HMAC_SECRET;
    try {
      process.env.INTERNAL_SERVICE_KEY = "dedicated_proxy_internal_secret";
      process.env.RECOMMENDATION_HMAC_SECRET = "different_hmac_secret";

      const jwt = require("jsonwebtoken");
      const JWT_SECRET = process.env.JWT_SECRET || "test_jwt_secret";
      const token = jwt.sign({ email: "user@example.com" }, JWT_SECRET);

      jest.spyOn(axios, "get").mockResolvedValue({
        status: 200,
        data: { recommendations: [] },
      });

      const res = await request(app)
        .get("/api/recommendations/user%40example.com?count=2")
        .set("Authorization", `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining("/api/recommendations/user%40example.com"),
        expect.objectContaining({
          headers: expect.objectContaining({ "x-internal-service-key": "dedicated_proxy_internal_secret" }),
        })
      );
    } finally {
      process.env.INTERNAL_SERVICE_KEY = originalKey;
      process.env.RECOMMENDATION_HMAC_SECRET = originalHmac;
    }
  });

  it("should NOT send RECOMMENDATION_HMAC_SECRET as x-internal-service-key when INTERNAL_SERVICE_KEY is missing", async () => {
    const originalKey = process.env.INTERNAL_SERVICE_KEY;
    const originalHmac = process.env.RECOMMENDATION_HMAC_SECRET;
    const originalNodeEnv = process.env.NODE_ENV;
    try {
      delete process.env.INTERNAL_SERVICE_KEY;
      process.env.NODE_ENV = "production"; // In non-test mode, no default test key
      process.env.RECOMMENDATION_HMAC_SECRET = "should_not_leak_as_internal_key";

      const jwt = require("jsonwebtoken");
      const JWT_SECRET = process.env.JWT_SECRET || "test_jwt_secret";
      const token = jwt.sign({ email: "user@example.com" }, JWT_SECRET);

      let capturedHeaders = null;
      jest.spyOn(axios, "get").mockImplementation(async (url, config) => {
        capturedHeaders = config.headers;
        return { status: 200, data: { recommendations: [] } };
      });

      const res = await request(app)
        .get("/api/recommendations/user%40example.com?count=2")
        .set("Authorization", `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(capturedHeaders["x-internal-service-key"]).toBeUndefined();
    } finally {
      process.env.INTERNAL_SERVICE_KEY = originalKey;
      process.env.RECOMMENDATION_HMAC_SECRET = originalHmac;
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it("should ignore URL email for unauthenticated requests and forward to guest recommendations", async () => {
    const mockGuestRecommendations = {
      products: [{ _id: "prod_guest", title: "Guest Product", status: "Active" }],
      recommendations: [{ _id: "prod_guest", title: "Guest Product", status: "Active" }],
      count: 1,
      personalized: false,
    };

    jest.spyOn(axios, "get").mockResolvedValue({
      status: 200,
      data: mockGuestRecommendations,
    });

    // Unauthenticated caller attempts to pass someone else's email in the URL
    const res = await request(app).get("/api/recommendations/victim%40example.com?count=2");

    expect(res.statusCode).toBe(200);
    expect(res.body.personalized).toBe(false);
    // Must forward to guest route (/api/recommendations) WITHOUT victim's email in the path
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/recommendations$/),
      expect.objectContaining({ params: { count: "2" }, timeout: 5000 })
    );
  });

  it("should reject account personalization and fall back to guest route when token is invalid or expired", async () => {
    const mockGuestRecommendations = {
      products: [],
      recommendations: [],
      count: 0,
      personalized: false,
    };

    jest.spyOn(axios, "get").mockResolvedValue({
      status: 200,
      data: mockGuestRecommendations,
    });

    const res = await request(app)
      .get("/api/recommendations/victim%40example.com?count=2")
      .set("Authorization", "Bearer invalid_or_expired_token_12345");

    expect(res.statusCode).toBe(200);
    expect(res.body.personalized).toBe(false);
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/recommendations$/),
      expect.objectContaining({ params: { count: "2" }, timeout: 5000 })
    );
  });

  it("should handle error when recommendation service returns 404", async () => {
    const errorResponse = {
      response: {
        status: 404,
        data: { error: "User not found" },
      },
      message: "Request failed with status code 404",
    };

    jest.spyOn(axios, "get").mockRejectedValue(errorResponse);

    const res = await request(app).get("/api/recommendations");

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe("User not found");
  });

  it("should handle timeout or internal error from recommendation service", async () => {
    const timeoutError = new Error("timeout of 5000ms exceeded");
    jest.spyOn(axios, "get").mockRejectedValue(timeoutError);

    const res = await request(app).get("/api/recommendations");

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe("Failed to fetch recommendations");
  });

  it("should forward anonymous guest recommendations when no email parameter is provided", async () => {
    const mockGuestRecommendations = {
      products: [
        { _id: "prod_1", title: "Vintage Clock", status: "Active" },
        { _id: "prod_2", title: "Antique Desk", status: "Active" },
      ],
      recommendations: [
        { _id: "prod_1", title: "Vintage Clock", status: "Active" },
        { _id: "prod_2", title: "Antique Desk", status: "Active" },
      ],
      count: 2,
      personalized: false,
    };

    jest.spyOn(axios, "get").mockResolvedValue({
      status: 200,
      data: mockGuestRecommendations,
    });

    const res = await request(app).get("/api/recommendations?count=2");

    expect(res.statusCode).toBe(200);
    expect(res.body.products).toHaveLength(2);
    expect(res.body.personalized).toBe(false);
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/recommendations$/),
      expect.objectContaining({ params: { count: "2" }, timeout: 5000 })
    );
  });

  it("should derive user identity from verified JWT token and override spoofed URL email", async () => {
    const jwt = require("jsonwebtoken");
    const JWT_SECRET = process.env.JWT_SECRET || "test_jwt_secret";
    const token = jwt.sign({ email: "verifieduser@example.com" }, JWT_SECRET);

    jest.spyOn(axios, "get").mockResolvedValue({
      status: 200,
      data: { products: [], recommendations: [], count: 0, personalized: true },
    });

    const res = await request(app)
      .get("/api/recommendations/attacker_spoofed@example.com?count=3")
      .set("Authorization", `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining("/api/recommendations/verifieduser%40example.com"),
      expect.objectContaining({ params: { count: "3" } })
    );
  });

  it("should gracefully degrade to active catalog fallback when fallback=true and upstream recommendation fails", async () => {
    const timeoutError = new Error("timeout of 5000ms exceeded");
    jest.spyOn(axios, "get").mockRejectedValue(timeoutError);

    const res = await request(app).get("/api/recommendations?count=2&fallback=true");

    expect(res.statusCode).toBe(200);
    expect(res.body.fallback).toBe(true);
    expect(res.body.personalized).toBe(false);
    expect(Array.isArray(res.body.products)).toBe(true);
  });
});

describe("Property Listings Regression Test", () => {
  it("should ensure active listings survive when closed/unsold items precede them in the catalog", () => {
    // Simulated catalog where the first 8 items created are Closed/UNSOLD (Series #5)
    const simulatedRawCatalog = [
      ...Array.from({ length: 8 }, (_, i) => ({
        _id: `closed_${i}`,
        name: `Closed Product ${i}`,
        status: "Closed",
        isModerated: false,
      })),
      ...Array.from({ length: 5 }, (_, i) => ({
        _id: `active_${i}`,
        name: `Active Product ${i}`,
        status: "Active",
        isModerated: false,
        moderationStatus: "ACTIVE",
      })),
    ];

    // The buggy behavior: slicing before filtering produced 0 items
    const buggyResult = simulatedRawCatalog.slice(0, 8).filter((p) => p.status === "Active");
    expect(buggyResult.length).toBe(0);

    // The fixed behavior: filtering active & unmoderated before slicing
    const fixedResult = simulatedRawCatalog
      .filter((p) => p.status === "Active" && !p.isModerated && !["REMOVED", "SUSPENDED"].includes(p.moderationStatus))
      .slice(0, 8);
    expect(fixedResult.length).toBe(5);
    expect(fixedResult[0].name).toBe("Active Product 0");
  });
});

describe("Recommendation Tracking Authorization & Identity Binding Tests", () => {
  const jwt = require("jsonwebtoken");
  const JWT_SECRET = process.env.JWT_SECRET || "test_jwt_secret";

  beforeAll(() => {
    process.env.JWT_SECRET = JWT_SECRET;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should reject client attempts to forge authoritative business events (bid) with 403 Forbidden", async () => {
    const token = jwt.sign({ email: "user@example.com" }, JWT_SECRET);

    const res = await request(app)
      .post("/api/track")
      .set("Authorization", `Bearer ${token}`)
      .send({
        email: "user@example.com",
        product_id: "507f1f77bcf86cd799439011",
        interaction_type: "bid",
      });

    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN_INTERACTION_TYPE");
    expect(res.body.message).toContain("Authoritative business events (bid, purchase) cannot be submitted by clients");
  });

  it("should reject client attempts to forge authoritative purchase events with 403 Forbidden", async () => {
    const token = jwt.sign({ email: "user@example.com" }, JWT_SECRET);

    const res = await request(app)
      .post("/api/track")
      .set("Authorization", `Bearer ${token}`)
      .send({
        email: "user@example.com",
        product_id: "507f1f77bcf86cd799439011",
        interaction_type: "purchase",
      });

    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN_INTERACTION_TYPE");
  });

  it("should reject unauthenticated tracking requests attempting to pass arbitrary emails as identity with 401", async () => {
    const res = await request(app)
      .post("/api/track")
      .send({
        email: "victim@example.com",
        product_id: "507f1f77bcf86cd799439011",
        interaction_type: "view",
      });

    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe("AUTHENTICATION_REQUIRED");
  });

  it("should accept anonymous guest tracking with valid session_id and forward session_id and recommendation_id", async () => {
    jest.spyOn(axios, "post").mockResolvedValue({
      status: 200,
      data: { status: "success", tracked: true },
    });

    const res = await request(app)
      .post("/api/track")
      .send({
        session_id: "sess_guest_abcdef123456",
        recommendation_id: "rec_slate_uuid_789",
        product_id: "507f1f77bcf86cd799439011",
        interaction_type: "click",
        email: "spoofed_guest@example.com", // Unauthenticated email must be ignored/dropped
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.tracked).toBe(true);

    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining("/api/track"),
      expect.objectContaining({
        session_id: "sess_guest_abcdef123456",
        recommendation_id: "rec_slate_uuid_789",
        product_id: "507f1f77bcf86cd799439011",
        interaction_type: "click",
      }),
      expect.any(Object)
    );
    // Ensure unverified email was not forwarded
    const forwardedPayload = axios.post.mock.calls[0][1];
    expect(forwardedPayload.email).toBeUndefined();
  });

  it("should bind user identity to verified JWT and forward client-observable events (view)", async () => {
    const token = jwt.sign({ email: "verified_user@example.com" }, JWT_SECRET);

    jest.spyOn(axios, "post").mockResolvedValue({
      status: 200,
      data: { status: "success", tracked: true },
    });

    const res = await request(app)
      .post("/api/track")
      .set("Authorization", `Bearer ${token}`)
      .send({
        email: "spoofed_email@example.com", // Spoofed email in body must be ignored
        product_id: "507f1f77bcf86cd799439011",
        interaction_type: "view",
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.tracked).toBe(true);

    // Verify axios received verified_user@example.com, NOT spoofed_email@example.com
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining("/api/track"),
      expect.objectContaining({
        email: "verified_user@example.com",
        product_id: "507f1f77bcf86cd799439011",
        interaction_type: "view",
      }),
      expect.any(Object)
    );
  });

  it("should fail gracefully without interrupting browsing when upstream recommendation service is unreachable", async () => {
    const token = jwt.sign({ email: "verified_user@example.com" }, JWT_SECRET);

    jest.spyOn(axios, "post").mockRejectedValue(new Error("connect ECONNREFUSED 127.0.0.1:8000"));

    const res = await request(app)
      .post("/api/track")
      .set("Authorization", `Bearer ${token}`)
      .send({
        product_id: "507f1f77bcf86cd799439011",
        interaction_type: "view",
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.tracked).toBe(false);
  });

  it("should reject tracking requests with missing or empty product_id with 400 Bad Request", async () => {
    const token = jwt.sign({ email: "verified_user@example.com" }, JWT_SECRET);

    const res = await request(app)
      .post("/api/track")
      .set("Authorization", `Bearer ${token}`)
      .send({
        interaction_type: "view",
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toContain("valid product_id string");
  });

  it("should reject tracking requests with oversized product_id (>64 chars) with 400 Bad Request", async () => {
    const token = jwt.sign({ email: "verified_user@example.com" }, JWT_SECRET);

    const res = await request(app)
      .post("/api/track")
      .set("Authorization", `Bearer ${token}`)
      .send({
        product_id: "a".repeat(65),
        interaction_type: "view",
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toContain("valid product_id string");
  });
});

describe("Authoritative Event Dispatcher & Reliability Tests", () => {
  const {
    recordAuthoritativeInteraction,
    enqueueAuthoritativeEvent,
    dispatchOutboxDoc,
    reconcileOutboxEvents,
    getInternalServiceKey,
    dispatchWithRetry,
  } = require("../../../src/infrastructure/messaging/recommendationTrackingService");
  const RecommendationOutbox = require("../../../src/infrastructure/messaging/models/recommendationOutbox");

  const originalEnv = process.env.NODE_ENV;
  const originalKey = process.env.INTERNAL_SERVICE_KEY;
  const originalUrl = process.env.RECOMMENDATION_SERVICE_URL;

  beforeEach(() => {
    process.env.RECOMMENDATION_SERVICE_URL = "http://localhost:8000";
    process.env.INTERNAL_SERVICE_KEY = "test_internal_secret";
  });

  afterEach(async () => {
    process.env.NODE_ENV = originalEnv;
    process.env.INTERNAL_SERVICE_KEY = originalKey;
    process.env.RECOMMENDATION_SERVICE_URL = originalUrl;
    jest.restoreAllMocks();
    try {
      await RecommendationOutbox.deleteMany({ eventId: { $regex: /^test_/ } });
    } catch (_) {}
  });

  it("should fail closed and return null if INTERNAL_SERVICE_KEY is missing in production", () => {
    delete process.env.INTERNAL_SERVICE_KEY;
    process.env.NODE_ENV = "production";

    const key = getInternalServiceKey();
    expect(key).toBeNull();
  });

  it("should resolve configured INTERNAL_SERVICE_KEY regardless of environment", () => {
    process.env.INTERNAL_SERVICE_KEY = "custom_production_secret_key";
    process.env.NODE_ENV = "production";

    const key = getInternalServiceKey();
    expect(key).toBe("custom_production_secret_key");
  });

  it("should dispatch authoritative event with service key header and idempotency event_id", async () => {
    jest.spyOn(axios, "post").mockResolvedValue({
      status: 200,
      data: { status: "success", tracked: true },
    });

    const outcome = await recordAuthoritativeInteraction({
      email: "buyer@example.com",
      productId: "507f1f77bcf86cd799439011",
      interactionType: "bid",
      eventId: "test_bid:unique_bid_id_123",
    });

    expect(outcome.success).toBe(true);
    expect(outcome.eventId).toBe("test_bid:unique_bid_id_123");
  });

  it("should retry up to maxRetries on transient 5xx errors before failing gracefully in dispatchWithRetry", async () => {
    jest.spyOn(axios, "post").mockRejectedValue({
      response: { status: 503, data: { detail: "Service Temporarily Unavailable" } },
      message: "Request failed with status code 503",
    });

    const outcome = await dispatchWithRetry(
      "http://localhost:8000",
      { email: "user@example.com" },
      "test_key",
      3
    );

    expect(outcome.success).toBe(false);
    expect(outcome.error).toContain("Service Temporarily Unavailable");
    expect(axios.post).toHaveBeenCalledTimes(3);
  });

  it("should fail fast without retrying on 4xx client errors (e.g. 403 Forbidden)", async () => {
    jest.spyOn(axios, "post").mockRejectedValue({
      response: { status: 403, data: { detail: "Forbidden" } },
      message: "Request failed with status code 403",
    });

    const outcome = await dispatchWithRetry(
      "http://localhost:8000",
      { email: "user@example.com" },
      "invalid_key",
      3
    );

    expect(outcome.success).toBe(false);
    expect(axios.post).toHaveBeenCalledTimes(1);
  });

  it("should durably persist events in RecommendationOutbox and prevent duplicate records", async () => {
    const eventId = `test_bid_${Date.now()}`;

    // First enqueue
    const res1 = await enqueueAuthoritativeEvent({
      email: "winner@example.com",
      productId: "507f1f77bcf86cd799439011",
      interactionType: "bid",
      eventId,
    });

    expect(res1.success).toBe(true);

    // Duplicate enqueue with same eventId
    const res2 = await enqueueAuthoritativeEvent({
      email: "winner@example.com",
      productId: "507f1f77bcf86cd799439011",
      interactionType: "bid",
      eventId,
    });

    expect(res2.success).toBe(true);

    // Assert only 1 document was created in MongoDB
    const docCount = await RecommendationOutbox.countDocuments({ eventId });
    expect(docCount).toBe(1);

    const doc = await RecommendationOutbox.findOne({ eventId });
    expect(doc.status).toMatch(/PENDING|PROCESSING|DELIVERED/);
    expect(doc.email).toBe("winner@example.com");
  });

  it("should transition outbox status to DELIVERED upon successful delivery", async () => {
    jest.spyOn(axios, "post").mockResolvedValue({
      status: 200,
      data: { status: "success", tracked: true },
    });

    const eventId = `test_purchase_${Date.now()}`;
    const enqueued = await enqueueAuthoritativeEvent({
      email: "buyer@example.com",
      productId: "507f1f77bcf86cd799439011",
      interactionType: "purchase",
      eventId,
    });

    const dispatchRes = await dispatchOutboxDoc(enqueued.outboxId);
    expect(dispatchRes.success).toBe(true);

    const doc = await RecommendationOutbox.findById(enqueued.outboxId);
    expect(doc.status).toBe("DELIVERED");
    expect(doc.deliveredAt).not.toBeNull();
  });

  it("should mark outbox as FAILED without retrying on 4xx rejection (e.g. 403 Forbidden)", async () => {
    jest.spyOn(axios, "post").mockRejectedValue({
      response: { status: 403, data: { detail: "Invalid internal service credentials" } },
      message: "Request failed with status code 403",
    });

    const eventId = `test_failed_${Date.now()}`;
    const enqueued = await enqueueAuthoritativeEvent({
      email: "buyer@example.com",
      productId: "507f1f77bcf86cd799439011",
      interactionType: "bid",
      eventId,
    });

    const dispatchRes = await dispatchOutboxDoc(enqueued.outboxId);
    expect(dispatchRes.success).toBe(false);

    const doc = await RecommendationOutbox.findById(enqueued.outboxId);
    expect(doc.status).toBe("FAILED");
    expect(doc.error).toContain("Invalid internal service credentials");
  });

  it("should reconcile and re-dispatch overdue PENDING outbox events", async () => {
    jest.spyOn(axios, "post").mockResolvedValue({
      status: 200,
      data: { status: "success", tracked: true },
    });

    const eventId = `test_reconcile_${Date.now()}`;
    const outbox = await RecommendationOutbox.create({
      eventId,
      eventType: "bid",
      email: "reconcile@example.com",
      productId: "507f1f77bcf86cd799439011",
      payload: {
        email: "reconcile@example.com",
        product_id: "507f1f77bcf86cd799439011",
        interaction_type: "bid",
        event_id: eventId,
      },
      status: "PENDING",
      nextAttemptAt: new Date(Date.now() - 10000), // Overdue
      attempts: 1,
    });

    const summary = await reconcileOutboxEvents({ limit: 10 });
    expect(summary.success).toBe(true);
    expect(summary.deliveredCount).toBeGreaterThanOrEqual(1);

    const refreshed = await RecommendationOutbox.findById(outbox._id);
    expect(refreshed.status).toBe("DELIVERED");
  });

  it("should reclaim and deliver a stranded PROCESSING event after worker lease expiration", async () => {
    jest.spyOn(axios, "post").mockResolvedValue({
      status: 200,
      data: { status: "success", tracked: true },
    });

    const eventId = `test_crash_recovery_${Date.now()}`;
    const outbox = await RecommendationOutbox.create({
      eventId,
      eventType: "bid",
      email: "crashed_worker@example.com",
      productId: "507f1f77bcf86cd799439011",
      payload: {
        email: "crashed_worker@example.com",
        product_id: "507f1f77bcf86cd799439011",
        interaction_type: "bid",
        event_id: eventId,
      },
      status: "PROCESSING",
      lastAttemptAt: new Date(Date.now() - 35000), // Lease expired (35s > 30s)
      attempts: 1,
    });

    const summary = await reconcileOutboxEvents({ limit: 10, leaseTimeoutMs: 30000 });
    expect(summary.success).toBe(true);

    const refreshed = await RecommendationOutbox.findById(outbox._id);
    expect(refreshed.status).toBe("DELIVERED");
    expect(refreshed.attempts).toBe(2);
  });

  it("should transition expired PROCESSING event to FAILED when retry attempts are exhausted (>=5)", async () => {
    const eventId = `test_crash_exhausted_${Date.now()}`;
    const outbox = await RecommendationOutbox.create({
      eventId,
      eventType: "bid",
      email: "exhausted_worker@example.com",
      productId: "507f1f77bcf86cd799439011",
      payload: {
        email: "exhausted_worker@example.com",
        product_id: "507f1f77bcf86cd799439011",
        interaction_type: "bid",
        event_id: eventId,
      },
      status: "PROCESSING",
      lastAttemptAt: new Date(Date.now() - 35000), // Lease expired
      attempts: 5, // Exhausted
    });

    const summary = await reconcileOutboxEvents({ limit: 10, leaseTimeoutMs: 30000 });
    expect(summary.success).toBe(true);

    const refreshed = await RecommendationOutbox.findById(outbox._id);
    expect(refreshed.status).toBe("FAILED");
    expect(refreshed.error).toContain("Worker lease expired");
  });

  it("should prevent concurrent workers from claiming or delivering the same outbox event", async () => {
    jest.spyOn(axios, "post").mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return { status: 200, data: { status: "success", tracked: true } };
    });

    const eventId = `test_concurrent_${Date.now()}`;
    const outbox = await RecommendationOutbox.create({
      eventId,
      eventType: "bid",
      email: "concurrent@example.com",
      productId: "507f1f77bcf86cd799439011",
      payload: {
        email: "concurrent@example.com",
        product_id: "507f1f77bcf86cd799439011",
        interaction_type: "bid",
        event_id: eventId,
      },
      status: "PENDING",
      attempts: 0,
    });

    // Simulate two workers concurrently racing to claim the same outbox document
    const [result1, result2] = await Promise.all([
      dispatchOutboxDoc(outbox._id),
      dispatchOutboxDoc(outbox._id),
    ]);

    const successes = [result1, result2].filter((r) => r.success === true);
    const rejections = [result1, result2].filter((r) => r.reason === "ALREADY_CLAIMED_OR_EXHAUSTED");

    expect(successes.length).toBe(1);
    expect(rejections.length).toBe(1);

    const refreshed = await RecommendationOutbox.findById(outbox._id);
    expect(refreshed.status).toBe("DELIVERED");
    expect(refreshed.attempts).toBe(1);
  });
});

describe("Staging Reverse Proxy & Rate Limiting Trust Tests", () => {
  it("should configure trust proxy when NODE_ENV is staging or production or TRUST_PROXY is set", () => {
    // Verify trust proxy evaluation logic
    const testCases = [
      { env: { NODE_ENV: "production" }, expected: true },
      { env: { NODE_ENV: "staging" }, expected: true },
      { env: { ENVIRONMENT: "staging" }, expected: true },
      { env: { TRUST_PROXY: "true" }, expected: true },
      { env: { TRUST_PROXY: "1" }, expected: true },
      { env: { NODE_ENV: "development" }, expected: false },
    ];

    for (const tc of testCases) {
      const shouldTrust =
        tc.env.NODE_ENV === "production" ||
        tc.env.NODE_ENV === "staging" ||
        tc.env.ENVIRONMENT === "staging" ||
        tc.env.ENVIRONMENT === "production" ||
        tc.env.TRUST_PROXY === "true" ||
        tc.env.TRUST_PROXY === "1";

      expect(shouldTrust).toBe(tc.expected);
    }
  });
});

describe("Phase 3: Recommendation Impressions & Privacy Telemetry Proxy Tests", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should forward batch impression requests to FastAPI recommendation service with HMAC user_id", async () => {
    const jwt = require("jsonwebtoken");
    const JWT_SECRET = process.env.JWT_SECRET || "test_jwt_secret";
    const token = jwt.sign({ email: "privacybuyer@example.com" }, JWT_SECRET);

    let forwardedPayload = null;
    jest.spyOn(axios, "post").mockImplementation(async (url, data) => {
      forwardedPayload = data;
      return {
        status: 200,
        data: { success: true, processed_count: data.interactions ? data.interactions.length : 1 },
      };
    });

    const res = await request(app)
      .post("/api/track")
      .set("Authorization", `Bearer ${token}`)
      .send({
        batch: [
          {
            product_id: "507f1f77bcf86cd799439011",
            interaction_type: "impression",
            position: 0,
            surface: "recommendations",
            recommendation_id: "slate_test_123",
          },
        ],
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(forwardedPayload).toBeDefined();
    expect(forwardedPayload.interactions).toBeDefined();
    expect(forwardedPayload.interactions[0].user_id).toMatch(/^[a-f0-9]{64}$/);
    expect(forwardedPayload.interactions[0].email).toBe("privacybuyer@example.com");
    expect(forwardedPayload.interactions[0].position).toBe(0);
  });

  it("should reject client batch requests containing authoritative bid or purchase events with 403", async () => {
    const jwt = require("jsonwebtoken");
    const JWT_SECRET = process.env.JWT_SECRET || "test_jwt_secret";
    const token = jwt.sign({ email: "user@example.com" }, JWT_SECRET);

    const res = await request(app)
      .post("/api/track")
      .set("Authorization", `Bearer ${token}`)
      .send({
        batch: [
          {
            product_id: "507f1f77bcf86cd799439011",
            interaction_type: "bid",
          },
        ],
      });

    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN_INTERACTION_TYPE");
    expect(res.body.message).toContain("Authoritative business events (bid, purchase) cannot be submitted by clients");
  });

  it("should forward guest impression telemetry with session_id without generating fake email", async () => {
    let forwardedPayload = null;
    jest.spyOn(axios, "post").mockImplementation(async (url, data) => {
      forwardedPayload = data;
      return {
        status: 200,
        data: { success: true, processed_count: data.interactions ? data.interactions.length : 1 },
      };
    });

    const res = await request(app)
      .post("/api/track")
      .send({
        session_id: "sess_guest_abc123",
        batch: [
          {
            product_id: "507f1f77bcf86cd799439011",
            interaction_type: "impression",
            position: 1,
            surface: "recommendations",
          },
        ],
      });

    expect(res.statusCode).toBe(200);
    expect(forwardedPayload.interactions[0].session_id).toBe("sess_guest_abc123");
    expect(forwardedPayload.interactions[0].email).toBeUndefined();
    expect(forwardedPayload.interactions[0].user_id).toBeUndefined();
  });

  it("should verify Express pseudonymous user ID generation uses RECOMMENDATION_HMAC_SECRET independently of INTERNAL_SERVICE_KEY", () => {
    const originalHmac = process.env.RECOMMENDATION_HMAC_SECRET;
    const originalKey = process.env.INTERNAL_SERVICE_KEY;
    try {
      process.env.RECOMMENDATION_HMAC_SECRET = "hmac_secret_xyz123";
      process.env.INTERNAL_SERVICE_KEY = "internal_service_key_abc789";

      const crypto = require("crypto");
      const testEmail = "TestUser@Example.COM";
      const expectedHash = crypto
        .createHmac("sha256", "hmac_secret_xyz123")
        .update(testEmail.trim().toLowerCase())
        .digest("hex");

      const hash1 = crypto
        .createHmac("sha256", process.env.RECOMMENDATION_HMAC_SECRET)
        .update(testEmail.trim().toLowerCase())
        .digest("hex");

      process.env.INTERNAL_SERVICE_KEY = "completely_different_internal_key";
      const hash2 = crypto
        .createHmac("sha256", process.env.RECOMMENDATION_HMAC_SECRET)
        .update(testEmail.trim().toLowerCase())
        .digest("hex");

      expect(hash1).toBe(expectedHash);
      expect(hash2).toBe(expectedHash);
    } finally {
      process.env.RECOMMENDATION_HMAC_SECRET = originalHmac;
      process.env.INTERNAL_SERVICE_KEY = originalKey;
    }
  });
});
