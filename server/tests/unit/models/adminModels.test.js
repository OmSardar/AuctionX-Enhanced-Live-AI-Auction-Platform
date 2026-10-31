const Admin = require("../../../src/modules/admin/authentication/models/admin");
const Banner = require("../../../src/modules/admin/tasks/models/banner");
const Event = require("../../../src/modules/admin/tasks/models/event");
const Calendar = require("../../../src/modules/admin/tasks/models/calendar");
const Transaction = require("../../../src/modules/admin/finance/models/transaction");

describe("Admin & Task Models Unit Tests", () => {
  describe("Admin Model", () => {
    it("should validate a valid admin instance", () => {
      const admin = new Admin({
        firstName: "Super",
        lastName: "Admin",
        email: "admin@example.com",
        password: "StrongAdminPassword123!",
        role: "admin",
      });
      const err = admin.validateSync();
      expect(err).toBeUndefined();
    });

    it("should reject password shorter than 8 characters", () => {
      const admin = new Admin({
        firstName: "Short",
        lastName: "Pass",
        email: "short@example.com",
        password: "short",
      });
      const err = admin.validateSync();
      expect(err).toBeDefined();
      expect(err.errors.password).toBeDefined();
    });

    it("should reject invalid email format", () => {
      const admin = new Admin({
        firstName: "Bad",
        lastName: "Email",
        email: "not-an-email",
        password: "ValidPassword123!",
      });
      const err = admin.validateSync();
      expect(err).toBeDefined();
      expect(err.errors.email).toBeDefined();
    });
  });

  describe("Banner Model", () => {
    it("should validate a valid banner instance", () => {
      const banner = new Banner({
        title: "Spring Auction Gala",
        position: "top",
        imageUrl: "https://example.com/banner.jpg",
      });
      const err = banner.validateSync();
      expect(err).toBeUndefined();
      expect(banner.position).toBe("top");
      expect(banner.isActive).toBe(true);
    });

    it("should reject invalid position enum", () => {
      const banner = new Banner({
        title: "Banner with bad position",
        position: "center",
        imageUrl: "https://example.com/banner.jpg",
      });
      const err = banner.validateSync();
      expect(err).toBeDefined();
      expect(err.errors.position).toBeDefined();
    });
  });

  describe("Event Model", () => {
    it("should validate a valid event instance", () => {
      const event = new Event({
        title: "Fine Art Auction",
        eventType: "auction",
        startDate: new Date(),
        endDate: new Date(Date.now() + 86400000),
      });
      const err = event.validateSync();
      expect(err).toBeUndefined();
      expect(event.eventType).toBe("auction");
      expect(event.isActive).toBe(true);
    });

    it("should fail validation when title or dates are missing", () => {
      const event = new Event({
        eventType: "sale",
      });
      const err = event.validateSync();
      expect(err).toBeDefined();
      expect(err.errors.title).toBeDefined();
      expect(err.errors.startDate).toBeDefined();
      expect(err.errors.endDate).toBeDefined();
    });
  });

  describe("Calendar Model", () => {
    it("should validate a valid calendar entry", () => {
      const entry = new Calendar({
        title: "Jewelry Auction Session",
        date: new Date(),
        startTime: "14:00",
        endTime: "16:00",
      });
      const err = entry.validateSync();
      expect(err).toBeUndefined();
      expect(entry.type).toBe("auction");
    });

    it("should fail validation when required fields are missing", () => {
      const entry = new Calendar({});
      const err = entry.validateSync();
      expect(err).toBeDefined();
      expect(err.errors.title).toBeDefined();
      expect(err.errors.date).toBeDefined();
      expect(err.errors.startTime).toBeDefined();
      expect(err.errors.endTime).toBeDefined();
    });
  });

  describe("Transaction Model", () => {
    it("should validate a valid transaction", () => {
      const tx = new Transaction({
        userEmail: "buyer@example.com",
        name: "Deposit for Auction Bidding",
        type: "deposit",
        amount: 5000,
      });
      const err = tx.validateSync();
      expect(err).toBeUndefined();
    });

    it("should reject negative transaction amount", () => {
      const tx = new Transaction({
        userEmail: "buyer@example.com",
        name: "Negative Amount",
        type: "withdrawal",
        amount: -50,
      });
      const err = tx.validateSync();
      expect(err).toBeDefined();
      expect(err.errors.amount).toBeDefined();
    });

    it("should reject invalid transaction type", () => {
      const tx = new Transaction({
        userEmail: "buyer@example.com",
        name: "Refund",
        type: "refund", // Only deposit or withdrawal allowed
        amount: 100,
      });
      const err = tx.validateSync();
      expect(err).toBeDefined();
      expect(err.errors.type).toBeDefined();
    });
  });
});
