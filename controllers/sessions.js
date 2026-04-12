/*
  controllers/sessions.js
  Methods:
  createSession
  editSession
  deleteSession
  (getSessions is in groups.js sinced it is loaded on the group page with GET /groups/:groupId/sessions)
*/
const Group = require("../models/group");
const Session = require("../models/session");

const BadRequestError = require("../errors/BadRequestError");
const ForbiddenError = require("../errors/ForbiddenError");
const NotFoundError = require("../errors/NotFoundError");

// const { sendEmailMessage } = require("../utils/email");

// POST /sessions
const createSession = (req, res, next) => {
  try {
    const user = req.user._id;
    const {
      group,
      name,
      date,
      preSessionNotes,
      postSessionNotes,
      areNotesVisibleToMembers,
      attendees,
    } = req.body;
    // Find the group first
    Group.findById(group)
      .select("_id owner")
      .orFail()
      .then((grp) => {
        if (!grp.owner.equals(user)) {
          // User does not own this group
          next(new ForbiddenError("Forbidden"));
        } else {
          Session.create({
            group,
            name,
            date,
            preSessionNotes,
            postSessionNotes,
            areNotesVisibleToMembers,
            attendees,
          })
            .then((session) => {
              console.log("session added");
              Group.findByIdAndUpdate(group, {
                $addToSet: { sessions: session._id },
              })
                .then((/* grp */) => res.status(201).send(session))
                .catch((err) => next(err));
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
        if (err.name === "DocumentNotFoundError") {
          next(new NotFoundError("Group not found"));
        } else if (err.name === "CastError") {
          next(new BadRequestError("Invalid Group ID"));
        } else if (err.name === "ValidationError") {
          next(new BadRequestError("Invalid Data"));
        } else {
          next(err);
        }
      });
  } catch (err) {
    next(err);
  }
};

// PATCH /sessions/:sessionId
const editSession = (req, res, next) => {
  try {
    const user = req.user._id;
    const { sessionId } = req.params;
    const {
      group,
      name,
      date,
      preSessionNotes,
      postSessionNotes,
      areNotesVisibleToMembers,
      attendees,
    } = req.body;

    // Find the group first
    Group.findById(group)
      .select("_id owner")
      .orFail()
      .then((grp) => {
        if (!grp.owner.equals(user)) {
          // User does not own this group
          next(new ForbiddenError("Forbidden"));
        } else {
          // Add sessions to the array, and return the full session list
          Session.findByIdAndUpdate(sessionId, {
            group,
            name,
            date,
            preSessionNotes,
            postSessionNotes,
            areNotesVisibleToMembers,
            attendees,
          })
            .populate("attendees", "username avatar")
            .lean()
            .orFail()
            .then((session) => res.send(session))
            .catch((err) => {
              if (err.name === "DocumentNotFoundError") {
                next(new NotFoundError("Session not found"));
              } else if (err.name === "CastError") {
                next(new BadRequestError("Invalid Session ID"));
              } else if (err.name === "ValidationError") {
                next(new BadRequestError("Invalid Data"));
              } else {
                next(err);
              }
            });
        }
      })
      .catch((err) => {
        if (err.name === "DocumentNotFoundError") {
          next(new NotFoundError("Group not found"));
        } else if (err.name === "CastError") {
          next(new BadRequestError("Invalid Group ID"));
        } else if (err.name === "ValidationError") {
          next(new BadRequestError("Invalid Data"));
        } else {
          next(err);
        }
      });
  } catch (err) {
    next(err);
  }
};

// DELETE /sessions/:sessionId
const deleteSession = (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const user = req.user._id;
    Session.findById(sessionId)
      .select("group")
      .populate("group", "owner")
      .orFail()
      .then((session) => {
        if (!session.group.owner.equals(user)) {
          // not the owner
          next(new ForbiddenError("Forbidden"));
        } else {
          Session.findByIdAndDelete(sessionId)
            .orFail()
            .then((/* sess */) => {
              Group.findByIdAndUpdate(session.group._id, {
                $pull: { sessions: sessionId },
              })
                .orFail()
                .then(() =>
                  res
                    .status(200)
                    .send({ message: "Session deleted successfully" })
                )
                .catch((err) => next(err));
            })
            .catch((err) => next(err));
        }
      })
      .catch((err) => {
        if (err.name === "DocumentNotFoundError") {
          next(new NotFoundError("Session not found"));
        } else if (err.name === "CastError") {
          next(new BadRequestError("Invalid Session ID"));
        } else {
          next(err);
        }
      });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createSession,
  editSession,
  deleteSession,
};
