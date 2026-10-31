const UserModel = require("../../../users/models/user");
const Feedback = require("../../../products/models/feedbackSchema");
const Order = require("../../../orders/models/orderSchema");

// Controller to get all users
const getCustomers = async (req, res) => {
  try {
    const users = await UserModel.find();
    res.status(200).json({ total: users.length, users });
  } catch (error) {
    console.error("Error fetching users:", error.message);
    res.status(500).json({ error: "Failed to fetch users" });
  }
};

const getTotalRevenue = async (req, res) => {
  try {
    // Fetch all orders from the database
    const orders = await Order.find();

    // Calculate 30% of the highest bid for each order
    const totalRevenue = orders.reduce((acc, order) => {
      // Use the highest bid or the bidding start price if there's no highest bid
      const highestBid =
        order.highestBid > 0 ? order.highestBid : order.biddingStartPrice;

      // Add 30% of the highest bid to the total revenue
      return acc + highestBid * 0.3;
    }, 0);

    // Return the total revenue
    res.status(200).json({ totalRevenue: totalRevenue.toFixed(2) });
  } catch (error) {
    console.error("Error fetching total revenue:", error.message);
    res.status(500).json({ error: "Failed to fetch total revenue" });
  }
};

// Delete a user by ID
const deleteCustomer = async (req, res) => {
  const { id } = req.params;
  try {
    const deletedUser = await UserModel.findByIdAndDelete(id);
    if (!deletedUser) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ message: "User deleted successfully", deletedUser });
  } catch (error) {
    res.status(500).json({ message: "Error deleting user", error });
  }
};

// Controller for getting all feedback entries
const getAllFeedback = async (req, res) => {
  try {
    const entries = await Feedback.find();
    res.json(entries);
  } catch (error) {
    console.error("Error fetching submissions:", error);
    res.status(500).send("Server Error");
  }
};

module.exports = {
  getCustomers,
  deleteCustomer,
  getAllFeedback,
  getTotalRevenue,
};
