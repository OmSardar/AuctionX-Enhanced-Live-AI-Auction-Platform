/**
 * Smoke Tests — Critical Application Health Probes
 *
 * These tests verify that all critical subsystems are reachable and operational.
 * They are intentionally lightweight and fast.
 */
const request = require("supertest");
const mongoose = require("mongoose");
const { app, server, io } = require("../../server");
const { createSocketClient } = require("../helpers/socketHelper");

describe("Smoke Tests — Application Health", () => {
  let testServer;

  beforeAll((done) => {
    testServer = server.listen(0, done);
  });

  afterAll((done) => {
    testServer.close(done);
  });

  // 1. Server alive
  it("GET / — server is running", async () => {
    const res = await request(app).get("/");
    expect(res.statusCode).toBe(200);
    expect(res.text).toContain("Server is running");
  });

  // 2. MongoDB connectivity
  it("MongoDB — connection is active", () => {
    expect(mongoose.connection.readyState).toBe(1); // 1 = connected
  });

  // 3. CSRF infrastructure
  it("GET /api/csrf-token — CSRF token endpoint is reachable", async () => {
    const res = await request(app).get("/api/csrf-token");
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("csrfToken");
  });

  // 4. Products API reachable
  it("GET /api/products — products endpoint returns valid JSON", async () => {
    const res = await request(app).get("/api/products");
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("success", true);
  });

  // 5. Auth pipeline functional
  it("POST /api/auth/login — auth endpoint is reachable (rejects bad creds)", async () => {
    const csrf = require("../helpers/csrfHelper").createCsrfCredentials();
    const res = await request(app)
      .post("/api/auth/login")
      .set("Cookie", [csrf.cookie])
      .set(csrf.headerName, csrf.headerValue)
      .send({ email: "nonexistent@test.com", password: "badpassword" });

    // Should return 400, 401, or 404, not 500 — proves auth pipeline works
    expect([400, 401, 404]).toContain(res.statusCode);
  });

  // 6. Recommendation proxy (handles reachable or unreachable service gracefully)
  it("GET /api/recommendations/:email — proxy is functional and does not crash", async () => {
    const res = await request(app).get("/api/recommendations/test@example.com");
    // If FastAPI is running returns 200; if offline returns 500. Either way, doesn't crash
    expect([200, 400, 404, 500, 502, 503, 504]).toContain(res.statusCode);
  });

  // 7. Banners API reachable
  it("GET /api/banners — banners endpoint is available", async () => {
    const res = await request(app).get("/api/banners");
    expect(res.statusCode).toBe(200);
  });

  // 8. Socket.IO handshake
  it("Socket.IO — can establish WebSocket connection", (done) => {
    const client = createSocketClient(testServer);

    client.on("connect", () => {
      expect(client.connected).toBe(true);
      client.disconnect();
      done();
    });

    client.on("connect_error", (err) => {
      client.disconnect();
      done.fail(`Socket.IO connection failed: ${err.message}`);
    });
  });
});
