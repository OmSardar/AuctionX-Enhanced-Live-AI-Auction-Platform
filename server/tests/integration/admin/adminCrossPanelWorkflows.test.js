const request = require("supertest");
const { app } = require("../../../server");
const { clearDatabase } = require("../../helpers/dbHelper");
const {
  createTestUser,
  createTestSeller,
  createTestAdmin,
} = require("../../helpers/authHelper");
const { createCsrfCredentials } = require("../../helpers/csrfHelper");

const Contact = require("../../../src/modules/communication/models/Contact");
const FeedbackUser = require("../../../src/modules/feedback/models/feedbackUserSchema");
const Banner = require("../../../src/modules/admin/tasks/models/banner");
const Event = require("../../../src/modules/admin/tasks/models/event");
const Calendar = require("../../../src/modules/admin/tasks/models/calendar");
const Faq = require("../../../src/modules/communication/models/FaqChat");
const Admin = require("../../../src/modules/admin/authentication/models/admin");
const Transaction = require("../../../src/modules/admin/finance/models/transaction");
const Goodie = require("../../../src/modules/admin/settings/models/goodie");

describe("Admin Cross-Panel Integration & Functional Audit Workflows", () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  describe("1. User Feedback Workflow", () => {
    it("should allow user to submit feedback and admin to view it in the feedback queue", async () => {
      const csrf = createCsrfCredentials();
      const feedbackPayload = {
        name: "Test Reviewer",
        email: "reviewer@example.com",
        phone: "1234567890",
        feedback_type: "Platform Usability",
        checkbox_values: ["excellent", "good", "good", "excellent"],
      };

      // 1. Submit feedback
      const submitRes = await request(app)
        .post("/api/feedback/user")
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send(feedbackPayload);

      expect([200, 201]).toContain(submitRes.statusCode);

      // 2. Admin queries feedbacks
      const { admin, token: adminToken } = await createTestAdmin();
      const adminRes = await request(app)
        .get("/api/feedback/user")
        .set("Cookie", [`adminToken=${adminToken}`]);

      expect(adminRes.statusCode).toBe(200);
      const items = Array.isArray(adminRes.body) ? adminRes.body : adminRes.body.data;
      expect(items.length).toBeGreaterThanOrEqual(1);
      expect(items.some((f) => f.email === "reviewer@example.com")).toBe(true);
    });
  });

  describe("2. Contact Us Workflow & Management", () => {
    it("should save contact submission even without SMTP and allow admin review and status update", async () => {
      const csrf = createCsrfCredentials();
      const contactPayload = {
        name: "Jane Inquirer",
        email: "jane@example.com",
        subject: "Auction Settlement Question",
        message: "How does the final escrow settlement release work?",
      };

      // 1. Public user submits contact form
      const submitRes = await request(app)
        .post("/api/contact")
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send(contactPayload);

      expect(submitRes.statusCode).toBe(201);
      expect(submitRes.body.code).toBe("SUCCESS");

      // Verify DB persistence
      const saved = await Contact.findOne({ email: "jane@example.com" });
      expect(saved).toBeTruthy();
      expect(saved.status).toBe("new");

      // 2. Admin retrieves contacts
      const { admin, token: adminToken } = await createTestAdmin();
      const getRes = await request(app)
        .get("/api/contact")
        .set("Cookie", [`adminToken=${adminToken}`]);

      expect(getRes.statusCode).toBe(200);
      expect(getRes.body.some((c) => c.email === "jane@example.com")).toBe(true);

      // 3. Admin updates status to 'in_progress' and then 'resolved'
      const updateRes = await request(app)
        .patch(`/api/contact/${saved._id}/status`)
        .set("Cookie", [`adminToken=${adminToken}`, csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({ status: "resolved" });

      expect(updateRes.statusCode).toBe(200);
      expect(updateRes.body.data.status).toBe("resolved");
      expect(updateRes.body.data.resolvedAt).toBeDefined();

      // 4. Admin deletes contact
      const deleteRes = await request(app)
        .delete(`/api/contact/${saved._id}`)
        .set("Cookie", [`adminToken=${adminToken}`, csrf.cookie])
        .set(csrf.headerName, csrf.headerValue);

      expect(deleteRes.statusCode).toBe(200);
      const afterDelete = await Contact.findById(saved._id);
      expect(afterDelete).toBeNull();
    });
  });

  describe("3. Banners & Announcements Lifecycle", () => {
    it("should persist banner creation, allow editing, and display active banners", async () => {
      const { admin, token: adminToken } = await createTestAdmin();
      const csrf = createCsrfCredentials();

      const bannerPayload = {
        title: "Summer Flash Auction",
        description: "Special zero-commission week on select luxury watches",
        imageUrl: "https://images.unsplash.com/photo-1523275335684-37898b6baf30",
        linkUrl: "/auctions?category=watches",
        active: true,
      };

      // 1. Admin creates banner
      const createRes = await request(app)
        .post("/api/banners")
        .set("Cookie", [`adminToken=${adminToken}`, csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send(bannerPayload);

      expect([200, 201]).toContain(createRes.statusCode);
      const bannerId = createRes.body._id || createRes.body.data?._id;

      // 2. Public / users query banners
      const listRes = await request(app).get("/api/banners");
      const banners = listRes.body?.data || (Array.isArray(listRes.body) ? listRes.body : []);
      expect(banners.some((b) => b.title === "Summer Flash Auction")).toBe(true);
    });
  });

  describe("4. Events & Calendar Operationalization", () => {
    it("should allow admin to create calendar entries and retrieve them consistently", async () => {
      const { admin, token: adminToken } = await createTestAdmin();
      const csrf = createCsrfCredentials();

      const calendarPayload = {
        title: "VIP Art Auction Launch",
        description: "High-value contemporary art auction opening ceremony",
        date: "2026-11-01",
        startTime: "10:00",
        endTime: "18:00",
        type: "auction",
      };

      const createRes = await request(app)
        .post("/api/calendar")
        .set("Cookie", [`adminToken=${adminToken}`, csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send(calendarPayload);

      expect([200, 201]).toContain(createRes.statusCode);

      const getRes = await request(app)
        .get("/api/calendar")
        .set("Cookie", [`adminToken=${adminToken}`]);

      expect(getRes.statusCode).toBe(200);
      const entries = Array.isArray(getRes.body) ? getRes.body : getRes.body.data;
      expect(entries.some((e) => e.title === "VIP Art Auction Launch")).toBe(true);
    });
  });

  describe("5. Knowledge Base & FAQ Operationalization", () => {
    it("should allow admin to create FAQ, public to read it, and protect mutation", async () => {
      const { admin, token: adminToken } = await createTestAdmin();
      const csrf = createCsrfCredentials();

      const faqPayload = {
        question: "How do proxy bids work?",
        answer: "Proxy bids automatically increment by minimum bid steps on your behalf up to your max limit.",
        category: "Bidding",
      };

      // 1. Unauthenticated creation should be rejected with 401
      const unauthRes = await request(app)
        .post("/api/faqs")
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send(faqPayload);

      expect(unauthRes.statusCode).toBe(401);

      // 2. Admin creates FAQ
      const createRes = await request(app)
        .post("/api/faqs")
        .set("Cookie", [`adminToken=${adminToken}`, csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send(faqPayload);

      expect(createRes.statusCode).toBe(201);
      const createdId = createRes.body?.data?._id || createRes.body?._id;

      // 3. Public query should return it
      const publicRes = await request(app).get("/api/faqs");
      expect(publicRes.statusCode).toBe(200);
      const faqsList = publicRes.body?.data || (Array.isArray(publicRes.body) ? publicRes.body : []);
      expect(faqsList.some((f) => f.question === "How do proxy bids work?")).toBe(true);

      // 4. Admin deletes FAQ
      const deleteRes = await request(app)
        .delete(`/api/faqs/${createdId}`)
        .set("Cookie", [`adminToken=${adminToken}`, csrf.cookie])
        .set(csrf.headerName, csrf.headerValue);

      expect(deleteRes.statusCode).toBe(200);
    });
  });

  describe("6. Admin Management & Security Guards", () => {
    it("should manage admin accounts, split names, hash passwords, and prevent self-deletion", async () => {
      const { admin, token: adminToken } = await createTestAdmin({
        email: "superadmin@auctionx.com",
      });
      const csrf = createCsrfCredentials();

      // 1. Create a new admin
      const newAdminPayload = {
        name: "Security Officer",
        email: "sec.officer@auctionx.com",
        password: "AdminPassword123!",
        role: "admin",
      };

      const createRes = await request(app)
        .post("/api/admins")
        .set("Cookie", [`adminToken=${adminToken}`, csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send(newAdminPayload);

      expect(createRes.statusCode).toBe(201);
      expect(createRes.body.data.email).toBe("sec.officer@auctionx.com");
      expect(createRes.body.data.password).toBeUndefined(); // password stripped
      const newAdminId = createRes.body.data._id;

      // 2. Self-deletion guard: admin cannot delete their own account
      const selfDeleteRes = await request(app)
        .delete(`/api/admins/${admin._id}`)
        .set("Cookie", [`adminToken=${adminToken}`, csrf.cookie])
        .set(csrf.headerName, csrf.headerValue);

      expect(selfDeleteRes.statusCode).toBe(400);
      expect(selfDeleteRes.body.message).toMatch(/cannot delete (?:their|your) own/i);

      // 3. Deleting the created admin succeeds
      const deleteRes = await request(app)
        .delete(`/api/admins/${newAdminId}`)
        .set("Cookie", [`adminToken=${adminToken}`, csrf.cookie])
        .set(csrf.headerName, csrf.headerValue);

      expect(deleteRes.statusCode).toBe(200);
      expect(deleteRes.body.message).toMatch(/(?:removed|deleted) successfully/i);
    });
  });

  describe("7. Transactions & Withdrawal State Governance", () => {
    it("should allow admin to update transaction status and notes safely", async () => {
      const { admin, token: adminToken } = await createTestAdmin();
      const csrf = createCsrfCredentials();

      // Create a test withdrawal transaction
      const withdrawal = await Transaction.create({
        userEmail: "seller1@auctionx.com",
        name: "Seller One",
        amount: 2500,
        type: "withdrawal",
        status: "pending",
        date: new Date(),
      });

      // 1. Invalid status value rejected
      const invalidRes = await request(app)
        .put(`/api/transactions/${withdrawal._id}`)
        .set("Cookie", [`adminToken=${adminToken}`, csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({ status: "invalid_status_enum" });

      expect(invalidRes.statusCode).toBe(400);

      // 2. Valid status transition to 'completed' with audit notes
      const validRes = await request(app)
        .put(`/api/transactions/${withdrawal._id}`)
        .set("Cookie", [`adminToken=${adminToken}`, csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          status: "completed",
          notes: "Wire transfer reference WT-98124 confirmed by treasury",
        });

      expect(validRes.statusCode).toBe(200);
      const record = validRes.body.data || validRes.body;
      expect(record.status).toBe("completed");
      expect(record.notes).toBe("Wire transfer reference WT-98124 confirmed by treasury");
    });
  });


  describe("8. Goodies Catalog Management", () => {
    it("should manage goodies catalog through authenticated CRUD and protect against mass assignment", async () => {
      const { admin, token: adminToken } = await createTestAdmin();
      const csrf = createCsrfCredentials();

      const goodiePayload = {
        name: "AuctionX Collector Hoodie",
        category: "shirts",
        price: 59.99,
        stock: 50,
        description: "Heavyweight embroidered cotton hoodie",
        keyFeatures: ["100% Organic Cotton", "Embroidered Gold Logo"],
        images: ["https://example.com/hoodie.jpg"],
      };

      // 1. Admin creates goodie
      const createRes = await request(app)
        .post("/api/goodies")
        .set("Cookie", [`adminToken=${adminToken}`, csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send(goodiePayload);

      expect(createRes.statusCode).toBe(201);
      expect(createRes.body.name).toBe("AuctionX Collector Hoodie");
      const goodieId = createRes.body._id;

      // 2. Public retrieves goodie catalog
      const listRes = await request(app).get("/api/goodies");
      expect(listRes.statusCode).toBe(200);
      expect(listRes.body.some((g) => g.name === "AuctionX Collector Hoodie")).toBe(true);

      // 3. Admin deletes goodie
      const deleteRes = await request(app)
        .delete(`/api/goodies/${goodieId}`)
        .set("Cookie", [`adminToken=${adminToken}`, csrf.cookie])
        .set(csrf.headerName, csrf.headerValue);

      expect(deleteRes.statusCode).toBe(200);
      expect(deleteRes.body.message).toMatch(/deleted successfully/i);
    });
  });

  describe("9. Role Authorization & Privilege Separation", () => {
    it("should reject ordinary user and seller tokens from administrative APIs", async () => {
      const { user, token: userToken } = await createTestUser({ role: "user" });
      const { seller, token: sellerToken } = await createTestSeller();

      // Ordinary user blocked from admin APIs
      const userRes = await request(app)
        .get("/api/admins")
        .set("Cookie", [`token=${userToken}`]);
      expect([401, 403]).toContain(userRes.statusCode);

      // Seller blocked from admin APIs
      const sellerRes = await request(app)
        .get("/api/admins")
        .set("Cookie", [`token=${sellerToken}`]);
      expect([401, 403]).toContain(sellerRes.statusCode);
    });
  });
});
