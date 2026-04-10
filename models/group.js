/*
  models/group.js
  Group model
  - name: Name of the group
  - summary:  (max 500) short description to be shown on the group listings page
  - description: (HTML) long text for full description
  - story: (max 300) Name of the story being played in this group
  - isHomebrew: (Boolean) Is the story pre-made or homebrew
  - slots: Seats at the table (not including owner/GM)
    - open: how many seats are available
    - limit: total number of seats
  - system: References the systems table (genre of game being played)
  - type: online / inperson / hybrid
  - owner: References the users table
  - members: Array of references to the users table
  - applications: Array of references to the applications table
  - sessions: Array of references to the sessions table
*/
const mongoose = require("mongoose");

const groupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      minlength: 3,
      maxlength: 300,
      trim: true,
    },
    summary: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    story: {
      type: String,
      required: false,
      maxlength: 300,
    },
    isHomebrew: {
      type: Boolean,
      required: true,
    },
    slots: {
      open: {
        type: Number,
        min: 0,
      },
      total: {
        type: Number,
        min: 1,
      },
    },
    system: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "system",
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: ["online", "hybrid", "inperson"],
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
      },
    ],
    applications: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "application",
      },
    ],
    sessions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "session",
      },
    ],
  },
  { timestamps: true }
);
groupSchema.index({ system: 1, type: 1, createdAt: -1, _id: -1 });
groupSchema.index({
  system: 1,
  type: 1,
  isHomebrew: 1,
  createdAt: -1,
  _id: -1,
});
groupSchema.index({ owner: 1 });
groupSchema.index({ members: 1 });
groupSchema.index({ createdAt: -1, _id: -1 });

module.exports = mongoose.model("group", groupSchema);
