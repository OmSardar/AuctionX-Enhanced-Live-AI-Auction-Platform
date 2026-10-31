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

    const updatedUser = await UserModel.findByIdAndUpdate(
      req.user._id,
      { amount },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ error: "User not found." });
    }

    res.status(200).json({
      message: "Amount updated successfully!",
      data: { amount: updatedUser.amount, name: updatedUser.name },
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

    const numericAmount = typeof user.amount === "number" && !isNaN(user.amount) ? user.amount : 0;
    res.status(200).json({ amount: numericAmount, name: user.name || user.businessName || "User" });
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

    const numericAmount = typeof user.amount === "number" && !isNaN(user.amount) ? user.amount : 0;
    res.status(200).json({ amount: numericAmount, name: user.name || user.businessName || "User" });
  } catch (error) {
    console.error("Error fetching amount:", error);
    res.status(500).json({ error: "Failed to fetch amount." });
  }
};

module.exports = {
  updateAmount,
  getAmount,
  getAmountbyEmail
};
