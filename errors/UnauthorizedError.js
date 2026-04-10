/*
  errors/UnauthorizedError.js
  Used for 401 status code errors (No authorization provided for a secure request)
*/
const { AUTHORIZATION_ERROR } = require("../utils/errors");

class UnauthorizedError extends Error {
  constructor(message) {
    super(message);
    this.statusCode = AUTHORIZATION_ERROR;
  }
}

module.exports = UnauthorizedError;
