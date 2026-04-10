/*
  middlewares/error-handler.js
  This is the last stop on the train, so to speak
  If an error was thrown, this will return it to the user with the proper status code and message
*/
const { INTERNAL_SERVER_ERROR } = require("../utils/errors");

const errorHandler = (err, req, res, next) => {
  // if an error has no status, set it to 500
  const { statusCode = INTERNAL_SERVER_ERROR, message } = err;
  res.status(statusCode).send({
    // check the status and display a message based on it
    message:
      statusCode === INTERNAL_SERVER_ERROR
        ? "An error occurred on the server"
        : message,
  });
};
module.exports = errorHandler;
