/*
  controllers/groups.js
  Methods:
  getGroups
  createGroup
  getGroup
  editGroup
  getApplications
  getSessions
*/

const mongoose = require("mongoose");
const Session = require("../models/session");
/* eslint-disable no-unused-vars */
const Application = require("../models/application");
const System = require("../models/system"); // This is here just to ensure the system/application model is loaded into mongoose
/* eslint-enable no-unused-vars */
const Group = require("../models/group");

const BadRequestError = require("../errors/BadRequestError");
const ForbiddenError = require("../errors/ForbiddenError");
const NotFoundError = require("../errors/NotFoundError");
const UnauthorizedError = require("../errors/UnauthorizedError");

// const { sendEmailMessage } = require("../utils/email");

// const { FRONTEND_URL } = process.env;

// GET /groups -- Get a list of groups
// (LOTS of filtering here. Comments below.)
const getGroups = (req, res, next) => {
  try {
    const {
      userId,
      owner,
      member,
      system,
      type,
      story,
      isHomebrew,
      openSlots,
      limit = 20,
    } = req.query;

    // filters will be an array of all the things to search on. The final result will combine them all with $and
    const filters = [];

    // User Id provided, search for groups where user is owner OR a member
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      filters.push({
        $or: [
          { owner: new mongoose.Types.ObjectId(userId) },
          { members: new mongoose.Types.ObjectId(userId) },
        ],
      });
    } else {
      // No user Id provided, search owner and member separately if they are present
      if (owner && mongoose.Types.ObjectId.isValid(owner)) {
        filters.push({
          owner: new mongoose.Types.ObjectId(owner),
        });
      }
      if (member && mongoose.Types.ObjectId.isValid(member)) {
        filters.push({
          members: new mongoose.Types.ObjectId(member),
        });
      }
    }

    // system and type are standard text searches
    if (system) filters.push({ system });
    if (type) filters.push({ type });

    // Search only for games with open slots?
    if (openSlots) {
      filters.push({ "slots.open": { $gt: 0 } });
    }

    // Homebrew gets a little tricky
    // Can search for ONLY homebrew by passing isHomebrew = true, which filters story to only match "Homebrew"
    if (typeof isHomebrew !== "undefined") {
      filters.push({ isHomebrew });
      if (!isHomebrew) {
        // OR, pass isHomebrew = false to look for pre-made campaigns
        if (story) {
          // If story is specified, search for a matching name
          filters.push({ story: { $regex: story, $options: "i" } });
        } else {
          // Otherwise, just find anything that isn't homebrew
          filters.push({ isHomebrew: { $ne: true } });
        }
      }
    }

    /* PAGINATION: TO BE TESTED/ADDED AT LATER DATE

    let cursorData = null;

    // Cursor is stored in base64 and includes timestamp and ID
    if (req.query.cursor) {
      cursorData = JSON.parse(
        Buffer.from(req.query.cursor, "base64").toString("utf-8")
      );
      const { createdAt, _id } = cursorData;

      filters.push({
        $or: [
          { createdAt: { $lt: new Date(createdAt) } },
          {
            createdAt: new Date(createdAt),
            _id: { $lt: new mongoose.Types.ObjectId(_id) },
          },
        ],
      });
    }
    */

    // Make sure limit is not garbage or NaN, under 20 is set to 20, over 100 is set to 100

    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 20), 100);
    const finalFilter = filters.length ? { $and: filters } : {};

    Group.find(finalFilter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limitNum)
      .lean()
      .populate("system", "id name")
      .populate("owner", "username avatar")
      .populate("members", "username avatar")
      .then((groups) => {
        if (!groups || !groups.length) {
          res.send({ groups: [] });
        } else {
          /* Next cursor = last item's createdAt
          const last = groups[groups.length - 1];
          const nextCursor = last
            ? Buffer.from(
                JSON.stringify({
                  createdAt: last.createdAt,
                  _id: last._id,
                })
              ).toString("base64")
            : null;
          const hasNextPage = groups.length === limitNum;
          res.send({
            groups,
            nextCursor,
            hasNextPage,
          });
          */
          res.send({
            groups,
          });
        }
      })
      .catch(next);
  } catch (err) {
    next(err);
  }
};

