import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  initiatePayment,
  verifyPayment,
  getPaymentStatus,
} from '../controllers/paymentController.js';

const router = express.Router();

// Rate limiting for payment endpoints
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  message: 'Too many payment attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 verification attempts per window
  message: 'Too many verification attempts',
  standardHeaders: true,
  legacyHeaders: false,
});

// Routes
router.post('/initiate', paymentLimiter, initiatePayment);
router.post('/verify', verifyLimiter, verifyPayment);
router.get('/:reference', getPaymentStatus);

export default router;
