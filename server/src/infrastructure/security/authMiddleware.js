const authUserMiddleware = require("../../modules/users/middleware/authUserMiddleware");
const adminAuthMiddleware = require("../../modules/admin/authentication/middleware/authAdminMiddleware");
const { protectSellerRoute } = require("../../modules/sellers/accounts/middleware/authSellerMiddleware");

module.exports = {
  authUserMiddleware,
  adminAuthMiddleware,
  protectSellerRoute,
};
