/*
  models/system.js
  Game System Model
  - id: shorthand name for system, used as form field values
  - name: display name for the system
*/
// const validator = require("validator");

const mongoose = require("mongoose");

const systemSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("system", systemSchema);
