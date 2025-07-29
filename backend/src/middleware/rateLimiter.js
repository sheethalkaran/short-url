const redisClient = require('../utils/redis');

const createRateLimiter = (maxRequests = 100, windowInMinutes = 60) => {
  return async (req, res, next) => {
    try {
      const identifier = req.ip || req.connection.remoteAddress;
      const key = `rate_limit:${identifier}`;
      const windowInSeconds = windowInMinutes * 60;

      const allowed = await redisClient.checkRateLimit(key, maxRequests, windowInSeconds);
      
      if (!allowed) {
        return res.status(429).json({
          success: false,
          message: 'Too many requests. Please try again later.',
          retryAfter: windowInSeconds
        });
      }

      next();
    } catch (error) {
      console.error('Rate limiter error:', error);
      next(); // Allow request to proceed if Redis is down
    }
  };
};


// Different rate limits for different endpoints (relaxed for development)
// For development, increase limits generously
const authRateLimit = createRateLimiter(1000, 15); // 1000 requests per 15 minutes
const urlRateLimit = createRateLimiter(500, 60);  // 500 requests per hour
const generalRateLimit = createRateLimiter(1000, 60); // 1000 requests per hour

module.exports = {
  authRateLimit,
  urlRateLimit,
  generalRateLimit
};