/*
  controllers/applications.js
  Methods:
  submitApplication
  getApplication
  updateApplicationStatus
*/

const mongoose = require("mongoose");
const Application = require("../models/application");
const Group = require("../models/group");

const BadRequestError = require("../errors/BadRequestError");
const ForbiddenError = require("../errors/ForbiddenError");
const NotFoundError = require("../errors/NotFoundError");
const ConflictError = require("../errors/ConflictError");
const UnauthorizedError = require("../errors/UnauthorizedError");

const { sendEmailMessage } = require("../utils/email");

const { FRONTEND_URL } = process.env;

// POST /groups/:groupId/applications
const submitApplication = (req, res, next) => {
  try {
    const { message, groupId } = req.body;
    const user = req.user._id;
    Application.create({ user, group: groupId, message })
      .then((app) => {
        Group.findByIdAndUpdate(
          groupId,
          {
            $addToSet: { applications: app._id },
          },
          { new: true }
        )
          .populate("owner", "email")
          .lean()
          .orFail()
          .then((group) => {
            // Email the owner about the new application
            sendEmailMessage({
              to: group.owner.email,
              subject: "New Application for your group!",
              text: `You have a new application for your group ${group.name}! Visit ${FRONTEND_URL}/group/${groupId} to view the application`,
              html: `<p>You have a new application for your group ${group.name}!</p><p><a href="${FRONTEND_URL}/group/${groupId}">Click here to view the application</a></p>`,
            });

            res.status(201).send(app);
          })
          .catch((err) => {
            if (err.name === "ValidationError") {
              next(new BadRequestError("Invalid Data"));
            } else {
              next(err);
            }
          });
      })
      .catch((err) => {
        if (err.name === "ValidationError") {
          next(new BadRequestError("Invalid Data"));
        } else if (err.code && err.code === 11000) {
          next(new ConflictError("User application already exists"));
        } else {
          next(err);
        }
      });
  } catch (err) {
    next(err);
  }
};

/* GET /applications/:appId     -- not currently in use (may need if applications get more complicated)
const getApplication = (req, res, next) => {
  try {
    const user = req.user._id;
    const {groupId} = req.query;
    const {appId} = req.params;
    // First find the group and make sure the current user is the owner
    Group.findById(groupId)
      .orFail()
      .then((group) => {
        if (!group) {
          throw new NotFoundError("Group not found");
        } else if (!group.owner.equals(user)) {
          throw new ForbiddenError("Forbidden");
        }
        // User owns the group, get the application
        Application.findbyId(appId)
          .populate("user", "username avatar -_id")
          .then((app) => {
            if (!app) {
              throw new NotFoundError("Application not found");
            } else {
              res.status(200).send(app);
            }
          })
          .catch((err) => {
            if (err.name === "ValidationError") {
              next(new BadRequestError("Invalid Data"));
            } else {
              next(err);
            }
          });
      })
      .catch((err) => {
        if (err.name === "DocumentNotFoundError") {
          next(new NotFoundError("Group not found"));
        } else if (err.name === "CastError") {
          // validation middleware should catch this but just in case
          next(new BadRequestError("Invalid Group ID"));
        } else {
          next(err);
        }
      });
  } catch (err) {
    next(err);
  }
};
*/

// PATCH /applications/:appId
const updateApplicationStatus = (req, res, next) => {
  try {
    const { status, response, groupId } = req.body;
    const user = req.user._id;
    const { appId } = req.params;
    // First find the group and make sure the current user is the owner
    Group.findById(groupId)
      .select("name owner slots")
      .orFail()
      .then((group) => {
        if (!group) {
          throw new NotFoundError("Group not found");
        } else if (!group.owner.equals(user)) {
          throw new ForbiddenError("Forbidden");
        } else if (group.slots.open <= 0) {
          throw new BadRequestError("No more open seats available");
        }
        // User owns the group, update the application if it exists
        Application.findByIdAndUpdate(
          appId,
          {
            $set: { status, response },
          },
          { new: true }
        )
          .lean()
          .orFail()
          .populate("user", "username avatar email isGoogleConnected")
          .then((app) => {
            if (status !== "approved") {
              // application was not approved, notify the user and return the application and group info
              sendEmailMessage({
                to: app.user.email,
                subject: "Your application has been declined",
                text: `Your application has been declined for group ${group.name}. Here is the response from the GM: ${response}`,
                html: `<p>Your application has been declined for group ${group.name}. Here is the response from the GM:</p><p>${response}</p>`,
              });
              res.status(200).send({
                group,
                app,
              });
            } else {
              // Now update the group to add the user and decrement the "open slots" amount
              Group.findByIdAndUpdate(
                groupId,
                {
                  $addToSet: { members: app.user._id },
                  $inc: { "slots.open": -1 },
                },
                { new: true }
              )
                .lean()
                .orFail()
                .then((updatedGroup) => {
                  // all done, email the user about their successful application and return the application and group info
                  sendEmailMessage({
                    to: app.user.email,
                    subject: "Your application has been approved!",
                    text: `Your application has been approved for group ${group.name}! Here is the response from the GM: ${response}`,
                    html: `<p>Your application has been approved for group ${group.name}! Here is the response from the GM:</p><p>${response}</p>`,
                  });
                  res.status(200).send({
                    group: updatedGroup,
                    app,
                  });
                })
                .catch((err) => {
                  if (err.name === "ValidationError") {
                    next(new BadRequestError("Invalid Data"));
                  } else {
                    next(err);
                  }
                });
            }
          })
          .catch((err) => {
            if (err.name === "ValidationError") {
              next(new BadRequestError("Invalid Data"));
            } else if (err.name === "DocumentNotFoundError") {
              next(new NotFoundError("Application not found"));
            } else if (err.name === "CastError") {
              // validation middleware should catch this but just in case
              next(new BadRequestError("Invalid Application ID"));
            } else {
              next(err);
            }
          });
      })
      .catch((err) => {
        if (err.name === "DocumentNotFoundError") {
          next(new NotFoundError("Group not found"));
        } else if (err.name === "CastError") {
          // validation middleware should catch this but just in case
          next(new BadRequestError("Invalid Group ID"));
        } else {
          next(err);
        }
      });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  submitApplication,
  updateApplicationStatus,
};
