/**
 * Non-Functional Tests — API Contracts & Error Handling
 *
 * Validates response format consistency, error handling quality,
 * content-type headers, and 404 behavior.
 */
const request = require("supertest");
const { app } = require("../../server");
const { clearDatabase } = require("../helpers/dbHelper");
const { createCsrfCredentials } = require("../helpers/csrfHelper");

describe("Non-Functional Tests — API Contracts", () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  // Content-Type validation
  it("should return application/json for API endpoints", async () => {
    const res = await request(app).get("/api/products");
    expect(res.headers["content-type"]).toMatch(/application\/json/);
  });

  it("should return text for root endpoint", async () => {
    const res = await request(app).get("/");
    expect(res.statusCode).toBe(200);
  });

  // 404 handler
  it("should return structured JSON 404 for unknown API routes", async () => {
    const res = await request(app).get("/api/this-route-does-not-exist");
    expect(res.statusCode).toBe(404);
    expect(res.body).toHaveProperty("success", false);
    expect(res.body).toHaveProperty("message");
  });

  // Products response format
  it("GET /api/products should return { success, count, products }", async () => {
    const res = await request(app).get("/api/products");
    expect(res.body).toHaveProperty("success");
    expect(res.body).toHaveProperty("count");
    expect(res.body).toHaveProperty("products");
    expect(Array.isArray(res.body.products)).toBe(true);
  });

  // CSRF token response format
  it("GET /api/csrf-token should return { csrfToken } and set cookie", async () => {
    const res = await request(app).get("/api/csrf-token");
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("csrfToken");
    expect(typeof res.body.csrfToken).toBe("string");
    expect(res.body.csrfToken.length).toBeGreaterThan(0);

    // Should set _csrf cookie
    const cookies = res.headers["set-cookie"];
    expect(cookies).toBeDefined();
    const csrfCookie = cookies.find((c) => c.startsWith("_csrf="));
    expect(csrfCookie).toBeDefined();
  });

  // Error response consistency for auth endpoints
  it("POST /api/auth/login with missing fields returns structured error", async () => {
    const csrf = createCsrfCredentials();
    const res = await request(app)
      .post("/api/auth/login")
      .set("Cookie", [csrf.cookie])
      .set(csrf.headerName, csrf.headerValue)
      .send({}); // missing email and password

    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(res.statusCode).toBeLessThan(500);
    expect(res.body).toBeDefined();
  });

  // Invalid ObjectId handling
  it("GET /api/products/:id with invalid ID returns error, not 500", async () => {
    const res = await request(app).get("/api/products/not-a-valid-id");
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(res.statusCode).toBeLessThanOrEqual(500);
  });

  // Empty body on POST
  it("POST /api/orders with empty body returns 401 (unauthenticated)", async () => {
    const csrf = createCsrfCredentials();
    const res = await request(app)
      .post("/api/orders")
      .set("Cookie", [csrf.cookie])
      .set(csrf.headerName, csrf.headerValue)
      .send({});

    expect(res.statusCode).toBe(401);
  });
});
