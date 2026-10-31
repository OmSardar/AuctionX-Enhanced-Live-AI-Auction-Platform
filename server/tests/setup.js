process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "auctionx-super-secure-test-jwt-secret-key-32chars";
process.env.MONGODB_URL = process.env.MONGODB_URL || "mongodb://127.0.0.1:27017/auctionx_test_db";
process.env.PORT = "0";
process.env.RECOMMENDATION_SERVICE_URL = "http://localhost:8000";
process.env.CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";
process.env.RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || "rzp_test_mock_key_id";
process.env.RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "mock_razorpay_secret_32chars_test_key";
process.env.RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || "mock_webhook_secret_32chars_test_key";

const mongoose = require("mongoose");

// Silence Winston and console output during tests to keep test reports clean
const { logger } = require("../src/infrastructure/logging/loggerMiddleware");
if (logger) {
  logger.transports.forEach((t) => {
    t.silent = true;
  });
}

beforeAll(async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URL, {
      serverSelectionTimeoutMS: 5000,
    });
  }
});

afterAll(async () => {
  try {
    if (mongoose.connection.readyState !== 0) {
      // Drop test database to clean up after test run
      if (mongoose.connection.db) {
        await mongoose.connection.db.dropDatabase();
      }
      await mongoose.disconnect();
    }
  } catch (err) {
    // Ignore teardown disconnect errors
  }
});
