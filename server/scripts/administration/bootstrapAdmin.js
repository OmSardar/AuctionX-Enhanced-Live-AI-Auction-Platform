/**
 * Admin Bootstrap CLI Script
 * Controlled server-side administrator provisioning utility.
 *
 * Usage:
 *   node scripts/administration/bootstrapAdmin.js --email="admin@auctionx.com" --password="StrongPassword123!" --firstName="System" --lastName="Admin"
 * OR with environment variables:
 *   ADMIN_BOOTSTRAP_EMAIL=admin@auctionx.com ADMIN_BOOTSTRAP_PASSWORD=StrongPassword123! npm run admin:bootstrap
 *
 * Security:
 * - Cannot be triggered via HTTP API endpoints or by client requests.
 * - Enforces minimum 8-character password requirement.
 * - Stores bcryptjs hashed credentials.
 * - Never prints plain-text passwords to logs.
 */

require("dotenv").config();
const mongoose = require("mongoose");
const bcryptjs = require("bcryptjs");

const Admin = require("../../src/modules/admin/authentication/models/admin");
const User = require("../../src/modules/users/models/user");

const parseArgs = () => {
  const args = {};
  process.argv.slice(2).forEach((arg) => {
    if (arg.startsWith("--")) {
      const [key, value] = arg.slice(2).split("=");
      if (key && value !== undefined) {
        args[key] = value;
      }
    }
  });
  return args;
};

const validateEmail = (email) => {
  return /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(email);
};

const bootstrapAdmin = async (overrides = {}) => {
  const cliArgs = parseArgs();
  const isCli = require.main === module;

  const email = (overrides.email || cliArgs.email || process.env.ADMIN_BOOTSTRAP_EMAIL || "").trim().toLowerCase();
  const password = overrides.password || cliArgs.password || process.env.ADMIN_BOOTSTRAP_PASSWORD || "";
  const firstName = (overrides.firstName || cliArgs.firstName || process.env.ADMIN_BOOTSTRAP_FIRSTNAME || "System").trim();
  const lastName = (overrides.lastName || cliArgs.lastName || process.env.ADMIN_BOOTSTRAP_LASTNAME || "Administrator").trim();
  const role = (overrides.role || cliArgs.role || process.env.ADMIN_BOOTSTRAP_ROLE || "super-admin").trim();

  const fail = (msg) => {
    if (!isCli || process.env.NODE_ENV === "test") {
      throw new Error(msg);
    }
    console.error(msg);
    process.exit(1);
  };

  if (!email || !validateEmail(email)) {
    fail("Error: A valid email is required (use --email=... or ADMIN_BOOTSTRAP_EMAIL)");
  }

  if (!password || password.length < 8) {
    fail("Error: A password of at least 8 characters is required (use --password=... or ADMIN_BOOTSTRAP_PASSWORD)");
  }

  const validRoles = ["super-admin", "admin", "editor"];
  if (!validRoles.includes(role)) {
    fail(`Error: Role must be one of: ${validRoles.join(", ")}`);
  }

  const mongoUri = process.env.MONGODB_URL || "mongodb://127.0.0.1:27017/Auction-X";
  const wasAlreadyConnected = mongoose.connection.readyState !== 0;

  try {
    if (!wasAlreadyConnected) {
      console.log(`Connecting to database at ${mongoUri.replace(/\/\/.*@/, "//***:***@")}...`);
      await mongoose.connect(mongoUri);
    }

    const hashedPassword = await bcryptjs.hash(password, 10);

    // 1. Provision in Admin collection
    let adminRecord = await Admin.findOne({ email });
    if (adminRecord) {
      adminRecord.firstName = firstName;
      adminRecord.lastName = lastName;
      adminRecord.password = hashedPassword;
      adminRecord.role = role;
      adminRecord.passwordChangedAt = new Date();
      await adminRecord.save();
      console.log(`Updated existing administrator in Admin collection: ${email} [${role}]`);
    } else {
      adminRecord = await Admin.create({
        firstName,
        lastName,
        email,
        password: hashedPassword,
        role,
        joinDate: new Date(),
        lastLogin: new Date(),
      });
      console.log(`Provisioned new administrator in Admin collection: ${email} [${role}]`);
    }

    // 2. Synchronize to User collection with role 'admin' for dual-model auth compatibility
    let userRecord = await User.findOne({ email });
    if (userRecord) {
      userRecord.name = `${firstName} ${lastName}`.trim();
      userRecord.password = hashedPassword;
      userRecord.role = "admin";
      userRecord.isVerified = true;
      userRecord.isNewUser = false;
      await userRecord.save();
      console.log(`Synchronized administrator credentials to User collection: ${email} [role: admin]`);
    } else {
      await User.create({
        name: `${firstName} ${lastName}`.trim(),
        email,
        password: hashedPassword,
        role: "admin",
        isVerified: true,
        isNewUser: false,
      });
      console.log(`Created administrator record in User collection: ${email} [role: admin]`);
    }

    console.log(`Administrator provisioning completed successfully for ${email}.`);
    if (!wasAlreadyConnected && isCli) {
      await mongoose.disconnect();
    }
    return { success: true, email, role };
  } catch (error) {
    console.error("Bootstrap administrator failed:", error.message);
    if (!wasAlreadyConnected && isCli && mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (!isCli || process.env.NODE_ENV === "test") {
      throw error;
    }
    process.exit(1);
  }
};

if (require.main === module) {
  bootstrapAdmin();
}

module.exports = {
  bootstrapAdmin,
};
