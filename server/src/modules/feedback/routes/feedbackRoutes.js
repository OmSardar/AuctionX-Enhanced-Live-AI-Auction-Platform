// routes/feedbackRoutes.js

const express = require('express');
const router = express.Router();

const feedbackController = require('../controllers/feedbackUserController');
const adminAuthMiddleware = require('../../admin/authentication/middleware/authAdminMiddleware');

// POST - Create new feedback (public user submission)
router.post('/', feedbackController.createFeedbackUser);
router.post('/create', feedbackController.createFeedbackUser);

// GET - Get all feedbacks (admin protected)
router.get('/', adminAuthMiddleware, feedbackController.getAllFeedback);

// GET - Get feedback by email (admin protected)
router.get('/email/:email', adminAuthMiddleware, feedbackController.getFeedbackByEmail);

// DELETE - Delete feedback by ID (admin protected)
router.delete('/:id', adminAuthMiddleware, feedbackController.deleteFeedbackUser);

module.exports = router;
