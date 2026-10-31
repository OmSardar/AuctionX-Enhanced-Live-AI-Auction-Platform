const SellerModel = require("../models/seller");

const updateAmount = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required." });
  }

  const isSeller = req.user.role === "seller" || req.user.isSeller;
  const isAdmin = req.user.role === "admin";
  if (!isSeller && !isAdmin) {
    return res.status(403).json({ error: "Access denied: Seller privileges required." });
  }

  const { email, amount } = req.body;
  const targetEmail = (email || req.user.email || "").trim().toLowerCase();
  const callerEmail = (req.user.email || "").trim().toLowerCase();

  if (targetEmail !== callerEmail && !isAdmin) {
    return res.status(403).json({ error: "Forbidden: Not authorized to update amount for this seller." });
  }

  if (amount === undefined || isNaN(amount) || amount < 0) {
    return res.status(400).json({ error: "Amount is required and must be a non-negative number." });
  }

  try {
    const updatedPayment = await SellerModel.findOneAndUpdate(
      { email: targetEmail },
      { amount },
      { new: true }
    );

    if (!updatedPayment) {
      return res.status(404).json({ error: "Seller not found." });
    }

    res
      .status(200)
      .json({ message: "Amount updated successfully!", data: updatedPayment });
  } catch (error) {
    console.error("Error updating amount in the database:", error);
    res.status(500).json({ error: "Failed to update amount." });
  }
};

const getAmount = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required." });
  }

  const isSeller = req.user.role === "seller" || req.user.isSeller;
  const isAdmin = req.user.role === "admin";
  if (!isSeller && !isAdmin) {
    return res.status(403).json({ error: "Access denied: Seller privileges required." });
  }

  const targetEmail = (req.query.email || req.user.email || "").trim().toLowerCase();
  const callerEmail = (req.user.email || "").trim().toLowerCase();

  if (targetEmail !== callerEmail && !isAdmin) {
    return res.status(403).json({ error: "Forbidden: Not authorized to view amount for this seller." });
  }

  try {
    const user = await SellerModel.findOne({ email: targetEmail });
    if (!user) {
      return res.status(404).json({ error: "Seller not found." });
    }

    res.status(200).json({ amount: user.amount, name: user.name });
  } catch (error) {
    console.error("Error fetching amount:", error);
    res.status(500).json({ error: "Failed to fetch amount." });
  }
};

module.exports = {
  updateAmount,
  getAmount,
};

