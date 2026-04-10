/*
  middlewares/delay.js
  Middleware for adding an artificial delay for testing
*/

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
const addArtificialDelay = async (req, res, next) => {
  await delay(2000); // Add a 2-second delay to all requests using this middleware
  next(); // Pass control to the next handler
};
module.exports = addArtificialDelay;
