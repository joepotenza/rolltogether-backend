/*
  middlewares/validation.js
  Handles validation for all incoming requests
  Validates request parameters, body, and query strings
  This ensures data is correct before heading to controllers
*/
const { Joi, celebrate } = require("celebrate");
// const validator = require("validator");
const mongoose = require("mongoose");
const isSvg = require("is-svg").default;

/* const validateURL = (value, helpers) => {
  if (validator.isURL(value)) {
    return value;
  }
  return helpers.error("string.uri");
}; */

const validateSVG = (value, helpers) => {
  try {
    if (isSvg(value)) {
      return value;
    }
  } catch (err) {
    return helpers.error("string.svg");
  }
  return helpers.error("string.svg");
};
const validateMongooseObjectId = (value, helpers) => {
  if (mongoose.Types.ObjectId.isValid(value)) {
    return value;
  }
  return helpers.error("string.objectId");
};

/**
 * USER VALIDATION
 */

module.exports.validateUserData = celebrate({
  body: Joi.object().keys({
    name: Joi.string().required().max(30).messages({
      "any.required": "The 'name' field is required",
      "string.max": "The maximum length of the 'name' field is 30",
      "string.empty": "The 'name' field must be filled in",
    }),

    username: Joi.string()
      .required()
      .min(3)
      .max(20)
      .pattern(/^[a-zA-Z0-9_]+$/)
      .messages({
        "any.required": "The 'username' field is required",
        "string.min": "The minimum length of the 'username' field is 3",
        "string.max": "The maximum length of the 'username' field is 20",
        "string.pattern.base":
          "The 'username' field may only contain letters and numbers",
        "string.empty": "The 'username' field must be filled in",
      }),

    email: Joi.string().required().email().messages({
      "any.required": "The 'email' field is required",
      "string.empty": "The 'email' field must be filled in",
      "string.email": "The 'email' field must be a valid email address",
    }),

    password: Joi.string().required().min(8).messages({
      "any.required": "The 'password' field is required",
      "string.empty": "The 'password' field must be filled in",
      "string.min": "The minimum length of the 'password' field is 8",
    }),

    avatar: Joi.string().required().custom(validateSVG).messages({
      "any.required": "The 'avatar' field is required",
      "string.empty": "The 'avatar' field must be filled in",
      "string.svg": "The 'avatar' field must be a valid SVG document",
    }),
    invite: Joi.string().optional().allow(""),
  }),
});

module.exports.validateUserDataForUpdate = celebrate({
  body: Joi.object().keys({
    name: Joi.string().required().max(30).messages({
      "any.required": "The 'name' field is required",
      "string.max": "The maximum length of the 'name' field is 30",
      "string.empty": "The 'name' field must be filled in",
    }),

    email: Joi.string().required().email().messages({
      "any.required": "The 'email' field is required",
      "string.empty": "The 'email' field must be filled in",
      "string.email": "The 'email' field must be a valid email address",
    }),

    avatar: Joi.string().required().custom(validateSVG).messages({
      "any.required": "The 'avatar' field is required",
      "string.empty": "The 'avatar' field must be filled in",
      "string.svg": "The 'avatar' field must be a valid SVG document",
    }),
  }),
});

module.exports.validateUserAuthenticationData = celebrate({
  body: Joi.object().keys({
    username: Joi.string().required().messages({
      "any.required": "The 'username' field is required",
      "string.empty": "The 'username' field must be filled in",
    }),

    password: Joi.string().required().messages({
      "any.required": "The 'password' field is required",
      "string.empty": "The 'password' field must be filled in",
    }),
  }),
});

module.exports.validateUserId = celebrate({
  params: Joi.object().keys({
    userId: Joi.string().required().custom(validateMongooseObjectId).messages({
      "any.required": "The 'userId' field is required",
      "string.empty": "The 'userId' field must be filled in",
      "string.objectId": "The 'userId' field must be a valid object Id",
    }),
  }),
});

module.exports.validateOAuthCallbackData = celebrate({
  body: Joi.object().keys({
    code: Joi.string().required().messages({
      "any.required": "The 'code' field is required",
      "string.empty": "The 'code' field must be filled in",
    }),
  }),
});

/**
 * GROUP VALIDATION
 */

