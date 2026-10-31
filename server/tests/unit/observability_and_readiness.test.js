const request = require("supertest");
const mongoose = require("mongoose");
const { app } = require("../../server");
const { redactObject, SENSITIVE_KEYS } = require("../../src/infrastructure/logging/loggerMiddleware");
const { normalizeRoute } = require("../../src/infrastructure/observability/metricsRoutes");

describe("SDLC & Observability — Health, Readiness, Metrics & Tracing", () => {
  describe("1. Request Correlation ID & Tracing Headers", () => {
    it("generates and returns X-Request-ID and X-Correlation-ID when not supplied", async () => {
      const res = await request(app).get("/health");

      expect(res.statusCode).toBe(200);
      expect(res.headers["x-request-id"]).toBeDefined();
      expect(res.headers["x-correlation-id"]).toBeDefined();
      expect(res.headers["x-request-id"]).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
      expect(res.headers["x-correlation-id"]).toBe(res.headers["x-request-id"]);
    });

    it("honors and preserves valid incoming X-Request-ID", async () => {
      const clientTraceId = "trace-client-abc-12345678";
      const res = await request(app)
        .get("/health")
        .set("X-Request-ID", clientTraceId);

      expect(res.statusCode).toBe(200);
      expect(res.headers["x-request-id"]).toBe(clientTraceId);
      expect(res.headers["x-correlation-id"]).toBe(clientTraceId);
    });

    it("sanitizes and replaces invalid or malicious incoming X-Request-ID with a secure UUID", async () => {
      const invalidId = "invalid trace ID with spaces & symbols !@#";
      const res = await request(app)
        .get("/health")
        .set("X-Request-ID", invalidId);

      expect(res.statusCode).toBe(200);
      expect(res.headers["x-request-id"]).not.toBe(invalidId);
      expect(res.headers["x-request-id"]).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it("preserves correlation context across 404 client error flows", async () => {
      const traceId = "test-404-trace-id-12345";
      const res = await request(app)
        .get("/api/nonexistent-route-for-testing")
        .set("X-Request-ID", traceId);

      expect(res.statusCode).toBe(404);
      expect(res.headers["x-request-id"]).toBe(traceId);
      expect(res.headers["x-correlation-id"]).toBe(traceId);
    });
  });

  describe("2. Liveness & Readiness Probes (/health, /ready)", () => {
    it("GET /health returns HTTP 200 with service metadata", async () => {
      const res = await request(app).get("/health");

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("status", "ok");
      expect(res.body).toHaveProperty("service", "auctionx-server");
      expect(typeof res.body.uptime).toBe("number");
      expect(res.body).toHaveProperty("timestamp");
    });

    it("GET /api/health alias returns identical liveness payload", async () => {
      const res = await request(app).get("/api/health");

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("status", "ok");
      expect(res.body).toHaveProperty("service", "auctionx-server");
    });

    it("GET /ready returns HTTP 200 with ping and memory indicators when DB is connected", async () => {
      const res = await request(app).get("/ready");

      if (mongoose.connection.readyState === 1) {
        expect(res.statusCode).toBe(200);
        expect(res.body.status).toBe("ready");
        expect(res.body.database.status).toBe("connected");
        expect(typeof res.body.database.pingMs).toBe("number");
        expect(res.body.memory).toHaveProperty("heapUsedMb");
        expect(res.body.memory).toHaveProperty("rssMb");
      } else {
        expect(res.statusCode).toBe(503);
        expect(res.body.status).toBe("degraded");
      }
    });

    it("Readiness probe does not leak secrets or credentials", async () => {
      const res = await request(app).get("/ready");
      const bodyStr = JSON.stringify(res.body);

      expect(bodyStr).not.toContain("mongodb://");
      expect(bodyStr).not.toContain("mongodb+srv://");
      expect(bodyStr).not.toContain("password");
      expect(bodyStr).not.toContain("secret");
    });
  });

  describe("3. Prometheus Metrics Telemetry (/metrics)", () => {
    it("GET /metrics returns standard Prometheus text format", async () => {
      // Warm up requests
      await request(app).get("/health");

      const res = await request(app).get("/metrics");

      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toContain("text/plain");
      expect(res.text).toContain("process_uptime_seconds");
      expect(res.text).toContain("nodejs_memory_heap_used_bytes");
      expect(res.text).toContain("http_requests_total");
      expect(res.text).toContain("auctionx_active_socket_connections");
      expect(res.text).toContain("http_requests_in_flight");
    });

    it("distinguishes health probe traffic from application traffic in Prometheus labels", async () => {
      await request(app).get("/health");

      const res = await request(app).get("/metrics");

      expect(res.text).toContain('is_probe="true"');
    });

    it("GET /metrics?format=json returns structured operational metrics", async () => {
      const res = await request(app).get("/metrics?format=json");

      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toContain("application/json");
      expect(res.body).toHaveProperty("uptime_seconds");
      expect(res.body).toHaveProperty("memory");
      expect(res.body).toHaveProperty("requests_total");
      expect(res.body).toHaveProperty("requests_in_flight");
      expect(res.body).toHaveProperty("activeSockets");
    });

    it("normalizeRoute masks emails, UUIDs, and MongoDB ObjectIds to prevent cardinality explosion", () => {
      expect(normalizeRoute("/api/recommendations/alice.smith@example.com")).toBe("/api/recommendations/:email");
      expect(normalizeRoute("/api/products/64b5f9024b1234567890abcd")).toBe("/api/products/:id");
      expect(normalizeRoute("/api/payment/pay_ABC1234567890xyz")).toBe("/api/payment/:paymentId");
      expect(normalizeRoute("/api/orders/order_ABC1234567890xyz")).toBe("/api/orders/:orderId");
      expect(normalizeRoute("/api/users/123e4567-e89b-12d3-a456-426614174000")).toBe("/api/users/:uuid");
      expect(normalizeRoute("/api/products?category=art&sort=desc")).toBe("/api/products");
    });

    it("enforces authentication when METRICS_AUTH_TOKEN is configured", async () => {
      const originalToken = process.env.METRICS_AUTH_TOKEN;
      process.env.METRICS_AUTH_TOKEN = "test_metrics_scrape_secret_key_123";

      try {
        // Request without token should be rejected with 401
        const unauthRes = await request(app).get("/metrics");
        expect(unauthRes.statusCode).toBe(401);
        expect(unauthRes.body.error).toContain("Unauthorized");

        // Request with invalid token should be rejected with 401
        const badTokenRes = await request(app)
          .get("/metrics")
          .set("Authorization", "Bearer wrong_token");
        expect(badTokenRes.statusCode).toBe(401);

        // Request with malformed query token should be rejected with 401
        const badQueryRes = await request(app).get("/metrics?token=wrong_query_token");
        expect(badQueryRes.statusCode).toBe(401);

        // Request with valid Bearer token should succeed with 200
        const authRes = await request(app)
          .get("/metrics")
          .set("Authorization", "Bearer test_metrics_scrape_secret_key_123");
        expect(authRes.statusCode).toBe(200);

        // Request with valid query parameter token should succeed with 200
        const queryRes = await request(app).get("/metrics?token=test_metrics_scrape_secret_key_123");
        expect(queryRes.statusCode).toBe(200);

        // Alternate path /api/metrics should enforce same authentication
        const apiRes = await request(app)
          .get("/api/metrics")
          .set("Authorization", "Bearer test_metrics_scrape_secret_key_123");
        expect(apiRes.statusCode).toBe(200);
      } finally {
        process.env.METRICS_AUTH_TOKEN = originalToken || "";
      }
    });

    it("fails closed with 401 in production when METRICS_AUTH_TOKEN is missing or empty", async () => {
      const originalEnv = process.env.NODE_ENV;
      const originalToken = process.env.METRICS_AUTH_TOKEN;

      try {
        process.env.NODE_ENV = "production";
        delete process.env.METRICS_AUTH_TOKEN;

        // Any unauthenticated request in production must fail closed
        const res = await request(app).get("/metrics");
        expect(res.statusCode).toBe(401);
        expect(res.body.error).toContain("Metrics authentication required in production");

        // Supplying a random token when none is configured must still fail closed
        const badRes = await request(app)
          .get("/metrics")
          .set("Authorization", "Bearer random_token");
        expect(badRes.statusCode).toBe(401);

        // Alternate route /api/metrics must also fail closed
        const apiRes = await request(app).get("/api/metrics");
        expect(apiRes.statusCode).toBe(401);
      } finally {
        process.env.NODE_ENV = originalEnv;
        if (originalToken !== undefined) {
          process.env.METRICS_AUTH_TOKEN = originalToken;
        } else {
          delete process.env.METRICS_AUTH_TOKEN;
        }
      }
    });

    it("rejects non-GET/HEAD methods on /metrics with 405 Method Not Allowed", async () => {
      const res = await request(app).post("/metrics").send({ fake: "data" });
      expect(res.statusCode).toBe(405);
      expect(res.body.error).toContain("Method Not Allowed");
      expect(res.headers.allow).toContain("GET, HEAD");
    });
  });

  describe("4. Security Logging & Redaction Verification", () => {
    it("scrubs session, cookie, token, and secret fields", () => {
      const sensitivePayload = {
        email: "test@example.com",
        cookie: "connect.sid=s%3A12345",
        "set-cookie": ["session=xyz"],
        session: "session_secret_123",
        jwt: "eyJhbGciOiJI...",
        accessToken: "at_abc123",
        refreshToken: "rt_xyz789",
        safeData: "public_content",
      };

      const sanitized = redactObject(sensitivePayload);

      expect(sanitized.cookie).toBe("[REDACTED]");
      expect(sanitized["set-cookie"]).toBe("[REDACTED]");
      expect(sanitized.session).toBe("[REDACTED]");
      expect(sanitized.jwt).toBe("[REDACTED]");
      expect(sanitized.accessToken).toBe("[REDACTED]");
      expect(sanitized.refreshToken).toBe("[REDACTED]");
      expect(sanitized.email).toBe("test@example.com");
      expect(sanitized.safeData).toBe("public_content");
    });
  });

  describe("5. End-to-End Controlled Failure Detection", () => {
    it("demonstrates controlled failure is logged, correlated, measurable, and detectable", async () => {
      const testTraceId = "ctrl-failure-test-trace-99999";

      // 1. Trigger controlled 404 error
      const errRes = await request(app)
        .get("/api/controlled-test-failure-endpoint")
        .set("X-Request-ID", testTraceId);

      // A. Correlated: Request ID and Correlation ID attached to error response
      expect(errRes.statusCode).toBe(404);
      expect(errRes.headers["x-request-id"]).toBe(testTraceId);
      expect(errRes.headers["x-correlation-id"]).toBe(testTraceId);

      // B. Measurable & Detectable: Prometheus counter increments under 404 status
      const metricsRes = await request(app).get("/metrics");
      expect(metricsRes.statusCode).toBe(200);
      expect(metricsRes.text).toContain('http_requests_total{method="GET",status="404",route="/api/controlled-test-failure-endpoint",is_probe="false"}');

      // C. Measurable: JSON metrics endpoint reflects request count
      const jsonMetricsRes = await request(app).get("/metrics?format=json");
      expect(jsonMetricsRes.statusCode).toBe(200);
      expect(jsonMetricsRes.body.requests_total).toBeGreaterThan(0);
    });
  });
});
