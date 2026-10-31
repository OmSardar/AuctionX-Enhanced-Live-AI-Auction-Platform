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

const User = require("../../../src/modules/users/models/user");
const Seller = require("../../../src/modules/sellers/accounts/models/seller");
const Admin = require("../../../src/modules/admin/authentication/models/admin");
const Product = require("../../../src/modules/products/models/productSchema");
const ReportAdmin = require("../../../src/modules/admin/moderation/models/reports");
const AdminSeller = require("../../../src/modules/admin/sellers/models/adminSeller");
const { bootstrapAdmin } = require("../../../scripts/administration/bootstrapAdmin");

describe("Admin Stage 1 — Secure Admin Foundation & Dashboard Tests", () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  describe("1. Admin API Authorization & Role Enforcement", () => {
    it("should reject unauthenticated requests to admin dashboard metrics with 401", async () => {
      const res = await request(app).get("/api/admin/dashboard/stats");

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Authentication required/i);
    });

    it("should reject authenticated ordinary users with 403 Forbidden", async () => {
      const { user, token } = await createTestUser({ role: "user" });

      const res = await request(app)
        .get("/api/admin/dashboard/stats")
        .set("Cookie", [`token=${token}`]);

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Admin privileges required/i);
    });

    it("should reject authenticated sellers with 403 Forbidden", async () => {
      const { seller, token } = await createTestSeller();

      const res = await request(app)
        .get("/api/admin/dashboard/stats")
        .set("Cookie", [`token=${token}`]);

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Admin privileges required/i);
    });

    it("should allow Admin collection users (adminToken) with 200 and telemetry data", async () => {
      const { admin, token } = await createTestAdmin();

      const res = await request(app)
        .get("/api/admin/dashboard/stats")
        .set("Cookie", [`adminToken=${token}`]);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.users).toBeDefined();
      expect(res.body.data.auctions).toBeDefined();
      expect(res.body.data.moderation).toBeDefined();
    });

    it("should allow User collection users with role='admin' with 200", async () => {
      const { user, token } = await createTestUser({ role: "admin" });

      const res = await request(app)
        .get("/api/admin/dashboard/stats")
        .set("Cookie", [`token=${token}`]);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });
  });

  describe("2. Privilege Escalation Prevention", () => {
    it("should ignore arbitrary role in registration payload and force role='user'", async () => {
      const csrf = createCsrfCredentials();
      const registrationPayload = {
        name: "Escalation Attacker",
        email: "attacker_reg@auctionx.com",
        password: "Password123!",
        role: "admin", // Malicious privilege escalation attempt
        isVerified: true,
      };

      const res = await request(app)
        .post("/api/auth/register")
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send(registrationPayload);

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);

      // Verify persisted document in MongoDB
      const persistedUser = await User.findOne({ email: registrationPayload.email });
      expect(persistedUser).not.toBeNull();
      expect(persistedUser.role).toBe("user"); // Must NOT be admin!
    });

    it("should prevent privilege escalation during profile updates", async () => {
      const csrf = createCsrfCredentials();
      const { user, token } = await createTestUser({ role: "user" });

      const updatePayload = {
        name: "Updated Hacker Name",
        role: "admin", // Malicious privilege escalation attempt
        address: "777 Exploit Ave",
      };

      const res = await request(app)
        .patch("/api/auth/updateProfile")
        .set("Cookie", [csrf.cookie, `token=${token}`])
        .set(csrf.headerName, csrf.headerValue)
        .send(updatePayload);

      expect(res.statusCode).toBe(200);

      const refreshedUser = await User.findById(user._id);
      expect(refreshedUser.role).toBe("user"); // Still ordinary user!
      expect(refreshedUser.name).toBe("Updated Hacker Name");
    });
  });

  describe("3. Real Dashboard Queries & Empty Collection Handling", () => {
    it("should return valid zero counts on empty collections without crashing", async () => {
      const { admin, token } = await createTestAdmin();

      const res = await request(app)
        .get("/api/admin/dashboard/stats")
        .set("Cookie", [`adminToken=${token}`]);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      const { users, auctions, moderation, activity } = res.body.data;

      expect(users.totalUsers).toBe(0);
      expect(users.totalSellers).toBe(0);
      expect(auctions.total).toBe(0);
      expect(auctions.active).toBe(0);
      expect(auctions.upcoming).toBe(0);
      expect(auctions.ended).toBe(0);
      expect(moderation.pendingReports).toBe(0);
      expect(moderation.pendingSellers).toBe(0);
      expect(Array.isArray(activity)).toBe(true);
      expect(activity.length).toBe(0);
    });

    it("should accurately reflect persisted test data across users, products, and moderation", async () => {
      const { admin, token } = await createTestAdmin();

      // Seed 2 Users (1 verified, 1 unverified)
      await User.create([
        {
          name: "Buyer One",
          email: "buyer1@auctionx.com",
          password: "hash",
          role: "user",
          isVerified: true,
        },
        {
          name: "Buyer Two",
          email: "buyer2@auctionx.com",
          password: "hash",
          role: "user",
          isVerified: false,
        },
      ]);

      // Seed 1 Seller
      await Seller.create({
        name: "Seller One",
        email: "seller1@auctionx.com",
        password: "hash",
        phoneNo: "9123456789",
        status: "Approved",
        isVerified: true,
      });

      // Seed Products with different statuses
      await Product.create([
        {
          name: "Vintage Camera",
          email: "seller1@auctionx.com",
          category: "electronics",
          mobileNumber: "9123456789",
          biddingStartDate: new Date(Date.now() - 3600000),
          biddingStartTime: "10:00",
          biddingEndTime: "18:00",
          biddingStartPrice: 100,
          description: [{ name: "Condition", description: "Good working condition" }],
          images: [{ secure_url: "https://example.com/cam.jpg", public_id: "cam_1" }],
          status: "Active",
          startTime: new Date(Date.now() - 3600000),
          endTime: new Date(Date.now() + 3600000),
        },
        {
          name: "Upcoming Rolex",
          email: "seller1@auctionx.com",
          category: "watches",
          mobileNumber: "9123456789",
          biddingStartDate: new Date(Date.now() + 7200000),
          biddingStartTime: "12:00",
          biddingEndTime: "20:00",
          biddingStartPrice: 5000,
          description: [{ name: "Box", description: "Original papers" }],
          images: [{ secure_url: "https://example.com/rolex.jpg", public_id: "rolex_1" }],
          status: "SCHEDULED",
          startTime: new Date(Date.now() + 7200000),
          endTime: new Date(Date.now() + 14400000),
        },
        {
          name: "Ended Painting",
          email: "seller1@auctionx.com",
          category: "art",
          mobileNumber: "9123456789",
          biddingStartDate: new Date(Date.now() - 7200000),
          biddingStartTime: "08:00",
          biddingEndTime: "16:00",
          biddingStartPrice: 250,
          description: [{ name: "Artist", description: "Oil on canvas" }],
          images: [{ secure_url: "https://example.com/paint.jpg", public_id: "paint_1" }],
          status: "ENDED",
          startTime: new Date(Date.now() - 7200000),
          endTime: new Date(Date.now() - 3600000),
        },
      ]);

      // Seed 1 Pending Report
      await ReportAdmin.create({
        userName: "Buyer One",
        userEmail: "buyer1@auctionx.com",
        reportType: "illegal",
        report: "Suspicious bid pattern observed on listing #42",
        status: "pending",
      });

      const res = await request(app)
        .get("/api/admin/dashboard/stats")
        .set("Cookie", [`adminToken=${token}`]);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);

      const { users, auctions, moderation, activity } = res.body.data;
      expect(users.totalUsers).toBe(2);
      expect(users.verifiedUsers).toBe(1);
      expect(users.totalSellers).toBe(1);

      expect(auctions.total).toBe(3);
      expect(auctions.active).toBe(1);
      expect(auctions.upcoming).toBe(1);
      expect(auctions.ended).toBe(1);

      expect(moderation.pendingReports).toBe(1);
      expect(activity.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("4. Administrator Provisioning Utility", () => {
    it("should safely provision an administrator into both Admin and User collections", async () => {
      const result = await bootstrapAdmin({
        email: "provisioned_admin@auctionx.com",
        password: "SuperSecretAdminPassword123!",
        name: "Security Admin",
        firstName: "Security",
        lastName: "Admin",
        role: "admin",
      });

      expect(result.success).toBe(true);
      expect(result.email).toBe("provisioned_admin@auctionx.com");

      // Verify Admin collection record
      const adminDoc = await Admin.findOne({ email: "provisioned_admin@auctionx.com" });
      expect(adminDoc).not.toBeNull();
      expect(adminDoc.role).toBe("admin");
      const isMatchAdmin = await bcryptjs.compare(
        "SuperSecretAdminPassword123!",
        adminDoc.password
      );
      expect(isMatchAdmin).toBe(true);

      // Verify User collection record
      const userDoc = await User.findOne({ email: "provisioned_admin@auctionx.com" });
      expect(userDoc).not.toBeNull();
      expect(userDoc.role).toBe("admin");
      expect(userDoc.isVerified).toBe(true);
      const isMatchUser = await bcryptjs.compare(
        "SuperSecretAdminPassword123!",
        userDoc.password
      );
      expect(isMatchUser).toBe(true);
    });

    it("should reject admin provisioning when password is fewer than 8 characters", async () => {
      await expect(
        bootstrapAdmin({
          email: "short_pw_admin@auctionx.com",
          password: "short",
        })
      ).rejects.toThrow(/at least 8 characters/i);
    });
  });
});
