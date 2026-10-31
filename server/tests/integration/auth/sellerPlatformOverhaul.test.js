const request = require("supertest");
const jwt = require("jsonwebtoken");
const { app } = require("../../../server");
const { clearDatabase } = require("../../helpers/dbHelper");
const { createTestSeller, createTestUser, createTestAdmin } = require("../../helpers/authHelper");
const { createCsrfCredentials } = require("../../helpers/csrfHelper");
const Seller = require("../../../src/modules/sellers/accounts/models/seller");
const Product = require("../../../src/modules/products/models/productSchema");
const Order = require("../../../src/modules/orders/models/orderSchema");

describe("Seller Platform Overhaul Integration Tests", () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  describe("1. Seller Authentication & Dual Cookie Architecture", () => {
    it("should issue JWT containing role: seller and purpose: seller_session on registration", async () => {
      const csrf = createCsrfCredentials();
      const sellerData = {
        name: "Vintage Art Store",
        email: "vintageart@example.com",
        password: "SellerPassword123!",
        phoneNo: "9876543210",
        address: "123 Artisan Way",
      };

      const res = await request(app)
        .post("/api/auth/seller/register")
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send(sellerData);

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.newUser.role).toBe("seller");

      const cookies = res.headers["set-cookie"];
      expect(cookies).toBeDefined();
      expect(cookies.some((c) => c.startsWith("token="))).toBe(true);
      expect(cookies.some((c) => c.startsWith("sellerToken="))).toBe(true);

      // Verify token payload claims
      const tokenCookie = cookies.find((c) => c.startsWith("token="));
      const token = tokenCookie.split(";")[0].replace("token=", "");
      const decoded = jwt.decode(token);
      expect(decoded.role).toBe("seller");
      expect(decoded.purpose).toBe("seller_session");
      expect(decoded.email).toBe(sellerData.email);
    });

    it("should issue both cookies and normalize email on seller login", async () => {
      const csrf = createCsrfCredentials();
      const { seller, plainPassword } = await createTestSeller({
        email: "unique_seller@example.com",
        plainPassword: "CorrectSeller123!",
      });

      // Attempt login with uppercase/spaced email
      const res = await request(app)
        .post("/api/auth/seller/login")
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          email: "  UNIQUE_SELLER@EXAMPLE.COM  ",
          password: plainPassword,
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.email).toBe(seller.email);

      const cookies = res.headers["set-cookie"];
      expect(cookies.some((c) => c.startsWith("token="))).toBe(true);
      expect(cookies.some((c) => c.startsWith("sellerToken="))).toBe(true);
    });

    it("should reject seller login with incorrect password or non-existent account", async () => {
      const csrf = createCsrfCredentials();
      const { seller } = await createTestSeller({
        email: "existing_seller@example.com",
        plainPassword: "ValidPassword123!",
      });

      const resBadPass = await request(app)
        .post("/api/auth/seller/login")
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          email: seller.email,
          password: "WrongPassword999!",
        });

      expect(resBadPass.statusCode).toBe(401);
      expect(resBadPass.body.success).toBe(false);

      const resNotFound = await request(app)
        .post("/api/auth/seller/login")
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          email: "nonexistent_seller@example.com",
          password: "ValidPassword123!",
        });

      expect(resNotFound.statusCode).toBe(401);
      expect(resNotFound.body.success).toBe(false);
      expect(resNotFound.body.message).toMatch(/Invalid credentials/i);
    });
  });

  describe("2. Seller Status Verification & Profile Endpoints", () => {
    it("POST /api/auth/seller/check-seller should accurately query SellerModel", async () => {
      const csrf = createCsrfCredentials();
      const { seller } = await createTestSeller({
        email: "verified_seller@example.com",
        name: "Verified Merchant",
        status: "Active",
      });

      const res = await request(app)
        .post("/api/auth/seller/check-seller")
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({ email: seller.email });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.isSeller).toBe(true);
      expect(res.body.role).toBe("seller");
    });

    it("POST /api/auth/seller/check-seller should return 404 for ordinary buyer email", async () => {
      const csrf = createCsrfCredentials();
      const { user } = await createTestUser({
        email: "regular_buyer@example.com",
      });

      const res = await request(app)
        .post("/api/auth/seller/check-seller")
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({ email: user.email });

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/seller not found/i);
    });

    it("GET /api/auth/seller/user/:email should return full profile to authenticated owner without password", async () => {
      const { seller, token } = await createTestSeller({
        email: "owner_seller@example.com",
        phoneNo: "9123456789",
        address: "456 Seller Blvd",
      });

      const res = await request(app)
        .get(`/api/auth/seller/user/${seller.email}`)
        .set("Cookie", [`token=${token}`]);

      expect(res.statusCode).toBe(200);
      expect(res.body.email).toBe(seller.email);
      expect(res.body.address).toBe("456 Seller Blvd");
      expect(res.body.password).toBeUndefined();
    });
  });

  describe("3. Profile Updates & IDOR Protection", () => {
    it("should allow seller to update permitted profile fields", async () => {
      const csrf = createCsrfCredentials();
      const { seller, token } = await createTestSeller({
        email: "update_seller@example.com",
        address: "Old Address",
        city: "Old City",
      });

      const updateData = {
        name: "Updated Shop Name",
        address: "New Market Street 10",
        city: "Mumbai",
        phoneNo: "9988776655",
      };

      const res = await request(app)
        .patch(`/api/auth/seller/updateUserProfile/${seller.email}`)
        .set("Cookie", [csrf.cookie, `token=${token}`])
        .set(csrf.headerName, csrf.headerValue)
        .send(updateData);

      expect(res.statusCode).toBe(200);
      expect(res.body.user.address).toBe("New Market Street 10");
      expect(res.body.user.city).toBe("Mumbai");

      // Verify in database
      const persisted = await Seller.findById(seller._id);
      expect(persisted.address).toBe("New Market Street 10");
    });

    it("should reject IDOR attempt when Seller A tries to update Seller B profile", async () => {
      const csrf = createCsrfCredentials();
      const { seller: sellerA, token: tokenA } = await createTestSeller({
        email: "seller_a@example.com",
      });
      const { seller: sellerB } = await createTestSeller({
        email: "seller_b@example.com",
        address: "Seller B Address",
      });

      // Seller A attempts to modify Seller B's profile
      const res = await request(app)
        .patch(`/api/auth/seller/updateUserProfile/${sellerB.email}`)
        .set("Cookie", [csrf.cookie, `token=${tokenA}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ address: "Compromised Address" });

      expect(res.statusCode).toBe(403);
      expect(res.body.message).toMatch(/Forbidden: You can only modify your own profile/i);

      // Verify Seller B's address was untouched
      const sellerBCheck = await Seller.findById(sellerB._id);
      expect(sellerBCheck.address).toBe("Seller B Address");
    });

    it("should verify current password and update new password for authenticated seller", async () => {
      const csrf = createCsrfCredentials();
      const currentPassword = "CurrentPassword123!";
      const newPassword = "NewSecretPassword456!";
      const { seller, token } = await createTestSeller({
        email: "pw_seller@example.com",
        plainPassword: currentPassword,
      });

      // 1. Attempt with incorrect current password
      const resFail = await request(app)
        .patch("/api/auth/seller/update-password")
        .set("Cookie", [csrf.cookie, `token=${token}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          currentPassword: "WrongCurrentPassword!",
          newPassword,
        });

      expect(resFail.statusCode).toBe(400);
      expect(resFail.body.message).toMatch(/Current password is incorrect/i);

      // 2. Attempt with correct current password
      const resSuccess = await request(app)
        .patch("/api/auth/seller/update-password")
        .set("Cookie", [csrf.cookie, `token=${token}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          currentPassword,
          newPassword,
        });

      expect(resSuccess.statusCode).toBe(200);
      expect(resSuccess.body.message).toMatch(/Password updated successfully/i);

      // 3. Verify seller can log in with new password
      const resNewLogin = await request(app)
        .post("/api/auth/seller/login")
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          email: seller.email,
          password: newPassword,
        });

      expect(resNewLogin.statusCode).toBe(200);
      expect(resNewLogin.body.success).toBe(true);
    });
  });

  describe("4. Role Authorization & Cross-Account Isolation", () => {
    it("should reject seller token from accessing admin-only management routes", async () => {
      const { token: sellerToken } = await createTestSeller({
        email: "unauthorized_seller@example.com",
      });

      const res = await request(app)
        .get("/api/admins")
        .set("Cookie", [`token=${sellerToken}`]);

      // Admin route requires admin role; seller token must be rejected with 401 or 403
      expect([401, 403]).toContain(res.statusCode);
    });

    it("should reject unauthenticated request from updating seller profile", async () => {
      const csrf = createCsrfCredentials();
      const { seller } = await createTestSeller();

      const res = await request(app)
        .patch(`/api/auth/seller/updateUserProfile/${seller.email}`)
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({ address: "Unauthenticated Update" });

      expect(res.statusCode).toBe(401);
    });
  });

  describe("5. Dual Cookie Precedence & Bearer Token Precedence", () => {
    it("should prioritize sellerToken cookie on seller routes when both cookies coexist", async () => {
      const { seller, token: sellerToken } = await createTestSeller({
        email: "dual_seller@example.com",
      });
      const { user, token: userToken } = await createTestUser({
        email: "dual_buyer@example.com",
      });

      // Request sent with BOTH cookies present simultaneously
      const res = await request(app)
        .get(`/api/auth/seller/user/${seller.email}`)
        .set("Cookie", [`token=${userToken}`, `sellerToken=${sellerToken}`]);

      expect(res.statusCode).toBe(200);
      expect(res.body.email).toBe(seller.email);
    });

    it("should authenticate seller with Bearer token in headers when cookies are absent", async () => {
      const { seller, token: sellerToken } = await createTestSeller({
        email: "bearer_seller@example.com",
      });

      const res = await request(app)
        .get(`/api/auth/seller/user/${seller.email}`)
        .set("Authorization", `Bearer ${sellerToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.email).toBe(seller.email);
    });

    it("should never grant authorization merely because a token was selected: rejects wrong purpose and tampered tokens", async () => {
      const secret = process.env.JWT_SECRET || "auctionx-super-secure-test-jwt-secret-key-32chars";

      // 1. Token with MFA challenge purpose sent to mandatory protected route
      const mfaToken = jwt.sign(
        { id: "507f1f77bcf86cd799439011", email: "test@example.com", purpose: "mfa_challenge", mfaPending: true },
        secret,
        { expiresIn: "1h" }
      );
      const resMfa = await request(app)
        .get("/api/orders/seller/test@example.com")
        .set("Cookie", [`sellerToken=${mfaToken}`]);
      expect(resMfa.statusCode).toBe(401);

      // 2. Token with password_reset purpose
      const resetToken = jwt.sign(
        { id: "507f1f77bcf86cd799439011", email: "test@example.com", purpose: "password_reset" },
        secret,
        { expiresIn: "1h" }
      );
      const resReset = await request(app)
        .get("/api/orders/seller/test@example.com")
        .set("Cookie", [`sellerToken=${resetToken}`]);
      expect(resReset.statusCode).toBe(401);

      // 3. Forged signature token
      const forgedToken = jwt.sign(
        { id: "507f1f77bcf86cd799439011", email: "test@example.com", role: "seller" },
        "completely_wrong_secret",
        { expiresIn: "1h" }
      );
      const resForged = await request(app)
        .get("/api/orders/seller/test@example.com")
        .set("Cookie", [`sellerToken=${forgedToken}`]);
      expect(resForged.statusCode).toBe(401);
    });
  });

  describe("6. Cross-Role Boundaries & Account Status Verification", () => {
    it("should reject buyer token from accessing seller-protected endpoints", async () => {
      const { user, token: buyerToken } = await createTestUser({
        email: "ordinary_buyer@example.com",
      });

      const res = await request(app)
        .get(`/api/auth/seller/user/${user.email}`)
        .set("Cookie", [`token=${buyerToken}`]);

      // Buyer does not have a Seller record, returns 404 or 403
      expect([403, 404]).toContain(res.statusCode);
    });

    it("should enforce suspension: reject login and block active requests for suspended seller", async () => {
      const csrf = createCsrfCredentials();
      const plainPassword = "SuspendedPassword123!";
      const { seller, token } = await createTestSeller({
        email: "suspended_seller@example.com",
        plainPassword,
        status: "Suspended",
        suspensionReason: "Terms of service violation",
      });

      // 1. Login attempt must be blocked with 403
      const resLogin = await request(app)
        .post("/api/auth/seller/login")
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          email: seller.email,
          password: plainPassword,
        });

      expect(resLogin.statusCode).toBe(403);
      expect(resLogin.body.message).toMatch(/suspended/i);

      // 2. Protected endpoint with pre-issued token must be rejected with 403 and clear cookies
      const resAccess = await request(app)
        .get(`/api/auth/seller/user/${seller.email}`)
        .set("Cookie", [`sellerToken=${token}`]);

      expect(resAccess.statusCode).toBe(403);
      expect(resAccess.body.status).toBe("Suspended");
    });

    it("should clear both token and sellerToken cookies on logout", async () => {
      const csrf = createCsrfCredentials();
      const res = await request(app)
        .post("/api/auth/seller/logout")
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);

      const cookies = res.headers["set-cookie"];
      expect(cookies).toBeDefined();
      expect(cookies.some((c) => c.startsWith("token=;"))).toBe(true);
      expect(cookies.some((c) => c.startsWith("sellerToken=;"))).toBe(true);
    });
  });

  describe("7. Seller Workflows: Listings, IDOR, and Order Access", () => {
    it("should prevent Seller A from updating or deleting Seller B product (IDOR prevention)", async () => {
      const csrf = createCsrfCredentials();
      const { seller: sellerA, token: tokenA } = await createTestSeller({ email: "seller_a_prod@example.com" });
      const { seller: sellerB } = await createTestSeller({ email: "seller_b_prod@example.com" });

      const now = new Date();
      const futureStart = new Date(now.getTime() + 60 * 60 * 1000);
      const futureEnd = new Date(futureStart.getTime() + 2 * 60 * 1000);

      const productB = await Product.create({
        name: "Vintage Mechanical Clock",
        category: "Collectibles & Antiques",
        description: [{ name: "Condition", description: "Mint" }],
        mobileNumber: "9123456780",
        biddingStartDate: futureStart,
        biddingStartTime: "14:00",
        biddingStartPrice: 200,
        email: sellerB.email,
        images: [{ secure_url: "https://example.com/clock.jpg", public_id: "clock_123" }],
        biddingEndTime: futureEnd.toISOString(),
        startingPrice: 200,
        currentPrice: 200,
        status: "Active",
      });

      // Seller A attempts to update Seller B's product
      const resUpdate = await request(app)
        .put(`/api/products/${productB._id}`)
        .set("Cookie", [csrf.cookie, `sellerToken=${tokenA}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ name: "Hacked Clock Title" });

      expect(resUpdate.statusCode).toBe(403);
      expect(resUpdate.body.message).toMatch(/Forbidden/i);

      // Verify product was not altered
      const unmodified = await Product.findById(productB._id);
      expect(unmodified.name).toBe("Vintage Mechanical Clock");

      // Seller A attempts to delete Seller B's product
      const resDelete = await request(app)
        .delete(`/api/products/${productB._id}`)
        .set("Cookie", [csrf.cookie, `sellerToken=${tokenA}`])
        .set(csrf.headerName, csrf.headerValue);

      expect(resDelete.statusCode).toBe(403);
      expect(resDelete.body.message).toMatch(/Forbidden/i);
    });

    it("should allow seller to update own product status to Closed", async () => {
      const csrf = createCsrfCredentials();
      const { seller, token } = await createTestSeller({ email: "seller_status@example.com" });

      const now = new Date();
      const product = await Product.create({
        name: "Handmade Ceramic Vase",
        category: "Home & Living",
        description: [{ name: "Material", description: "Clay" }],
        mobileNumber: "9123456780",
        biddingStartDate: now,
        biddingStartTime: "12:00",
        biddingStartPrice: 150,
        email: seller.email,
        images: [{ secure_url: "https://example.com/vase.jpg", public_id: "vase_123" }],
        biddingEndTime: new Date(now.getTime() + 10000).toISOString(),
        startingPrice: 150,
        currentPrice: 150,
        status: "Active",
      });

      const res = await request(app)
        .patch(`/api/products/statuspatch/${product._id}`)
        .set("Cookie", [csrf.cookie, `sellerToken=${token}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ status: "Closed" });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.product.status).toBe("Closed");

      const check = await Product.findById(product._id);
      expect(check.status).toBe("Closed");
    });

    it("should allow seller to fetch their own orders and reject cross-seller order access", async () => {
      const { seller: seller1, token: token1 } = await createTestSeller({ email: "seller_orders_1@example.com" });
      const { seller: seller2 } = await createTestSeller({ email: "seller_orders_2@example.com" });

      // Create an order for seller 1 with all required schema fields
      await Order.create({
        title: "Art Print A",
        name: "Art Print Order Item",
        sellerEmail: seller1.email,
        userEmail: "buyer1@example.com",
        category: "Art",
        images: [{ secure_url: "https://example.com/art.jpg", public_id: "art_123" }],
        biddingStartPrice: 100,
        highestBid: 250,
        phoneNo: "9876543210",
        address: "789 Collector Rd",
      });

      // Seller 1 fetches their own orders
      const resOwn = await request(app)
        .get(`/api/orders/seller/${seller1.email}`)
        .set("Cookie", [`sellerToken=${token1}`]);

      expect(resOwn.statusCode).toBe(200);
      expect(Array.isArray(resOwn.body)).toBe(true);
      expect(resOwn.body.length).toBe(1);
      expect(resOwn.body[0].title).toBe("Art Print A");

      // Seller 1 attempts IDOR access to Seller 2's orders
      const resIdor = await request(app)
        .get(`/api/orders/seller/${seller2.email}`)
        .set("Cookie", [`sellerToken=${token1}`]);

      expect(resIdor.statusCode).toBe(403);
      expect(resIdor.body.message).toMatch(/Forbidden/i);
    });

    it("should reject buyer attempting to access seller orders with 403", async () => {
      const { seller } = await createTestSeller({ email: "seller_orders_owned@example.com" });
      const { token: buyerToken } = await createTestUser({ email: "buyer_attacker@example.com" });

      const res = await request(app)
        .get(`/api/orders/seller/${seller.email}`)
        .set("Cookie", [`token=${buyerToken}`]);

      expect(res.statusCode).toBe(403);
      expect(res.body.message).toMatch(/Seller privileges required/i);
    });
  });

  describe("7. Advanced JWT Boundary, Purpose Enforcement & Seller Payment Isolation", () => {
    it("GET /api/auth/seller/check should reject intermediate MFA challenge tokens", async () => {
      const { seller } = await createTestSeller({ email: "seller_mfa_chk@example.com" });
      const mfaToken = jwt.sign(
        { id: seller._id, email: seller.email, purpose: "mfa_challenge", mfaPending: true },
        process.env.JWT_SECRET || "fallback_secret",
        { expiresIn: "5m" }
      );

      const res = await request(app)
        .get("/api/auth/seller/check")
        .set("Cookie", [`sellerToken=${mfaToken}`]);

      expect(res.statusCode).toBe(200);
      expect(res.body.authenticated).toBe(false);
      expect(res.body.mfaPending).toBe(true);
    });

    it("GET /api/auth/seller/check should reject wrong purpose tokens (e.g. password_reset)", async () => {
      const { seller } = await createTestSeller({ email: "seller_reset_chk@example.com" });
      const resetToken = jwt.sign(
        { id: seller._id, email: seller.email, purpose: "password_reset" },
        process.env.JWT_SECRET || "fallback_secret",
        { expiresIn: "5m" }
      );

      const res = await request(app)
        .get("/api/auth/seller/check")
        .set("Cookie", [`sellerToken=${resetToken}`]);

      expect(res.statusCode).toBe(200);
      expect(res.body.authenticated).toBe(false);
      expect(res.body.message).toMatch(/Invalid token purpose/i);
    });

    it("GET /api/auth/seller/check should reject tokens declaring non-seller role (role: 'user')", async () => {
      const { token: userToken } = await createTestUser({ email: "buyer_for_seller_chk@example.com" });

      const res = await request(app)
        .get("/api/auth/seller/check")
        .set("Cookie", [`token=${userToken}`]);

      expect(res.statusCode).toBe(200);
      expect(res.body.authenticated).toBe(false);
      expect(res.body.message).toMatch(/Seller privileges required|Seller not found/i);
    });

    it("GET /api/auth/seller/check should respect dual cookie precedence (sellerToken takes priority)", async () => {
      const { token: buyerToken } = await createTestUser({ email: "buyer_dual@example.com" });
      const { seller, token: sellerToken } = await createTestSeller({ email: "seller_dual@example.com" });

      const res = await request(app)
        .get("/api/auth/seller/check")
        .set("Cookie", [`token=${buyerToken}`, `sellerToken=${sellerToken}`]);

      expect(res.statusCode).toBe(200);
      expect(res.body.authenticated).toBe(true);
      expect(res.body.user.email).toBe(seller.email);
    });

    it("GET /api/auth/seller/check should authenticate via Bearer header", async () => {
      const { seller, token: sellerToken } = await createTestSeller({ email: "seller_bearer@example.com" });

      const res = await request(app)
        .get("/api/auth/seller/check")
        .set("Authorization", `Bearer ${sellerToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.authenticated).toBe(true);
      expect(res.body.user.email).toBe(seller.email);
    });

    it("GET /api/auth/seller/check should reject suspended seller with 403 and clear cookies", async () => {
      const { token: sellerToken } = await createTestSeller({
        email: "suspended_seller@example.com",
        status: "Suspended",
      });

      const res = await request(app)
        .get("/api/auth/seller/check")
        .set("Cookie", [`sellerToken=${sellerToken}`]);

      expect(res.statusCode).toBe(403);
      expect(res.body.authenticated).toBe(false);
      expect(res.body.status).toBe("Suspended");

      const cookies = res.headers["set-cookie"] || [];
      expect(cookies.some((c) => c.startsWith("sellerToken=;") || c.includes("sellerToken=;"))).toBe(true);
    });

    it("GET /api/auth/seller/checkUser should authenticate seller and reject unauthenticated or buyer requests", async () => {
      const { seller, token: sellerToken } = await createTestSeller({ email: "checkuser_seller@example.com" });
      const { token: buyerToken } = await createTestUser({ email: "checkuser_buyer@example.com" });

      // 1. Unauthenticated request -> 401
      const resUnauth = await request(app).get("/api/auth/seller/checkUser");
      expect(resUnauth.statusCode).toBe(401);

      // 2. Buyer request -> 404 (buyer not in SellerModel)
      const resBuyer = await request(app)
        .get("/api/auth/seller/checkUser")
        .set("Cookie", [`token=${buyerToken}`]);
      expect(resBuyer.statusCode).toBe(404);

      // 3. Authenticated seller -> 200
      const resSeller = await request(app)
        .get("/api/auth/seller/checkUser")
        .set("Cookie", [`sellerToken=${sellerToken}`]);
      expect(resSeller.statusCode).toBe(200);
      expect(resSeller.body.email).toBe(seller.email);
    });

    it("GET /api/auth/seller/get-amount and PATCH /api/auth/seller/update-amount should enforce authentication, seller role and IDOR protection", async () => {
      const csrf = createCsrfCredentials();
      const { seller: sellerA, token: tokenA } = await createTestSeller({
        email: "payment_seller_a@example.com",
        amount: 500,
      });
      const { seller: sellerB } = await createTestSeller({
        email: "payment_seller_b@example.com",
        amount: 1000,
      });
      const { token: buyerToken } = await createTestUser({ email: "buyer_payment@example.com" });

      // 1. Unauthenticated GET -> 401
      const resUnauth = await request(app).get("/api/auth/seller/get-amount");
      expect(resUnauth.statusCode).toBe(401);

      // 2. Buyer GET -> 403 (Seller privileges required)
      const resBuyer = await request(app)
        .get("/api/auth/seller/get-amount")
        .set("Cookie", [`token=${buyerToken}`]);
      expect(resBuyer.statusCode).toBe(403);

      // 3. Seller A gets own balance -> 200
      const resSellerA = await request(app)
        .get("/api/auth/seller/get-amount")
        .set("Cookie", [`sellerToken=${tokenA}`]);
      expect(resSellerA.statusCode).toBe(200);
      expect(resSellerA.body.amount).toBe(500);

      // 4. Seller A attempts IDOR query on Seller B's balance -> 403
      const resIdorGet = await request(app)
        .get(`/api/auth/seller/get-amount?email=${sellerB.email}`)
        .set("Cookie", [`sellerToken=${tokenA}`]);
      expect(resIdorGet.statusCode).toBe(403);
      expect(resIdorGet.body.error).toMatch(/Forbidden/i);

      // 5. Seller A attempts IDOR update on Seller B's balance -> 403
      const resIdorPatch = await request(app)
        .patch("/api/auth/seller/update-amount")
        .set("Cookie", [csrf.cookie, `sellerToken=${tokenA}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ email: sellerB.email, amount: 9999 });
      expect(resIdorPatch.statusCode).toBe(403);
      expect(resIdorPatch.body.error).toMatch(/Forbidden/i);

      // Verify Seller B's amount was not changed
      const sellerBRecord = await Seller.findById(sellerB._id);
      expect(sellerBRecord.amount).toBe(1000);

      // 6. Seller A updates own balance -> 200
      const resUpdateOwn = await request(app)
        .patch("/api/auth/seller/update-amount")
        .set("Cookie", [csrf.cookie, `sellerToken=${tokenA}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ email: sellerA.email, amount: 750 });
      expect(resUpdateOwn.statusCode).toBe(200);
      expect(resUpdateOwn.body.data.amount).toBe(750);
    });
  });
});
