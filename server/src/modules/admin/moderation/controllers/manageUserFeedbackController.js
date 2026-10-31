const FeedbackUser = require("../../../feedback/models/feedbackUserSchema");

// Get all feedbacks from real user submissions
const getAllFeedbacks = async (req, res) => {
  try {
    const feedbacks = await FeedbackUser.find().sort({ createdAt: -1 });
    res.status(200).json(feedbacks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get a single feedback by ID
const getFeedbackById = async (req, res) => {
  try {
    const feedback = await FeedbackUser.findById(req.params.id);
    if (!feedback) {
      return res.status(404).json({ message: "Feedback not found" });
    }
    res.status(200).json(feedback);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Add a new feedback
const addFeedback = async (req, res) => {
  try {
    const feedback = new FeedbackUser({
      name: req.body.name || req.body.userName,
      email: req.body.email || req.body.userEmail,
      phone: req.body.phone || req.body.phoneNumber || "",
      checkbox_values: Array.isArray(req.body.checkbox_values)
        ? req.body.checkbox_values
        : req.body.rating
        ? [String(req.body.rating)]
        : [],
    });
    const savedFeedback = await feedback.save();
    res.status(201).json(savedFeedback);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Update a feedback by ID
const updateFeedback = async (req, res) => {
  try {
    const feedback = await FeedbackUser.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!feedback) {
      return res.status(404).json({ message: "Feedback not found" });
    }
    res.status(200).json(feedback);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Delete a feedback by ID
const deleteFeedback = async (req, res) => {
  try {
    const feedback = await FeedbackUser.findByIdAndDelete(req.params.id);
    if (!feedback) {
      return res.status(404).json({ message: "Feedback not found" });
    }
    res.status(200).json({ message: "Feedback deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getAllFeedbacks,
  getFeedbackById,
  addFeedback,
  updateFeedback,
  deleteFeedback,
};
