const express = require("express");
const router = express.Router();
const adminAuthMiddleware = require("../../authentication/middleware/authAdminMiddleware");

// HIGH-01 fix: Enforce admin authentication across all admin routes
router.use(adminAuthMiddleware);

/////////////////////////////////////////////-DASHBOARD-METRICS-/////////////////////////////////////////////
const adminDashboardController = require("../controllers/adminDashboardController");

// Admin Dashboard stats & metrics endpoint (Stage 1)
router.get("/dashboard", adminDashboardController.getDashboardStats);
router.get("/dashboard/stats", adminDashboardController.getDashboardStats);
router.get("/stats", adminDashboardController.getDashboardStats);

/////////////////////////////////////////////-AUDIT-EXPLORER-ROUTES (Stage 7.42)-/////////////////////////////////////////////
const auditService = require("../../../analytics/services/auditService");

router.get("/audit-logs", async (req, res) => {
  try {
    const result = await auditService.queryEvents(req.query);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error fetching audit logs", error: err.message });
  }
});

router.get("/audit-logs/summary", async (req, res) => {
  try {
    const summary = await auditService.getAuditSummary();
    res.status(200).json({ success: true, data: summary });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error fetching audit summary", error: err.message });
  }
});

router.get("/audit-logs/:id", async (req, res) => {
  try {
    const event = await auditService.getEventById(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: "Audit log entry not found" });
    res.status(200).json({ success: true, data: event });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error fetching audit log details", error: err.message });
  }
});

/////////////////////////////////////////////-REAL-DATA-ANALYTICS-ROUTES (Stage 7.42)-/////////////////////////////////////////////
const analyticsService = require("../../../analytics/services/analyticsService");

router.get("/analytics/overview", async (req, res) => {
  try {
    const overview = await analyticsService.getFullAnalyticsOverview();
    res.status(200).json({ success: true, data: overview });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error fetching analytics overview", error: err.message });
  }
});

router.get("/analytics/revenue", async (req, res) => {
  try {
    const months = parseInt(req.query.months, 10) || 12;
    const revenue = await analyticsService.getRevenueTimeSeries(months);
    res.status(200).json({ success: true, data: revenue });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error fetching revenue time-series", error: err.message });
  }
});

router.get("/analytics/categories", async (req, res) => {
  try {
    const categories = await analyticsService.getCategoryBreakdown();
    res.status(200).json({ success: true, data: categories });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error fetching category breakdown", error: err.message });
  }
});

router.get("/analytics/auction-health", async (req, res) => {
  try {
    const health = await analyticsService.getAuctionHealth();
    res.status(200).json({ success: true, data: health });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error fetching auction health", error: err.message });
  }
});

router.get("/analytics/user-growth", async (req, res) => {
  try {
    const months = parseInt(req.query.months, 10) || 12;
    const growth = await analyticsService.getUserGrowth(months);
    res.status(200).json({ success: true, data: growth });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error fetching user growth", error: err.message });
  }
});

/////////////////////////////////////////////-USER-MANAGEMENT-ROUTES-/////////////////////////////////////////////
const adminUserManagementController = require("../../users/controllers/adminUserManagementController");

// User directory with pagination, search, filter, and sort
router.get("/users", adminUserManagementController.getUsers);

// Global administrative audit logs
router.get("/users/audit-logs", adminUserManagementController.getGlobalAuditLogs);

// Single account administrative details and activity
router.get("/users/:id", adminUserManagementController.getUserById);

// Account status governance (Suspend / Restore)
router.patch("/users/:id/status", adminUserManagementController.updateUserStatus);

// Account-specific audit log history
router.get("/users/:id/audit-logs", adminUserManagementController.getUserAuditLogs);

/////////////////////////////////////////////-LISTING-MODERATION-ROUTES (Stage 3)-/////////////////////////////////////////////
const adminListingModerationController = require("../../moderation/controllers/adminListingModerationController");

// Listing Directory (Paginated, Search, Filters, Sorting)
router.get("/listings", adminListingModerationController.getListings);

// Reports Queue & Status Management (Placed before :id parameter)
router.get("/listings/reports", adminListingModerationController.getReports);
router.get("/listings/reports/:id", adminListingModerationController.getReportById);
router.patch("/listings/reports/:id/status", adminListingModerationController.updateReportStatus);

// Single Listing Details, Moderation & Audit History
router.get("/listings/:id", adminListingModerationController.getListingById);
router.patch("/listings/:id/moderate", adminListingModerationController.moderateListing);
router.get("/listings/:id/audit-logs", adminListingModerationController.getListingAuditLogs);

/////////////////////////////////////////////-AUCTION-OPERATIONS-ROUTES (Stage 4)-/////////////////////////////////////////////
const adminAuctionOperationsController = require("../../auctions/controllers/adminAuctionOperationsController");

