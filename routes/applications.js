/*
  routes/applications.js
  REST endpoints for Applications
  - POST /applications - Adds an application
  - PATCH /applications/:appId - Updates an application
*/
const router = require("express").Router();
const { requireAuth } = require("../middlewares/auth");
// const addArtificialDelay = require("../middlewares/delay");
const {
  validateApplicationData,
  validateGroupAndApplicationId,
} = require("../middlewares/validation");
const {
  submitApplication,
  updateApplicationStatus,
} = require("../controllers/applications");

// add application
router.post("", requireAuth, validateApplicationData, submitApplication);

// update application status
router.patch(
  "/:appId",
  requireAuth,
  validateGroupAndApplicationId,
  updateApplicationStatus
);

module.exports = router;