// POST /groups -- Create a group
const createGroup = (req, res, next) => {
  try {
    const {
      name,
      summary,
      description,
      isHomebrew,
      story,
      slots,
      system,
      type,
      members,
    } = req.body;
    const owner = req.user._id;
    Group.create({
      name,
      summary,
      description,
      isHomebrew,
      story,
      slots,
      system,
      type,
      owner,
      members,
    })
      .then((group) => {
        res.status(201).send(group);
      })
      .catch((err) => {
        if (err.name === "ValidationError") {
          next(new BadRequestError("Invalid Data"));
        } else {
          next(err);
        }
      });
  } catch (err) {
    next(err);
  }
};

// GET /groups/:groupId -- Get a group
const getGroup = (req, res, next) => {
  try {
    Group.findById(req.params.groupId)
      .populate("system", "id name")
      .populate("owner", "username avatar")
      .populate("members", "username avatar isGoogleConnected isGoogleRevoked")
      .lean()
      .orFail()
      .then((group) => res.send(group))
      .catch((err) => {
        if (err.name === "DocumentNotFoundError") {
          next(new NotFoundError("Group not found"));
        } else if (err.name === "CastError") {
          next(new BadRequestError("Invalid Group ID"));
        } else {
          next(err);
        }
      });
  } catch (err) {
    next(err);
  }
};

// PATCH /groups/:groupId -- Edit a group
const editGroup = (req, res, next) => {
  try {
    const {
      name,
      summary,
      description,
      isHomebrew,
      story,
      slots,
      system,
      type,
    } = req.body;
    const user = req.user._id;

    Group.findById(req.params.groupId)
      .select("_id owner")
      .orFail()
      .then((group) => {
        if (!group.owner.equals(user)) {
          next(new ForbiddenError("Forbidden"));
        } else {
          Group.findByIdAndUpdate(
            req.params.groupId,
            {
              $set: {
                name,
                summary,
                description,
                isHomebrew,
                story,
                slots,
                system,
                type,
              },
            },
            {
              new: true,
              runValidators: true,
            }
          )
            .populate("system", "id name")
            .populate("owner", "username avatar")
            .populate("members", "username avatar isGoogleConnected")
            .lean()
            .orFail()
            .then((grp) => res.send(grp))
            .catch((err) => {
              if (err.name === "DocumentNotFoundError") {
                next(new NotFoundError("Group not found"));
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

// GET /groups/:groupId/applications
const getApplications = (req, res, next) => {
  try {
    const { status, userId } = req.query;
    const user = req.user._id;
    const match = {};
    if (status) match.status = status;
    if (userId) match.user = user;
    // Find through the group schema so we can verify the group is actually owned by this user
    Group.findById(req.params.groupId)
      .select("applications owner")
      .populate({
        path: "applications",
        match,
        populate: {
          path: "user",
          select: "username avatar isGoogleConnected -_id",
        },
      })
      .orFail()
      .then((group) => {
        if (!group) {
          throw new NotFoundError("Group not found");
        } else if (!group.owner.equals(user) && user !== userId) {
          // Must be the owner OR the user filtering for their own applications
          throw new ForbiddenError("Forbidden");
        }
        if (!group.applications || !group.applications.length) {
          res.send([]);
        } else {
          res.status(200).send(group.applications.toReversed()); // reverse since we want the newest one first
        }
      })
      .catch((err) => {
        if (err.name === "DocumentNotFoundError") {
          next(new NotFoundError("Group not found"));
        } else if (err.name === "ValidationError") {
          next(new BadRequestError("Invalid Data"));
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

// GET /groups/:groupId/sessions
const getSessions = (req, res, next) => {
  try {
    const user = req.user._id;
    const { groupId } = req.params;
    const { limit = 20 } = req.query;
    // Select through Group and then make sure the current user is the owner or a member
    Group.findById(groupId)
      .select("owner members")
      .orFail()
      .then((group) => {
        const isOwner = group.owner.equals(user);
        const index = group.members.findIndex((member) => member.equals(user));
        const isMember = index < 0;
        if (!group) {
          throw new NotFoundError("Group not found");
        } else if (
          // Check ownership and membership
          !isOwner &&
          isMember
        ) {
          throw new UnauthorizedError("User is not a member of this group");
        }
        // Get the session list
        Session.find({ group: groupId })
          .sort({ date: -1, _id: -1 })
          .limit(limit)
          .populate(
            "attendees",
            "username avatar isGoogleConnected isGoogleRevoked"
          )
          .lean()
          .then((sessions) => {
            res.status(200).send(sessions);
          })
          .catch((err) => {
            next(err);
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
  getGroups,
  createGroup,
  getGroup,
  editGroup,
  getApplications,
  getSessions,
};
