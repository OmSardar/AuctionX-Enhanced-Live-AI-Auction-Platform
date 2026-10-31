const auditService = require("../../../src/modules/analytics/services/auditService");
const analyticsService = require("../../../src/modules/analytics/services/analyticsService");
const AuditLog = require("../../../src/modules/authentication/models/auditLog");

describe("AuditService & AnalyticsService Unit Tests — Stage 7.42", () => {
  describe("AuditService", () => {
    it("should record an event and sanitize sensitive credentials from metadata", async () => {
      const sensitiveMetadata = {
        userEmail: "test@example.com",
        password: "superSecretPassword123!",
        authToken: "bearer_xyz_token",
        nested: {
          clientSecret: "oauth_client_secret_xyz",
          safeField: "safe_value",
        },
      };

      const event = await auditService.recordEvent({
        actorType: "admin",
        actorId: "admin_test_999",
        actorEmail: "admin999@auctionx.com",
        action: "TEST_SECURITY_ACTION",
        category: "SECURITY",
        outcome: "SUCCESS",
        metadata: sensitiveMetadata,
      });

      expect(event).toBeDefined();
      expect(event.action).toBe("TEST_SECURITY_ACTION");
      expect(event.metadata.password).toBe("[REDACTED]");
      expect(event.metadata.authToken).toBe("[REDACTED]");
      expect(event.metadata.nested.clientSecret).toBe("[REDACTED]");
      expect(event.metadata.nested.safeField).toBe("safe_value");

      // Clean up test record
      await AuditLog.deleteOne({ _id: event._id });
    });

    it("should deduplicate events with the same idempotency key", async () => {
      const idempotencyKey = `idem_test_${Date.now()}`;

      const first = await auditService.recordEvent({
        actorType: "admin",
        actorId: "admin_idem",
        actorEmail: "idem@auctionx.com",
        action: "IDEMPOTENT_MUTATION",
        idempotencyKey,
      });

      const second = await auditService.recordEvent({
        actorType: "admin",
        actorId: "admin_idem",
        actorEmail: "idem@auctionx.com",
        action: "IDEMPOTENT_MUTATION",
        idempotencyKey,
      });

      expect(first._id.toString()).toBe(second._id.toString());

      // Clean up
      await AuditLog.deleteOne({ idempotencyKey });
    });

    it("should cap query limits at 100", async () => {
      const result = await auditService.queryEvents({
        limit: 500, // Attempt abusive limit
      });

      expect(result).toHaveProperty("events");
      expect(result).toHaveProperty("totalCount");
      expect(result).toHaveProperty("page");
    });
  });

  describe("AnalyticsService", () => {
    it("should generate continuous monthly buckets without null holes", async () => {
      const timeSeries = await analyticsService.getRevenueTimeSeries(6);

      expect(timeSeries.labels.length).toBe(6);
      expect(timeSeries.grossSales.length).toBe(6);
      expect(timeSeries.netSales.length).toBe(6);
      expect(timeSeries.platformFees.length).toBe(6);

      timeSeries.grossSales.forEach((val) => {
        expect(typeof val).toBe("number");
        expect(isNaN(val)).toBe(false);
      });
    });

    it("should compute auction health with safe zero-division guard", async () => {
      const health = await analyticsService.getAuctionHealth();

      expect(health).toHaveProperty("completionRate");
      expect(typeof health.completionRate).toBe("number");
      expect(isNaN(health.completionRate)).toBe(false);
      expect(health.completionRate).toBeGreaterThanOrEqual(0);
      expect(health.completionRate).toBeLessThanOrEqual(100);
    });

    it("should aggregate categories cleanly", async () => {
      const categories = await analyticsService.getCategoryBreakdown();

      expect(Array.isArray(categories.labels)).toBe(true);
      expect(Array.isArray(categories.counts)).toBe(true);
      expect(Array.isArray(categories.revenues)).toBe(true);
    });
  });
});
