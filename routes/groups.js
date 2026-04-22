/*
  routes/groups.js
  REST endpoints for Groups
  - GET /groups - Lists groups according to filters
  - POST /groups - Adds a new group
  - GET /groups/:groupId - Gets a single group
  - PATCH /groups/:groupId - Updates a group's details
  - GET /groups/:groupId/applications - Lists applications for a group (can be filtered)
  - GET /groups/:groupId/sessions - Lists sessions for a group (can be filtered)
*/
const router = require("express").Router();
const { /* readAuth, */ requireAuth } = require("../middlewares/auth");
// const addArtificialDelay = require("../middlewares/delay");
const {
  validateGroupFilters,
  validateGroupData,
  validateGroupId,
} = require("../middlewares/validation");
const {
  getGroups,
  createGroup,
  getGroup,
  editGroup,
  getApplications,
  getSessions,
} = require("../controllers/groups");

// group list
router.get("", validateGroupFilters, getGroups);

// add group
router.post("", requireAuth, validateGroupData, createGroup);

// get group
router.get("/:groupId", validateGroupId, getGroup);

// update group
router.patch("/:groupId", requireAuth, validateGroupData, editGroup);

// get group applications
router.get(
  "/:groupId/applications",
  requireAuth,
  validateGroupId,
  getApplications
);

// get group sessions
router.get("/:groupId/sessions", requireAuth, validateGroupId, getSessions);

module.exports = router;
