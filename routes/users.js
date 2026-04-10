/*
  routes/users.js
  REST endpoint for Users
  - GET /users/me - Returns the current authorized user's profile
  - PATCH /users/me - Updates the current user's profile
  - GET /users/:username - Gets a user's public profile (no real name or _id)
*/
const router = require("express").Router();
const { readAuth, requireAuth } = require("../middlewares/auth");
const {
  validateUserDataForUpdate,
  validateFreeBusyData,
} = require("../middlewares/validation");
// const addArtificialDelay = require("../middlewares/delay");
const {
  getCurrentUser,
  updateUserInfo,
  getUserProfile,
  freebusy,
} = require("../controllers/users");

// Get the current user
router.get("/me", requireAuth, getCurrentUser);

// Update the current user's profile
router.patch("/me", requireAuth, validateUserDataForUpdate, updateUserInfo);

// Get a user's public profile
router.get("/:username", readAuth, getUserProfile);

// Match users' calendars
router.post("/freebusy", requireAuth, validateFreeBusyData, freebusy);

module.exports = router;