module.exports.validateGroupFilters = celebrate({
  query: Joi.object().keys({
    userId: Joi.string()
      .optional()
      .allow("")
      .custom(validateMongooseObjectId)
      .messages({
        "string.objectId": "The 'userId' field must be a valid object Id",
      }),

    owner: Joi.string()
      .optional()
      .allow("")
      .custom(validateMongooseObjectId)
      .messages({
        "string.objectId": "The 'owner' field must be a valid object Id",
      }),

    member: Joi.string()
      .optional()
      .allow("")
      .custom(validateMongooseObjectId)
      .messages({
        "string.objectId": "The 'member' field must be a valid object Id",
      }),

    system: Joi.string()
      .optional()
      .allow("")
      .length(24)
      .custom(validateMongooseObjectId)
      .messages({
        "string.length": "The 'system' field must be a valid object Id",
        "string.objectId": "The 'system' field must be a valid object Id",
      }),

    type: Joi.string()
      .optional()
      .allow("")
      .valid("online", "hybrid", "inperson")
      .messages({
        "any.only":
          "The 'type' field must be one of ['online','hybrid','inperson']",
      }),

    isHomebrew: Joi.boolean().optional().allow("").messages({
      "boolean.base": "The 'isHomebrew' field must be a boolean",
    }),

    story: Joi.string().optional().allow(""),

    openSlots: Joi.boolean().optional().allow("").messages({
      "boolean.base": "The 'openSlots' field must be a boolean",
    }),
  }),
});

module.exports.validateGroupData = celebrate({
  body: Joi.object().keys({
    name: Joi.string().required().min(3).max(300).messages({
      "any.required": "The 'name' field is required",
      "string.min": "The minimum length of the 'name' field is 3",
      "string.max": "The maximum length of the 'name' field is 30",
      "string.empty": "The 'name' field must be filled in",
    }),

    summary: Joi.string().required().max(500).messages({
      "any.required": "The 'summary' field is required",
      "string.empty": "The 'summary' field must be filled in",
      "string.max": "The maximum length of the 'summary' field is 500",
    }),

    description: Joi.string().required().messages({
      "any.required": "The 'description' field is required",
      "string.empty": "The 'description' field must be filled in",
    }),

    isHomebrew: Joi.boolean().required().messages({
      "any.required": "The 'isHomebrew' field is required",
      "boolean.base": "The 'isHomebrew' field must be a boolean",
    }),

    story: Joi.string().optional().allow(""),

    slots: Joi.object({
      open: Joi.number().required().min(0).integer(),
      total: Joi.number().required().min(1).integer(),
    })
      .required()
      .unknown(false)
      .messages({
        "any.required": " The 'slots' field is required",
        "object.unknown": "The 'slots' object contains unknown fields",
        "open.any.required": "The 'slots.open' field is required",
        "total.any.required": "The 'slots.total' field is required",
        "open.number.min": "Open slots must be at least 0",
        "open.number.integer": "Open slots must be an integer",
        "total.number.min": "Total slots must be at least 1",
        "total.number.integer": "Total slots must be an integer",
      }),

    system: Joi.string()
      .required()
      .length(24)
      .custom(validateMongooseObjectId)
      .messages({
        "any.required": "The 'system' field is required",
        "string.empty": "The 'system' field must be filled in",
        "string.length": "The 'system' field must be a valid object Id",
        "string.objectId": "The 'system' field must be a valid object Id",
      }),

    type: Joi.string()
      .required()
      .valid("online", "hybrid", "inperson")
      .messages({
        "any.required": "The 'type' field is required",
        "any.only":
          "The 'type' field must be one of ['online','hybrid','inperson']",
      }),

    members: Joi.array()
      .items(Joi.string().length(24).custom(validateMongooseObjectId))
      .messages({
        "string.empty": "The 'members' field contains an empty entry",
        "string.length":
          "The 'members' field must be an array of valid object Ids",
        "string.objectId":
          "The 'members' field must be an array of valid object Ids",
      }),
  }),
});

module.exports.validateApplicationData = celebrate({
  body: Joi.object().keys({
    message: Joi.string().required().messages({
      "any.required": "The 'message' field is required",
      "string.empty": "The 'message' field must be filled in",
    }),
    groupId: Joi.string().required().custom(validateMongooseObjectId).messages({
      "any.required": "The 'groupId' field is required",
      "string.empty": "The 'groupId' field must be filled in",
      "string.objectId": "The 'groupId' field must be a valid object Id",
    }),
  }),
});

module.exports.validateGroupId = celebrate({
  params: Joi.object().keys({
    groupId: Joi.string().required().custom(validateMongooseObjectId).messages({
      "any.required": "The 'groupId' field is required",
      "string.empty": "The 'groupId' field must be filled in",
      "string.objectId": "The 'groupId' field must be a valid object Id",
    }),
  }),
});

module.exports.validateApplicationId = celebrate({
  params: Joi.object().keys({
    appId: Joi.string().required().custom(validateMongooseObjectId).messages({
      "any.required": "The 'appId' field is required",
      "string.empty": "The 'appId' field must be filled in",
      "string.objectId": "The 'appId' field must be a valid object Id",
    }),
  }),
});

