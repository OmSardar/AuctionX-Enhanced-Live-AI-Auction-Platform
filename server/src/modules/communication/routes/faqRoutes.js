const express = require('express');
const faqController = require('../controllers/faqController');
const adminAuthMiddleware = require('../../admin/authentication/middleware/authAdminMiddleware');

const router = express.Router();

// Public routes
router.get('/search-faq', faqController.search);
router.get('/faqs', faqController.getAllFaqs);

// Admin-protected routes
router.post('/faqs', adminAuthMiddleware, faqController.createFaq);
router.put('/faqs/:id', adminAuthMiddleware, faqController.updateFaq);
router.delete('/faqs/:id', adminAuthMiddleware, faqController.deleteFaq);

module.exports = router;