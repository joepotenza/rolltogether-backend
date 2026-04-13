/*
  routes/index.js
  Main route controller that filters REST calls to the appropriate router
  - POST /signup - Registers a new user
  - POST /signin - Authorizes a user for login
*/
const router = require("express").Router();
// const addArtificialDelay = require("../middlewares/delay");
const { requireAuth } = require("../middlewares/auth");
router.use("/users", require("./users"));
router.use("/groups", require("./groups"));
router.use("/sessions", require("./sessions"));
router.use("/applications", require("./applications"));

const {
  createUser,
  login,
  oauth2callback,
  revokeoauth2,
} = require("../controllers/users");
const {
  validateUserData,
  validateUserAuthenticationData,
  validateOAuthCallbackData,
} = require("../middlewares/validation");

// Create a new user
router.post("/signup", validateUserData, createUser);

// Sign in with email and password
router.post("/signin", validateUserAuthenticationData, login);

// Validate the code returned from OAuth and turn it into a user refresh token
router.post(
  "/oauth2callback",
  requireAuth,
  validateOAuthCallbackData,
  oauth2callback
);

// User choosing to revoke their google access
router.post("/revokeoauth2", requireAuth, revokeoauth2);

module.exports = router;
