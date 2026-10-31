/**
 * Focused Regression Suite: Auction Timing, Timezone Parsing & Countdown Boundaries
 * 
 * Verifies:
 * 1. Timezone-safe parsing of UTC ISO timestamps and legacy HH:MM strings.
 * 2. Absolute auction instant and duration preservation across arbitrary local timezones.
 * 3. Graceful fallback on missing, null, or malformed timestamps.
 * 4. Boundary calculations for SCHEDULED, LIVE, ENDED, and extended (anti-sniping) auctions.
 */

function parseAuctionDates(startDateRaw, startTimeRaw, endTimeRaw) {
  let startDate = null;
  let endDate = null;

  if (
    startDateRaw &&
    typeof startDateRaw === "object" &&
    !(startDateRaw instanceof Date)
  ) {
    const prod = startDateRaw;
    return parseAuctionDates(
      prod.startTime || prod.biddingStartDate,
      prod.startTime || prod.biddingStartTime,
      prod.endTime || prod.biddingEndTime || prod.bidEndTime
    );
  }

  if (startTimeRaw instanceof Date) {
    if (!isNaN(startTimeRaw.getTime())) {
      startDate = startTimeRaw;
    }
  } else if (
    startTimeRaw &&
    typeof startTimeRaw === "string" &&
    startTimeRaw.includes("T")
  ) {
    const parsedStart = new Date(startTimeRaw);
    if (!isNaN(parsedStart.getTime())) {
      startDate = parsedStart;
    }
  }

  if (!startDate && startDateRaw) {
    if (startDateRaw instanceof Date && (!startTimeRaw || typeof startTimeRaw !== "string" || !startTimeRaw.includes(":"))) {
      if (!isNaN(startDateRaw.getTime())) {
        startDate = startDateRaw;
      }
    } else {
      const datePart =
        typeof startDateRaw === "string"
          ? startDateRaw.split("T")[0]
          : startDateRaw instanceof Date
          ? startDateRaw.toISOString().split("T")[0]
          : null;

      if (datePart && startTimeRaw && typeof startTimeRaw === "string") {
        const cleanTime = startTimeRaw.trim();
        if (cleanTime.includes("T")) {
          const parsed = new Date(cleanTime);
          if (!isNaN(parsed.getTime())) startDate = parsed;
        } else {
          const timePart = cleanTime.length === 5 ? `${cleanTime}:00` : cleanTime;
          const combined = new Date(`${datePart}T${timePart}Z`);
          if (!isNaN(combined.getTime())) {
            startDate = combined;
          }
        }
      }

      if (!startDate) {
        const fallbackDate = new Date(startDateRaw);
        if (!isNaN(fallbackDate.getTime())) {
          if (startTimeRaw && typeof startTimeRaw === "string" && startTimeRaw.includes(":")) {
            const parts = startTimeRaw.split(":").map(Number);
            if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
              fallbackDate.setUTCHours(parts[0], parts[1], 0, 0);
            }
          }
          startDate = fallbackDate;
        }
      }
    }
  }

  if (endTimeRaw instanceof Date) {
    if (!isNaN(endTimeRaw.getTime())) {
      endDate = endTimeRaw;
    }
  } else if (endTimeRaw && typeof endTimeRaw === "string") {
    const cleanEnd = endTimeRaw.trim();
    const parsedEnd = new Date(cleanEnd);
    if (!isNaN(parsedEnd.getTime())) {
      endDate = parsedEnd;
    }
  }

  return { startDate, endDate };
}

