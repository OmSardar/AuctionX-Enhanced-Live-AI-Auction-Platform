/**
 * @file Common Domain Type Definitions for AuctionX Server
 * @module common/types
 */

/**
 * @typedef {Object} AuthenticatedUser
 * @property {string} _id - User ObjectId string
 * @property {string} email - User email address
 * @property {string} role - 'user' | 'seller' | 'admin'
 * @property {string} [name] - User full name
 */

/**
 * @typedef {Object} ApiResponse
 * @property {boolean} success - Operation success status
 * @property {string} [message] - Human-readable response message
 * @property {*} [data] - Response payload
 * @property {string} [error] - Error description if failed
 * @property {string} [code] - Machine-readable error code
 */

module.exports = {};
