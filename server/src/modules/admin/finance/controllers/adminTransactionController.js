const Transaction = require("../models/transaction");
const { runWalletReconciliation } = require("../../../payments/services/walletReconciliationService");

// @desc    Run wallet reconciliation & escrow invariant scan
// @route   GET /api/transactions/wallet-reconciliation
// @access  Private (Admin)
exports.getWalletReconciliation = async (req, res) => {
  try {
    // Strictly read-only audit: autoRepair is forced to false
    const autoRepair = false;
    const report = await runWalletReconciliation({ autoRepair });
    res.json({
      success: true,
      ...report,
    });
  } catch (err) {
    console.error("Error running wallet reconciliation:", err);
    res.status(500).json({
      success: false,
      error: "Failed to run wallet reconciliation",
      details: err.message,
    });
  }
};

// @desc    Get all transactions with pagination
// @route   GET /api/transactions
// @access  Private
// @desc    Execute authorized, audited wallet reconciliation repair
// @route   POST /api/transactions/wallet-reconciliation/repair
// @access  Private (Admin only)
exports.postWalletReconciliationRepair = async (req, res) => {
  try {
    const report = await runWalletReconciliation({ autoRepair: true });

    const adminEmail = req.admin?.email || req.user?.email || "admin@auctionx.com";
    await Transaction.create([
      {
        userId: req.admin?._id || req.user?._id,
        userEmail: adminEmail,
        name: req.admin?.name || req.user?.name || "Administrator",
        type: "ADMIN_RECONCILIATION_REPAIR",
        amount: 0,
        reference: `Executed wallet escrow reconciliation repair (${report.summary.discrepancyCount} discrepancies investigated)`,
        metadata: {
          adminEmail,
          discrepancyCount: report.summary.discrepancyCount,
          repairedAt: new Date().toISOString(),
        },
      },
    ]);

    res.json({
      success: true,
      message: "Wallet reconciliation repair executed and audited successfully",
      ...report,
    });
  } catch (err) {
    console.error("Error executing wallet reconciliation repair:", err);
    res.status(500).json({
      success: false,
      error: "Failed to execute wallet reconciliation repair",
      details: err.message,
    });
  }
};

exports.getTransactions = async (req, res) => {
  try {
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const skip = (page - 1) * limit;

    // Build query
    const query = {};

    // Optional: Add filters based on query params
    if (req.query.userEmail) {
      query.userEmail = req.query.userEmail;
    }
    if (req.query.type) {
      query.type = req.query.type;
    }
    if (req.query.name) {
      query.name = { $regex: req.query.name, $options: 'i' };
    }

    // Get transactions with total count for pagination
    const [transactions, total] = await Promise.all([
      Transaction.find(query).sort({ date: -1 }).skip(skip).limit(limit),
      Transaction.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      count: transactions.length,
      total,
      totalPages,
      currentPage: page,
      transactions,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
};

// @desc    Get single transaction
// @route   GET /api/transactions/:id
// @access  Private
exports.getTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: "Transaction not found",
      });
    }

    const isAdmin = req.admin || ["admin", "super-admin", "editor"].includes(req.user?.role);
    if (
      !isAdmin &&
      transaction.userEmail &&
      req.user?.email &&
      transaction.userEmail.toLowerCase() !== req.user.email.toLowerCase()
    ) {
      return res.status(403).json({
        success: false,
        error: "Access denied: You do not own this transaction",
      });
    }

    res.json({
      success: true,
      data: transaction,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
};

exports.getTransactionsByType = async (req, res) => {
  try {
    const { type } = req.params;

    // Validate type
    if (!["deposit", "withdrawal"].includes(type)) {
      return res.status(400).json({ error: "Invalid transaction type. Must be 'deposit' or 'withdrawal'" });
    }

    const transactions = await Transaction.find({ type })
      .sort({ date: -1 }); // Newest first

    res.json(transactions);
  } catch (error) {
    console.error("Error fetching transactions by type:", error);
    res.status(500).json({ error: "Server error" });
  }
};



// @desc    Create new transaction
// @route   POST /api/transactions
// @access  Private
exports.createTransaction = async (req, res) => {
  try {
    const { userEmail, name, type, amount } = req.body;

    const transaction = await Transaction.create({
      userEmail,
      name,
      type,
      amount,
    });

    res.status(201).json({
      success: true,
      data: transaction,
    });
  } catch (err) {
    console.error(err);
    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors).map((val) => val.message);
      return res.status(400).json({
        success: false,
        error: messages,
      });
    } else {
      res.status(500).json({
        success: false,
        error: "Server Error",
      });
    }
  }
};

// @desc    Update transaction
// @route   PUT /api/transactions/:id
// @access  Private
exports.updateTransaction = async (req, res) => {
  try {
    const { status, notes } = req.body;
    const allowedStatuses = ["pending", "completed", "failed", "rejected", "processing"];
    const updateData = {};

    if (status !== undefined) {
      const normalizedStatus = String(status).toLowerCase();
      if (!allowedStatuses.includes(normalizedStatus)) {
        return res.status(400).json({
          success: false,
          error: `Invalid status. Must be one of: ${allowedStatuses.join(", ")}`,
        });
      }
      updateData.status = normalizedStatus;
    }

    if (notes !== undefined) {
      updateData.notes = String(notes);
    }

    const transaction = await Transaction.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: "Transaction not found",
      });
    }

    res.json({
      success: true,
      data: transaction,
    });
  } catch (err) {
    console.error("Error updating transaction:", err);
    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors).map((val) => val.message);
      return res.status(400).json({
        success: false,
        error: messages,
      });
    } else {
      res.status(500).json({
        success: false,
        error: "Server Error",
      });
    }
  }
};

// @desc    Delete transaction
// @route   DELETE /api/transactions/:id
// @access  Private
exports.deleteTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.findByIdAndDelete(req.params.id);

    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: "Transaction not found",
      });
    }

    res.json({
      success: true,
      message: "Transaction deleted successfully",
      data: {},
    });
  } catch (err) {
    console.error("Error deleting transaction:", err);
    res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
};
