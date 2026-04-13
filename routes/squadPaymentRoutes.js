import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  initiatePaymentController,
  verifyPaymentController,
  callbackHandler,
  getPaymentStatusController,
} from '../controllers/squadPaymentController.js';

const router = express.Router();

// Rate limiting middleware
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  message: 'Too many payment attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

const verifyLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  max: 10, // 10 verification attempts per minute (allows 5 retries with delays)
  message: 'Too many verification attempts, please wait before retrying',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req, res) => {
    // Log rate limit info for debugging
    console.log('🔐 Rate limit check:', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString(),
    });
    return false;
  },
});

// Routes
/**
 * POST /api/v1/payments/squad/initiate
 * Initialize a new payment
 */
router.post('/initiate', paymentLimiter, initiatePaymentController);

/**
 * POST /api/v1/payments/squad/verify
 * Verify a payment status
 */
router.post('/verify', verifyLimiter, verifyPaymentController);

/**
 * POST /api/v1/payments/squad/callback
 * Webhook endpoint for Squad to send payment status
 * No rate limiting on callback to prevent Squad from being blocked
 */
router.post('/callback', callbackHandler);

/**
 * GET /api/v1/payments/squad/status/:transactionRef
 * Get payment status by transaction reference
 */
router.get('/status/:transactionRef', getPaymentStatusController);

export default router;
