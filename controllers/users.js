/*
  controllers/users.js
  Methods:
  getCurrentUser
  updateUserInfo
  getUserProfile
  createUser
  login
  oauth2callback
  freebusy
*/
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const User = require("../models/user");
const Group = require("../models/group");
const BadRequestError = require("../errors/BadRequestError");
const NotFoundError = require("../errors/NotFoundError");
const ConflictError = require("../errors/ConflictError");
const UnauthorizedError = require("../errors/UnauthorizedError");
const AuthRevokedError = require("../errors/AuthRevokedError");
const ForbiddenError = require("../errors/ForbiddenError");
// const { sendEmailMessage } = require("../utils/email");
const FreeBusy = require("../utils/FreeBusy");

const { JWT_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, INVITE_CODE } =
  process.env;

const oAuth2Client = new OAuth2Client(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  "postmessage" // Specific value required for GIS popup flow
);

// revokeUserToken: Only used within this file to update user record and return the result
const revokeUserToken = (user, setIsGoogleRevoked = false) => {
  const updateUser = user;
  updateUser.googleResourceId = "";
  updateUser.googleEmail = "";
  updateUser.googleRefreshToken = "";
  updateUser.isGoogleConnected = false;
  updateUser.isGoogleRevoked = setIsGoogleRevoked;
  return updateUser.save();
};

// GET /users/me -- Get current user
const getCurrentUser = (req, res, next) => {
  try {
    User.findById(req.user._id)
      .select(
        "name username email avatar +googleRefreshToken isGoogleConnected isGoogleRevoked"
      )
      .orFail()
      .then(async (user) => {
        const { googleRefreshToken, ...userWithoutRefreshToken } =
          user.toObject();
        let doRevoke = false;
        let tokenErr = null;
        // if the user is marked as connected but no token present (shouldn't happen), fix it by revoking
        if (
          !user.googleRefreshToken &&
          user.isGoogleConnected &&
          !user.isGoogleRevoked
        ) {
          doRevoke = true;
        } else if (user.googleRefreshToken && !user.isGoogleRevoked) {
          // If the user has a google token, and it isn't already marked as revoked, check its validity and report to the front end
          oAuth2Client.setCredentials({
            refresh_token: googleRefreshToken,
          });
          try {
            const { token } = await oAuth2Client.getAccessToken();
            // console.log("TOKEN FROM GETACCESSTOKEN ", token);
            if (!token) {
              doRevoke = true;
            }
          } catch (err) {
            // console.log("GETACCESSTOKEN ERROR ", err.message);
            // 'invalid_grant' is the specific error Google sends when the refresh token is revoked/expired
            if (err.message.includes("invalid_grant")) {
              // console.log("OK LETS REVOKE IT");
              doRevoke = true;
            } else {
              // some other error occurred, get out of here and process the error
              tokenErr = err;
            }
          }
        }
        if (tokenErr) {
          // console.log("tokenErr exists");
          next(tokenErr);
        } else if (doRevoke) {
          // console.log("Doing revoke!");
          userWithoutRefreshToken.isGoogleRevoked = true;
          revokeUserToken(user, true) // pass setIsGoogleRevoked=true to ensure the user account has no token but is marked as revoked
            .then((/* success */) => {
              // revoked successfully
              res.send(userWithoutRefreshToken);
            })
            .catch((err) => {
              next(err);
            });
        } else {
          // no errors, no expired tokens
          res.send(userWithoutRefreshToken);
        }
      })
      .catch((err) => {
        if (err.name === "DocumentNotFoundError") {
          next(new NotFoundError("User not found"));
        } else if (err.name === "CastError") {
          next(new BadRequestError("Invalid User ID"));
        } else {
          next(err);
        }
      });
  } catch (err) {
    next(err);
  }
};

// PATCH /users/me -- Update current user info
const updateUserInfo = (req, res, next) => {
  try {
    const { name, email, avatar } = req.body;
    const updatedInfo = { name, email, avatar };
    User.findByIdAndUpdate(
      req.user._id,
      {
        $set: updatedInfo,
      },
      {
        runValidators: true,
        new: true,
      }
    )
      .lean()
      .orFail()
      .then((user) => res.send(user))
      .catch((err) => {
        if (err.name === "DocumentNotFoundError") {
          next(new NotFoundError("User not found"));
        } else if (err.name === "ValidationError") {
          next(new BadRequestError("Invalid Data"));
        } else if (err.code && err.code === 11000) {
          next(new ConflictError("Email address already exists"));
        } else {
          next(err);
        }
      });
  } catch (err) {
    next(err);
  }
};

// GET /users/:userId -- Get user profile
const getUserProfile = (req, res, next) => {
  try {
    User.findOne({ username: req.params.username })
      .select("username avatar")
      .lean()
      .orFail()
      .then((user) => res.send(user))
      .catch((err) => {
        if (err.name === "DocumentNotFoundError") {
          next(new NotFoundError("User not found"));
        } else {
          next(err);
        }
      });
  } catch (err) {
    next(err);
  }
};

