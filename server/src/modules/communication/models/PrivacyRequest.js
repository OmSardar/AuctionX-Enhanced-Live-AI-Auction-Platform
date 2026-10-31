const mongoose = require('mongoose');

const PrivacyRequestSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  requestType: {
    type: String,
    required: true,
    enum: ['access', 'delete', 'correct', 'optout', 'other' ,'Bidding Issues' ,'Payment Issues', 'Account Questions','Item Questions','Shipping & Delivery','Other']
  },
  details: {
    type: String,
    required: true
  },
  status: {
    type: String,
    default: 'pending',
    enum: ['pending', 'in-progress', 'completed', 'rejected']
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('PrivacyRequest', PrivacyRequestSchema);