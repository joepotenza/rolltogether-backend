/*
  routes/sessions.js
  REST endpoints for Group Sessions
  - POST /sessions - Creates a new session
  - PATCH /sessions/:sessionId - Updates a session's details
  - DELETE /sessions/:sessionId - Deletes a session
*/
const router = require("express").Router();
const { /* readAuth, */ requireAuth } = require("../middlewares/auth");
// const addArtificialDelay = require("../middlewares/delay");
const {
  validateSessionData,
  validateSessionId,
} = require("../middlewares/validation");
const {
  createSession,
  editSession,
  deleteSession,
} = require("../controllers/sessions");

// add session
router.post("", requireAuth, validateSessionData, createSession);

// update session
router.patch("/:sessionId", requireAuth, validateSessionId, editSession);

// delete session
router.delete("/:sessionId", requireAuth, validateSessionId, deleteSession);

module.exports = router;
