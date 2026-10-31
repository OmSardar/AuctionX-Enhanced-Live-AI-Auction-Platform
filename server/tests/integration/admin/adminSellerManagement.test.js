const request = require("supertest");
const mongoose = require("mongoose");
const { app } = require("../../../server");
const { createTestAdmin } = require("../../helpers/authHelper");
const { createCsrfCredentials } = require("../../helpers/csrfHelper");
const AdminSeller = require("../../../src/modules/admin/sellers/models/adminSeller");
const Admin = require("../../../src/modules/admin/authentication/models/admin");

describe("Admin Seller Management Integration Tests", () => {
  let adminToken;
  let testAdmin;
  let csrf;

  beforeAll(async () => {
    csrf = createCsrfCredentials();
    const adminObj = await createTestAdmin();
    testAdmin = adminObj.admin;
    adminToken = adminObj.token;
  });

  beforeEach(async () => {
    await AdminSeller.deleteMany({});
  });

  afterAll(async () => {
    await AdminSeller.deleteMany({});
    if (testAdmin) {
      await Admin.findByIdAndDelete(testAdmin._id);
    }
  });

  describe("GET /api/sellers - List Sellers", () => {
    it("should reject unauthenticated requests", async () => {
      const res = await request(app)
        .get("/api/sellers")
        .set("Cookie", csrf.cookie)
        .set("x-csrf-token", csrf.token);

      expect(res.status).toBe(401);
    });

    it("should return empty list and correct status counts when no sellers exist", async () => {
      const res = await request(app)
        .get("/api/sellers")
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set("x-csrf-token", csrf.token);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.sellers).toEqual([]);
      expect(res.body.statusCounts.all).toBe(0);
    });

    it("should list sellers with pagination and filter by status", async () => {
      await AdminSeller.create([
        {
          name: "Seller One",
          email: "seller1@example.com",
          status: "active",
          businessName: "Shop One",
        },
        {
          name: "Seller Two",
          email: "seller2@example.com",
          status: "pending_approval",
          businessName: "Shop Two",
        },
      ]);

      const allRes = await request(app)
        .get("/api/sellers?page=1&limit=10")
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set("x-csrf-token", csrf.token);

      expect(allRes.status).toBe(200);
      expect(allRes.body.sellers.length).toBe(2);
      expect(allRes.body.statusCounts.all).toBe(2);
      expect(allRes.body.statusCounts.active).toBe(1);
      expect(allRes.body.statusCounts.pending_approval).toBe(1);

      const filteredRes = await request(app)
        .get("/api/sellers?status=active")
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set("x-csrf-token", csrf.token);

      expect(filteredRes.status).toBe(200);
      expect(filteredRes.body.sellers.length).toBe(1);
      expect(filteredRes.body.sellers[0].name).toBe("Seller One");
    });
  });

  describe("GET /api/sellers/stats - Seller Statistics", () => {
    it("should return seller stats aggregated by status", async () => {
      await AdminSeller.create([
        { name: "Active Seller", email: "act@example.com", status: "active" },
        { name: "Suspended Seller", email: "susp@example.com", status: "suspended" },
      ]);

      const res = await request(app)
        .get("/api/sellers/stats")
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set("x-csrf-token", csrf.token);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.statusCounts.all).toBe(2);
      expect(res.body.statusCounts.active).toBe(1);
      expect(res.body.statusCounts.suspended).toBe(1);
      expect(res.body.statusCounts.pending_approval).toBe(0);
    });
  });

  describe("GET /api/sellers/:id - Single Seller Details", () => {
    it("should return 400 for invalid ObjectId format", async () => {
      const res = await request(app)
        .get("/api/sellers/invalid-id-format")
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set("x-csrf-token", csrf.token);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Invalid seller ID format");
    });

    it("should return 404 for non-existent seller", async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get(`/api/sellers/${fakeId}`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set("x-csrf-token", csrf.token);

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("Seller not found");
    });

    it("should return seller details when found", async () => {
      const seller = await AdminSeller.create({
        name: "Detailed Seller",
        email: "details@example.com",
        businessName: "Detailed Goods",
        status: "active",
      });

      const res = await request(app)
        .get(`/api/sellers/${seller._id}`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set("x-csrf-token", csrf.token);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.seller.name).toBe("Detailed Seller");
    });
  });

  describe("PATCH /api/sellers/:id/status - Update Status", () => {
    it("should reject invalid status with 400", async () => {
      const seller = await AdminSeller.create({
        name: "Test",
        email: "statustest@example.com",
      });

      const res = await request(app)
        .patch(`/api/sellers/${seller._id}/status`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set("x-csrf-token", csrf.token)
        .send({ status: "bogus_status" });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Invalid status");
    });

    it("should successfully update seller status", async () => {
      const seller = await AdminSeller.create({
        name: "To Suspend",
        email: "suspend@example.com",
        status: "active",
      });

      const res = await request(app)
        .patch(`/api/sellers/${seller._id}/status`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set("x-csrf-token", csrf.token)
        .send({ status: "suspended" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.seller.status).toBe("suspended");

      const inDb = await AdminSeller.findById(seller._id);
      expect(inDb.status).toBe("suspended");
    });
  });

  describe("PATCH /api/sellers/:id/verify - Verify Seller", () => {
    it("should verify seller and automatically set status to active", async () => {
      const seller = await AdminSeller.create({
        name: "Pending Seller",
        email: "pending@example.com",
        status: "pending_approval",
        isVerified: false,
      });

      const res = await request(app)
        .patch(`/api/sellers/${seller._id}/verify`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set("x-csrf-token", csrf.token);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.seller.isVerified).toBe(true);
      expect(res.body.seller.status).toBe("active");

      const inDb = await AdminSeller.findById(seller._id);
      expect(inDb.isVerified).toBe(true);
      expect(inDb.status).toBe("active");
    });

    it("should return 404 when verifying non-existent seller", async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .patch(`/api/sellers/${fakeId}/verify`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set("x-csrf-token", csrf.token);

      expect(res.status).toBe(404);
    });
  });
});
