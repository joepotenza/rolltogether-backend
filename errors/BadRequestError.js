/*
  errors/BadRequestError.js
  Used for 400 status code errors
*/
const { INVALID_DATA_ERROR } = require("../utils/errors");

class BadRequestError extends Error {
  constructor(message) {
    super(message);
    this.statusCode = INVALID_DATA_ERROR;
  }
}

module.exports = BadRequestError;
