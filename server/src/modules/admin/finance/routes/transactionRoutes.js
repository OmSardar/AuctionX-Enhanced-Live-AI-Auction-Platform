const express = require("express");
const {
  getTransactions,
  getTransaction,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getTransactionsByType,
} = require("../controllers/adminTransactionController");

const router = express.Router();
const adminAuthMiddleware = require("../../authentication/middleware/authAdminMiddleware");

// Enforce admin authentication on transaction routes
router.use(adminAuthMiddleware);


router.route("/").get(getTransactions).post(createTransaction);
router.get("/type/:type", getTransactionsByType);
router
  .route("/:id")
  .get(getTransaction)
  .put(updateTransaction)
  .delete(deleteTransaction);

module.exports = router;
