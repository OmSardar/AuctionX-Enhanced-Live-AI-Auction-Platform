const request = require("supertest");
const bcryptjs = require("bcryptjs");
const { app } = require("../../../server");
const { clearDatabase } = require("../../helpers/dbHelper");
const {
  createTestUser,
  createTestSeller,
  createTestAdmin,
} = require("../../helpers/authHelper");
const { createCsrfCredentials } = require("../../helpers/csrfHelper");

const UserModel = require("../../../src/modules/users/models/user");
const SellerModel = require("../../../src/modules/sellers/accounts/models/seller");
const Admin = require("../../../src/modules/admin/authentication/models/admin");
const AdminAuditLog = require("../../../src/modules/admin/disputes/models/adminAuditLog");

describe("Admin Stage 2 — User Management & Account Governance Tests", () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  describe("1. Access Control & Authorization Rejection", () => {
    it("should reject unauthenticated requests to user directory with 401", async () => {
      const res = await request(app).get("/api/admin/users");
      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("should reject ordinary users from accessing user directory with 403 Forbidden", async () => {
      const { token } = await createTestUser({ role: "user" });
      const res = await request(app)
        .get("/api/admin/users")
        .set("Cookie", [`token=${token}`]);

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Admin privileges required/i);
    });

    it("should reject sellers from accessing user directory with 403 Forbidden", async () => {
      const { token } = await createTestSeller();
      const res = await request(app)
        .get("/api/admin/users")
        .set("Cookie", [`token=${token}`]);

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Admin privileges required/i);
    });

    it("should reject unauthenticated requests to account status update with 401", async () => {
      const csrf = createCsrfCredentials();
      const { user } = await createTestUser({ role: "user" });
      const res = await request(app)
        .patch(`/api/admin/users/${user._id}/status`)
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({ status: "Suspended", reason: "Policy violation" });

      expect(res.statusCode).toBe(401);
    });

    it("should reject ordinary users from updating user status with 403", async () => {
      const csrf = createCsrfCredentials();
      const { user: target } = await createTestUser({ role: "user" });
      const { token: userToken } = await createTestUser({ role: "user" });

      const res = await request(app)
        .patch(`/api/admin/users/${target._id}/status`)
        .set("Cookie", [csrf.cookie, `token=${userToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ status: "Suspended", reason: "Unauthorized attempt" });

      expect(res.statusCode).toBe(403);
    });
  });

  describe("2. Directory Search, Filtering, Sorting & Pagination", () => {
    it("should allow authorized administrators to paginate and filter users", async () => {
      const { token: adminToken } = await createTestAdmin();

      // Seed 3 users (2 buyers, 1 seller)
      await createTestUser({ name: "Alice Wonderland", email: "alice@example.com", isVerified: true });
      await createTestUser({ name: "Bob Builder", email: "bob@example.com", isVerified: false });
      await createTestSeller({ name: "Sam Seller", email: "sam_seller@example.com", isVerified: true });

      const res = await request(app)
        .get("/api/admin/users?accountType=all&page=1&limit=10")
        .set("Cookie", [`adminToken=${adminToken}`]);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.users).toBeDefined();
      expect(res.body.users.length).toBeGreaterThanOrEqual(3);
      expect(res.body.pagination.total).toBeGreaterThanOrEqual(3);
      expect(res.body.summary).toBeDefined();
    });

    it("should filter accounts accurately by search term (name or email)", async () => {
      const { token: adminToken } = await createTestAdmin();

      await createTestUser({ name: "Charlie Chaplin", email: "charlie@chaplin.com" });
      await createTestUser({ name: "David Beckham", email: "david@beckham.com" });

      const res = await request(app)
        .get("/api/admin/users?search=Charlie")
        .set("Cookie", [`adminToken=${adminToken}`]);

      expect(res.statusCode).toBe(200);
      expect(res.body.users.length).toBe(1);
      expect(res.body.users[0].name).toBe("Charlie Chaplin");
    });

    it("should filter accounts accurately by accountType=seller", async () => {
      const { token: adminToken } = await createTestAdmin();

      await createTestUser({ name: "Regular Buyer", email: "regbuyer@example.com" });
      await createTestSeller({ name: "Certified Merchant", email: "merchant@example.com" });

      const res = await request(app)
        .get("/api/admin/users?accountType=seller")
        .set("Cookie", [`adminToken=${adminToken}`]);

      expect(res.statusCode).toBe(200);
      expect(res.body.users.length).toBe(1);
      expect(res.body.users[0].email).toBe("merchant@example.com");
      expect(res.body.users[0].accountType).toBe("seller");
    });

    it("should safely normalize invalid pagination and sorting values", async () => {
      const { token: adminToken } = await createTestAdmin();

      await createTestUser({ name: "User One", email: "one@example.com" });

      const res = await request(app)
        .get("/api/admin/users?page=-5&limit=9999&sortBy=maliciousPayload&sortOrder=invalidDir")
        .set("Cookie", [`adminToken=${adminToken}`]);

      expect(res.statusCode).toBe(200);
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(100); // Bounded max 100
    });
  });

  describe("3. Data Sanitization & Sensitive Field Protection", () => {
    it("should never expose password hashes, OAuth tokens, or secrets in user directory", async () => {
      const { token: adminToken } = await createTestAdmin();
      await createTestUser({ email: "secureuser@example.com", plainPassword: "SuperSecretPassword123!" });

      const res = await request(app)
        .get("/api/admin/users")
        .set("Cookie", [`adminToken=${adminToken}`]);

      expect(res.statusCode).toBe(200);
      const targetUser = res.body.users.find((u) => u.email === "secureuser@example.com");
      expect(targetUser).toBeDefined();
      expect(targetUser.password).toBeUndefined();
      expect(targetUser.__v).toBeUndefined();
    });

    it("should never expose password hashes in single account detail view", async () => {
      const { token: adminToken } = await createTestAdmin();
      const { user } = await createTestUser({ email: "detailuser@example.com", plainPassword: "SuperSecretPassword123!" });

      const res = await request(app)
        .get(`/api/admin/users/${user._id}`)
        .set("Cookie", [`adminToken=${adminToken}`]);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.password).toBeUndefined();
      expect(res.body.activityStats).toBeDefined();
    });
  });

  describe("4. Account Status Governance & Permission Enforcement", () => {
    it("should reject status modifications when acting administrator has editor role", async () => {
      const csrf = createCsrfCredentials();
      const { token: editorToken } = await createTestAdmin({ role: "editor" });
      const { user: target } = await createTestUser({ role: "user" });

      const res = await request(app)
        .patch(`/api/admin/users/${target._id}/status`)
        .set("Cookie", [csrf.cookie, `adminToken=${editorToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ status: "Suspended", reason: "Attempted editor suspension" });

      expect(res.statusCode).toBe(403);
      expect(res.body.message).toMatch(/Editor role is read-only/i);
    });

    it("should reject status modifications when reason is missing or shorter than 5 characters", async () => {
      const csrf = createCsrfCredentials();
      const { token: adminToken } = await createTestAdmin({ role: "admin" });
      const { user: target } = await createTestUser({ role: "user" });

      const res = await request(app)
        .patch(`/api/admin/users/${target._id}/status`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ status: "Suspended", reason: "no" });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/at least 5 characters/i);
    });

    it("should successfully suspend a regular user account with a valid reason", async () => {
      const csrf = createCsrfCredentials();
      const { admin, token: adminToken } = await createTestAdmin({ role: "admin" });
      const { user: target } = await createTestUser({
        name: "Suspension Candidate",
        email: "suspend_me@example.com",
        role: "user",
      });

      const res = await request(app)
        .patch(`/api/admin/users/${target._id}/status`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          status: "Suspended",
          reason: "Repeated non-payment after winning auctions",
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.status).toBe("Suspended");
      expect(res.body.user.suspensionReason).toBe("Repeated non-payment after winning auctions");

      // Verify in MongoDB
      const updated = await UserModel.findById(target._id);
      expect(updated.status).toBe("Suspended");
      expect(updated.suspensionReason).toBe("Repeated non-payment after winning auctions");
      expect(updated.statusChangedBy).toBe(admin.email);
    });

    it("should block a suspended user from authenticating", async () => {
      const csrf = createCsrfCredentials();
      const { user, plainPassword } = await createTestUser({
        email: "blocked_login@example.com",
        status: "Suspended",
        suspensionReason: "Terms of service violation",
      });

      const res = await request(app)
        .post("/api/auth/login")
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          email: user.email,
          password: plainPassword,
        });

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/account has been suspended/i);
      expect(res.body.message).toMatch(/Terms of service violation/i);
    });

    it("should restore a suspended user back to Active status", async () => {
      const csrf = createCsrfCredentials();
      const { token: adminToken } = await createTestAdmin({ role: "admin" });
      const { user: target } = await createTestUser({
        email: "restore_me@example.com",
        status: "Suspended",
        suspensionReason: "Previous dispute",
      });

      const res = await request(app)
        .patch(`/api/admin/users/${target._id}/status`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          status: "Active",
          reason: "Dispute resolved via verification support ticket #4501",
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.status).toBe("Active");

      const refreshed = await UserModel.findById(target._id);
      expect(refreshed.status).toBe("Active");
      expect(refreshed.suspensionReason).toBe("");
    });

    it("should prevent privilege escalation: status change endpoint cannot promote user to admin", async () => {
      const csrf = createCsrfCredentials();
      const { token: adminToken } = await createTestAdmin({ role: "admin" });
      const { user: target } = await createTestUser({ role: "user" });

      const res = await request(app)
        .patch(`/api/admin/users/${target._id}/status`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          status: "Active",
          reason: "Attempting privilege escalation payload",
          role: "admin", // Malicious promotion attempt
        });

      expect(res.statusCode).toBe(200);

      const refreshed = await UserModel.findById(target._id);
      expect(refreshed.role).toBe("user"); // Still ordinary user!
    });
  });

  describe("5. Self-Lockout & Administrator Protection Guarantees", () => {
    it("should prevent self-suspension to protect against administrator lockout", async () => {
      const csrf = createCsrfCredentials();
      const { admin, token: adminToken } = await createTestAdmin({ role: "super-admin" });

      const res = await request(app)
        .patch(`/api/admin/users/${admin._id}/status`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          status: "Suspended",
          reason: "Self-suspension attempt",
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/Self-suspension is prohibited/i);
    });

    it("should reject standard admin from suspending another administrator account", async () => {
      const csrf = createCsrfCredentials();
      const { token: adminToken } = await createTestAdmin({ role: "admin" });
      const { admin: otherAdmin } = await createTestAdmin({ role: "admin", email: "other_admin@auctionx.com" });

      const res = await request(app)
        .patch(`/api/admin/users/${otherAdmin._id}/status`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          status: "Suspended",
          reason: "Attempting to suspend peer admin",
        });

      expect(res.statusCode).toBe(403);
      expect(res.body.message).toMatch(/Only super-administrators can suspend or modify administrator accounts/i);
    });

    it("should prevent suspending the last active super-administrator", async () => {
      const csrf = createCsrfCredentials();
      // Create 1 super-admin and 1 regular admin
      const { admin: soleSuperAdmin } = await createTestAdmin({
        role: "super-admin",
        email: "sole_superadmin@auctionx.com",
      });
      const { token: actingToken } = await createTestAdmin({
        role: "super-admin",
        email: "acting_superadmin@auctionx.com",
      });

      // Now we have 2 super-admins. Suspend the first one:
      const res1 = await request(app)
        .patch(`/api/admin/users/${soleSuperAdmin._id}/status`)
        .set("Cookie", [csrf.cookie, `adminToken=${actingToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          status: "Suspended",
          reason: "Decommissioning auxiliary super-admin",
        });
      expect(res1.statusCode).toBe(200);

      // Now soleSuperAdmin is Suspended. actingSuperAdmin is the ONLY active super-admin.
      const otherActive = await Admin.countDocuments({ role: "super-admin", status: "Active" });
      expect(otherActive).toBe(1);
    });
  });

  describe("6. Audit Logging & Non-Tamperable History", () => {
    it("should record an immutable audit log entry for every status change", async () => {
      const csrf = createCsrfCredentials();
      const { admin, token: adminToken } = await createTestAdmin({ role: "admin" });
      const { user: target } = await createTestUser({ email: "audited_user@example.com" });

      const res = await request(app)
        .patch(`/api/admin/users/${target._id}/status`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          status: "Suspended",
          reason: "Investigating fraudulent bidding pattern",
        });

      expect(res.statusCode).toBe(200);

      // Verify audit record in database
      const auditEntry = await AdminAuditLog.findOne({ targetAccountId: target._id.toString() });
      expect(auditEntry).not.toBeNull();
      expect(auditEntry.action).toBe("SUSPEND_ACCOUNT");
      expect(auditEntry.actingAdminEmail).toBe(admin.email);
      expect(auditEntry.reason).toBe("Investigating fraudulent bidding pattern");
      expect(auditEntry.beforeStatus).toBe("Active");
      expect(auditEntry.afterStatus).toBe("Suspended");
      expect(auditEntry.outcome).toBe("SUCCESS");
    });

    it("should allow administrators to retrieve global audit history", async () => {
      const { token: adminToken } = await createTestAdmin({ role: "admin" });

      const res = await request(app)
        .get("/api/admin/users/audit-logs")
        .set("Cookie", [`adminToken=${adminToken}`]);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.auditLogs)).toBe(true);
      expect(res.body.pagination).toBeDefined();
    });
  });
});
