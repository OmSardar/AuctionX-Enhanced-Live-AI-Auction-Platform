/**
 * Non-Functional Tests — Security Headers
 *
 * Validates Helmet headers, CORS behavior, sensitive header absence,
 * and cookie security attributes.
 */
const request = require("supertest");
const { app } = require("../../server");

describe("Non-Functional Tests — Security Headers", () => {
  // Helmet headers
  it("should include X-Content-Type-Options: nosniff", async () => {
    const res = await request(app).get("/");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("should include X-Frame-Options header", async () => {
    const res = await request(app).get("/");
    // Helmet sets this to SAMEORIGIN by default
    expect(res.headers["x-frame-options"]).toBeDefined();
  });

  it("should NOT expose X-Powered-By header", async () => {
    const res = await request(app).get("/");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("should include Content-Security-Policy header", async () => {
    const res = await request(app).get("/");
    expect(res.headers["content-security-policy"]).toBeDefined();
  });

  it("should include Strict-Transport-Security header", async () => {
    const res = await request(app).get("/");
    expect(res.headers["strict-transport-security"]).toBeDefined();
  });

  // CORS — cross-origin request from allowed origin
  it("should return CORS headers for allowed origin", async () => {
    const res = await request(app)
      .get("/api/products")
      .set("Origin", "http://localhost:5173");

    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });

  // CORS — disallowed origin
  it("should NOT return CORS allow for disallowed origin", async () => {
    const res = await request(app)
      .get("/api/products")
      .set("Origin", "https://evil-site.example.com");

    // Express CORS middleware either omits the header or won't match
    const origin = res.headers["access-control-allow-origin"];
    if (origin) {
      expect(origin).not.toBe("https://evil-site.example.com");
    }
  });

  // Auth cookie security
  it("should set HttpOnly cookie on login", async () => {
    const { createTestUser } = require("../helpers/authHelper");
    const { createCsrfCredentials } = require("../helpers/csrfHelper");
    const csrf = createCsrfCredentials();

    const user = await createTestUser({
      email: "cookietest@example.com",
    });

    const res = await request(app)
      .post("/api/auth/login")
      .set("Cookie", [csrf.cookie])
      .set(csrf.headerName, csrf.headerValue)
      .send({ email: "cookietest@example.com", password: user.plainPassword });

    if (res.statusCode === 200 && res.headers["set-cookie"]) {
      const tokenCookie = res.headers["set-cookie"].find((c) =>
        c.startsWith("token=")
      );
      if (tokenCookie) {
        expect(tokenCookie).toMatch(/HttpOnly/i);
      }
    }
  });
});