// Operational Telemetry & Health Console (Must precede :id)
router.get("/auctions/lifecycle/telemetry", adminAuctionOperationsController.getLifecycleTelemetry);
router.get("/auctions/scheduled-bids", adminAuctionOperationsController.getScheduledBidsDirectory);

// Auction Operations Directory (Paginated, Multi-filter, Search, Sort)
router.get("/auctions", adminAuctionOperationsController.getAuctions);

// Single Auction Operational Investigation & Bid Ledger
router.get("/auctions/:id", adminAuctionOperationsController.getAuctionById);
router.get("/auctions/:id/bids", adminAuctionOperationsController.getAuctionBids);

/////////////////////////////////////////////-ORDER & SETTLEMENT OPERATIONS ROUTES (Stage 5)-/////////////////////////////////////////////
const adminOrderOperationsController = require("../../orders/controllers/adminOrderOperationsController");

// Order Metrics & Operational Telemetry (Must precede :id)
router.get("/orders/summary", adminOrderOperationsController.getOrderSummary);
router.get("/orders/deadlines/monitoring", adminOrderOperationsController.getDeadlineMonitoring);

// Order Operations Directory (Paginated, Multi-filter, Search, Sort)
router.get("/orders", adminOrderOperationsController.getOrders);

// Single Order Operational Investigation & Settlement Diagnostics
router.get("/orders/:id", adminOrderOperationsController.getOrderById);

/////////////////////////////////////////////-DISPUTES & RESOLUTION MANAGEMENT ROUTES (Stage 6 & 7)-/////////////////////////////////////////////
const adminDisputeOperationsController = require("../../disputes/controllers/adminDisputeOperationsController");

// Dispute & Complaint Telemetry (Must precede :id)
router.get("/disputes/summary", adminDisputeOperationsController.getDisputeSummary);
router.get("/disputes/contested/orders", adminDisputeOperationsController.getContestedOrders);

// Disputes & Complaints Directory (Paginated, Multi-filter, Search, Sort)
router.get("/disputes", adminDisputeOperationsController.getDisputes);

// Dispute Hold Protocol (Stage 7)
router.post("/disputes/:id/hold", adminDisputeOperationsController.placeDisputeHold);
router.post("/disputes/:id/release-hold", adminDisputeOperationsController.releaseDisputeHold);

// Internal Investigation Notes (Stage 7)
router.get("/disputes/:id/notes", adminDisputeOperationsController.getInternalNotes);
router.post("/disputes/:id/notes", adminDisputeOperationsController.addInternalNote);

// Single Dispute Case Investigation View
router.get("/disputes/:id", adminDisputeOperationsController.getDisputeById);

/////////////////////////////////////////////-AUDIT RECONCILIATION & RECOVERY CONSOLE (Stage 7.2)-/////////////////////////////////////////////
const adminReconciliationController = require("../../disputes/controllers/adminReconciliationController");

// Reconciliation Telemetry Summary
router.get("/reconciliation/summary", adminReconciliationController.getReconciliationSummary);

// Paginated Inventory of Administrative Operations Requiring Investigation
router.get("/reconciliation/operations", adminReconciliationController.getReconciliationOperations);

// Deep Read-Only Consistency Inspection of a Specific Operation
router.get("/reconciliation/operations/:id/inspect", adminReconciliationController.inspectOperation);


/////////////////////////////////////////////-CUSTOMER-ROUTES-/////////////////////////////////////////////

const customerController = require("../../users/controllers/manageUserCustomerController");

// Get all customers ✅
router.get("/customers", customerController.getAllCustomers);

// Get a single customer by ID
router.get("/customers/:id", customerController.getCustomerById);

// Update a customer by ID
router.put("/customers/:id", customerController.updateCustomer);

// Delete a customer by ID
router.delete("/customers/:id", customerController.deleteCustomer);

// Add this route for bulk delete
router.delete("/customers", customerController.deleteMultipleCustomers);

/////////////////////////////////////////////-INVENTORY-ROUTES-/////////////////////////////////////////////

const itemController = require("../../listings/controllers/manageUserInventoryController");

// Get all items
router.get("/items", itemController.getItems);

// Get a single item by ID
router.get("/items/:id", itemController.getItemById);

// Add a new item
router.post("/items", itemController.addItem);

// Update an item
router.put("/items/:id", itemController.updateItem);

// Delete an item
router.delete("/items/:id", itemController.deleteItem);

// Delete multiple items
router.delete("/items", itemController.deleteMultipleItems);

/////////////////////////////////////////////-ORDER-ROUTES-/////////////////////////////////////////////

const orderController = require("../../orders/controllers/manageUserOrderController");

// Get all orders with pagination
router.get("/", orderController.getOrders);

