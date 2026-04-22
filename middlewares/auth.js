/*
  middlewares/auth.js
  Handles authorization in two ways:
  readAuth - Validates the authorization header, only rejects if it isn't valid
  requireAuth - Requires and validates the authorization header. Will reject if the header is not present.
  Both methods set req.user to the authorized user for use in controllers
*/
const jwt = require("jsonwebtoken");

const UnauthorizedError = require("../errors/UnauthorizedError");

const { JWT_SECRET } = process.env;

const auth = ({ req, next, required }) => {
  // Get token from authorization header
  const authHeader = req.headers.authorization;
  if (
    (!authHeader && required) ||
    (authHeader && !authHeader.startsWith("Bearer "))
  ) {
    // This will not throw an error if the auth header isn't included
    // and required is set to false (if we want to just read and log the user info)
    // UNLESS the token is not a bearer token
    throw new UnauthorizedError("Invalid authorization");
  }

  if (!authHeader) {
    // No header provided, exit cleanly
    next();
  } else {
    try {
      const token = authHeader.replace("Bearer ", "");
      const payload = jwt.verify(token, JWT_SECRET);
      if (!payload || !payload._id) {
        // If it was provided, and it's invalid, reject it even if it's not required
        throw new UnauthorizedError("Invalid authorization");
      }

      // User authenticated successfully, update the request with the user data
      req.user = payload;
      next();
    } catch (err) {
      if (err.name === "JsonWebTokenError") {
        next(new UnauthorizedError("Invalid authorization"));
      } else {
        next(err);
      }
    }
  }
};

const readAuth = (req, res, next) => {
  auth({ req, res, next, required: false });
};
const requireAuth = (req, res, next) => {
  auth({ req, res, next, required: true });
};

module.exports = {
  readAuth,
  requireAuth,
};
