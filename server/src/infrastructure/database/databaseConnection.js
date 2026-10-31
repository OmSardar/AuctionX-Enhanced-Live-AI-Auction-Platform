const mongoose = require("mongoose");

const DbCon = async () => {
  try {
    // Set recommended Mongoose options
    mongoose.set("strictQuery", true);

    await mongoose.connect(process.env.MONGODB_URL);
    console.log("MongoDB is connected");

    // Initialize core schema indexes
    try {
      const Product = require("../../modules/products/models/productSchema");
      const Bid = require("../../modules/bidding/models/bidSchema");
      const Order = require("../../modules/orders/models/orderSchema");
      const Payment = require("../../modules/payments/models/Payment");
      const WebhookEvent = require("../../modules/payments/models/WebhookEvent");
      await Promise.all([
        Product.init(),
        Bid.init(),
        Order.init(),
        Payment.init(),
        WebhookEvent.init(),
      ]);
    } catch (idxErr) {
      console.warn("Index initialization notice:", idxErr.message);
    }

    // Connection lifecycle events
    mongoose.connection.on("disconnected", () => {
      console.warn("MongoDB disconnected. Attempting to reconnect...");
    });

    mongoose.connection.on("reconnected", () => {
      console.log("MongoDB reconnected successfully");
    });

    mongoose.connection.on("error", (err) => {
      console.error("MongoDB connection error:", err.message);
    });
  } catch (error) {
    console.error("FATAL: Failed to connect to MongoDB:", error.message);
    process.exit(1); // Crash the process — don't serve requests without a database
  }
};

module.exports = DbCon;
