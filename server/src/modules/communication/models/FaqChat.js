const mongoose = require('mongoose');

// FAQ Schema and Model
const faqSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true,
    unique: true
  },
  answer: {
    type: String,
    required: true
  },
  category: {
    type: String,
    default: 'General'
  },
  tags: [String]
});

// Create text index for search functionality
faqSchema.index({ question: 'text', tags: 'text' });

const FAQ = mongoose.model('FAQ', faqSchema);

module.exports = FAQ;