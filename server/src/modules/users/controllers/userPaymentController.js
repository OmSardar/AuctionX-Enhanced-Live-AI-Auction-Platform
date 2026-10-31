// controllers/LoginControllers/UserLoginController/UserPaymentController.js

const UserModel = require("../models/user");
const SellerModel = require("../../sellers/accounts/models/seller");

// ✅ PATCH: Update user amount (HIGH-03 fix: always use authenticated user)
const updateAmount = async (req, res) => {
  const { amount } = req.body;

  if (amount === undefined || isNaN(amount) || amount < 0) {
    return res.status(400).json({ error: "Amount is required and must be a non-negative number." });
  }

  try {
    // Always use authenticated user's ID — prevents IDOR
    if (!req.user || !req.user._id) {
      return res.status(401).json({ error: "Authentication required." });
    }

    const user = await UserModel.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const currentReserved =
      typeof user.reservedAmount === "number" && !isNaN(user.reservedAmount)
        ? user.reservedAmount
        : 0;
    const requestedTotal = Math.round(Number(amount) * 100) / 100;

    // Enforce invariant: Total wallet funds cannot be reduced below reserved escrow funds
    if (requestedTotal < currentReserved) {
      const currentAvailable = Math.round(((user.amount || 0) - currentReserved) * 100) / 100;
      return res.status(400).json({
        error: `Cannot reduce wallet balance below active reservations of ₹${currentReserved}. Available balance is ₹${currentAvailable}.`,
        code: "RESERVED_FUNDS_LOCKED",
        reservedBalance: currentReserved,
        availableBalance: currentAvailable,
      });
    }

    user.amount = requestedTotal;
    const updatedUser = await user.save();

    const availableBalance = Math.round((updatedUser.amount - (updatedUser.reservedAmount || 0)) * 100) / 100;

    res.status(200).json({
      message: "Amount updated successfully!",
      data: {
        amount: updatedUser.amount,
        totalBalance: updatedUser.amount,
        reservedBalance: updatedUser.reservedAmount || 0,
        availableBalance,
        name: updatedUser.name,
      },
    });
  } catch (error) {
    console.error("Error updating amount:", error.message);
    res.status(500).json({ error: "Failed to update amount." });
  }
};

// ✅ GET: Get user amount (requires protectRoute)
const getAmount = async (req, res) => {
  try {
    let user = await UserModel.findById(req.user._id);
    if (!user) {
      user = await SellerModel.findById(req.user._id);
    }

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const totalBalance = typeof user.amount === "number" && !isNaN(user.amount) ? user.amount : 0;
    const reservedBalance =
      typeof user.reservedAmount === "number" && !isNaN(user.reservedAmount)
        ? user.reservedAmount
        : 0;
    const availableBalance = Math.round((totalBalance - reservedBalance) * 100) / 100;

    res.status(200).json({
      amount: totalBalance,
      totalBalance,
      reservedBalance,
      availableBalance,
      name: user.name || user.businessName || "User",
    });
  } catch (error) {
    console.error("Error fetching amount:", error);
    res.status(500).json({ error: "Failed to fetch amount." });
  }
};

const getAmountbyEmail = async (req, res) => {
  try {
    const email = req.params.email;

    if (!email) {
      return res.status(400).json({ error: "Email is required." });
    }

    let user = await UserModel.findOne({ email });
    if (!user) {
      user = await SellerModel.findOne({ email });
    }

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const totalBalance = typeof user.amount === "number" && !isNaN(user.amount) ? user.amount : 0;
    const reservedBalance =
      typeof user.reservedAmount === "number" && !isNaN(user.reservedAmount)
        ? user.reservedAmount
        : 0;
    const availableBalance = Math.round((totalBalance - reservedBalance) * 100) / 100;

    res.status(200).json({
      amount: totalBalance,
      totalBalance,
      reservedBalance,
      availableBalance,
      name: user.name || user.businessName || "User",
    });
  } catch (error) {
    console.error("Error fetching amount:", error);
    res.status(500).json({ error: "Failed to fetch amount." });
  }
};

module.exports = {
  updateAmount,
  getAmount,
  getAmountbyEmail,
};