// Get a single order by ID
router.get("/:id", orderController.getOrderById);

// Add a new order
router.post("/", orderController.addOrder);

// Update an order
router.put("/:id", orderController.updateOrder);

// Delete an order
router.delete("/:id", orderController.deleteOrder);

// Delete multiple orders
router.delete("/", orderController.deleteMultipleOrders);

/////////////////////////////////////////////-SUBSCRIPTION-ROUTES-/////////////////////////////////////////////

const subscriptionController = require("../../finance/controllers/adminSubscriptionController");
const { check } = require("express-validator");

// @route   GET /api/subscriptions
// @desc    Get all subscriptions
// @access  Private/Admin
router.get("/subscriptions", subscriptionController.getSubscriptions);

// @route   GET /api/subscriptions/plans
// @desc    Get configured subscription plans with live subscriber counts
// @access  Private/Admin
router.get("/subscriptions/plans", subscriptionController.getPlans);

// @route   GET /api/subscriptions/:id
// @desc    Get single subscription
// @access  Private/Admin or Subscription Owner
router.get("/subscriptions/:id", subscriptionController.getSubscription);

// @route   POST /api/subscriptions
// @desc    Create new subscription
// @access  Private/Admin
router.post(
  "/subscriptions",
  [
    check("planName", "Plan name is required").not().isEmpty(),
    check("userEmail", "Please include a valid email").isEmail(),
    check("status", "Status is required").not().isEmpty(),
    check("endDate", "End date is required").not().isEmpty(),
    check("price", "Price must be a positive number").isFloat({ min: 0 }),
    check("userId", "User ID is required").not().isEmpty(),
  ],
  subscriptionController.createSubscription
);

// @route   PUT /api/subscriptions/:id
// @desc    Update subscription
// @access  Private/Admin or Subscription Owner
router.put("/subscriptions/:id", subscriptionController.updateSubscription);

// @route   PUT /api/subscriptions/:id/cancel
// @desc    Cancel subscription
// @access  Private/Admin or Subscription Owner
router.put(
  "/subscriptions/:id/cancel",
  subscriptionController.cancelSubscription
);

// @route   DELETE /api/subscriptions/:id
// @desc    Delete subscription
// @access  Private/Admin
router.delete("/subscriptions/:id", subscriptionController.deleteSubscription);

/////////////////////////////////////////////-TRANSACTION-ROUTES-/////////////////////////////////////////////

const {
  getTransactions,
  getTransaction,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getTransactionsByType,
} = require("../../finance/controllers/adminTransactionController");

router.route("/").get(getTransactions).post(createTransaction);
router.get("/type/:type", getTransactionsByType);
router
  .route("/:id")
  .get(getTransaction)
  .put(updateTransaction)
  .delete(deleteTransaction);

/////////////////////////////////////////////-FEEDBACK-ROUTES-/////////////////////////////////////////////

const feedbackController = require("../../moderation/controllers/manageUserFeedbackController");

// Feedback routes
router.get("/feedbacks", feedbackController.getAllFeedbacks);
router.get("/feedbacks/:id", feedbackController.getFeedbackById);
router.post("/feedbacks", feedbackController.addFeedback);
router.put("/feedbacks/:id", feedbackController.updateFeedback);
router.delete("/feedbacks/:id", feedbackController.deleteFeedback);

/////////////////////////////////////////////-REPORT-ROUTES-/////////////////////////////////////////////

const reportController = require("../../moderation/controllers/manageUserReportController");

// Get all reports
router.get("/reports", reportController.getAllReports);

// Get a single report by ID
router.get("/reports/:id", reportController.getReportById);

// Create a new report
router.post("/reports", reportController.createReport);

// Update a report
router.put("/reports/:id", reportController.updateReport);

// Delete a report
router.delete("/reports/:id", reportController.deleteReport);

/////////////////////////////////////////////-ADMIN-PROFILE-ROUTES-/////////////////////////////////////////////

const userController = require("../../settings/controllers/adminProfileController");
const { avatar } = require("../../../media/middleware/imageUploadAdminMiddleware");

// Profile routes
router.get(
  "/adminProfile/profile",
  adminAuthMiddleware,
  userController.getProfile
);
router.put(
  "/adminProfile/profile",
  adminAuthMiddleware,
  userController.updateProfile
);
router.post(
  "/adminProfile/profile/upload-pic",
  adminAuthMiddleware,
  avatar,
  userController.uploadProfilePic
);

// Password routes
router.put(
  "/adminProfile/change-password",
  adminAuthMiddleware,
  userController.updatePassword
);

// Verification route (admin only)
router.put(
  "/adminProfile/verify/:id",
  adminAuthMiddleware,
  userController.verifyUser
);

