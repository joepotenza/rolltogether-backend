/*
  models/session.js
  Group Session Model: One scheduled game session
  - group: References the groups table
  - name: (max 300) Name of the session
  - date: Date/time session is scheduled
  - preSessionNotes: (HTML) Notes prepared by GM to use during the session
  - postSessionNotes: (HTML) Notes entered by GM after the session as a recap
  - areNotesVisibleToMembers: (Boolean) Whether members should be able to see the GM's notes
  - attendees: Array of references to the users table for which users are attending the session
*/
const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema(
  {
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "group",
      required: true,
      index: true,
    },
    name: {
      type: String,
      maxlength: 300,
      required: false,
      index: true,
      trim: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    preSessionNotes: {
      type: String,
    },
    postSessionNotes: {
      type: String,
    },
    areNotesVisibleToMembers: {
      type: String,
      default: "none",
      enum: ["none", "pre", "post", "all"],
    },
    attendees: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
      },
    ],
  },
  { timestamps: true }
);
sessionSchema.index({ group: 1, date: 1, _id: 1 });

module.exports = mongoose.model("session", sessionSchema);
