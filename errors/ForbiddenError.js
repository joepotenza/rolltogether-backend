/*
  errors/ForbiddenError.js
  Used for 403 status code errors (User is forbidden to perform this action)
*/
const { FORBIDDEN_ERROR } = require("../utils/errors");

class ForbiddenError extends Error {
  constructor(message) {
    super(message);
    this.statusCode = FORBIDDEN_ERROR;
  }
}

module.exports = ForbiddenError;
