/*
  models/user.js
  User Model
  - name: (max 30) User's real name, not shown on public pages
  - username: (max 30) User's username, used for login and to identify them on the site (Name is not public)
  - email: User's email address
  - password: BCrypt encrypted user password
  - avatar: SVG document containing the user's site avatar
*/
const validator = require("validator");

const isSvg = require("is-svg").default;

const mongoose = require("mongoose");

const bcrypt = require("bcryptjs");

const UnauthorizedError = require("../errors/UnauthorizedError");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      minlength: 1,
      maxlength: 30,
      trim: true,
    },
    username: {
      type: String,
      required: true,
      unique: true,
      minlength: 3,
      maxlength: 20,
      trim: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
      validate: {
        validator(value) {
          return validator.isEmail(value);
        },
        message: "You must enter a valid email address",
      },
    },
    password: {
      type: String,
      required: true,
      select: false,
      trim: true,
    },
    avatar: {
      type: String,
      required: true,
      validate: {
        validator(value) {
          return isSvg(value);
        },
        message: "Avatar must be a valid SVG document",
      },
    },
    googleResourceId: { type: String, unique: true, sparse: true },
    googleEmail: { type: String, unique: true, sparse: true },
    googleRefreshToken: { type: String, select: false },
    googleCalendarLinkedAt: { type: Date },
    isGoogleConnected: { type: Boolean, default: false },
    isGoogleRevoked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Match a user by username OR email and password using bcrypt for encrypted passwords
userSchema.statics.findUserByCredentials = function (username, password) {
  const criteria = {};
  if (validator.isEmail(username)) {
    criteria.email = username;
  } else {
    criteria.username = username;
  }
  return this.findOne(criteria)
    .select("+password")
    .then((user) => {
      if (!user) {
        return Promise.reject(
          new UnauthorizedError("Incorrect username or password")
        );
      }
      return bcrypt.compare(password, user.password).then((matched) => {
        if (!matched) {
          return Promise.reject(
            new UnauthorizedError("Incorrect username or password")
          );
        }
        return user;
      });
    })
    .catch((err) => Promise.reject(err));
};

module.exports = mongoose.model("user", userSchema);
