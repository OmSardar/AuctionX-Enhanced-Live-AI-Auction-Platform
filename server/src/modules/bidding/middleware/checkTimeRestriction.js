const Product = require("../../products/models/productSchema");

/**
 * Safely parses auction start and end time boundaries for a product.
 * Supports ISO strings, HH:MM strings, and Date objects without timezone drift.
 */
function parseAuctionTimeBoundaries(product) {
  if (!product) return { startTime: null, endTime: null };

  let startTime = null;
  if (
    product.biddingStartTime &&
    typeof product.biddingStartTime === "string" &&
    product.biddingStartTime.includes("T")
  ) {
    const parsed = new Date(product.biddingStartTime);
    if (!isNaN(parsed.getTime())) startTime = parsed;
  }

  if (!startTime && product.biddingStartDate) {
    const datePart =
      typeof product.biddingStartDate === "string"
        ? product.biddingStartDate.split("T")[0]
        : product.biddingStartDate instanceof Date
        ? product.biddingStartDate.toISOString().split("T")[0]
        : null;

    if (
      datePart &&
      product.biddingStartTime &&
      typeof product.biddingStartTime === "string" &&
      !product.biddingStartTime.includes("T")
    ) {
      const timePart =
        product.biddingStartTime.length === 5
          ? `${product.biddingStartTime}:00`
          : product.biddingStartTime;
      const combined = new Date(`${datePart}T${timePart}`);
      if (!isNaN(combined.getTime())) {
        startTime = combined;
      }
    }

    if (!startTime) {
      const fallbackDate = new Date(product.biddingStartDate);
      if (!isNaN(fallbackDate.getTime())) {
        if (product.biddingStartTime && typeof product.biddingStartTime === "string") {
          const parts = product.biddingStartTime.split(":").map(Number);
          if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            fallbackDate.setHours(parts[0], parts[1], 0, 0);
          }
        }
        startTime = fallbackDate;
      }
    }
  }

  let endTime = null;
  const rawEndTime = product.biddingEndTime || product.bidEndTime;
  if (rawEndTime) {
    const parsedEnd = new Date(rawEndTime);
    if (!isNaN(parsedEnd.getTime())) {
      endTime = parsedEnd;
    }
  }

  return { startTime, endTime };
}

/**
 * Evaluates the 3-phase auction lifecycle for a product:
 * - UPCOMING: currentTime < startTime
 * - ACTIVE: currentTime >= startTime && currentTime < endTime && status !== "Closed"
 * - ENDED: currentTime >= endTime || status === "Closed"
 */
function getAuctionTimeStatus(product, currentTime = new Date()) {
  if (!product) {
    return { notFound: true, isUpcoming: false, isActive: false, isEnded: false };
  }

  const { startTime, endTime } = parseAuctionTimeBoundaries(product);

  const isClosed = product.status === "Closed";
  const isEnded = isClosed || (endTime !== null && currentTime >= endTime);
  const isStarted = startTime !== null && currentTime >= startTime;
  const isUpcoming = !isStarted && !isEnded;
  const isActive = isStarted && !isEnded;

  let reason = null;
  if (isClosed) {
    reason = "Bidding has ended for this product";
  } else if (isUpcoming) {
    reason = "Bidding has not started yet";
  } else if (isEnded) {
    reason = "Operation not allowed, bidding time has passed.";
  }

  return {
    startTime,
    endTime,
    isUpcoming,
    isActive,
    isEnded,
    reason,
  };
}

const checkTimeRestriction = async (req, res, next) => {
  try {
    const currentTime = new Date();
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    const rawEndTime = product.biddingEndTime || product.bidEndTime;
    const bidEndTime = new Date(rawEndTime);
    if (!isNaN(bidEndTime.getTime()) && currentTime > bidEndTime) {
      return res.status(403).json({
        error: "Operation not allowed, bidding time has passed.",
      });
    }
    next();
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
};

module.exports = checkTimeRestriction;
module.exports.checkTimeRestriction = checkTimeRestriction;
module.exports.parseAuctionTimeBoundaries = parseAuctionTimeBoundaries;
module.exports.getAuctionTimeStatus = getAuctionTimeStatus;