module.exports.validateGroupAndApplicationId = celebrate({
  body: Joi.object().keys({
    status: Joi.string().required().valid("approved", "denied").messages({
      "any.required": "The 'status' field is required",
      "any.only": "The 'status' field must be one of ['approved','denied']",
    }),
    groupId: Joi.string().required().custom(validateMongooseObjectId).messages({
      "any.required": "The 'groupId' field is required",
      "string.empty": "The 'groupId' field must be filled in",
      "string.objectId": "The 'groupId' field must be a valid object Id",
    }),
    response: Joi.string().optional().allow(""),
  }),

  params: Joi.object().keys({
    appId: Joi.string().required().custom(validateMongooseObjectId).messages({
      "any.required": "The 'appId' field is required",
      "string.empty": "The 'appId' field must be filled in",
      "string.objectId": "The 'appId' field must be a valid object Id",
    }),
  }),
});

/**
 * SESSION VALIDATION
 */

module.exports.validateSessionId = celebrate({
  params: Joi.object().keys({
    sessionId: Joi.string()
      .required()
      .custom(validateMongooseObjectId)
      .messages({
        "any.required": "The 'sessionId' field is required",
        "string.empty": "The 'sessionId' field must be filled in",
        "string.objectId": "The 'sessionId' field must be a valid object Id",
      }),
  }),
});

module.exports.validateSessionData = celebrate({
  body: Joi.object().keys({
    name: Joi.string().required().max(300).messages({
      "any.required": "The 'name' field is required",
      "string.max": "The maximum length of the 'name' field is 30",
      "string.empty": "The 'name' field must be filled in",
    }),

    date: Joi.date().iso().required().messages({
      "any.required": "The 'date' field is required",
      "date.empty": "The 'date' field must be filled in",
      "date.format": "The 'date' field must be a valid date",
    }),

    preSessionNotes: Joi.string().optional().allow(""),

    postSessionNotes: Joi.string().optional().allow(""),

    areNotesVisibleToMembers: Joi.string()
      .required()
      .valid("none", "pre", "post", "all")
      .messages({
        "any.required": "The 'areNotesVisibleToMembers' field is required",
        "any.only":
          "The 'areNotesVisibleToMembers' field must be one of ['none','pre','post','all']",
      }),

    group: Joi.string()
      .required()
      .length(24)
      .custom(validateMongooseObjectId)
      .messages({
        "any.required": "The 'group' field is required",
        "string.empty": "The 'group' field must be filled in",
        "string.length": "The 'group' field must be a valid object Id",
        "string.objectId": "The 'group' field must be a valid object Id",
      }),

    attendees: Joi.array()
      .items(Joi.string().length(24).custom(validateMongooseObjectId))
      .messages({
        "string.empty": "The 'attendees' field contains an empty entry",
        "string.length":
          "The 'attendees' field must be an array of valid object Ids",
        "string.objectId":
          "The 'attendees' field must be an array of valid object Ids",
      }),
  }),
});

module.exports.validateFreeBusyData = celebrate({
  body: Joi.object().keys({
    start: Joi.date().iso().required().messages({
      "any.required": "The 'start' field is required",
      "date.empty": "The 'start' field must be filled in",
      "date.format": "The 'start' field must be a valid date",
    }),

    end: Joi.date().iso().required().messages({
      "any.required": "The 'end' field is required",
      "date.empty": "The 'end' field must be filled in",
      "date.format": "The 'end' field must be a valid date",
    }),

    minUsers: Joi.number().required().min(1).integer().messages({
      "any.required": " The 'minUsers' field is required",
      "number.min": "Mininum users must be at least 1",
      "number.integer": "Minimum users must be an integer",
    }),

    minDuration: Joi.number().required().min(30).integer().messages({
      "any.required": " The 'minDuration' field is required",
      "number.min": "Mininum duration must be at least 30 minutes",
      "number.integer": "Minimum duration must be an integer",
    }),

    prefStartHour: Joi.number().required().min(-1).integer().messages({
      "any.required": " The 'prefStartHour' field is required",
      "number.min": "'prefStartHour' must be at least 1",
      "number.integer": "'prefStartHour' must be an integer",
    }),
    prefEndHour: Joi.number().required().min(-1).integer().messages({
      "any.required": " The 'prefEndHour' field is required",
      "number.min": "'prefEndHour' must be at least 1",
      "number.integer": "'prefEndHour' must be an integer",
    }),

    userIds: Joi.array()
      .items(Joi.string().length(24).custom(validateMongooseObjectId))
      .messages({
        "string.empty": "The 'userIds' field contains an empty entry",
        "string.length":
          "The 'userIds' field must be an array of valid object Ids",
        "string.objectId":
          "The 'userIds' field must be an array of valid object Ids",
      }),

    groupId: Joi.string()
      .required()
      .length(24)
      .custom(validateMongooseObjectId)
      .messages({
        "any.required": "The 'groupId' field is required",
        "string.empty": "The 'groupId' field must be filled in",
        "string.length": "The 'groupId' field must be a valid object Id",
        "string.objectId": "The 'groupId' field must be a valid object Id",
      }),
  }),
});
