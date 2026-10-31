// models/Feedback.js

const mongoose = require('mongoose');

const FeedbackSchema = new mongoose.Schema({
    email: { type: String, required: true },
    name: { type: String, required: true },
    phone: { type: String, required: true },
    checkbox_values: { type: [String], required: true },
}, {
    timestamps: true // This will add createdAt and updatedAt fields
});

const Feedback = mongoose.model('Feedback', FeedbackSchema);
module.exports = Feedback;
