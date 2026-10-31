const request = require("supertest");
const { app } = require("../../../server");
const { clearDatabase } = require("../../helpers/dbHelper");
const { createTestSeller } = require("../../helpers/authHelper");
const { createCsrfCredentials } = require("../../helpers/csrfHelper");

describe("Seller Auth Integration Tests", () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  describe("POST /api/auth/seller/register", () => {
    it("should register a new seller successfully", async () => {
      const csrf = createCsrfCredentials();
      const sellerData = {
        name: "Bob's Vintage Market",
        email: "bobvintage@example.com",
        password: "SellerPassword123!",
        phoneNo: "9876543210",
        address: "789 Market Lane",
      };

      const res = await request(app)
        .post("/api/auth/seller/register")
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send(sellerData);

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.newUser).toBeDefined();
      expect(res.body.newUser.email).toBe(sellerData.email);

      const cookies = res.headers["set-cookie"];
      expect(cookies).toBeDefined();
      expect(cookies.some((c) => c.startsWith("token="))).toBe(true);
    });

    it("should reject registration if seller already exists", async () => {
      const csrf = createCsrfCredentials();
      await createTestSeller({ email: "sellerdup@example.com" });

      const res = await request(app)
        .post("/api/auth/seller/register")
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          name: "Another Seller",
          email: "sellerdup@example.com",
          password: "SellerPassword123!",
        });

      expect(res.statusCode).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/already exists/i);
    });
  });

  describe("POST /api/auth/seller/login", () => {
    it("should login seller with valid credentials and set token cookie", async () => {
      const csrf = createCsrfCredentials();
      const { seller, plainPassword } = await createTestSeller({
        email: "loginseller@example.com",
        plainPassword: "CorrectSeller123!",
      });

      const res = await request(app)
        .post("/api/auth/seller/login")
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          email: seller.email,
          password: plainPassword,
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.email).toBe(seller.email);

      const cookies = res.headers["set-cookie"];
      expect(cookies).toBeDefined();
      expect(cookies.some((c) => c.startsWith("token="))).toBe(true);
    });

    it("should reject seller login with incorrect password", async () => {
      const csrf = createCsrfCredentials();
      const { seller } = await createTestSeller({
        email: "wrongpass_seller@example.com",
        plainPassword: "CorrectSeller123!",
      });

      const res = await request(app)
        .post("/api/auth/seller/login")
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          email: seller.email,
          password: "BadPassword123!",
        });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Invalid credentials/i);
    });
  });

  describe("POST /api/auth/seller/logout", () => {
    it("should logout seller successfully", async () => {
      const csrf = createCsrfCredentials();
      const { token } = await createTestSeller();

      const res = await request(app)
        .post("/api/auth/seller/logout")
        .set("Cookie", [csrf.cookie, `sellerToken=${token}`])
        .set(csrf.headerName, csrf.headerValue);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
