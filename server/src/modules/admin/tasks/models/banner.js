const mongoose = require('mongoose');

const bannerSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  link: {
    type: String,
    trim: true
  },
  position: {
    type: String,
    required: true,
    enum: ['top', 'sidebar', 'footer', 'popup'],
    default: 'top'
  },
  imageUrl: {
    type: String,
    required: true
  },
  imagePublicId: {
    type: String
  },
  startDate: {
    type: Date
  },
  endDate: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for better query performance
bannerSchema.index({ position: 1 });
bannerSchema.index({ isActive: 1 });
bannerSchema.index({ startDate: 1 });
bannerSchema.index({ endDate: 1 });

const Banner = mongoose.model('Banner', bannerSchema);

module.exports = Banner;