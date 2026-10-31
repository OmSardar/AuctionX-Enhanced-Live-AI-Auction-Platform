const jwt = require("jsonwebtoken");
const bcryptjs = require("bcryptjs");
const User = require("../../src/modules/users/models/user");
const Seller = require("../../src/modules/sellers/accounts/models/seller");
const Admin = require("../../src/modules/admin/authentication/models/admin");

const TEST_JWT_SECRET =
  process.env.JWT_SECRET || "auctionx-super-secure-test-jwt-secret-key-32chars";

function getTestJwtSecret() {
  return process.env.JWT_SECRET || TEST_JWT_SECRET;
}

function generateUserToken(payload, expiresIn = "24h") {
  return jwt.sign(payload, getTestJwtSecret(), { expiresIn });
}

function generateSellerToken(payload, expiresIn = "24h") {
  return jwt.sign(payload, getTestJwtSecret(), { expiresIn });
}

function generateAdminToken(payload, expiresIn = "24h") {
  return jwt.sign(payload, getTestJwtSecret(), { expiresIn });
}

async function createTestUser(overrides = {}) {
  const defaultPassword = overrides.plainPassword || "Password123!";
  const hashedPassword = await bcryptjs.hash(defaultPassword, 10);
  const email = overrides.email || `testuser_${Date.now()}_${Math.random().toString(36).substring(7)}@example.com`;

  const user = new User({
    name: overrides.name || "Test User",
    email,
    password: hashedPassword,
    role: overrides.role || "user",
    isVerified: overrides.isVerified !== undefined ? overrides.isVerified : true,
    address: overrides.address || "123 Test St",
    phoneNo: overrides.phoneNo || "9876543210",
    ...overrides,
  });

  await user.save();

  const token = generateUserToken({
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    role: user.role,
  });

  return { user, token, plainPassword: defaultPassword };
}

async function createTestSeller(overrides = {}) {
  const defaultPassword = overrides.plainPassword || "SellerPassword123!";
  const hashedPassword = await bcryptjs.hash(defaultPassword, 10);
  const email = overrides.email || `testseller_${Date.now()}_${Math.random().toString(36).substring(7)}@example.com`;

  const seller = new Seller({
    name: overrides.name || "Test Seller",
    email,
    password: hashedPassword,
    phoneNo: overrides.phoneNo || "9123456780",
    status: overrides.status || "Approved",
    isVerified: overrides.isVerified !== undefined ? overrides.isVerified : true,
    ...overrides,
  });

  await seller.save();

  const token = generateSellerToken({
    id: seller._id.toString(),
    email: seller.email,
    name: seller.name,
    role: "seller",
  });

  return { seller, token, plainPassword: defaultPassword };
}

async function createTestAdmin(overrides = {}) {
  const defaultPassword = overrides.plainPassword || "AdminPassword123!";
  const hashedPassword = await bcryptjs.hash(defaultPassword, 10);
  const email = overrides.email || `testadmin_${Date.now()}_${Math.random().toString(36).substring(7)}@example.com`;

  const admin = new Admin({
    firstName: overrides.firstName || "Admin",
    lastName: overrides.lastName || "User",
    email,
    password: hashedPassword,
    role: overrides.role || "admin",
    ...overrides,
  });

  await admin.save();

  const token = generateAdminToken({
    id: admin._id.toString(),
    email: admin.email,
    name: `${admin.firstName} ${admin.lastName}`,
    role: admin.role,
  });

  return { admin, token, plainPassword: defaultPassword };
}

module.exports = {
  TEST_JWT_SECRET,
  generateUserToken,
  generateSellerToken,
  generateAdminToken,
  createTestUser,
  createTestSeller,
  createTestAdmin,
};
