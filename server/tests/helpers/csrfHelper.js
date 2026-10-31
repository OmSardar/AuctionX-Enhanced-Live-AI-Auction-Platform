const crypto = require("crypto");

/**
 * Generates a valid CSRF token and the corresponding cookie header string and request header.
 * The backend uses the double-submit cookie pattern: cookie '_csrf' must equal header 'x-csrf-token'.
 */
function createCsrfCredentials(token = crypto.randomUUID()) {
  return {
    token,
    cookie: `_csrf=${token}`,
    headerName: "x-csrf-token",
    headerValue: token,
  };
}

module.exports = {
  createCsrfCredentials,
};
