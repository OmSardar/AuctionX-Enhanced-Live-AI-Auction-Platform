const express = require("express");
const jwt = require("jsonwebtoken");
const {
  getTransactions,
  getTransaction,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getTransactionsByType,
  getWalletReconciliation,
  postWalletReconciliationRepair,
} = require("../controllers/adminTransactionController");

const router = express.Router();
const adminAuthMiddleware = require("../../authentication/middleware/authAdminMiddleware");
const authUserMiddleware = require("../../../users/middleware/authUserMiddleware");

/**
 * Composite Auth Middleware for Transactions:
 * - Allows administrative roles full management access across all users.
 * - Allows authenticated standard users to view and record only their own transactions.
 */
const authAdminOrUser = async (req, res, next) => {
  let token;
  if (req.cookies && (req.cookies.adminToken || req.cookies.token)) {
    token = req.cookies.adminToken || req.cookies.token;
  }
  const authHeader = req.headers.authorization;
  if (!token && authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Authentication required: No token provided",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const isAdmin = decoded.role && ["admin", "super-admin", "editor"].includes(decoded.role);

    if (isAdmin) {
      return adminAuthMiddleware(req, res, next);
    }

    return authUserMiddleware(req, res, () => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      // Enforce strict ownership scoping
      if (req.method === "GET") {
        // Standard user can only read their own transactions
        req.query.userEmail = req.user.email;
      } else if (req.method === "POST") {
        if (req.body.userEmail && req.body.userEmail.toLowerCase() !== req.user.email.toLowerCase()) {
          return res.status(403).json({
            success: false,
            message: "Access denied: Cannot record transactions for other users",
          });
        }
        req.body.userEmail = req.user.email;
        req.body.userId = req.user._id;
      }

      next();
    });
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized: Invalid or expired token",
    });
  }
};

// Root routes (User & Admin accessible, scoped by ownership for non-admin users)
router.route("/").get(authAdminOrUser, getTransactions).post(authAdminOrUser, createTransaction);

// Administrative only routes (MUST precede parameterized /:id to prevent route hijacking)
router.get("/wallet-reconciliation", adminAuthMiddleware, getWalletReconciliation);
router.post("/wallet-reconciliation/repair", adminAuthMiddleware, postWalletReconciliationRepair);
router.get("/type/:type", adminAuthMiddleware, getTransactionsByType);

// Parameterized routes (User & Admin for GET, Admin only for mutations)
router
  .route("/:id")
  .get(authAdminOrUser, getTransaction)
  .put(adminAuthMiddleware, updateTransaction)
  .delete(adminAuthMiddleware, deleteTransaction);

module.exports = router;
