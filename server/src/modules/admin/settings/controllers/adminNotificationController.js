const Notification = require("../models/notification");
const User = require("../../../users/models/user");

// @desc    Get all notifications for user
// @route   GET /api/notifications
// @access  Private
exports.getNotifications = async (req, res) => {
    try {
      // Debug: Check if user exists
      if (!req.user || !req.user._id) {
        console.error('User not authenticated:', req.user);
        return res.status(401).json({ message: 'Not authenticated' });
      }
  
      const { page = 1, limit = 8, filter = 'all' } = req.query;
      const userId = req.user._id;
      
      // Build query
      let query = { 
        $or: [
          { recipients: userId },
          { recipientType: 'all' },
          { recipientType: req.user.role }
        ]
      };
  
      if (filter === 'read') query['readBy.user'] = userId;
      if (filter === 'unread') query['readBy.user'] = { $ne: userId };
  
      const notifications = await Notification.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .populate('sender', 'name email');
  
      const total = await Notification.countDocuments(query);
  
      res.json({
        notifications,
        totalPages: Math.ceil(total / limit),
        currentPage: parseInt(page),
        totalNotifications: total
      });
  
    } catch (error) {
      console.error('Notification controller error:', {
        message: error.message,
        stack: error.stack,
        user: req.user // Log the user object for debugging
      });
      res.status(500).json({ 
        message: 'Server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };

// @desc    Create a new notification
// @route   POST /api/notifications
// @access  Private (Admin/Sender)
exports.createNotification = async (req, res, next) => {
  try {
    const { title, message, recipientType, priority } = req.body;

    // Validate input
    if (!title || !message) {
      return res
        .status(400)
        .json({ message: "Title and message are required" });
    }

    // Determine recipients based on recipientType
    let recipients = [];
    if (recipientType !== "all") {
      const query = { role: recipientType };
      const users = await User.find(query).select("_id");
      recipients = users.map((user) => user._id);
    }

    const notification = new Notification({
      title,
      message,
      sender: req.user._id,
      recipients,
      recipientType,
      priority,
    });

    const createdNotification = await notification.save();

    // Here you would typically emit a real-time event (Socket.io, etc.)

    res.status(201).json(createdNotification);
  } catch (error) {
    next(error);
  }
};

// @desc    Mark notification as read
// @route   PATCH /api/notifications/:id/read
// @access  Private
exports.markAsRead = async (req, res, next) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    // Check if user is a recipient
    const isRecipient =
      notification.recipientType === "all" ||
      notification.recipients.includes(req.user._id) ||
      notification.recipientType === req.user.role;

    if (!isRecipient) {
      return res
        .status(403)
        .json({ message: "Not authorized to view this notification" });
    }

    // Check if already read
    const alreadyRead = notification.readBy.some(
      (r) => r.user.toString() === req.user._id.toString()
    );

    if (!alreadyRead) {
      notification.readBy.push({ user: req.user._id });
      await notification.save();
    }

    res.json(notification);
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a notification
// @route   DELETE /api/notifications/:id
// @access  Private (Admin/Sender)
exports.deleteNotification = async (req, res, next) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    // Check if user is sender or admin
    if (
      notification.sender.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to delete this notification" });
    }

    await notification.remove();

    res.json({ message: "Notification removed" });
  } catch (error) {
    next(error);
  }
};
