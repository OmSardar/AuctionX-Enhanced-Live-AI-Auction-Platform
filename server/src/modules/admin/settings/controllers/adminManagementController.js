const Admin = require("../../authentication/models/admin");
const bcrypt = require("bcryptjs");

/**
 * Helper to normalize admin record for frontend consumption
 */
const formatAdminRecord = (admin) => {
  const plain = admin.toObject ? admin.toObject() : { ...admin };
  delete plain.password;
  delete plain.__v;

  const fullName =
    plain.fullName ||
    `${plain.firstName || ""} ${plain.lastName || ""}`.trim() ||
    plain.email.split("@")[0];

  return {
    ...plain,
    _id: (plain._id || plain.id).toString(),
    id: (plain._id || plain.id).toString(),
    fullName,
    name: fullName,
    active: plain.status === "Active",
  };
};

/**
 * GET /api/admins
 * Paginated list of administrators with optional role/search filter
 */
exports.getAllAdmins = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 6));
    const skip = (page - 1) * limit;

    const query = {};
    if (req.query.role && req.query.role !== "all") {
      query.role = req.query.role;
    }
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      query.$or = [
        { email: searchRegex },
        { firstName: searchRegex },
        { lastName: searchRegex },
      ];
    }

    const [total, adminDocs] = await Promise.all([
      Admin.countDocuments(query),
      Admin.find(query)
        .select("-password")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    const formattedAdmins = adminDocs.map(formatAdminRecord);

    return res.status(200).json({
      success: true,
      admins: formattedAdmins,
      data: formattedAdmins,
      totalAdmins: total,
      totalPages: Math.ceil(total / limit) || 1,
      currentPage: page,
    });
  } catch (error) {
    console.error("Error fetching admins:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching administrators",
      error: error.message,
    });
  }
};

/**
 * POST /api/admins
 * Create a new administrator with role assignment and hashed password
 */
exports.createAdmin = async (req, res) => {
  try {
    const { email, role, password } = req.body;
    const fullName = req.body.fullName || req.body.name;

    if (!fullName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Full name, email, and password are required",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if admin already exists
    const existing = await Admin.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "An administrator with this email already exists",
      });
    }

    // Split fullName into firstName and lastName
    const nameParts = fullName.trim().split(/\s+/);
    const firstName = nameParts[0] || "Admin";
    const lastName = nameParts.slice(1).join(" ") || "User";

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const validRoles = ["super-admin", "admin", "editor"];
    const assignedRole = validRoles.includes(role) ? role : "admin";

    const newAdmin = new Admin({
      firstName,
      lastName,
      email: normalizedEmail,
      password: hashedPassword,
      role: assignedRole,
      status: "Active",
    });

    const saved = await newAdmin.save();
    const formatted = formatAdminRecord(saved);

    return res.status(201).json({
      success: true,
      message: "Administrator created successfully",
      admin: formatted,
      data: formatted,
    });
  } catch (error) {
    console.error("Error creating admin:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while creating administrator",
      error: error.message,
    });
  }
};

/**
 * DELETE /api/admins/:id
 * Remove an administrator (cannot self-delete)
 */
exports.deleteAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    // Self-deletion guard
    if (req.user && (req.user._id?.toString() === id || req.user.id?.toString() === id)) {
      return res.status(400).json({
        success: false,
        message: "Administrators cannot delete their own account",
      });
    }

    const deleted = await Admin.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Administrator not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Administrator removed successfully",
    });
  } catch (error) {
    console.error("Error deleting admin:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while deleting administrator",
      error: error.message,
    });
  }
};
