// FILE: controllers/userController.js
const User = require("../../../users/models/user");
const ActivityLog = require("../../authentication/models/activityLog");
const bcrypt = require("bcrypt");
const path = require("path");
const fs = require("fs");
const PDFDocument = require("pdfkit");

// Helper function to log user activity
const logActivity = async (userId, activity, type, req) => {
  try {
    await ActivityLog.create({
      userId,
      activity,
      type,
      ipAddress: req.ip,
      device: req.headers["user-agent"],
      timestamp: new Date(),
    });
  } catch (error) {
    console.error("Error logging activity:", error);
  }
};

// exports.getProfile = async (req, res) => {
//   try {
//     const user = await User.findById(req.userId).select("-password");

//     if (!user) {
//       return res.status(404).json({ message: "User not found" });
//     }

//     res.status(200).json(user);
//   } catch (error) {
//     console.error("Error fetching user profile:", error);
//     res.status(500).json({ message: "Server error" });
//   }
// };

// exports.getProfile = async (req, res) => {
//   try {
//     const user = await User.findOne({ email: req.email }).select("-password");

//     if (!user) {
//       return res.status(404).json({ message: "User not found" });
//     }

//     res.status(200).json(user);
//   } catch (error) {
//     console.error("Error fetching user profile:", error);
//     res.status(500).json({ message: "Server error" });
//   }
// };

