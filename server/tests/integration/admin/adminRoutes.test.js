const request = require("supertest");
const { app } = require("../../../server");
const { clearDatabase } = require("../../helpers/dbHelper");
const { createTestUser, createTestAdmin } = require("../../helpers/authHelper");
const { createCsrfCredentials } = require("../../helpers/csrfHelper");

describe("Admin Routes Integration & Authorization Tests", () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  describe("Access control on /api/admin/*", () => {
    it("should reject unauthenticated requests with 401", async () => {
      const res = await request(app).get("/api/admin/customers");

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("should reject standard user requests with 403 Forbidden", async () => {
      const { user, token } = await createTestUser({ role: "user" });

      const res = await request(app)
        .get("/api/admin/customers")
        .set("Cookie", [`token=${token}`]);

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Admin privileges required/i);
    });

    it("should allow verified admin requests with 200", async () => {
      const { admin, token } = await createTestAdmin();

      const res = await request(app)
        .get("/api/admin/customers")
        .set("Cookie", [`adminToken=${token}`]);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe("POST /api/auth/check-admin", () => {
    it("should forbid non-admin from checking admin status", async () => {
      const csrf = createCsrfCredentials();
      const { user, token } = await createTestUser({ role: "user" });

      const res = await request(app)
        .post("/api/auth/check-admin")
        .set("Cookie", [csrf.cookie, `token=${token}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ email: user.email });

      expect(res.statusCode).toBe(403);
    });

    it("should confirm admin status for authenticated admin", async () => {
      const csrf = createCsrfCredentials();
      const { user: adminUser, token } = await createTestUser({ role: "admin" });

      const res = await request(app)
        .post("/api/auth/check-admin")
        .set("Cookie", [csrf.cookie, `token=${token}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ email: adminUser.email });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.isAdmin).toBe(true);
    });
  });
});
