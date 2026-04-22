/*
  errors/NotFoundError.js
  Used for 404 status code errors (resource or item not found)
*/
const { NOT_FOUND_ERROR } = require("../utils/errors");

class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.statusCode = NOT_FOUND_ERROR;
  }
}

module.exports = NotFoundError;
