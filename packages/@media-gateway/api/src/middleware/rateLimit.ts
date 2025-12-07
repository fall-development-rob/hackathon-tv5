import rateLimit from 'express-rate-limit';

// General API rate limit
export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests',
    code: 'RATE_LIMIT_EXCEEDED',
    details: {
      retryAfter: '15 minutes',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Search rate limit (more restrictive)
export const searchRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20, // Limit to 20 search requests per minute
  message: {
    error: 'Too many search requests',
    code: 'SEARCH_RATE_LIMIT_EXCEEDED',
    details: {
      retryAfter: '1 minute',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Write operations rate limit
export const writeRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 50, // Limit to 50 write operations per 5 minutes
  message: {
    error: 'Too many write requests',
    code: 'WRITE_RATE_LIMIT_EXCEEDED',
    details: {
      retryAfter: '5 minutes',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});
