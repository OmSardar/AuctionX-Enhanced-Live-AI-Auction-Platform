const mongoose = require('mongoose');

const goodieSchema = new mongoose.Schema({
  name: { type: String, required: true },
  keyFeatures: [{ type: String }],
  category: { type: String, required: true, index: true },
  price: { type: Number, required: true },
  stock: { type: Number, required: true },
  images: [{ type: String }],
  description: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Goodie', goodieSchema);