// Fix getProfile method
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("+password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const userObj = user.toObject ? user.toObject() : { ...user._doc };
    const hasPassword = Boolean(userObj.password && userObj.password.length > 0);
    const isOAuthUser = Boolean(userObj.isOAuthUser || (userObj.googlePhoto && userObj.googlePhoto.length > 0));
    delete userObj.password;
    userObj.hasPassword = hasPassword;
    userObj.isOAuthUser = isOAuthUser;
    res.status(200).json(userObj);
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Fix uploadProfilePic method
exports.uploadProfilePic = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const profilePicData = {
      secure_url: `/uploads/avatars/${req.file.filename}`,
      public_id: `avatars/${Date.now()}-${req.file.originalname}`,
    };

    const user = await User.findByIdAndUpdate(
      req.userId,
      { profilePic: profilePicData },
      { new: true }
    ).select("-password");

    if (!user) {
      fs.unlinkSync(
        path.join(__dirname, "..", "..", "public", profilePicData.secure_url)
      );
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ profilePic: user.profilePic });
  } catch (error) {
    console.error("Error uploading profile picture:", error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const {
      name,
      email,
      phoneNo,
      alternativePhoneNo,
      address,
      city,
      state,
      country,
      pinCode,
      gender,
    } = req.body;

    // Check if email is already in use by another user
    if (email) {
      const existingUser = await User.findOne({
        email,
        _id: { $ne: req.userId },
      });
      if (existingUser) {
        return res.status(400).json({ message: "Email is already in use" });
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.userId,
      {
        name,
        email,
        phoneNo,
        alternativePhoneNo,
        address,
        city,
        state,
        country,
        pinCode,
        gender,
        isNewUser: false, // Update to show user has completed profile
      },
      { new: true }
    ).select("-password");

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Log the activity
    await logActivity(req.userId, "Updated profile information", "update", req);

    res.status(200).json(updatedUser);
  } catch (error) {
    console.error("Error updating user profile:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// exports.uploadProfilePic = async (req, res) => {
//   try {
//     if (!req.file) {
//       return res.status(400).json({ message: "No file uploaded" });
//     }

//     // Assuming you're using cloudinary or similar service
//     // This is a placeholder for actual image upload logic
//     const profilePicData = {
//       secure_url: `/uploads/profile-pics/${req.file.filename}`,
//       public_id: `profile-pics/${Date.now()}-${req.file.originalname}`,
//     };

//     const user = await User.findByIdAndUpdate(
//       req.userId,
//       {
//         profilePic: [profilePicData],
//         isNewUser: false, // Update to show user has uploaded profile pic
//       },
//       { new: true }
//     ).select("-password");

//     if (!user) {
//       // Delete the uploaded file if user not found
//       fs.unlinkSync(
//         path.join(__dirname, "..", "public", profilePicData.secure_url)
//       );
//       return res.status(404).json({ message: "User not found" });
//     }

//     // Log the activity
//     await logActivity(req.userId, "Updated profile picture", "update", req);

//     res.status(200).json({ profilePic: user.profilePic });
//   } catch (error) {
//     console.error("Error uploading profile picture:", error);
//     res.status(500).json({ message: "Server error" });
//   }
// };

exports.updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.password || user.password.length === 0) {
      return res.status(400).json({
        message: "Password management is unavailable for Google sign-in accounts.",
      });
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password
    );
    if (!isPasswordValid) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password and mark as not a new user
    user.password = hashedPassword;
    user.isNewUser = false;
    await user.save();

    // Log the activity
    await logActivity(req.userId, "Changed account password", "security", req);

    res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Error updating password:", error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.verifyUser = async (req, res) => {
  try {
    const userId = req.params.id;

    const user = await User.findByIdAndUpdate(
      userId,
      { isVerified: true },
      { new: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Log the activity (assuming admin is verifying the user)
    await logActivity(
      req.userId, // admin id
      `Verified user ${userId}`,
      "verification",
      req
    );

    res.status(200).json({ message: "User verified successfully", user });
  } catch (error) {
    console.error("Error verifying user:", error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getNotificationPreferences = async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(
      user.notificationPreferences || {
        emailAlerts: true,
        loginAlerts: true,
        systemUpdates: false,
        weeklyReports: true,
      }
    );
  } catch (error) {
    console.error("Error fetching notification preferences:", error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.updateNotificationPreferences = async (req, res) => {
  try {
    const preferences = req.body;

    const user = await User.findByIdAndUpdate(
      req.userId,
      { notificationPreferences: preferences },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Log the activity
    await logActivity(
      req.userId,
      "Updated notification preferences",
      "update",
      req
    );

    res.status(200).json(user.notificationPreferences);
  } catch (error) {
    console.error("Error updating notification preferences:", error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getActivityLogs = async (req, res) => {
  try {
    // Get pagination parameters from query string
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Get total count for pagination info
    const total = await ActivityLog.countDocuments({ userId: req.userId });

    // Get logs with pagination
    const logs = await ActivityLog.find({ userId: req.userId })
      .sort({ timestamp: -1 }) // Most recent first
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      logs,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching activity logs:", error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.downloadActivityReport = async (req, res) => {
  try {
    // Get date range from query params or use default (last 30 days)
    const endDate = new Date();
    const startDate =
      new Date(req.query.startDate) ||
      new Date(endDate.setDate(endDate.getDate() - 30));

    // Find logs within the date range
    const logs = await ActivityLog.find({
      userId: req.userId,
      timestamp: { $gte: startDate, $lte: endDate },
    }).sort({ timestamp: -1 });

    // Create PDF document
    const doc = new PDFDocument();
    const filename = `activity_report_${req.userId}_${Date.now()}.pdf`;

    // Set response headers
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);

    // Pipe PDF to response
    doc.pipe(res);

    // Add content to PDF
    doc.fontSize(16).text("Activity Log Report", { align: "center" });
    doc.moveDown();
    doc.fontSize(12).text(`Generated: ${new Date().toLocaleString()}`);
    doc
      .fontSize(12)
      .text(
        `Date Range: ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`
      );
    doc.moveDown();

    // Add table header
    doc.fontSize(10).text("Activity", 50, doc.y, { width: 200 });
    doc.text("Type", 250, doc.y - 10, { width: 80 });
    doc.text("IP Address", 330, doc.y - 10, { width: 100 });
    doc.text("Date & Time", 430, doc.y - 10, { width: 100 });
    doc.moveDown();
    doc.rect(50, doc.y - 5, 500, 2).fill("#000000");
    doc.moveDown();

    // Add table rows
    logs.forEach((log) => {
      doc.fontSize(9).text(log.activity, 50, doc.y, { width: 200 });
      doc.text(log.type, 250, doc.y - 9, { width: 80 });
      doc.text(log.ipAddress, 330, doc.y - 9, { width: 100 });
      doc.text(new Date(log.timestamp).toLocaleString(), 430, doc.y - 9, {
        width: 100,
      });
      doc.moveDown();
    });

    // Finalize the PDF and end the stream
    doc.end();

    // Log the activity
    await logActivity(req.userId, "Downloaded activity report", "report", req);
  } catch (error) {
    console.error("Error generating activity report:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Admin-specific controller for managing user amounts
exports.updateUserAmount = async (req, res) => {
  try {
    const { userId, amount } = req.body;

    // Check if requester is an admin
    const requester = await User.findById(req.userId);
    if (!requester || requester.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Unauthorized: Admin access required" });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { amount },
      { new: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Log the activity
    await logActivity(
      req.userId,
      `Updated amount for user ${userId} to ${amount}`,
      "financial",
      req
    );

    res.status(200).json({ message: "User amount updated successfully", user });
  } catch (error) {
    console.error("Error updating user amount:", error);
    res.status(500).json({ message: "Server error" });
  }
};