// POST /signup -- Create a new user
const createUser = (req, res, next) => {
  try {
    const { name, avatar, username, email, password, invite } = req.body;
    if (!password) {
      throw new BadRequestError("Invalid Data");
    }

    if (INVITE_CODE && (!invite || invite !== INVITE_CODE)) {
      throw new ForbiddenError("Invalid Invite Code");
    }

    // hash the password before storing in the database
    bcrypt
      .hash(password, 10) // 10-character salt
      .then((hashedPassword) => {
        User.create({ name, avatar, username, email, password: hashedPassword })
          .then((user) => {
            /*
              Bug fixed: delete does not work against the raw user object since it is technically a Mongoose document
              and not a regular JS object
            */
            const newUser = user.toObject();
            delete newUser.password;

            res.status(201).send(newUser);
          })
          .catch((err) => {
            if (err.name === "ValidationError") {
              next(new BadRequestError("Invalid Data"));
            } else if (err.code && err.code === 11000) {
              next(new ConflictError("Username or email already exists"));
            } else {
              next(err);
            }
          });
      })
      .catch(next);
  } catch (err) {
    next(err);
  }
};

// POST /signin -- Login with email and password
const login = (req, res, next) => {
  const { username, password } = req.body;
  if (!username || !password) {
    throw new BadRequestError("Invalid Data");
  }
  return User.findUserByCredentials(username, password)
    .then((user) => {
      const token = jwt.sign({ _id: user._id }, JWT_SECRET, {
        expiresIn: "7d",
      });
      res.status(200).send({ token });
    })
    .catch(() => next(new UnauthorizedError("Incorrect username or password")));
};

// POST /oauth2callback -- OAuth callback handler to send code to Google and get a token
const oauth2callback = (req, res, next) => {
  try {
    const { code } = req.body;
    // Exchange the code for tokens
    oAuth2Client
      .getToken(code)
      .then(({ tokens }) => {
        // Make sure the right properties are there just in case
        if (
          !tokens ||
          !tokens.id_token ||
          !tokens.access_token ||
          !tokens.refresh_token
        ) {
          throw new AuthRevokedError(
            "Google access has been revoked. Please re-link your account."
          );
        } else {
          const googleRefreshToken = tokens.refresh_token;
          // Get the resource Id (Google's User ID) to ensure uniqueness
          oAuth2Client
            .verifyIdToken({
              idToken: tokens.id_token,
              audience: GOOGLE_CLIENT_ID,
            })
            .then((ticket) => {
              try {
                const payload = ticket.getPayload();
                const googleResourceId = payload.sub;
                const googleEmail = payload.email;
                // Update the user record with token and resource Id
                User.findByIdAndUpdate(
                  req.user._id,
                  {
                    $set: {
                      googleResourceId,
                      googleRefreshToken,
                      googleEmail,
                      googleCalendarLinkedAt: new Date(),
                      isGoogleConnected: true,
                      isGoogleRevoked: false,
                    },
                  },
                  { new: true, useValidators: true }
                )
                  .lean()
                  .orFail()
                  .then((/* user */) => {
                    res.status(200).send({
                      success: true,
                      message: "Your Google Account is now connected!",
                    });
                  })
                  .catch((err) => {
                    if (err.name === "DocumentNotFoundError") {
                      next(new NotFoundError("User not found"));
                    } else if (err.name === "ValidationError") {
                      next(new BadRequestError("Invalid Data"));
                    } else if (err.code && err.code === 11000) {
                      next(
                        new ConflictError(
                          "The selected Google account is already linked to another user."
                        )
                      );
                    } else {
                      next(err);
                    }
                  });
              } catch (err) {
                next(err);
              }
            })
            .catch((err) => {
              next(err);
            });
        }
      })
      .catch((err) => {
        if (err.message.includes("invalid_grant")) {
          next(
            new AuthRevokedError(
              "Google access has been revoked. Please re-link your account."
            )
          );
        } else {
          next(err);
        }
      });
  } catch (err) {
    next(err);
  }
};

// POST /revokeoauth2 - revoke OAuth access
const revokeoauth2 = (req, res, next) => {
  try {
    User.findById(req.user._id)
      .select(
        "googleResourceId googleEmail googleRefreshToken isGoogleConnected isGoogleRevoked"
      )
      .orFail()
      .then((user) => {
        // If the user doesn't have a token, throw an error
        if (!user.googleRefreshToken) {
          throw new BadRequestError(
            "No Google account token found for this user"
          );
        } else {
          // If the user has a google token revoke it
          oAuth2Client
            .revokeToken(user.googleRefreshToken)
            .then((/* success */) => {
              // Token revoked, update the user
              revokeUserToken(user)
                .then((/* saved */) => res.send({ revoked: true }))
                .catch((err) => {
                  if (err.name === "ValidationError") {
                    next(new BadRequestError("Invalid Data"));
                  } else {
                    next(err);
                  }
                });
            })
            .catch((err) => {
              next(err);
            });
        }
      })
      .catch((err) => {
        if (err.name === "DocumentNotFoundError") {
          next(new NotFoundError("User not found"));
        } else if (err.name === "CastError") {
          next(new BadRequestError("Invalid User ID"));
        } else {
          next(err);
        }
      });
  } catch (err) {
    next(err);
  }
};

