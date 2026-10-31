/**
 * Canonical Auction Timer Utility for Auction X
 *
 * Handles robust date/time parsing, auction phase detection (Upcoming, Live, Ended),
 * countdown calculations, and interval state management.
 */

/**
 * Safely parses auction dates.
 * Specifically handles biddingStartTime in "HH:MM" 24-hour format
 * (e.g., "10:00") without producing Invalid Date / NaN.
 *
 * @param {string|Date} startDateRaw - Bidding start date
 * @param {string} startTimeRaw - Bidding start time (e.g. "10:00")
 * @param {string|Date} endTimeRaw - Bidding end date/time (ISO string or Date)
 * @returns {{ startDate: Date|null, endDate: Date|null }}
 */
export function parseAuctionDates(startDateRaw, startTimeRaw, endTimeRaw) {
  let startDate = null;
  let endDate = null;

  // Support single product object invocation: parseAuctionDates(product)
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

  // 1. Resolve start date/time
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
          // Time is in HH:MM or HH:MM:SS format
          const timePart = cleanTime.length === 5 ? `${cleanTime}:00` : cleanTime;
          // Crucial: The backend computes auction schedules in UTC (setUTCHours).
          // Appending 'Z' ensures consistent UTC parsing without browser timezone skew.
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

  // 2. Resolve end date/time
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

/**
 * Formats a millisecond duration into 2-digit time components.
 *
 * @param {number} differenceMs - Milliseconds remaining
 * @returns {{ days: string, hours: string, minutes: string, seconds: string }}
 */
export function formatTimeRemaining(differenceMs) {
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

/**
 * Calculates current auction state and countdown based on authoritative current time.
 * Correctly derives the lifecycle states supporting both legacy and modern enums:
 * - UPCOMING: status is "SCHEDULED" / "DRAFT" OR current time < bidding start time
 * - ACTIVE: status is "LIVE" / "Active" AND current time >= start time AND current time < end time
 * - ENDED: status is "Closed" / "ENDED" / "SETTLED" / "UNSOLD" / "CANCELLED" OR current time >= end time
 *
 * @param {Date|null} startDate - Auction start date/time
 * @param {Date|null} endDate - Auction end date/time
 * @param {string} [status="Active"] - Product status from backend
 * @returns {{
 *   isStarted: boolean,
 *   isEnded: boolean,
 *   isActive: boolean,
 *   isUpcoming: boolean,
 *   statusText: string,
 *   timeLeft: { days: string, hours: string, minutes: string, seconds: string },
 *   differenceMs: number
 * }}
 */
export function calculateAuctionTime(startDate, endDate, status = "Active") {
  const now = Date.now();
  const startTime = startDate ? startDate.getTime() : null;
  const endTime = endDate ? endDate.getTime() : null;

  // Terminal lifecycle statuses
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

  // Upcoming: scheduled status, draft status, or start time in the future
  const isUpcoming =
    !isEnded &&
    (status === "SCHEDULED" ||
      status === "DRAFT" ||
      (startTime !== null && now < startTime));

  // Active: started and not ended
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
