const mongoose = require("mongoose");

const feedbackSchema = new mongoose.Schema({
  userName: { type: String, required: true },
  userEmail: { type: String, required: true },
  phoneNumber: { type: String, required: true },
  rating: { type: Number, required: true },
  image: { type: String, required: true }, // Added image field
  ratingsDetails: [
    {
      category: { type: String, required: true },
      stars: { type: Number, required: true },
    },
  ],
});

// Check if the model already exists
const Feedback =
  mongoose.models.Feedback || mongoose.model("Feedback", feedbackSchema);

module.exports = Feedback;
