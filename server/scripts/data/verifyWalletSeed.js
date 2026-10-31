const mongoose = require("mongoose");
const Product = require("../../src/modules/products/models/productSchema");

async function verify() {
  await mongoose.connect("mongodb://127.0.0.1:27017/Auction-X");
  const items = await Product.find({ tempname: /^demo-wallet-auction/ }).sort({ endTime: 1 }).lean();
  console.log(`\nVerified in MongoDB 'Auction-X': ${items.length} items`);
  console.log("-----------------------------------------------------------------------------------------");
  console.log("Product Name                    | Price | Status | End Time                 | Remaining");
  console.log("-----------------------------------------------------------------------------------------");
  items.forEach((it) => {
    const remSec = Math.round((new Date(it.endTime).getTime() - Date.now()) / 1000);
    const remStr = remSec > 0 ? `${Math.floor(remSec / 60)}m ${remSec % 60}s` : "Ended";
    console.log(
      `${it.name.padEnd(31, " ")} | ₹${String(it.startingPrice).padEnd(4, " ")} | ${it.status.padEnd(6, " ")} | ${new Date(it.endTime).toISOString()} | ${remStr}`
    );
  });
  console.log("-----------------------------------------------------------------------------------------\n");
  await mongoose.disconnect();
}

verify().catch((e) => {
  console.error(e);
  process.exit(1);
});

