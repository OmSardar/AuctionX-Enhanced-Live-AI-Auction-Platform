const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const auditService = require("../../../src/modules/analytics/services/auditService");
const { isAdmin, IsUser, IsSeller } = require("../../../src/modules/authentication/middleware/authOtherMiddlewares");
const adminAuthMiddleware = require("../../../src/modules/admin/authentication/middleware/authAdminMiddleware");
const authUserMiddleware = require("../../../src/modules/users/middleware/authUserMiddleware");
const { protectSellerRoute } = require("../../../src/modules/sellers/accounts/middleware/authSellerMiddleware");
const Admin = require("../../../src/modules/admin/authentication/models/admin");
const User = require("../../../src/modules/users/models/user");
const Seller = require("../../../src/modules/sellers/accounts/models/seller");
const { graphqlHandler } = require("../../../src/modules/integrations/graphql/graphqlHandler");

const JWT_SECRET = process.env.JWT_SECRET || "secure_jwt_secret_test_key_for_antigravity";

describe("Stage 7.44 — Security Findings Closure & Independent Verification", () => {
  beforeAll(() => {
    process.env.JWT_SECRET = JWT_SECRET;
  });

  // =========================================================================
  // Section 1: Trusted Proxy & Client IP Spoofing Defenses
  // =========================================================================
  describe("1. Trusted Proxy & Client IP Spoofing Defenses (resolveAuthenticClientIp)", () => {
    it("should REJECT spoofed CF-Connecting-IP on a direct connection when trust proxy is disabled", () => {
      const mockReq = {
        app: {
          get: (key) => (key === "trust proxy" ? false : undefined),
        },
        socket: { remoteAddress: "203.0.113.10" },
        headers: {
          "cf-connecting-ip": "1.1.1.1",
          "x-forwarded-for": "1.1.1.1, 203.0.113.10",
        },
        ip: "203.0.113.10",
      };

      const resolvedIp = auditService.resolveAuthenticClientIp(mockReq);
      // Must NOT trust the attacker's spoofed 1.1.1.1
      expect(resolvedIp).toBe("203.0.113.10");
      expect(resolvedIp).not.toBe("1.1.1.1");
    });

    it("should REJECT spoofed CF-Connecting-IP on a direct origin connection from public internet even if trust proxy is 1", () => {
      // In this scenario, an attacker directly hits the origin IP bypassing Cloudflare.
      // Socket address is a public untrusted IP.
      const mockReq = {
        app: {
          get: (key) => (key === "trust proxy" ? 1 : undefined),
        },
        socket: { remoteAddress: "198.51.100.99" }, // Public IP of attacker directly connecting
        headers: {
          "cf-connecting-ip": "8.8.8.8", // Attacker trying to spoof Google DNS IP
          "x-forwarded-for": "8.8.8.8",
        },
        ip: "198.51.100.99",
      };

      const resolvedIp = auditService.resolveAuthenticClientIp(mockReq);
      // Because socket is NOT a trusted proxy hop (loopback/private subnet), CF-Connecting-IP is rejected
      expect(resolvedIp).toBe("198.51.100.99");
      expect(resolvedIp).not.toBe("8.8.8.8");
    });

    it("should ACCEPT authoritative CF-Connecting-IP when request arrives from a trusted proxy hop (loopback / private subnet)", () => {
      // Legitimate ingress: request arrives from local Nginx reverse proxy (127.0.0.1) or private Docker network (10.0.0.5)
      const mockReq = {
        app: {
          get: (key) => (key === "trust proxy" ? 1 : undefined),
        },
        socket: { remoteAddress: "127.0.0.1" },
        headers: {
          "cf-connecting-ip": "203.0.113.45",
          "x-forwarded-for": "203.0.113.45",
        },
        ip: "203.0.113.45",
      };

      const resolvedIp = auditService.resolveAuthenticClientIp(mockReq);
      expect(resolvedIp).toBe("203.0.113.45");
    });

    it("should fall back to Express req.ip when arriving from a trusted proxy hop without Cloudflare header", () => {
      const mockReq = {
        app: {
          get: (key) => (key === "trust proxy" ? 1 : undefined),
        },
        socket: { remoteAddress: "10.0.1.25" },
        headers: {
          "x-forwarded-for": "198.51.100.55",
        },
        ip: "198.51.100.55",
      };

      const resolvedIp = auditService.resolveAuthenticClientIp(mockReq);
      expect(resolvedIp).toBe("198.51.100.55");
    });

    it("should REJECT spoofed CF-Connecting-IP over IPv4-mapped IPv6 direct origin connection from public internet", () => {
      const mockReq = {
        app: {
          get: (key) => (key === "trust proxy" ? 1 : undefined),
        },
        socket: { remoteAddress: "::ffff:198.51.100.99" }, // Public IP in IPv4-mapped IPv6 format
        headers: {
          "cf-connecting-ip": "8.8.8.8",
          "x-forwarded-for": "8.8.8.8",
        },
      };

      const resolvedIp = auditService.resolveAuthenticClientIp(mockReq);
      expect(resolvedIp).toBe("::ffff:198.51.100.99");
      expect(resolvedIp).not.toBe("8.8.8.8");
    });

    it("should ACCEPT CF-Connecting-IP over IPv4-mapped IPv6 trusted proxy hop (e.g. ::ffff:127.0.0.1 or ::ffff:10.0.0.1)", () => {
      const mockReq = {
        app: {
          get: (key) => (key === "trust proxy" ? 1 : undefined),
        },
        socket: { remoteAddress: "::ffff:10.0.0.5" }, // Docker/internal proxy in IPv4-mapped IPv6
        headers: {
          "cf-connecting-ip": "203.0.113.88",
          "x-forwarded-for": "203.0.113.88",
        },
        ip: "203.0.113.88",
      };

      const resolvedIp = auditService.resolveAuthenticClientIp(mockReq);
      expect(resolvedIp).toBe("203.0.113.88");
    });
  });

  // =========================================================================
  // Section 2: Admin Authentication Boundary & Role Confusion Tests
  // =========================================================================
  describe("2. Admin Authentication Boundary & Role Confusion Tests", () => {
    let mockRes;
    let nextCalled;

    beforeEach(() => {
      nextCalled = false;
      mockRes = {
        statusCode: null,
        body: null,
        clearedCookies: [],
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(payload) {
          this.body = payload;
          return this;
        },
        clearCookie(name, options) {
          this.clearedCookies.push({ name, options });
        },
      };
      jest.restoreAllMocks();
    });

    it("should REJECT an ordinary user token (role: 'user') from authenticating as administrator, even if email matches an admin", async () => {
      const userPayload = {
        id: new mongoose.Types.ObjectId().toString(),
        email: "shared_admin_and_user@example.com",
        role: "user",
      };
      const userToken = jwt.sign(userPayload, JWT_SECRET, { expiresIn: "1h" });

      // Mock DB: Admin document exists with this email, but the token is for a user role
      jest.spyOn(Admin, "findOne").mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        email: "shared_admin_and_user@example.com",
        role: "admin",
        status: "Active",
      });

      const req = {
        cookies: { adminToken: userToken },
        headers: {},
      };

      // Test authAdminMiddleware
      await adminAuthMiddleware(req, mockRes, () => { nextCalled = true; });
      expect(nextCalled).toBe(false);
      expect(mockRes.statusCode).toBe(403);
      expect(mockRes.body.message).toMatch(/Admin privileges required/i);

      // Test isAdmin (authOtherMiddlewares)
      mockRes.statusCode = null;
      mockRes.body = null;
      await isAdmin(req, mockRes, () => { nextCalled = true; });
      expect(nextCalled).toBe(false);
      expect(mockRes.statusCode).toBe(403);
      expect(mockRes.body.message).toMatch(/User is not an admin/i);
    });

    it("should REJECT a seller token (role: 'seller') from authenticating as administrator", async () => {
      const sellerPayload = {
        id: new mongoose.Types.ObjectId().toString(),
        email: "seller@example.com",
        role: "seller",
      };
      const sellerToken = jwt.sign(sellerPayload, JWT_SECRET, { expiresIn: "1h" });

      const req = {
        cookies: {},
        headers: { authorization: `Bearer ${sellerToken}` },
      };

      await adminAuthMiddleware(req, mockRes, () => { nextCalled = true; });
      expect(nextCalled).toBe(false);
      expect(mockRes.statusCode).toBe(403);

      mockRes.statusCode = null;
      await isAdmin(req, mockRes, () => { nextCalled = true; });
      expect(nextCalled).toBe(false);
      expect(mockRes.statusCode).toBe(403);
    });

    it("should REJECT wrong-purpose tokens (e.g. password_reset, email_verification)", async () => {
      const resetToken = jwt.sign(
        { id: new mongoose.Types.ObjectId().toString(), email: "admin@example.com", purpose: "password_reset" },
        JWT_SECRET,
        { expiresIn: "15m" }
      );

      const req = {
        cookies: { adminToken: resetToken },
        headers: {},
      };

      await adminAuthMiddleware(req, mockRes, () => { nextCalled = true; });
      expect(nextCalled).toBe(false);
      expect(mockRes.statusCode).toBe(401);
      expect(mockRes.body.message).toMatch(/Invalid token purpose/i);

      mockRes.statusCode = null;
      await isAdmin(req, mockRes, () => { nextCalled = true; });
      expect(nextCalled).toBe(false);
      expect(mockRes.statusCode).toBe(401);
      expect(mockRes.body.message).toMatch(/Invalid token purpose/i);
    });

    it("should REJECT expired tokens with HTTP 401 without leaking internal stack trace", async () => {
      const expiredToken = jwt.sign(
        { id: new mongoose.Types.ObjectId().toString(), email: "admin@example.com", role: "admin" },
        JWT_SECRET,
        { expiresIn: "-10s" } // already expired
      );

      const req = {
        cookies: { adminToken: expiredToken },
        headers: {},
      };

      await adminAuthMiddleware(req, mockRes, () => { nextCalled = true; });
      expect(nextCalled).toBe(false);
      expect(mockRes.statusCode).toBe(401);
      expect(mockRes.body.message).toMatch(/expired/i);

      mockRes.statusCode = null;
      await isAdmin(req, mockRes, () => { nextCalled = true; });
      expect(nextCalled).toBe(false);
      expect(mockRes.statusCode).toBe(401);
      expect(mockRes.body.message).toMatch(/expired/i);
    });

    it("should REJECT malformed or invalidly signed tokens with HTTP 401", async () => {
      const invalidToken = jwt.sign(
        { id: new mongoose.Types.ObjectId().toString(), role: "admin" },
        "wrong_signing_secret_key"
      );

      const req = {
        cookies: { adminToken: invalidToken },
        headers: {},
      };

      await adminAuthMiddleware(req, mockRes, () => { nextCalled = true; });
      expect(nextCalled).toBe(false);
      expect(mockRes.statusCode).toBe(401);
      expect(mockRes.body.message).toMatch(/Invalid/i);

      mockRes.statusCode = null;
      await isAdmin(req, mockRes, () => { nextCalled = true; });
      expect(nextCalled).toBe(false);
      expect(mockRes.statusCode).toBe(401);
      expect(mockRes.body.message).toMatch(/Invalid/i);
    });

    it("should REJECT suspended or disabled administrator accounts with 403 and clear all auth cookies", async () => {
      const adminId = new mongoose.Types.ObjectId().toString();
      const adminToken = jwt.sign(
        { id: adminId, email: "suspended_admin@example.com", role: "admin" },
        JWT_SECRET,
        { expiresIn: "1h" }
      );

      jest.spyOn(Admin, "findById").mockResolvedValue({
        _id: adminId,
        email: "suspended_admin@example.com",
        role: "admin",
        status: "Suspended",
      });

      const req = {
        cookies: { adminToken },
        headers: {},
      };

      await adminAuthMiddleware(req, mockRes, () => { nextCalled = true; });
      expect(nextCalled).toBe(false);
      expect(mockRes.statusCode).toBe(403);
      expect(mockRes.body.message).toMatch(/suspended/i);
      expect(mockRes.clearedCookies.some((c) => c.name === "adminToken")).toBe(true);
      expect(mockRes.clearedCookies.some((c) => c.name === "token")).toBe(true);

      mockRes.statusCode = null;
      mockRes.clearedCookies = [];
      await isAdmin(req, mockRes, () => { nextCalled = true; });
      expect(nextCalled).toBe(false);
      expect(mockRes.statusCode).toBe(403);
      expect(mockRes.body.message).toMatch(/suspended/i);
      expect(mockRes.clearedCookies.some((c) => c.name === "adminToken")).toBe(true);
    });

    it("should REJECT token when password was changed after token issuance", async () => {
      const adminId = new mongoose.Types.ObjectId().toString();
      // Token issued 10 minutes ago
      const tokenIat = Math.floor(Date.now() / 1000) - 600;
      const adminToken = jwt.sign(
        { id: adminId, email: "admin@example.com", role: "admin", iat: tokenIat },
        JWT_SECRET,
        { expiresIn: "1h" }
      );

      // Password changed 2 minutes ago
      const passwordChangedAt = new Date(Date.now() - 120 * 1000);

      jest.spyOn(Admin, "findById").mockResolvedValue({
        _id: adminId,
        email: "admin@example.com",
        role: "admin",
        status: "Active",
        passwordChangedAt,
      });

      const req = {
        cookies: { adminToken },
        headers: {},
      };

      await adminAuthMiddleware(req, mockRes, () => { nextCalled = true; });
      expect(nextCalled).toBe(false);
      expect(mockRes.statusCode).toBe(401);
      expect(mockRes.body.message).toMatch(/Password recently changed/i);

      mockRes.statusCode = null;
      await isAdmin(req, mockRes, () => { nextCalled = true; });
      expect(nextCalled).toBe(false);
      expect(mockRes.statusCode).toBe(401);
      expect(mockRes.body.message).toMatch(/Password recently changed/i);
    });

    it("should PERMIT active administrator and attach admin identity to req context", async () => {
      const adminId = new mongoose.Types.ObjectId().toString();
      const adminToken = jwt.sign(
        { id: adminId, email: "active_admin@example.com", role: "admin" },
        JWT_SECRET,
        { expiresIn: "1h" }
      );

      const mockAdminDoc = {
        _id: adminId,
        email: "active_admin@example.com",
        role: "admin",
        status: "Active",
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(Admin, "findById").mockResolvedValue(mockAdminDoc);

      const req = {
        cookies: { adminToken },
        headers: {},
      };

      await adminAuthMiddleware(req, mockRes, () => { nextCalled = true; });
      expect(nextCalled).toBe(true);
      expect(req.userId).toBe(adminId);
      expect(req.admin).toBe(mockAdminDoc);
      expect(req.role).toBe("admin");

      nextCalled = false;
      await isAdmin(req, mockRes, () => { nextCalled = true; });
      expect(nextCalled).toBe(true);
      expect(req.user).toBe(mockAdminDoc);
    });

    it("should REJECT intermediate MFA challenge tokens across admin, user, and seller middlewares", async () => {
      const challengeToken = jwt.sign(
        { id: new mongoose.Types.ObjectId().toString(), email: "admin@example.com", mfaPending: true, purpose: "mfa_challenge" },
        JWT_SECRET,
        { expiresIn: "10m" }
      );

      const req = {
        cookies: { adminToken: challengeToken, token: challengeToken },
        headers: {},
      };

      // Test adminAuthMiddleware
      await adminAuthMiddleware(req, mockRes, () => { nextCalled = true; });
      expect(nextCalled).toBe(false);
      expect(mockRes.statusCode).toBe(401);
      expect(mockRes.body.message).toMatch(/Incomplete authentication challenge/i);

      // Test isAdmin
      mockRes.statusCode = null;
      mockRes.body = null;
      await isAdmin(req, mockRes, () => { nextCalled = true; });
      expect(nextCalled).toBe(false);
      expect(mockRes.statusCode).toBe(401);
      expect(mockRes.body.message).toMatch(/Incomplete authentication challenge/i);

      // Test authUserMiddleware
      mockRes.statusCode = null;
      mockRes.body = null;
      await authUserMiddleware(req, mockRes, () => { nextCalled = true; });
      expect(nextCalled).toBe(false);
      expect(mockRes.statusCode).toBe(401);
      expect(mockRes.body.message).toMatch(/Incomplete authentication challenge/i);

      // Test protectSellerRoute
      mockRes.statusCode = null;
      mockRes.body = null;
      await protectSellerRoute(req, mockRes, () => { nextCalled = true; });
      expect(nextCalled).toBe(false);
      expect(mockRes.statusCode).toBe(401);
      expect(mockRes.body.message).toMatch(/Incomplete authentication challenge/i);
    });

    it("should REJECT disabled administrator accounts (status: 'Disabled') with 403 and clear auth cookies", async () => {
      const adminId = new mongoose.Types.ObjectId().toString();
      const adminToken = jwt.sign(
        { id: adminId, email: "disabled_admin@example.com", role: "admin" },
        JWT_SECRET,
        { expiresIn: "1h" }
      );

      jest.spyOn(Admin, "findById").mockResolvedValue({
        _id: adminId,
        email: "disabled_admin@example.com",
        role: "admin",
        status: "Disabled",
      });

      const req = {
        cookies: { adminToken },
        headers: {},
      };

      await adminAuthMiddleware(req, mockRes, () => { nextCalled = true; });
      expect(nextCalled).toBe(false);
      expect(mockRes.statusCode).toBe(403);
      expect(mockRes.clearedCookies.some((c) => c.name === "adminToken")).toBe(true);
      expect(mockRes.clearedCookies.some((c) => c.name === "token")).toBe(true);
    });

    it("should REJECT token with role 'admin' pointing to a User record whose DB role is 'user' (cross-role elevation)", async () => {
      const targetUserId = new mongoose.Types.ObjectId().toString();
      const forgedAdminToken = jwt.sign(
        { id: targetUserId, email: "victim@example.com", role: "admin" },
        JWT_SECRET,
        { expiresIn: "1h" }
      );

      // Admin collection has no record for this ID
      jest.spyOn(Admin, "findById").mockResolvedValue(null);
      // User collection lookup with role admin returns null because in DB user's role is 'user'
      jest.spyOn(User, "findOne").mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      const req = {
        cookies: { adminToken: forgedAdminToken },
        headers: {},
      };

      await adminAuthMiddleware(req, mockRes, () => { nextCalled = true; });
      expect(nextCalled).toBe(false);
      expect(mockRes.statusCode).toBe(403);
      expect(mockRes.body.message).toMatch(/Access denied: Admin privileges required/i);
    });

    it("should REJECT token with explicit unknown ID without falling back to email lookup", async () => {
      const unknownId = new mongoose.Types.ObjectId().toString();
      const token = jwt.sign(
        { id: unknownId, email: "real_admin@example.com", role: "admin" },
        JWT_SECRET,
        { expiresIn: "1h" }
      );

      jest.spyOn(Admin, "findById").mockResolvedValue(null);
      jest.spyOn(User, "findOne").mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });
      const adminFindOneSpy = jest.spyOn(Admin, "findOne");

      const req = {
        cookies: { adminToken: token },
        headers: {},
      };

      await adminAuthMiddleware(req, mockRes, () => { nextCalled = true; });
      expect(nextCalled).toBe(false);
      expect(mockRes.statusCode).toBe(403);
      expect(adminFindOneSpy).not.toHaveBeenCalled();
    });

    it("should ENFORCE equivalent security controls whether token is provided via Cookie or Bearer header", async () => {
      const adminId = new mongoose.Types.ObjectId().toString();
      const validAdminToken = jwt.sign(
        { id: adminId, email: "admin@example.com", role: "admin" },
        JWT_SECRET,
        { expiresIn: "1h" }
      );

      const mockAdminDoc = {
        _id: adminId,
        email: "admin@example.com",
        role: "admin",
        status: "Active",
      };
      jest.spyOn(Admin, "findById").mockResolvedValue(mockAdminDoc);

      // Test Bearer header
      const bearerReq = {
        cookies: {},
        headers: { authorization: `Bearer ${validAdminToken}` },
      };
      nextCalled = false;
      await adminAuthMiddleware(bearerReq, mockRes, () => { nextCalled = true; });
      expect(nextCalled).toBe(true);
      expect(bearerReq.admin).toBe(mockAdminDoc);

      // Test Cookie
      const cookieReq = {
        cookies: { adminToken: validAdminToken },
        headers: {},
      };
      nextCalled = false;
      await adminAuthMiddleware(cookieReq, mockRes, () => { nextCalled = true; });
      expect(nextCalled).toBe(true);
      expect(cookieReq.admin).toBe(mockAdminDoc);
    });

    it("should REJECT wrong-purpose tokens (e.g. password_reset) in authUserMiddleware and IsUser", async () => {
      const resetToken = jwt.sign(
        { id: new mongoose.Types.ObjectId().toString(), email: "user@example.com", purpose: "password_reset" },
        JWT_SECRET,
        { expiresIn: "15m" }
      );

      const req = {
        cookies: { token: resetToken },
        headers: {},
      };

      await authUserMiddleware(req, mockRes, () => { nextCalled = true; });
      expect(nextCalled).toBe(false);
      expect(mockRes.statusCode).toBe(401);
      expect(mockRes.body.message).toMatch(/Invalid token purpose/i);

      mockRes.statusCode = null;
      mockRes.body = null;
      await IsUser(req, mockRes, () => { nextCalled = true; });
      expect(nextCalled).toBe(false);
      expect(mockRes.statusCode).toBe(401);
      expect(mockRes.body.message).toMatch(/Invalid token purpose/i);
    });

    it("should ENSURE error responses do not leak token, secret, or internal stack trace", async () => {
      const malformedToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.corrupted_payload.invalid_signature";
      const req = {
        cookies: { adminToken: malformedToken },
        headers: {},
      };

      await adminAuthMiddleware(req, mockRes, () => { nextCalled = true; });
      expect(mockRes.statusCode).toBe(401);
      expect(mockRes.body.message).toMatch(/(Invalid|Authentication error|Unauthorized)/i);
      expect(JSON.stringify(mockRes.body)).not.toContain(JWT_SECRET);
      expect(JSON.stringify(mockRes.body)).not.toContain("stack");
    });
  });

  // =========================================================================
  // Section 3: GraphQL Security & Abuse Limits
  // =========================================================================
  describe("3. GraphQL Security & Abuse Limits (graphqlHandler)", () => {
    let mockRes;

    beforeEach(() => {
      mockRes = {
        statusCode: null,
        body: null,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(payload) {
          this.body = payload;
          return this;
        },
      };
    });

    it("should reject queries exceeding MAX_QUERY_LENGTH (10,000 characters)", async () => {
      const padding = " ".repeat(10001);
      const oversizedQuery = `query { dashboardOverview { ${padding} totalUsers } }`;

      const req = {
        body: { query: oversizedQuery },
        admin: { role: "admin", id: "admin_123" },
      };

      await graphqlHandler(req, mockRes);
      expect(mockRes.statusCode).toBe(400);
      expect(mockRes.body.errors[0].message).toMatch(/exceeds maximum limit/i);
    });

    it("should reject queries exceeding MAX_ALIASES (15 aliases)", async () => {
      const aliases = Array.from({ length: 16 }, (_, i) => `alias${i}: dashboardOverview { totalUsers }`).join("\n");
      const maliciousQuery = `query { ${aliases} }`;

      const req = {
        body: { query: maliciousQuery },
        admin: { role: "admin", id: "admin_123" },
      };

      await graphqlHandler(req, mockRes);
      expect(mockRes.statusCode).toBe(400);
      expect(mockRes.body.errors[0].message).toMatch(/exceeds maximum allowed/i);
    });

    it("should reject queries exceeding MAX_SELECTION_COUNT (150 fields)", async () => {
      const fields = Array.from({ length: 155 }, (_, i) => `f${i}: totalUsers`).join("\n");
      const maliciousQuery = `query { dashboardOverview { ${fields} } }`;

      const req = {
        body: { query: maliciousQuery },
        admin: { role: "admin", id: "admin_123" },
      };

      await graphqlHandler(req, mockRes);
      expect(mockRes.statusCode).toBe(400);
      expect(mockRes.body.errors[0].message).toMatch(/exceeds maximum allowed/i);
    });

    it("should block schema introspection in production mode", async () => {
      const originalEnv = process.env.NODE_ENV;
      const originalIntrospection = process.env.ENABLE_GRAPHQL_INTROSPECTION;
      try {
        process.env.NODE_ENV = "production";
        delete process.env.ENABLE_GRAPHQL_INTROSPECTION;

        const introspectionQuery = `query { __schema { types { name } } }`;
        const req = {
          body: { query: introspectionQuery },
          admin: { role: "admin", id: "admin_123" },
        };

        await graphqlHandler(req, mockRes);
        expect(mockRes.statusCode).toBe(400);
        expect(mockRes.body.errors[0].message).toMatch(/GraphQL schema introspection is disabled/i);
      } finally {
        process.env.NODE_ENV = originalEnv;
        if (originalIntrospection !== undefined) {
          process.env.ENABLE_GRAPHQL_INTROSPECTION = originalIntrospection;
        }
      }
    });

    it("should reject queries exceeding MAX_QUERY_DEPTH (6 levels)", async () => {
      // 7 levels of nesting: level1 -> level2 -> level3 -> level4 -> level5 -> level6 -> level7
      const deepQuery = `query {
        dashboardOverview {
          recentActivity {
            status
          }
        }
      }`;
      // Craft query exceeding 6 levels
      const deepAbuseQuery = `query {
        a { b { c { d { e { f { g { h } } } } } } }
      }`;

      const req = {
        body: { query: deepAbuseQuery },
        admin: { role: "admin", id: "admin_123" },
      };

      await graphqlHandler(req, mockRes);
      expect(mockRes.statusCode).toBe(400);
      expect(mockRes.body.errors[0].message).toMatch(/Query depth of \d+ exceeds maximum allowed depth of 6/i);
    });

    it("should reject GraphQL batching attempts (array in request body)", async () => {
      const req = {
        body: [
          { query: "query { dashboardOverview { totalUsers } }" },
          { query: "query { dashboardOverview { totalUsers } }" },
        ],
        admin: { role: "admin", id: "admin_123" },
      };

      await graphqlHandler(req, mockRes);
      expect(mockRes.statusCode).toBe(400);
      expect(mockRes.body.errors[0].message).toMatch(/GraphQL query is required and must be a string/i);
    });

    it("should reject missing or non-string queries with HTTP 400", async () => {
      const req = {
        body: { query: 12345 },
        admin: { role: "admin", id: "admin_123" },
      };

      await graphqlHandler(req, mockRes);
      expect(mockRes.statusCode).toBe(400);
      expect(mockRes.body.errors[0].message).toMatch(/GraphQL query is required and must be a string/i);
    });

    it("should allow intended administrative queries when valid admin context is present", async () => {
      const validQuery = `query GetAuditSummary {
        auditSummary {
          totalEventsLast24h
        }
      }`;

      jest.spyOn(auditService, "getAuditSummary").mockResolvedValue({
        totalEventsLast24h: 42,
        outcomes: { SUCCESS: 40, FAILURE: 2 },
        recentFailures: [],
      });

      const req = {
        body: { query: validQuery },
        admin: { _id: "admin_123", email: "admin@example.com", role: "admin" },
        role: "admin",
      };

      await graphqlHandler(req, mockRes);
      expect(mockRes.statusCode).toBe(200);
      expect(mockRes.body.data).toBeDefined();
      expect(mockRes.body.data.auditSummary.totalEventsLast24h).toBe(42);
    });
  });
});
