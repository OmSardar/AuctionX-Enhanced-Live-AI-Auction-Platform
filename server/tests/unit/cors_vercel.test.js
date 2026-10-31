const request = require("supertest");
const { app } = require("../../server");
const { isOriginAllowed, KNOWN_ALLOWED_ORIGINS } = require("../../src/bootstrap/application/createApplication");

describe("Vercel & Multi-Origin CORS Integration Tests", () => {
  const VERCEL_PROD = "https://auction-x-enhanced-live-ai-auction.vercel.app";
  const VERCEL_PREVIEW = "https://auction-x-enhanced-live-ai-auction-git-main-omsardar.vercel.app";
  const ATTACKER = "https://malicious-attacker-domain.com";

  describe("isOriginAllowed logic", () => {
    it("allows production Vercel frontend", () => {
      expect(isOriginAllowed(VERCEL_PROD)).toBe(true);
      expect(isOriginAllowed(`${VERCEL_PROD}/`)).toBe(true);
    });

    it("allows Vercel preview and branch deployments", () => {
      expect(isOriginAllowed(VERCEL_PREVIEW)).toBe(true);
    });

    it("allows known Render deployment origins", () => {
      expect(isOriginAllowed("https://auction-x-enhanced-live-ai-auction.onrender.com")).toBe(true);
      expect(isOriginAllowed("https://auctionx-client.onrender.com")).toBe(true);
    });

    it("allows requests with no Origin header (curl / native apps / same-origin)", () => {
      expect(isOriginAllowed(undefined)).toBe(true);
      expect(isOriginAllowed(null)).toBe(true);
      expect(isOriginAllowed("")).toBe(true);
    });

    it("rejects unauthorized external origins", () => {
      expect(isOriginAllowed(ATTACKER)).toBe(false);
      expect(isOriginAllowed("https://evil-site.com")).toBe(false);
    });
  });

  describe("Express HTTP CORS Headers & Preflight Verification", () => {
    it("returns Access-Control-Allow-Origin for production Vercel origin on GET /api/csrf-token", async () => {
      const res = await request(app)
        .get("/api/csrf-token")
        .set("Origin", VERCEL_PROD);

      expect(res.status).toBe(200);
      expect(res.headers["access-control-allow-origin"]).toBe(VERCEL_PROD);
      expect(res.headers["access-control-allow-credentials"]).toBe("true");
    });

    it("returns Access-Control-Allow-Origin on preflight OPTIONS request from Vercel", async () => {
      const res = await request(app)
        .options("/api/products")
        .set("Origin", VERCEL_PROD)
        .set("Access-Control-Request-Method", "POST")
        .set("Access-Control-Request-Headers", "Content-Type, X-CSRF-Token");

      expect([200, 204]).toContain(res.status);
      expect(res.headers["access-control-allow-origin"]).toBe(VERCEL_PROD);
      expect(res.headers["access-control-allow-credentials"]).toBe("true");
      expect(res.headers["access-control-allow-methods"]).toMatch(/POST/);
    });

    it("returns Access-Control-Allow-Origin for Vercel preview deployment", async () => {
      const res = await request(app)
        .get("/api/csrf-token")
        .set("Origin", VERCEL_PREVIEW);

      expect(res.status).toBe(200);
      expect(res.headers["access-control-allow-origin"]).toBe(VERCEL_PREVIEW);
      expect(res.headers["access-control-allow-credentials"]).toBe("true");
    });

    it("omits Access-Control-Allow-Origin for unauthorized origin", async () => {
      const res = await request(app)
        .get("/api/csrf-token")
        .set("Origin", ATTACKER);

      expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    });
  });
});

