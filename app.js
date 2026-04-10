/*
  app.js
  RollTogether.online REST API

  Libraries used:
  - DotEnv
  - Express
  - Mongoose (MongoDB)
  - CORS (Cross site request headers)
  - Helmet (Returns secure headers with response)
  - Celebrate/Joi (Validates incoming form data, parameters, and query strings)
  - Express-Rate-Limit (Ensures one user does not abuse the API with too many requests in a short period)
  - Winston (Request and Error logging)
  - delay.js: (Custom artificial delay middleware that can be used in DEV for testing slow responses)
  - error-handler.js: (Custom error handler for returning proper status codes and messages)
*/
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const { errors } = require("celebrate");
const { rateLimit } = require("express-rate-limit");
const { RATE_LIMITER_CONFIG } = require("./utils/config");

const app = express();
const { PORT = 3001, MONGO_URI } = process.env;

const NotFoundError = require("./errors/NotFoundError");
const errorHandler = require("./middlewares/error-handler");
const { requestLogger, errorLogger } = require("./middlewares/logger");
const addArtificialDelay = require("./middlewares/delay");

// Rate Limiter
const limiter = rateLimit(RATE_LIMITER_CONFIG);

// All requests are JSON based
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS for front end authorization
app.use(cors());

// Helmet for secure headers
app.use(helmet());

// Apply the rate limiting middleware to all requests
app.use(limiter);

mongoose.connect(MONGO_URI).catch(console.error);

// Log requests
app.use(requestLogger);

app.use("/", require("./routes/index")); // addArtificialDelay,

app.use("/", () => {
  throw new NotFoundError("Requested resource not found");
});

// Log errors
app.use(errorLogger);

// Joi error handler
app.use(errors());

// custom error handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
