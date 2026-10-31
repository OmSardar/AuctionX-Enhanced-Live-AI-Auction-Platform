const { validationResult, param, body } = require("express-validator");
const mongoose = require("mongoose");

/**
 * Standard validation result checker for express-validator chains.
 * Returns 400 with structured errors if validation fails.
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: errors.array()[0]?.msg || "Validation failed",
      errors: errors.array().map((err) => ({
        field: err.path || err.param,
        message: err.msg,
      })),
    });
  }
  next();
};

/**
 * Middleware validator for MongoDB ObjectId route parameters.
 * Rejects malformed IDs immediately with HTTP 400 instead of triggering Mongoose CastError 500s.
 */
const validateObjectId = (paramName = "id") => {
  return (req, res, next) => {
    const val = req.params[paramName];
    if (!val || !mongoose.Types.ObjectId.isValid(val) || String(new mongoose.Types.ObjectId(val)) !== String(val)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_IDENTIFIER",
        message: `Invalid identifier format for ${paramName}`,
      });
    }
    next();
  };
};

/**
 * Middleware to validate that a numeric body field is a positive number.
 */
const validatePositiveNumber = (fieldName, { required = true } = {}) => {
  return (req, res, next) => {
    const val = req.body[fieldName];
    if (val === undefined || val === null || val === "") {
      if (required) {
        return res.status(400).json({
          success: false,
          code: "MISSING_REQUIRED_FIELD",
          message: `${fieldName} is required`,
        });
      }
      return next();
    }

    const num = Number(val);
    if (isNaN(num) || num <= 0 || !isFinite(num)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_NUMERIC_VALUE",
        message: `${fieldName} must be a positive finite number`,
      });
    }
    next();
  };
};

module.exports = {
  validate,
  validateObjectId,
  validatePositiveNumber,
};
