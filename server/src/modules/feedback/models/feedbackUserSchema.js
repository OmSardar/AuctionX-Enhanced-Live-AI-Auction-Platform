const mongoose = require('mongoose');

const FeedbackUserSchema = new mongoose.Schema({
    email: { type: String, required: true },
    name: { type: String, required: true },
    phone: { type: String, required: true },
    checkbox_values: { type: [String], required: true },
}, {
    timestamps: true // adds createdAt and updatedAt
});

const FeedbackUser = mongoose.models.FeedbackUser || mongoose.model('FeedbackUser', FeedbackUserSchema);
module.exports = FeedbackUser;