function formatTimeRemaining(differenceMs) {
  if (differenceMs <= 0 || isNaN(differenceMs)) {
    return { days: "00", hours: "00", minutes: "00", seconds: "00" };
  }

  const days = Math.floor(differenceMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor(
    (differenceMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
  );
  const minutes = Math.floor(
    (differenceMs % (1000 * 60 * 60)) / (1000 * 60)
  );
  const seconds = Math.floor((differenceMs % (1000 * 60)) / 1000);

  return {
    days: String(days).padStart(2, "0"),
    hours: String(hours).padStart(2, "0"),
    minutes: String(minutes).padStart(2, "0"),
    seconds: String(seconds).padStart(2, "0"),
  };
}

function calculateAuctionTime(startDate, endDate, status = "Active", nowOverride = null) {
  const now = nowOverride !== null ? nowOverride : Date.now();
  const startTime = startDate ? startDate.getTime() : null;
  const endTime = endDate ? endDate.getTime() : null;

  const terminalStatuses = [
    "Closed",
    "ENDED",
    "AWAITING_PAYMENT",
    "SETTLED",
    "UNSOLD",
    "CANCELLED",
  ];

  const isTerminalStatus = terminalStatuses.includes(status);
  const isTimeEnded = endTime !== null && now >= endTime;
  const isEnded = isTerminalStatus || isTimeEnded;

  const isUpcoming =
    !isEnded &&
    (status === "SCHEDULED" ||
      status === "DRAFT" ||
      (startTime !== null && now < startTime));

  const isStarted = !isUpcoming && !isEnded;
  const isActive = isStarted && !isEnded;

  let differenceMs = 0;
  let statusText = "BID ENDS IN";

  if (isEnded) {
    statusText = "AUCTION ENDED";
    differenceMs = 0;
  } else if (isUpcoming) {
    statusText = "AUCTION STARTS IN";
    differenceMs = startTime !== null ? Math.max(0, startTime - now) : 0;
  } else {
    statusText = "BID ENDS IN";
    differenceMs = endTime !== null ? Math.max(0, endTime - now) : 0;
  }

  return {
    isStarted,
    isEnded,
    isActive,
    isUpcoming,
    statusText,
    timeLeft: formatTimeRemaining(differenceMs),
    differenceMs: Math.max(0, differenceMs),
  };
}

describe("Auction Timing & Timezone Regression Suite", () => {
  describe("1. Timezone-Safe Timestamp Parsing", () => {
    it("should preserve exact UTC instant from backend ISO strings", () => {
      const product = {
        startTime: "2026-10-15T12:00:00.000Z",
        endTime: "2026-10-15T14:00:00.000Z",
        status: "SCHEDULED"
      };

      const { startDate, endDate } = parseAuctionDates(product);
      expect(startDate).toBeInstanceOf(Date);
      expect(endDate).toBeInstanceOf(Date);
      expect(startDate.toISOString()).toBe("2026-10-15T12:00:00.000Z");
      expect(endDate.toISOString()).toBe("2026-10-15T14:00:00.000Z");
      expect(endDate.getTime() - startDate.getTime()).toBe(2 * 60 * 60 * 1000); // exactly 2 hours
    });

    it("should parse legacy date + HH:MM time as UTC without local timezone distortion", () => {
      const { startDate } = parseAuctionDates("2026-10-15", "10:00", null);
      expect(startDate).toBeInstanceOf(Date);
      // Backend sets UTC hours, so 10:00 UTC must be parsed as 10:00:00.000Z
      expect(startDate.toISOString()).toBe("2026-10-15T10:00:00.000Z");
    });

    it("should gracefully handle null, undefined, or invalid timestamps without throwing", () => {
      const emptyResult = parseAuctionDates(null, null, null);
      expect(emptyResult.startDate).toBeNull();
      expect(emptyResult.endDate).toBeNull();

      const invalidResult = parseAuctionDates("invalid-date", "invalid-time", "bad-date");
      expect(invalidResult.startDate).toBeNull();
      expect(invalidResult.endDate).toBeNull();
    });

    it("should support direct product object invocation with legacy field names", () => {
      const legacyProduct = {
        biddingStartDate: "2026-11-01",
        biddingStartTime: "15:30",
        biddingEndTime: "2026-11-01T17:30:00.000Z"
      };

      const { startDate, endDate } = parseAuctionDates(legacyProduct);
      expect(startDate.toISOString()).toBe("2026-11-01T15:30:00.000Z");
      expect(endDate.toISOString()).toBe("2026-11-01T17:30:00.000Z");
    });
  });

  describe("2. Auction Lifecycle Phase & Countdown Calculations", () => {
    const start = new Date("2026-10-15T10:00:00.000Z");
    const end = new Date("2026-10-15T12:00:00.000Z");

    it("should compute SCHEDULED / upcoming auction correctly before start time", () => {
      // 1 hour before start
      const now = new Date("2026-10-15T09:00:00.000Z").getTime();
      const state = calculateAuctionTime(start, end, "SCHEDULED", now);

      expect(state.isUpcoming).toBe(true);
      expect(state.isActive).toBe(false);
      expect(state.isEnded).toBe(false);
      expect(state.statusText).toBe("AUCTION STARTS IN");
      expect(state.differenceMs).toBe(60 * 60 * 1000);
      expect(state.timeLeft).toEqual({
        days: "00",
        hours: "01",
        minutes: "00",
        seconds: "00"
      });
    });

    it("should compute LIVE / active auction correctly between start and end time", () => {
      // 30 minutes into auction (90 minutes remaining)
      const now = new Date("2026-10-15T10:30:00.000Z").getTime();
      const state = calculateAuctionTime(start, end, "LIVE", now);

      expect(state.isUpcoming).toBe(false);
      expect(state.isActive).toBe(true);
      expect(state.isEnded).toBe(false);
      expect(state.statusText).toBe("BID ENDS IN");
      expect(state.differenceMs).toBe(90 * 60 * 1000);
      expect(state.timeLeft).toEqual({
        days: "00",
        hours: "01",
        minutes: "30",
        seconds: "00"
      });
    });

    it("should compute ENDED auction when current time passes end time", () => {
      // 1 minute after auction end
      const now = new Date("2026-10-15T12:01:00.000Z").getTime();
      const state = calculateAuctionTime(start, end, "LIVE", now);

      expect(state.isUpcoming).toBe(false);
      expect(state.isActive).toBe(false);
      expect(state.isEnded).toBe(true);
      expect(state.statusText).toBe("AUCTION ENDED");
      expect(state.differenceMs).toBe(0);
      expect(state.timeLeft).toEqual({
        days: "00",
        hours: "00",
        minutes: "00",
        seconds: "00"
      });
    });

    it("should treat terminal statuses (e.g. SETTLED, Closed) as ENDED immediately", () => {
      // Current time is before end, but status is already terminal
      const now = new Date("2026-10-15T10:30:00.000Z").getTime();
      const state = calculateAuctionTime(start, end, "SETTLED", now);

      expect(state.isEnded).toBe(true);
      expect(state.isActive).toBe(false);
      expect(state.statusText).toBe("AUCTION ENDED");
      expect(state.differenceMs).toBe(0);
    });

    it("should accurately reflect anti-sniping dynamic end time extension", () => {
      // Initial end time: 12:00:00. Bid received at 11:59:00 extends end time by 2 minutes to 12:02:00
      const extendedEnd = new Date("2026-10-15T12:02:00.000Z");
      const now = new Date("2026-10-15T11:59:30.000Z").getTime(); // 2.5 minutes remaining

      const state = calculateAuctionTime(start, extendedEnd, "LIVE", now);
      expect(state.isActive).toBe(true);
      expect(state.isEnded).toBe(false);
      expect(state.differenceMs).toBe(150 * 1000); // 2 min 30 sec = 150000ms
      expect(state.timeLeft).toEqual({
        days: "00",
        hours: "00",
        minutes: "02",
        seconds: "30"
      });
    });
  });
});
