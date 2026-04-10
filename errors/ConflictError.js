/*
  errors/ConflictError.js
  Used for 409 CONFLICT code errors (duplicate record exists)
*/
const { DATA_CONFLICT_ERROR } = require("../utils/errors");

class ConflictError extends Error {
  constructor(message) {
    super(message);
    this.statusCode = DATA_CONFLICT_ERROR;
  }
}

module.exports = ConflictError;
