const express = require("express");
const router = express.Router();
const authUserMiddleware = require("../../users/middleware/authUserMiddleware");
const scheduledBidController = require("../controllers/scheduledBidController");

// All scheduled bid routes require authenticated user
router.use(authUserMiddleware);

// Create a new scheduled bid
router.post("/", scheduledBidController.createScheduledBid);

// Get current user's scheduled bids
router.get("/user", scheduledBidController.getUserScheduledBids);

// Cancel a scheduled bid
router.delete("/:id", scheduledBidController.cancelScheduledBid);

module.exports = router;
