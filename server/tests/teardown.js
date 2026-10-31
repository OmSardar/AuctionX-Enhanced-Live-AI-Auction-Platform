const mongoose = require("mongoose");

module.exports = async () => {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  } catch (err) {
    // Ignore teardown errors
  }
};