// Notification preferences routes
router.get(
  "/adminProfile/notifications",
  adminAuthMiddleware,
  userController.getNotificationPreferences
);
router.put(
  "/adminProfile/notifications",
  adminAuthMiddleware,
  userController.updateNotificationPreferences
);

// Activity logs routes
router.get(
  "/adminProfile/activity-logs",
  adminAuthMiddleware,
  userController.getActivityLogs
);
router.get(
  "/adminProfile/activity-logs/download",
  adminAuthMiddleware,
  userController.downloadActivityReport
);

// Admin-only routes
router.put(
  "/adminProfile/update-amount",
  adminAuthMiddleware,
  userController.updateUserAmount
);

/////////////////////////////////////////////-BANNER-ROUTES-/////////////////////////////////////////////
const bannerController = require("../../tasks/controllers/bannerController");
const handleImageUploads = require("../../../media/middleware/imageUploadMiddleware");

// Configure image upload middleware specifically for banners
const uploadBannerImage = handleImageUploads([
  {
    name: "image",
    folder: "banners",
    transformation: { width: 1200, height: 400, crop: "fill" },
  },
]);

// GET /api/banners - Get all banners
router.get("/banners", bannerController.getAllBanners);

// POST /api/banners - Create new banner (admin only)
router.post("/banners", uploadBannerImage, bannerController.createBanner);

// PATCH /api/banners/:id - Update banner status (admin only)
router.patch("/banners/:id", bannerController.updateBannerStatus);

// DELETE /api/banners/:id - Delete banner (admin only)
router.delete("/banners/:id", bannerController.deleteBanner);

/////////////////////////////////////////////-EVENTS-ROUTES-/////////////////////////////////////////////

const eventController = require("../../tasks/controllers/eventController");

// GET /api/events - Get all events
router.get("/events", eventController.getAllEvents);

// POST /api/events - Create new event
router.post("/events", eventController.createEvent);

// GET /api/events/:id - Get single event
router.get("/events/:id", eventController.getEventById);

// PUT /api/events/:id - Update event
router.put("/events/:id", eventController.updateEvent);

// DELETE /api/events/:id - Delete event
router.delete("/events/:id", eventController.deleteEvent);

/////////////////////////////////////////////-CALENDER-ROUTES-/////////////////////////////////////////////

const calendarController = require("../../tasks/controllers/calendarController");
const Calendar = require("../../tasks/models/calendar");

// Create a new calendar entry
router.post("/calendar", calendarController.createCalendarEntry);

// Get all calendar entries
router.get("/calendar", calendarController.getAllCalendarEntries);

// Get calendar entries for a specific date
router.get("/calendar/date/:date", async (req, res) => {
  try {
    if (!calendarController.isValidDate(req.params.date)) {
      return res.status(400).json({ message: "Invalid date format" });
    }

    const entries = await Calendar.find({
      date: new Date(req.params.date),
    }).sort({ startTime: 1 });

    res.status(200).json({
      success: true,
      count: entries.length,
      data: entries,
    });
  } catch (err) {
    console.error("Error fetching entries by date:", err);
    res.status(500).json({
      success: false,
      message: "Server error fetching entries by date",
    });
  }
});

/////////////////////////////////////////////-NOTIFICATION-ROUTES-/////////////////////////////////////////////

const notificationController = require("../../settings/controllers/adminNotificationController");

router
  .route("/notifications")
  .get(notificationController.getNotifications)
  .post(notificationController.createNotification);

router
  .route("/notifications/:id/read")
  .patch(notificationController.markAsRead);

router
  .route("/notifications/:id")
  .delete(notificationController.deleteNotification);

/////////////////////////////////////////////-SELLER-ROUTES-/////////////////////////////////////////////

const sellerController = require("../../sellers/controllers/sellerManagementController");

// Seller management routes
router.get("/sellers", sellerController.getAllSellers); // Get all sellers with pagination
router.get("/sellers/stats", sellerController.getSellerStats); // Get seller statistics
router.get("/sellers/:id", sellerController.getSeller); // Get single seller details
router.patch("/sellers/:id/status", sellerController.updateStatus); // Update seller status
router.patch("/sellers/:id/verify", sellerController.verifySeller); // Verify seller

// Get seller transaction history with pagination
router.get("/sellers/history", sellerController.getSellerHistory);

// Get single transaction details
router.get("/sellers/history/:id", sellerController.getTransactionDetails);

/////////////////////////////////////////////-ADMIN-MANAGEMENT-ROUTES-/////////////////////////////////////////////
const adminManagementController = require("../../settings/controllers/adminManagementController");

router.get("/admins", adminManagementController.getAllAdmins);
router.post("/admins", adminManagementController.createAdmin);
router.delete("/admins/:id", adminManagementController.deleteAdmin);

module.exports = router;
