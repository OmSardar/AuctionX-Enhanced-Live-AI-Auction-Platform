// controllers/feedbackController.js

const FeedbackUser = require('../models/feedbackUserSchema');

// POST - Create new feedback user
exports.createFeedbackUser = async (req, res) => {
    try {
        const { email, name, phone, checkbox_values } = req.body;

        if (!email || !name) {
            return res.status(400).json({ message: 'Name and email are required' });
        }

        const newFeedbackUser = new FeedbackUser({
            email,
            name,
            phone: phone || '',
            checkbox_values: Array.isArray(checkbox_values) ? checkbox_values : []
        });

        const savedFeedbackUser = await newFeedbackUser.save();
        res.status(201).json(savedFeedbackUser);
    } catch (err) {
        console.error("Feedback creation error:", err);
        res.status(500).json({ message: 'Server error' });
    }
};

// GET - Get all feedbacks
exports.getAllFeedback = async (req, res) => {
    try {
        const feedbacks = await FeedbackUser.find().sort({ createdAt: -1 });
        res.status(200).json(feedbacks);
    } catch (err) {
        console.error("Feedback fetch error:", err);
        res.status(500).json({ message: 'Server error' });
    }
};

// GET - Get feedbacks by email
exports.getFeedbackByEmail = async (req, res) => {
    try {
        const email = req.params.email;

        const feedbacks = await FeedbackUser.find({ email });

        if (!feedbacks.length) {
            return res.status(404).json({ message: 'No feedback found for this email' });
        }

        res.status(200).json(feedbacks);
    } catch (err) {
        console.error("Feedback fetch by email error:", err);
        res.status(500).json({ message: 'Server error' });
    }
};

// DELETE - Delete feedback by ID (admin action)
exports.deleteFeedbackUser = async (req, res) => {
    try {
        const deleted = await FeedbackUser.findByIdAndDelete(req.params.id);
        if (!deleted) {
            return res.status(404).json({ message: 'Feedback not found' });
        }
        res.status(200).json({ success: true, message: 'Feedback deleted successfully' });
    } catch (err) {
        console.error("Feedback deletion error:", err);
        res.status(500).json({ message: 'Server error' });
    }
};
