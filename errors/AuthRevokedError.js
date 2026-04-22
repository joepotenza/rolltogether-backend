/*
  errors/AuthRevokedError.js
  Used for 410 status code errors ("Gone" aka Auth Revoked: For OAuth token validation)
*/
const { AUTH_REVOKED_ERROR } = require("../utils/errors");

class AuthRevokedError extends Error {
  constructor(message) {
    super(message);
    this.statusCode = AUTH_REVOKED_ERROR;
  }
}

module.exports = AuthRevokedError;
