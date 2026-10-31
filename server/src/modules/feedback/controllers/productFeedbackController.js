// controllers/productFeedbackController.js
const ProductFeedback = require("../models/ProductFeedback");

exports.createFeedback = async (req, res) => {
  try {
const { productName, rating, reviewText, orderId, userEmail, sellerEmail } = req.body;

 if (!productName || !rating || !reviewText || !orderId || !userEmail || !sellerEmail) {
  return res.status(400).json({ 
    success: false,
    message: "All required fields must be filled including user and seller email." 
  });
}


    // Validate rating range
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ 
        success: false,
        message: "Rating must be between 1 and 5." 
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userEmail)) {
      return res.status(400).json({ 
        success: false,
        message: "Please provide a valid email address." 
      });
    }
    if (!emailRegex.test(sellerEmail)) {
  return res.status(400).json({ 
    success: false,
    message: "Please provide a valid seller email address." 
  });
}


    const productImage = req.cloudinaryUploads?.productImage?.[0]?.secure_url;
    const additionalPhotos = req.cloudinaryUploads?.additionalPhotos?.map(photo => photo.secure_url) || [];

    if (!productImage) {
      return res.status(400).json({ 
        success: false,
        message: "Product image is required." 
      });
    }

    // Check for existing feedback
    const existingFeedback = await ProductFeedback.findOne({ orderId });
    if (existingFeedback) {
      return res.status(400).json({ 
        success: false,
        message: "Feedback already submitted for this order." 
      });
    }
const newFeedback = new ProductFeedback({
  productName,
  productImage,
  rating: Number(rating),
  reviewText,
  additionalPhotos,
  orderId,
  userEmail: userEmail.toLowerCase().trim(),
  sellerEmail: sellerEmail.toLowerCase().trim(),
});

    await newFeedback.save();
    
    res.status(201).json({ 
      success: true,
      message: "Feedback submitted successfully", 
      feedback: newFeedback 
    });
  } catch (error) {
    console.error("Error submitting feedback:", error);
    res.status(500).json({ 
      success: false,
      message: "Failed to submit feedback", 
      error: error.message 
    });
  }
};

exports.getAllFeedback = async (req, res) => {
  try {
    const feedbackList = await ProductFeedback.find().sort({ createdAt: -1 });
    res.json(feedbackList);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch feedback", error: error.message });
  }
};

exports.getFeedbackBySellerEmail = async (req, res) => {
  try {
    const { sellerEmail } = req.params;

    if (!sellerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sellerEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid seller email.",
      });
    }

    const feedbacks = await ProductFeedback.find({ sellerEmail: sellerEmail.toLowerCase().trim() });

    if (feedbacks.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No feedbacks found for the provided seller email.",
      });
    }

    res.status(200).json({
      success: true,
      feedbacks,
    });
  } catch (error) {
    console.error("Error fetching feedbacks:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while fetching feedbacks.",
      error: error.message,
    });
  }
};