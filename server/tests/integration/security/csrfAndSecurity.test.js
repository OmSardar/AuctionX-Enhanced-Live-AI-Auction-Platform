const request = require("supertest");
const { app } = require("../../../server");
const { createCsrfCredentials } = require("../../helpers/csrfHelper");

describe("Security & CSRF Integration Tests", () => {
  describe("CSRF Protection Middleware", () => {
    it("should issue a new CSRF token via GET /api/csrf-token", async () => {
      const res = await request(app).get("/api/csrf-token");

      expect(res.statusCode).toBe(200);
      expect(res.body.csrfToken).toBeDefined();

      const cookies = res.headers["set-cookie"];
      expect(cookies).toBeDefined();
      expect(cookies.some((c) => c.startsWith("_csrf="))).toBe(true);
      expect(cookies.some((c) => c.startsWith("XSRF-TOKEN="))).toBe(true);
    });

    it("should reject POST request when CSRF token is missing", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "test@example.com", password: "password" });

      expect(res.statusCode).toBe(403);
      expect(res.body.message).toMatch(/CSRF token missing/i);
    });

    it("should reject POST request when CSRF cookie and header do not match", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .set("Cookie", ["_csrf=valid-cookie-token"])
        .set("x-csrf-token", "tampered-header-token")
        .send({ email: "test@example.com", password: "password" });

      expect(res.statusCode).toBe(403);
      expect(res.body.message).toMatch(/Invalid CSRF token/i);
    });

    it("should pass CSRF validation when cookie and header match", async () => {
      const csrf = createCsrfCredentials();

      const res = await request(app)
        .post("/api/auth/login")
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({ email: "test@example.com", password: "password" });

      // Passes CSRF (reaches auth validation which yields 401 instead of 403 CSRF rejection)
      expect(res.statusCode).not.toBe(403);
    });
  });

  describe("Security Headers (Helmet)", () => {
    it("should include standard security headers in HTTP responses", async () => {
      const res = await request(app).get("/");

      expect(res.statusCode).toBe(200);
      expect(res.headers["x-content-type-options"]).toBe("nosniff");
      expect(res.headers["x-dns-prefetch-control"]).toBe("off");
    });
  });

  describe("NoSQL Injection Sanitization", () => {
    it("should sanitize query/body keys with dollar signs", async () => {
      const csrf = createCsrfCredentials();

      const res = await request(app)
        .post("/api/auth/login")
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          email: { $gt: "" }, // NoSQL injection attempt
          password: "password",
        });

      // Sanitized object will not match query as raw $gt injection and will be rejected
      expect([400, 401, 500]).toContain(res.statusCode);
      expect(res.body.success).not.toBe(true);
    });
  });
});
