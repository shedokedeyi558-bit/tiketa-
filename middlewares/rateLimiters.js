import rateLimit from 'express-rate-limit';

/**
 * Payment initiate limiter
 * POST /api/v1/payments/squad/initiate
 * 5 requests per IP per 10 minutes
 */
export const paymentLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5,
  standardHeaders: 'draft-7', // Return rate limit info in RateLimit-* headers
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many payment requests from this IP, please try again after 10 minutes.',
  },
  skipSuccessfulRequests: false,
});

/**
 * Auth limiter
 * POST /api/v1/auth/signup, POST /api/v1/auth/login
 * 10 requests per IP per 15 minutes
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts from this IP, please try again after 15 minutes.',
  },
  skipSuccessfulRequests: false,
});

/**
 * General API limiter (catch-all)
 * 100 requests per IP per minute
 */
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after a minute.',
  },
  skipSuccessfulRequests: false,
});
