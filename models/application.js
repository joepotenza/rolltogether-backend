/*
  models/application.js
  Group Application model: Links a user to a group
  - group: References the groups table
  - user: References the users table
  - message: The message the user includes with their application
  - response: The response the group owner sends when processing the application
  - status: new / accepted / denied
*/
const mongoose = require("mongoose");
const Group = require("./group");

// See if the user submitting the application is the owner or already a member
async function checkUserNotInGroup(groupId, user) {
  let isValid = false;
  await Group.findById(groupId)
    .orFail()
    .then((group) => {
      isValid =
        !group.owner.equals(user) &&
        group.members.findIndex((member) => member.equals(user)) === -1;
    })
    .catch((/* err */) => {
      isValid = false;
    });
  return isValid;
}

async function userValidator(user) {
  // 'this' refers to the current order document
  const res = await checkUserNotInGroup(this.group, user);
  return res;
}

const applicationSchema = new mongoose.Schema(
  {
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "group",
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
      index: true,
      validate: {
        validator: userValidator,
        message: (/* props */) => "User is already a member of this group",
      },
    },
    message: {
      type: String,
      required: true,
      maxlength: 500,
      trim: true,
    },
    response: {
      type: String,
      maxlength: 500,
      trim: true,
    },
    status: {
      type: String,
      default: "new",
      enum: ["new", "approved", "denied"],
      index: true,
    },
  },
  { timestamps: true }
);
applicationSchema.index({ group: 1, status: 1 });
applicationSchema.index({ group: 1, user: 1 }, { unique: true }); // user can not submit multiple applications for same group

module.exports = mongoose.model("application", applicationSchema);
