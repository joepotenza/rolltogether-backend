/*
  utils/config.js
  Configuration Variables

  RATE_LIMITER_CONFIG - For rater limiter which ensures one user is not abusing the API
*/

// TBD these rates may need adjusting
const RATE_LIMITER_CONFIG = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 1000, // Limit each IP to 100 requests per `window` (here, per 15 minutes).
  standardHeaders: "draft-8", // draft-6: `RateLimit-*` headers; draft-7 & draft-8: combined `RateLimit` header
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers.
  ipv6Subnet: 56, // Set to 60 or 64 to be less aggressive, or 52 or 48 to be more aggressive
};

module.exports = { RATE_LIMITER_CONFIG };
