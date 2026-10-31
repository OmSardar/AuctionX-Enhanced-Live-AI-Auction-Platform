import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  parseAuctionDates,
  calculateAuctionTime,
  formatTimeRemaining,
} from "../src/utils/auctionTimer.js";

describe("Live Auction Countdown & Timer Invariants (Batch 2)", () => {
  const baseTimestamp = new Date("2026-10-31T12:00:00.000Z").getTime();

  test("1. parseAuctionDates correctly parses batch 2 live auction products", () => {
    const mockProduct = {
      startTime: new Date(baseTimestamp - 60000),
      endTime: new Date(baseTimestamp + 5 * 60000),
      biddingStartDate: "2026-10-31T11:59:00.000Z",
      biddingStartTime: "2026-10-31T11:59:00.000Z",
      biddingEndTime: "2026-10-31T12:05:00.000Z",
    };

    const { startDate, endDate } = parseAuctionDates(mockProduct);
    assert.ok(startDate instanceof Date);
    assert.ok(endDate instanceof Date);
    assert.equal(startDate.getTime(), baseTimestamp - 60000);
    assert.equal(endDate.getTime(), baseTimestamp + 5 * 60000);
  });

  test("2. calculateAuctionTime accurately reflects active 5m, 10m, and 20m auctions", () => {
    const origDateNow = Date.now;
    Date.now = () => baseTimestamp;

    try {
      const startDate = new Date(baseTimestamp - 60000);
      const end5 = new Date(baseTimestamp + 5 * 60000);
      const end10 = new Date(baseTimestamp + 10 * 60000);
      const end20 = new Date(baseTimestamp + 20 * 60000);

      // Group 1: 5 minutes
      const timing5 = calculateAuctionTime(startDate, end5, "Active");
      assert.equal(timing5.isActive, true);
      assert.equal(timing5.isEnded, false);
      assert.equal(timing5.statusText, "BID ENDS IN");
      assert.equal(timing5.timeLeft.minutes, "05");
      assert.equal(timing5.timeLeft.seconds, "00");

      // Group 2: 10 minutes
      const timing10 = calculateAuctionTime(startDate, end10, "Active");
      assert.equal(timing10.isActive, true);
      assert.equal(timing10.timeLeft.minutes, "10");
      assert.equal(timing10.timeLeft.seconds, "00");

      // Group 3: 20 minutes
      const timing20 = calculateAuctionTime(startDate, end20, "Active");
      assert.equal(timing20.isActive, true);
      assert.equal(timing20.timeLeft.minutes, "20");
      assert.equal(timing20.timeLeft.seconds, "00");
    } finally {
      Date.now = origDateNow;
    }
  });

  test("3. simulated expiration: Group 1 ends at 5m while Groups 2 & 3 remain active", () => {
    const origDateNow = Date.now;
    // Advance clock by 5 minutes and 1 second
    Date.now = () => baseTimestamp + (5 * 60000) + 1000;

    try {
      const startDate = new Date(baseTimestamp - 60000);
      const end5 = new Date(baseTimestamp + 5 * 60000);
      const end10 = new Date(baseTimestamp + 10 * 60000);
      const end20 = new Date(baseTimestamp + 20 * 60000);

      const timing5 = calculateAuctionTime(startDate, end5, "Active");
      assert.equal(timing5.isEnded, true);
      assert.equal(timing5.isActive, false);
      assert.equal(timing5.statusText, "AUCTION ENDED");
      assert.deepEqual(timing5.timeLeft, { days: "00", hours: "00", minutes: "00", seconds: "00" });

      const timing10 = calculateAuctionTime(startDate, end10, "Active");
      assert.equal(timing10.isActive, true);
      assert.equal(timing10.isEnded, false);
      assert.equal(timing10.timeLeft.minutes, "04");
      assert.equal(timing10.timeLeft.seconds, "59");

      const timing20 = calculateAuctionTime(startDate, end20, "Active");
      assert.equal(timing20.isActive, true);
      assert.equal(timing20.isEnded, false);
      assert.equal(timing20.timeLeft.minutes, "14");
      assert.equal(timing20.timeLeft.seconds, "59");
    } finally {
      Date.now = origDateNow;
    }
  });

  test("4. formatTimeRemaining handles millisecond durations and edge cases safely", () => {
    assert.deepEqual(formatTimeRemaining(0), { days: "00", hours: "00", minutes: "00", seconds: "00" });
    assert.deepEqual(formatTimeRemaining(-5000), { days: "00", hours: "00", minutes: "00", seconds: "00" });
    assert.deepEqual(formatTimeRemaining(NaN), { days: "00", hours: "00", minutes: "00", seconds: "00" });

    // 1 hour, 23 minutes, 45 seconds
    const duration = (1 * 3600 + 23 * 60 + 45) * 1000;
    const formatted = formatTimeRemaining(duration);
    assert.equal(formatted.days, "00");
    assert.equal(formatted.hours, "01");
    assert.equal(formatted.minutes, "23");
    assert.equal(formatted.seconds, "45");
  });
});

