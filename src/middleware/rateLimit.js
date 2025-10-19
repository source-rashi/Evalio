const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 50 });
const ocrLimiter = rateLimit({ windowMs: 60 * 1000, max: 10 });
const evalLimiter = rateLimit({ windowMs: 60 * 1000, max: 20 });

module.exports = { authLimiter, ocrLimiter, evalLimiter };
