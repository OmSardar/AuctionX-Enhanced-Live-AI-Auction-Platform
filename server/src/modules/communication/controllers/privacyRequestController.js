const PrivacyRequest = require('../models/PrivacyRequest');

// Create a new privacy or support request
exports.createPrivacyRequest = async (req, res) => {
  try {
    const { category, fullName, email, requestType, details } = req.body;

    if (!category || !fullName || !email || !requestType || !details) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (!['support', 'privacy'].includes(category)) {
      return res.status(400).json({ message: 'Invalid category. Must be support or privacy.' });
    }

    const newRequest = new PrivacyRequest({
      category,
      fullName,
      email,
      requestType,
      details
    });

    const savedRequest = await newRequest.save();

    res.status(201).json({
      success: true,
      message: `${category} request submitted successfully`,
      data: savedRequest
    });
  } catch (error) {
    console.error('Error creating request:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while processing your request',
      error: error.message
    });
  }
};

// Get all requests (optionally filter by category)
exports.getAllPrivacyRequests = async (req, res) => {
  try {
    const { category } = req.query;

    let filter = {};
    if (category) {
      if (!['support', 'privacy'].includes(category)) {
        return res.status(400).json({ message: 'Invalid category filter. Must be support or privacy.' });
      }
      filter.category = category;
    }

    const requests = await PrivacyRequest.find(filter).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: requests.length,
      data: requests
    });
  } catch (error) {
    console.error('Error fetching requests:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching requests',
      error: error.message
    });
  }
};

// Get a specific request by ID
exports.getPrivacyRequestById = async (req, res) => {
  try {
    const request = await PrivacyRequest.findById(req.params.id);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    res.status(200).json({
      success: true,
      data: request
    });
  } catch (error) {
    console.error('Error fetching request:', error);
    if (error.kind === 'ObjectId') {
      return res.status(400).json({
        success: false,
        message: 'Invalid request ID format'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error while fetching the request',
      error: error.message
    });
  }
};

// Update privacy request status
exports.updatePrivacyRequestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Validate the status
    const validStatuses = ['pending', 'in-progress', 'completed', 'rejected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value'
      });
    }

    // Find and update the request
    const updatedRequest = await PrivacyRequest.findByIdAndUpdate(
      id,
      { status },
      { new: true } // Return the updated document
    );

    if (!updatedRequest) {
      return res.status(404).json({
        success: false,
        message: 'Privacy request not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Privacy request status updated successfully',
      data: updatedRequest
    });
  } catch (error) {
    console.error('Error updating privacy request status:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating privacy request status',
      error: error.message
    });
  }
};

// Delete privacy request
exports.deletePrivacyRequest = async (req, res) => {
  try {
    const deleted = await PrivacyRequest.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Privacy request not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Privacy request deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting privacy request:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting privacy request',
      error: error.message
    });
  }
};