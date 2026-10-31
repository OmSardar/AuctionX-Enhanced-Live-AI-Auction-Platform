const UserModel = require("../../../users/models/user");

// Get all customers (non-admin users)
const getAllCustomers = async (req, res) => {
  try {
    const page = req.query.page ? Math.max(1, parseInt(req.query.page, 10)) : null;
    const limit = req.query.limit ? Math.min(200, Math.max(1, parseInt(req.query.limit, 10))) : null;

    let query = UserModel.find({ role: "user" })
      .select("-password -__v -resetPasswordToken -resetPasswordExpires -twoFactorSecret")
      .sort({ createdAt: -1 })
      .lean();

    if (page && limit) {
      const skip = (page - 1) * limit;
      const [total, customers] = await Promise.all([
        UserModel.countDocuments({ role: "user" }),
        query.skip(skip).limit(limit),
      ]);
      return res.status(200).json({
        success: true,
        data: customers,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    }

    const customers = await query;
    res.status(200).json({ success: true, data: customers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get a single customer by ID (only if they're not admin)
const getCustomerById = async (req, res) => {
  try {
    const customer = await UserModel.findOne({
      _id: req.params.id,
      role: "user", // Ensure the user is not an admin
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found or is an admin",
      });
    }
    res.status(200).json({ success: true, data: customer });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update a customer by ID (only if they're not admin)
const updateCustomer = async (req, res) => {
  try {
    // Prevent changing role to admin through this endpoint
    if (req.body.role === "admin") {
      return res.status(403).json({
        success: false,
        message: "Cannot change user role to admin through this endpoint",
      });
    }

    const updatedCustomer = await UserModel.findOneAndUpdate(
      {
        _id: req.params.id,
        role: "user", // Only update if they're not admin
      },
      req.body,
      { new: true }
    );

    if (!updatedCustomer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found or is an admin",
      });
    }
    res.status(200).json({ success: true, data: updatedCustomer });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete a customer by ID (only if they're not admin)
const deleteCustomer = async (req, res) => {
  try {
    const deletedCustomer = await UserModel.findOneAndDelete({
      _id: req.params.id,
      role: "user", // Only delete if they're not admin
    });

    if (!deletedCustomer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found or is an admin",
      });
    }
    res.status(200).json({
      success: true,
      message: "Customer deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Bulk delete customers by IDs (only non-admin users)
const deleteMultipleCustomers = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No customer IDs provided",
      });
    }

    // Delete only users with role "user" from the provided IDs
    const result = await UserModel.deleteMany({
      _id: { $in: ids },
      role: "user",
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "No customers found to delete (or all were admins)",
      });
    }

    res.status(200).json({
      success: true,
      message: `${result.deletedCount} customers deleted successfully`,
    });
  } catch (error) {
    console.error("Error deleting customers:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getAllCustomers,
  getCustomerById,
  updateCustomer,
  deleteCustomer,
  deleteMultipleCustomers,
};
