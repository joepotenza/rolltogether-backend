/*
  middlewares/logger.js
  Logs all requests and errors to the console (dev) or file (production)
*/
const winston = require("winston");

const expressWinston = require("express-winston");

const { NODE_ENV = "development" } = process.env;

// The winston.format function allows us to customize how our logs
// are formatted. In this case, we are using a built-in timestamp
// format, as well as Winston's generic printf method.
const messageFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.printf(
    ({ level, message, meta, timestamp }) =>
      `${timestamp} ${level}: ${meta.error?.stack || message}`
  )
);

// This returns the list of locations to log to. If running in development, also log to the console
const getTransports = (filename) => {
  const transports = [
    new winston.transports.File({
      filename,
      // For file logs we use the more verbose json format
      format: winston.format.json(),
    }),
  ];
  if (NODE_ENV === "development") {
    transports.push(
      new winston.transports.Console({
        // For console logs we use our relatively concise messageFormat
        format: messageFormat,
      })
    );
  }
  return transports;
};

// The request logger, with two different "transports". One transport
// logs to a file, the other logs to the console.
const requestLogger = expressWinston.logger({
  transports: getTransports("request.log"),
});

// error logger
const errorLogger = expressWinston.errorLogger({
  transports: getTransports("error.log"),
});

module.exports = {
  requestLogger,
  errorLogger,
};
