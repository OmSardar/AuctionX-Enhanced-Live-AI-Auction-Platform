/**
 * Stage 1 Verification Suite:
 * - Security, Input Validation, and Webhook Infrastructure Preparation
 */

const request = require("supertest");
const { app } = require("../../server");
const { createCsrfCredentials } = require("../helpers/csrfHelper");
const { redactObject } = require("../../src/infrastructure/logging/loggerMiddleware");
const { validateEnv } = require("../../src/config/environment/validateEnvironment");
const { isCsrfExempt } = require("../../src/infrastructure/security/csrfMiddleware");

describe("Stage 1 — Security, Input Validation & Webhook Infrastructure", () => {
  describe("A. Webhook Raw-Body Capture & CSRF Exemption", () => {
    it("POST /api/payment/webhook bypasses CSRF without X-CSRF-Token", async () => {
      const payload = JSON.stringify({
        event: "payment.captured",
        payload: { payment: { entity: { id: "pay_test123", amount: 50000 } } },
      });

      const res = await request(app)
        .post("/api/payment/webhook")
        .set("Content-Type", "application/json")
        .send(payload);

      // Must NOT be rejected with 403 CSRF token missing
      expect(res.statusCode).not.toBe(403);
      // Stage 1 stub returns 501 with rawBytesReceived confirming infrastructure readiness
      expect(res.statusCode).toBe(501);
      expect(res.body).toHaveProperty("success", false);
      expect(res.body).toHaveProperty("code", "WEBHOOK_STAGE_4_PREREQUISITE");
      expect(res.body).toHaveProperty("rawBytesReceived", Buffer.byteLength(payload));
    });

    it("POST /api/webhooks/razorpay (alias) also bypasses CSRF and captures raw bytes", async () => {
      const payload = JSON.stringify({ event: "order.paid" });

      const res = await request(app)
        .post("/api/webhooks/razorpay")
        .set("Content-Type", "application/json")
        .send(payload);

      expect(res.statusCode).not.toBe(403);
      expect(res.statusCode).toBe(501);
      expect(res.body).toHaveProperty("rawBytesReceived", Buffer.byteLength(payload));
    });

    it("isCsrfExempt helper accurately identifies only webhook routes", () => {
      expect(isCsrfExempt({ originalUrl: "/api/payment/webhook" })).toBe(true);
      expect(isCsrfExempt({ originalUrl: "/api/payment/webhook?secret=1" })).toBe(true);
      expect(isCsrfExempt({ originalUrl: "/api/webhooks/razorpay" })).toBe(true);
      expect(isCsrfExempt({ originalUrl: "/api/products" })).toBe(false);
      expect(isCsrfExempt({ originalUrl: "/api/auth/login" })).toBe(false);
      expect(isCsrfExempt({ originalUrl: "/api/orders" })).toBe(false);
    });
  });

  describe("B. CSRF Protection Invariants on Standard Routes", () => {
    it("POST to standard route is rejected with HTTP 403 when CSRF token is missing", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "test@example.com", password: "somepassword" });

      expect(res.statusCode).toBe(403);
      expect(res.body).toHaveProperty("message", "CSRF token missing");
    });

    it("POST to standard route proceeds when valid CSRF credentials are provided", async () => {
      const csrf = createCsrfCredentials();
      const res = await request(app)
        .post("/api/auth/login")
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({ email: "invalid-user@test.com", password: "badpassword" });

      // Proceeds past CSRF check to auth logic (returns 400 or 401, not 403)
      expect([400, 401, 404]).toContain(res.statusCode);
      expect(res.statusCode).not.toBe(403);
    });
  });

  describe("C. Input Validation & Parameter Boundaries", () => {
    it("GET /api/products/:id rejects malformed ObjectId with HTTP 400 instead of 500", async () => {
      const res = await request(app).get("/api/products/not-a-valid-id-123");

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty("success", false);
      expect(res.body).toHaveProperty("code", "INVALID_IDENTIFIER");
      expect(res.body.message).toContain("Invalid identifier format");
    });

    it("GET /api/orders/:id rejects malformed ObjectId with HTTP 400 instead of 500", async () => {
      const csrf = createCsrfCredentials();
      const res = await request(app)
        .get("/api/orders/malformed-id-xyz")
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue);

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty("code", "INVALID_IDENTIFIER");
    });

    it("PATCH /api/products/tempdata/:id rejects negative tempamount with HTTP 400", async () => {
      const csrf = createCsrfCredentials();
      const validObjectId = "507f1f77bcf86cd799439011";

      const res = await request(app)
        .patch(`/api/products/tempdata/${validObjectId}`)
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({ tempamount: -100 });

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty("code", "INVALID_NUMERIC_VALUE");
    });

    it("Normal JSON parsing works for valid requests", async () => {
      const res = await request(app).get("/api/products");
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("success", true);
    });
  });

  describe("D. Error Handling & Payload Robustness", () => {
    it("Malformed JSON body returns HTTP 400 with MALFORMED_JSON code instead of crashing", async () => {
      const csrf = createCsrfCredentials();

      const res = await request(app)
        .post("/api/auth/login")
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .set("Content-Type", "application/json")
        .send('{"badJson": '); // Broken JSON

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty("success", false);
      expect(res.body).toHaveProperty("code", "MALFORMED_JSON");
      expect(res.body.message).toContain("Malformed JSON payload");
    });

    it("Error response does not leak stack traces or internal paths", async () => {
      const res = await request(app).get("/api/products/invalid-id");

      expect(res.body).not.toHaveProperty("stack");
      expect(JSON.stringify(res.body)).not.toContain("node_modules");
      expect(JSON.stringify(res.body)).not.toContain("server.js");
    });
  });

  describe("E. Sensitive Data Redaction in Logging", () => {
    it("redactObject scrubs sensitive keys and protects secrets", () => {
      const sampleLog = {
        email: "user@example.com",
        password: "super_secret_password",
        token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        apiKey: "pk_test_12345",
        nested: {
          key_secret: "razorpay_secret_999",
          normalField: "public_value",
        },
      };

      const redacted = redactObject(sampleLog);

      expect(redacted.password).toBe("[REDACTED]");
      expect(redacted.token).toBe("[REDACTED]");
      expect(redacted.apiKey).toBe("[REDACTED]");
      expect(redacted.nested.key_secret).toBe("[REDACTED]");
      expect(redacted.email).toBe("user@example.com");
      expect(redacted.nested.normalField).toBe("public_value");
    });
  });

  describe("F. Configuration Validation", () => {
    it("validateEnv verifies current configuration safely without printing values", () => {
      const result = validateEnv({ strict: false });

      expect(result).toHaveProperty("isValid");
      expect(result).toHaveProperty("missing");
      expect(result).toHaveProperty("warnings");
      expect(Array.isArray(result.warnings)).toBe(true);

      // Asserts that no sensitive value is present in the output
      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain(process.env.JWT_SECRET || "undefined");
    });
  });
});
