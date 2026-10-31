const request = require("supertest");
const { app } = require("../../../server");
const { clearDatabase } = require("../../helpers/dbHelper");
const {
  createTestUser,
  createTestSeller,
  createTestAdmin,
} = require("../../helpers/authHelper");
const { createCsrfCredentials } = require("../../helpers/csrfHelper");
const configureGoogleStrategy = require("../../../src/infrastructure/security/passportGoogleStrategy");

const UserModel = require("../../../src/modules/users/models/user");
const SellerModel = require("../../../src/modules/sellers/accounts/models/seller");
const Admin = require("../../../src/modules/admin/authentication/models/admin");
const AdminAuditLog = require("../../../src/modules/admin/disputes/models/adminAuditLog");
const Product = require("../../../src/modules/products/models/productSchema");

describe("Admin Stage 2.1 — Audit Reliability & Suspension Enforcement Tests", () => {
  beforeEach(async () => {
    await clearDatabase();
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("1. Audit Reliability & Compensating Rollback", () => {
    it("should abort status change and leave target account untouched if audit intent fails", async () => {
      const csrf = createCsrfCredentials();
      const { admin, token: adminToken } = await createTestAdmin({ role: "super-admin" });
      const { user: target } = await createTestUser({ role: "user" });

      // Spy on AdminAuditLog save and force intent creation to fail
      const saveSpy = jest
        .spyOn(AdminAuditLog.prototype, "save")
        .mockRejectedValueOnce(new Error("Database connection lost during audit intent"));

      const res = await request(app)
        .patch(`/api/admin/users/${target._id}/status`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ status: "Suspended", reason: "Attempted violation" });

      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Failed to initialize administrative audit record/i);

      // Verify target user was NOT suspended in database
      const refreshedTarget = await UserModel.findById(target._id);
      expect(refreshedTarget.status).toBe("Active");
      expect(refreshedTarget.suspensionReason).toBe("");
    });

    it("should execute compensating rollback when audit finalization fails", async () => {
      const csrf = createCsrfCredentials();
      const { admin, token: adminToken } = await createTestAdmin({ role: "super-admin" });
      const { user: target } = await createTestUser({ role: "user" });

      // Spy on save: 1st save (audit intent PENDING) succeeds. 2nd save (target document update) succeeds.
      // 3rd save (audit finalization to SUCCESS) fails!
      let auditSaveCallCount = 0;
      const originalSave = AdminAuditLog.prototype.save;
      jest.spyOn(AdminAuditLog.prototype, "save").mockImplementation(function () {
        auditSaveCallCount++;
        if (auditSaveCallCount === 1) {
          // Intent save succeeds
          return originalSave.apply(this, arguments);
        } else if (auditSaveCallCount === 2) {
          // Finalize save fails!
          return Promise.reject(new Error("Audit disk commit failure"));
        } else {
          // Rollback status save succeeds
          return originalSave.apply(this, arguments);
        }
      });

      const res = await request(app)
        .patch(`/api/admin/users/${target._id}/status`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ status: "Suspended", reason: "Policy breach test" });

      // Must NOT return 200 success without a committed audit log
      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/audit trail could not be committed/i);

      // Verify compensating rollback: target account must be restored to Active
      const refreshedTarget = await UserModel.findById(target._id);
      expect(refreshedTarget.status).toBe("Active");
      expect(refreshedTarget.statusChangedBy).toMatch(/ROLLBACK/i);

      // Verify audit log outcome is ROLLED_BACK
      const auditRecord = await AdminAuditLog.findOne({ targetAccountId: target._id.toString() });
      expect(auditRecord).toBeTruthy();
      expect(auditRecord.outcome).toBe("ROLLED_BACK");
      expect(auditRecord.failureReason).toMatch(/Audit finalization failed/i);
    });

    it("should handle idempotent retries without creating misleading duplicate audit records", async () => {
      const csrf = createCsrfCredentials();
      const { admin, token: adminToken } = await createTestAdmin({ role: "super-admin" });
      const { user: target } = await createTestUser({ role: "user" });
      const customIdempotencyKey = "idemp_test_op_987654";

      // First attempt
      const res1 = await request(app)
        .patch(`/api/admin/users/${target._id}/status`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          status: "Suspended",
          reason: "Terms violation repeated",
          idempotencyKey: customIdempotencyKey,
        });

      expect(res1.statusCode).toBe(200);
      expect(res1.body.success).toBe(true);
      expect(res1.body.user.status).toBe("Suspended");
      expect(res1.body.auditLog.outcome).toBe("SUCCESS");

      // Retry identical request
      const res2 = await request(app)
        .patch(`/api/admin/users/${target._id}/status`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          status: "Suspended",
          reason: "Terms violation repeated",
          idempotencyKey: customIdempotencyKey,
        });

      expect(res2.statusCode).toBe(200);
      expect(res2.body.success).toBe(true);
      expect(res2.body.isReplay).toBe(true);
      expect(res2.body.user.status).toBe("Suspended");

      // Verify only ONE audit record exists
      const auditCount = await AdminAuditLog.countDocuments({ idempotencyKey: customIdempotencyKey });
      expect(auditCount).toBe(1);

      const totalTargetAudits = await AdminAuditLog.countDocuments({
        targetAccountId: target._id.toString(),
      });
      expect(totalTargetAudits).toBe(1);
    });
  });

  describe("2. Google OAuth Suspension Enforcement", () => {
    it("should block suspended user from authenticating through Google OAuth profile verification", async () => {
      const { user: target } = await createTestUser({
        email: "suspended.oauth@example.com",
        status: "Suspended",
        suspensionReason: "Fraudulent bidding pattern",
      });

      const mockProfile = {
        displayName: "Suspended Google User",
        emails: [{ value: "suspended.oauth@example.com" }],
        photos: [{ value: "https://lh3.googleusercontent.com/testphoto" }],
      };

      let errorResult = null;
      let userResult = null;

      await configureGoogleStrategy.verifyGoogleProfile(
        "mockAccessToken",
        "mockRefreshToken",
        mockProfile,
        (err, user) => {
          errorResult = err;
          userResult = user;
        }
      );

      expect(errorResult).toBeTruthy();
      expect(errorResult.status).toBe(403);
      expect(errorResult.message).toMatch(/Account has been suspended/i);
      expect(errorResult.suspensionReason).toBe("Fraudulent bidding pattern");
      expect(userResult).toBeFalsy();
    });

    it("should block suspended seller from authenticating through Google OAuth", async () => {
      const { seller } = await createTestSeller({
        email: "suspended.seller.oauth@example.com",
        status: "Suspended",
        suspensionReason: "Counterfeit merchandise listing",
      });

      const mockProfile = {
        displayName: "Suspended Seller",
        emails: [{ value: "suspended.seller.oauth@example.com" }],
        photos: [{ value: "https://lh3.googleusercontent.com/sellerphoto" }],
      };

      let errorResult = null;
      let userResult = null;

      await configureGoogleStrategy.verifyGoogleProfile(
        "mockAccessToken",
        "mockRefreshToken",
        mockProfile,
        (err, user) => {
          errorResult = err;
          userResult = user;
        }
      );

      expect(errorResult).toBeTruthy();
      expect(errorResult.status).toBe(403);
      expect(errorResult.message).toMatch(/Account has been suspended/i);
      expect(errorResult.suspensionReason).toBe("Counterfeit merchandise listing");
      expect(userResult).toBeFalsy();
    });

    it("should allow active user to authenticate through Google OAuth profile verification", async () => {
      const { user: target } = await createTestUser({
        email: "active.oauth@example.com",
        status: "Active",
      });

      const mockProfile = {
        displayName: "Active Google User",
        emails: [{ value: "active.oauth@example.com" }],
        photos: [{ value: "https://lh3.googleusercontent.com/activephoto" }],
      };

      let errorResult = null;
      let payloadResult = null;

      await configureGoogleStrategy.verifyGoogleProfile(
        "mockAccessToken",
        "mockRefreshToken",
        mockProfile,
        (err, payload) => {
          errorResult = err;
          payloadResult = payload;
        }
      );

      expect(errorResult).toBeNull();
      expect(payloadResult).toBeTruthy();
      expect(payloadResult.token).toBeTruthy();
      expect(payloadResult.user.email).toBe("active.oauth@example.com");
    });
  });

  describe("3. Existing Session Invalidation & Boundary Enforcement", () => {
    it("should reject suspended user with pre-existing session token on /api/auth/check and clear cookie", async () => {
      const { user, token } = await createTestUser({ role: "user" });

      // Pre-check: active user is authenticated
      const activeRes = await request(app)
        .get("/api/auth/check")
        .set("Cookie", [`token=${token}`]);
      expect(activeRes.statusCode).toBe(200);
      expect(activeRes.body.authenticated).toBe(true);

      // Admin suspends user
      await UserModel.findByIdAndUpdate(user._id, {
        status: "Suspended",
        suspensionReason: "Payment chargeback dispute",
      });

      // Suspended user attempts to use existing session token
      const suspendedRes = await request(app)
        .get("/api/auth/check")
        .set("Cookie", [`token=${token}`]);

      expect(suspendedRes.statusCode).toBe(403);
      expect(suspendedRes.body.authenticated).toBe(false);
      expect(suspendedRes.body.status).toBe("Suspended");
      expect(suspendedRes.body.reason).toMatch(/Payment chargeback dispute/);

      // Verify session cookie was cleared
      const setCookie = suspendedRes.headers["set-cookie"];
      expect(setCookie).toBeTruthy();
      const cookieStr = Array.isArray(setCookie) ? setCookie.join("; ") : setCookie;
      expect(cookieStr).toMatch(/token=;/);
    });

    it("should reject suspended user on protected profile routes", async () => {
      const csrf = createCsrfCredentials();
      const { user, token } = await createTestUser({
        role: "user",
        status: "Suspended",
        suspensionReason: "Account locked by administrator",
      });

      const res = await request(app)
        .patch(`/api/auth/updateUserProfile/${encodeURIComponent(user.email)}`)
        .set("Cookie", [csrf.cookie, `token=${token}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ name: "Attempted Name Change" });

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.status).toBe("Suspended");
      expect(res.body.message).toMatch(/Account has been suspended/);
    });

    it("should reject suspended seller with pre-existing session on /api/auth/seller/check", async () => {
      const { seller, token } = await createTestSeller();

      // Pre-check: active seller is authenticated
      const activeRes = await request(app)
        .get("/api/auth/seller/check")
        .set("Cookie", [`token=${token}`]);
      expect(activeRes.statusCode).toBe(200);
      expect(activeRes.body.authenticated).toBe(true);

      // Admin suspends seller
      await SellerModel.findByIdAndUpdate(seller._id, {
        status: "Suspended",
        suspensionReason: "Unfulfilled buyer orders",
      });

      // Suspended seller attempts to use session
      const suspendedRes = await request(app)
        .get("/api/auth/seller/check")
        .set("Cookie", [`token=${token}`]);

      expect(suspendedRes.statusCode).toBe(403);
      expect(suspendedRes.body.authenticated).toBe(false);
      expect(suspendedRes.body.status).toBe("Suspended");
      expect(suspendedRes.body.reason).toMatch(/Unfulfilled buyer orders/);
    });

    it("should reject suspended seller when attempting to create a product listing", async () => {
      const csrf = createCsrfCredentials();
      const { seller, token } = await createTestSeller({
        status: "Suspended",
        suspensionReason: "Seller suspended for counterfeit items",
      });

      const res = await request(app)
        .post("/api/products")
        .set("Cookie", [csrf.cookie, `token=${token}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          productName: "Prohibited Item",
          biddingStartPrice: 100,
        });

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.status).toBe("Suspended");
      expect(res.body.message).toMatch(/Account has been suspended/);
    });

    it("should reject suspended administrator on admin endpoints", async () => {
      const { admin, token } = await createTestAdmin({
        role: "admin",
        status: "Suspended",
        suspensionReason: "Unauthorized administrative activity",
      });

      const res = await request(app)
        .get("/api/admin/users")
        .set("Cookie", [`adminToken=${token}`]);

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Administrator account has been suspended/i);
    });

    it("should reject suspended user from placing bids via API", async () => {
      const csrf = createCsrfCredentials();
      const { user, token } = await createTestUser({
        status: "Suspended",
        suspensionReason: "Bid shilling detected",
      });

      // Create valid product
      const product = await Product.create({
        name: "Test Antique Clock",
        description: [{ name: "Condition", description: "Mint condition" }],
        email: "seller@example.com",
        category: "Collectibles",
        images: [{ secure_url: "https://example.com/clock.jpg", public_id: "clock1" }],
        mobileNumber: "1234567890",
        biddingStartDate: new Date(Date.now() - 3600000),
        biddingStartTime: "10:00",
        biddingEndTime: "18:00",
        biddingStartPrice: 50,
        currentPrice: 50,
        status: "Active",
      });

      const res = await request(app)
        .post(`/api/products/${product._id}/bid`)
        .set("Cookie", [csrf.cookie, `token=${token}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ amount: 60 });

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.status).toBe("Suspended");
    });
  });

  describe("4. Non-Destructive Status Updates & Boundary Invariants", () => {
    it("should preserve user role, profilePic, googlePhoto, and selectedAvatar across status changes", async () => {
      const csrf = createCsrfCredentials();
      const { admin, token: adminToken } = await createTestAdmin({ role: "super-admin" });
      const { user: target } = await createTestUser({
        role: "user",
        profilePic: [{ secure_url: "https://res.cloudinary.com/test/avatar.jpg", public_id: "avatar1" }],
        googlePhoto: "https://lh3.googleusercontent.com/original-google-photo",
        selectedAvatar: "https://res.cloudinary.com/test/avatar.jpg",
        isVerified: true,
      });

      // Suspend
      const suspendRes = await request(app)
        .patch(`/api/admin/users/${target._id}/status`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ status: "Suspended", reason: "Temporary audit hold" });

      expect(suspendRes.statusCode).toBe(200);

      const suspendedDoc = await UserModel.findById(target._id);
      expect(suspendedDoc.status).toBe("Suspended");
      expect(suspendedDoc.role).toBe("user"); // Role not changed
      expect(suspendedDoc.googlePhoto).toBe("https://lh3.googleusercontent.com/original-google-photo");
      expect(suspendedDoc.selectedAvatar).toBe("https://res.cloudinary.com/test/avatar.jpg");
      expect(suspendedDoc.profilePic[0].secure_url).toBe("https://res.cloudinary.com/test/avatar.jpg");
      expect(suspendedDoc.isVerified).toBe(true);

      // Restore
      const restoreRes = await request(app)
        .patch(`/api/admin/users/${target._id}/status`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ status: "Active", reason: "Audit hold resolved successfully" });

      expect(restoreRes.statusCode).toBe(200);

      const restoredDoc = await UserModel.findById(target._id);
      expect(restoredDoc.status).toBe("Active");
      expect(restoredDoc.role).toBe("user");
      expect(restoredDoc.googlePhoto).toBe("https://lh3.googleusercontent.com/original-google-photo");
      expect(restoredDoc.selectedAvatar).toBe("https://res.cloudinary.com/test/avatar.jpg");
      expect(restoredDoc.isVerified).toBe(true);
    });

    it("should allow unauthenticated public discovery and browsing without blocking", async () => {
      // Unrelated public endpoints must remain publicly accessible
      const res = await request(app).get("/api/products");
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.products || res.body)).toBe(true);
    });
  });
});