// POST /users/freebusy
/**
 * NOTE: Reverted to more basic version until all bugs are gone
 * Will only search a time window and return the busy intervals
 */
const freebusy = (req, res, next) => {
  try {
    const {
      groupId,
      userIds,
      start,
      end,
      /* minUsers,
      minDuration,
      prefStartHour,
      prefEndHour, */
    } = req.body;

    // Automatically adjust end date by 1 day
    // (UI date picker will always give us the wrong info, if you select Monday - Friday, it's going to cut off at Friday 0:00:00
    // when you really need Friday 23:59:59
    const startDate = new Date(start);
    const endDate = new Date(end);
    endDate.setUTCDate(endDate.getUTCDate() + 1);

    // Get the group from groupId
    Group.findById(groupId)
      .select("owner members")
      .populate(
        "owner",
        "username googleRefreshToken googleEmail isGoogleConnected isGoogleRevoked"
      )
      .populate(
        "members",
        "username googleRefreshToken googleEmail isGoogleConnected isGoogleRevoked"
      )
      .lean()
      .orFail()
      .then(async (grp) => {
        // Check if current user is owner
        const ownerId = grp.owner._id.toString();
        if (!ownerId === req.user._id) {
          next(new ForbiddenError("You are not the owner of this group"));
        } else {
          const usersToGetTokens = []; // array of users to match with google
          const disconnectedUsers = []; // array of users requested who for some reason don't have a token or are revoked
          const allUsers = []; // usernames of ALL users, so we can properly return unavailableUsers for ones who were disconnected
          // Loop over requested user Ids
          for (let i = 0; i < userIds.length; i += 1) {
            const user = userIds[i];

            if (ownerId === user) {
              // user is owner
              if (
                grp.owner.googleRefreshToken &&
                grp.owner.isGoogleConnected &&
                !grp.owner.isGoogleRevoked
              ) {
                // owner google account is ok
                usersToGetTokens.push(grp.owner);
                allUsers.push(grp.owner.username);
              } else {
                // owner google account not connected, owner failing will throw an error but members will not.
                throw new BadRequestError(
                  "Can not check availability: your Google Account is not connected"
                );
              }
            } else {
              // search members for the user
              let found = false;
              for (let m = 0; m < grp.members.length; m += 1) {
                const member = grp.members[m];
                member._id = member._id.toString();
                if (member._id === user) {
                  // found member
                  found = true;
                  allUsers.push(member.username);
                  if (
                    member.googleRefreshToken &&
                    member.isGoogleConnected &&
                    !member.isGoogleRevoked
                  ) {
                    // member has valid google account
                    usersToGetTokens.push(member);
                  } else {
                    // member not linked to google, mark as disconnected (will show on front end)
                    disconnectedUsers.push(member.username);
                  }
                  break;
                }
              }
              if (!found) {
                throw new BadRequestError(
                  "All attendees must be members of the group"
                );
              }
            }
          }
          if (!usersToGetTokens.length) {
            throw new BadRequestError(
              "No connected Google Calendar accounts found"
            );
          }

          // Check if the owner is in the 'connected' list
          const isOwnerConnected = usersToGetTokens.some(
            (u) => u._id.toString() === grp.owner._id.toString()
          );

          if (!isOwnerConnected) {
            throw new BadRequestError(
              "You must have a connected Google Calendar to check group availability as the GM."
            );
          }

          const totalConnected = usersToGetTokens.length;

          /*
          if (totalConnected < minUsers) {
            const missingCount = minUsers - totalConnected;

            throw new BadRequestError(
              `Cannot check availability: You requested a minimum of ${minUsers} players, ` +
                `but only ${totalConnected} participants have connected Google Calendars. ` +
                `You need at least ${missingCount} more member(s) to link their accounts.`
            );
          } */

          if (totalConnected < 2) {
            throw new BadRequestError(
              `Cannot check availability: need at least 2 connected calendars.`
            );
          }

          const freeBusy = new FreeBusy({
            ownerId: grp.owner._id,
            allUsers,
            disconnectedUsers,
            usersToGetTokens,
            startDate,
            endDate,
            /* minUsers,
            minDuration,
            prefStartHour,
            prefEndHour, */
          });
          const result = await freeBusy.process();
          if (result.error) {
            next(result.error);
          } else {
            res.status(200).send(result);
          }
        }
      })
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

module.exports = {
  getCurrentUser,
  updateUserInfo,
  getUserProfile,
  createUser,
  login,
  oauth2callback,
  revokeoauth2,
  freebusy,
};
