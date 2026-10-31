const request = require("supertest");
const { app } = require("../../../server");
const { clearDatabase } = require("../../helpers/dbHelper");
const { createTestUser } = require("../../helpers/authHelper");
const { createCsrfCredentials } = require("../../helpers/csrfHelper");

describe("User Auth Integration Tests", () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  describe("POST /api/auth/register", () => {
    it("should register a new user successfully", async () => {
      const csrf = createCsrfCredentials();
      const userData = {
        name: "Alice Wonderland",
        email: "alice@example.com",
        password: "Password123!",
        address: "Wonderland St 1",
        phoneNo: "9988776655",
      };

      const res = await request(app)
        .post("/api/auth/register")
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send(userData);

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.newUser).toBeDefined();
      expect(res.body.newUser.email).toBe(userData.email);
      expect(res.body.newUser.name).toBe(userData.name);

      // Check cookie was set
      const cookies = res.headers["set-cookie"];
      expect(cookies).toBeDefined();
      expect(cookies.some((c) => c.startsWith("token="))).toBe(true);
    });

    it("should reject registration if user already exists", async () => {
      const csrf = createCsrfCredentials();
      await createTestUser({ email: "duplicate@example.com" });

      const res = await request(app)
        .post("/api/auth/register")
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          name: "Duplicate User",
          email: "duplicate@example.com",
          password: "Password123!",
        });

      expect(res.statusCode).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/already exists/i);
    });
  });

  describe("POST /api/auth/login", () => {
    it("should login successfully with valid credentials", async () => {
      const csrf = createCsrfCredentials();
      const { user, plainPassword } = await createTestUser({
        email: "loginuser@example.com",
        plainPassword: "CorrectPassword123!",
      });

      const res = await request(app)
        .post("/api/auth/login")
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          email: user.email,
          password: plainPassword,
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.email).toBe(user.email);

      const cookies = res.headers["set-cookie"];
      expect(cookies).toBeDefined();
      expect(cookies.some((c) => c.startsWith("token="))).toBe(true);
    });

    it("should reject login with wrong password", async () => {
      const csrf = createCsrfCredentials();
      const { user } = await createTestUser({
        email: "wrongpass@example.com",
        plainPassword: "CorrectPassword123!",
      });

      const res = await request(app)
        .post("/api/auth/login")
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          email: user.email,
          password: "WrongPassword!",
        });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Invalid credentials/i);
    });

    it("should reject login for non-existent email", async () => {
      const csrf = createCsrfCredentials();

      const res = await request(app)
        .post("/api/auth/login")
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          email: "nonexistent@example.com",
          password: "SomePassword123!",
        });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Invalid credentials/i);
    });
  });

  describe("POST /api/auth/logout", () => {
    it("should logout an authenticated user", async () => {
      const csrf = createCsrfCredentials();
      const { token } = await createTestUser();

      const res = await request(app)
        .post("/api/auth/logout")
        .set("Cookie", [csrf.cookie, `token=${token}`])
        .set(csrf.headerName, csrf.headerValue);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("should handle logout when unauthenticated", async () => {
      const csrf = createCsrfCredentials();

      const res = await request(app)
        .post("/api/auth/logout")
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue);

      expect([200, 401]).toContain(res.statusCode);
    });
  });
});
