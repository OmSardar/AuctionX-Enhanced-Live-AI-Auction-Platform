const request = require("supertest");
const mongoose = require("mongoose");
const { app } = require("../../../server");
const { createTestAdmin } = require("../../helpers/authHelper");
const { createCsrfCredentials } = require("../../helpers/csrfHelper");
const Calendar = require("../../../src/modules/admin/tasks/models/calendar");
const Event = require("../../../src/modules/admin/tasks/models/event");
const Banner = require("../../../src/modules/admin/tasks/models/banner");
const Admin = require("../../../src/modules/admin/authentication/models/admin");

describe("Admin Tasks Integration Tests (Banners, Events, Calendar)", () => {
  let adminToken;
  let csrf;
  let testAdmin;

  beforeAll(async () => {
    csrf = createCsrfCredentials();
    const adminObj = await createTestAdmin();
    testAdmin = adminObj.admin;
    adminToken = adminObj.token;
  });

  beforeEach(async () => {
    await Calendar.deleteMany({});
    await Event.deleteMany({});
    await Banner.deleteMany({});
  });

  afterAll(async () => {
    await Calendar.deleteMany({});
    await Event.deleteMany({});
    await Banner.deleteMany({});
    if (testAdmin) {
      await Admin.findByIdAndDelete(testAdmin._id);
    }
  });

  // --------------------------------------------------------------------------
  // Calendar Routes
  // --------------------------------------------------------------------------
  describe("Calendar Endpoints", () => {
    it("should reject unauthenticated calendar requests", async () => {
      const res = await request(app)
        .get("/api/calendar")
        .set("Cookie", csrf.cookie)
        .set("x-csrf-token", csrf.token);

      expect(res.status).toBe(401);
    });

    it("should create a valid calendar entry (POST /api/calendar)", async () => {
      const entryData = {
        title: "Auction Inspection",
        date: "2026-10-15",
        startTime: "10:00",
        endTime: "12:00",
        description: "Review rare art pieces",
        type: "auction",
        location: "Warehouse A",
      };

      const res = await request(app)
        .post("/api/calendar")
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set("x-csrf-token", csrf.token)
        .send(entryData);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe("Auction Inspection");
    });

    it("should fail to create calendar entry when required fields are missing", async () => {
      const res = await request(app)
        .post("/api/calendar")
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set("x-csrf-token", csrf.token)
        .send({ title: "Incomplete Entry" });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("required");
    });

    it("should fail to create calendar entry with invalid date format", async () => {
      const res = await request(app)
        .post("/api/calendar")
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set("x-csrf-token", csrf.token)
        .send({
          title: "Bad Date",
          date: "not-a-valid-date",
          startTime: "10:00 AM",
          endTime: "11:00 AM",
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Invalid date format");
    });

    it("should list all calendar entries (GET /api/calendar)", async () => {
      await Calendar.create({
        title: "Entry 1",
        date: new Date("2026-10-10"),
        startTime: "09:00",
        endTime: "10:00",
        type: "meeting",
      });

      const res = await request(app)
        .get("/api/calendar")
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set("x-csrf-token", csrf.token);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(1);
      expect(res.body.data[0].title).toBe("Entry 1");
    });

    // REGRESSION TEST for the missing Calendar import bug in CalendarRoutes.js and AdminRoutes.js
    it("REGRESSION: should fetch calendar entries by date without ReferenceError (GET /api/calendar/date/:date)", async () => {
      const targetDate = "2026-11-20";
      await Calendar.create({
        title: "Special Auction Event",
        date: new Date(targetDate),
        startTime: "14:00",
        endTime: "16:00",
        type: "auction",
      });

      const res = await request(app)
        .get(`/api/calendar/date/${targetDate}`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set("x-csrf-token", csrf.token);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(1);
      expect(res.body.data[0].title).toBe("Special Auction Event");
    });

    it("should return 400 when fetching calendar entries with invalid date", async () => {
      const res = await request(app)
        .get("/api/calendar/date/invalid-date-string")
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set("x-csrf-token", csrf.token);

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Invalid date format");
    });
  });

  // --------------------------------------------------------------------------
  // Events Routes
  // --------------------------------------------------------------------------
  describe("Events Endpoints", () => {
    it("should reject unauthenticated event creation", async () => {
      const res = await request(app)
        .post("/api/events")
        .set("Cookie", csrf.cookie)
        .set("x-csrf-token", csrf.token)
        .send({ title: "Unauthorized Event" });

      expect(res.status).toBe(401);
    });

    it("should create a valid event (POST /api/events)", async () => {
      const eventData = {
        title: "Grand Autumn Auction",
        description: "Annual luxury auction",
        eventType: "auction",
        startDate: "2026-10-01T10:00:00.000Z",
        endDate: "2026-10-02T18:00:00.000Z",
        isActive: true,
      };

      const res = await request(app)
        .post("/api/events")
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set("x-csrf-token", csrf.token)
        .send(eventData);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.event.title).toBe("Grand Autumn Auction");
    });

    it("should reject event creation when end date is before start date", async () => {
      const eventData = {
        title: "Time Travel Event",
        description: "Invalid dates",
        eventType: "auction",
        startDate: "2026-10-05T10:00:00.000Z",
        endDate: "2026-10-01T18:00:00.000Z", // Earlier than start date!
        isActive: true,
      };

      const res = await request(app)
        .post("/api/events")
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set("x-csrf-token", csrf.token)
        .send(eventData);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("End date must be after start date");
    });

    it("should get all events with pagination (GET /api/events)", async () => {
      await Event.create({
        title: "Event One",
        description: "First event",
        eventType: "sale",
        startDate: new Date("2026-10-01"),
        endDate: new Date("2026-10-02"),
      });

      const res = await request(app)
        .get("/api/events?page=1&limit=10")
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set("x-csrf-token", csrf.token);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.events.length).toBe(1);
    });

    it("should get event by ID and return 404 for non-existent ID", async () => {
      const event = await Event.create({
        title: "Target Event",
        description: "Target description",
        eventType: "auction",
        startDate: new Date("2026-10-01"),
        endDate: new Date("2026-10-02"),
      });

      const getRes = await request(app)
        .get(`/api/events/${event._id}`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set("x-csrf-token", csrf.token);

      expect(getRes.status).toBe(200);
      expect(getRes.body.event.title).toBe("Target Event");

      const fakeId = new mongoose.Types.ObjectId();
      const notFoundRes = await request(app)
        .get(`/api/events/${fakeId}`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set("x-csrf-token", csrf.token);

      expect(notFoundRes.status).toBe(404);
    });

    it("should update and delete an event (PUT & DELETE /api/events/:id)", async () => {
      const event = await Event.create({
        title: "Initial Event",
        description: "Initial description",
        eventType: "sale",
        startDate: new Date("2026-10-01"),
        endDate: new Date("2026-10-02"),
      });

      const updateRes = await request(app)
        .put(`/api/events/${event._id}`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set("x-csrf-token", csrf.token)
        .send({ title: "Updated Event Title" });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.event.title).toBe("Updated Event Title");

      const deleteRes = await request(app)
        .delete(`/api/events/${event._id}`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set("x-csrf-token", csrf.token);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.message).toBe("Event deleted successfully");
    });
  });

  // --------------------------------------------------------------------------
  // Banners Routes
  // --------------------------------------------------------------------------
  describe("Banners Endpoints", () => {
    it("should allow public access to list banners (GET /api/banners)", async () => {
      await Banner.create({
        title: "Summer Sale Banner",
        imageUrl: "https://example.com/banner1.jpg",
        imagePublicId: "banners/banner1",
        position: "top",
        isActive: true,
      });

      const res = await request(app)
        .get("/api/banners")
        .set("Cookie", csrf.cookie)
        .set("x-csrf-token", csrf.token);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
    });

    it("should require admin auth to update banner status (PATCH /api/banners/:id)", async () => {
      const banner = await Banner.create({
        title: "Draft Banner",
        imageUrl: "https://example.com/banner2.jpg",
        imagePublicId: "banners/banner2",
        isActive: false,
      });

      const unauthRes = await request(app)
        .patch(`/api/banners/${banner._id}`)
        .set("Cookie", csrf.cookie)
        .set("x-csrf-token", csrf.token)
        .send({ isActive: true });

      expect(unauthRes.status).toBe(401);

      const authRes = await request(app)
        .patch(`/api/banners/${banner._id}`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set("x-csrf-token", csrf.token)
        .send({ isActive: true });

      expect(authRes.status).toBe(200);
      expect(authRes.body.data.isActive).toBe(true);
    });

    it("should return 404 when updating non-existent banner", async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .patch(`/api/banners/${fakeId}`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set("x-csrf-token", csrf.token)
        .send({ isActive: true });

      expect(res.status).toBe(404);
    });

    it("should delete a banner and handle non-existent banner (DELETE /api/banners/:id)", async () => {
      const banner = await Banner.create({
        title: "To Delete",
        imageUrl: "https://example.com/banner3.jpg",
        imagePublicId: "banners/banner3",
      });

      const deleteRes = await request(app)
        .delete(`/api/banners/${banner._id}`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set("x-csrf-token", csrf.token);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.message).toBe("Banner deleted successfully");

      const notFoundRes = await request(app)
        .delete(`/api/banners/${banner._id}`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set("x-csrf-token", csrf.token);

      expect(notFoundRes.status).toBe(404);
    });
  });
});
