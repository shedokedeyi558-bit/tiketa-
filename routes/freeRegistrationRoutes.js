import express from 'express';
import rateLimit from 'express-rate-limit';
import { freeRegisterController, freeConfirmController } from '../controllers/freeRegistrationController.js';

const router = express.Router();

// Light rate limit — free registrations should still be protected from abuse
const freeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: 'Too many registration attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * POST /api/v1/payments/free/register
 * Register for a free event — no payment needed
 */
router.post('/register', freeLimiter, freeRegisterController);

/**
 * GET /api/v1/payments/free/confirm?reference=FREE_xxx
 * Retrieve a completed free registration (same shape as paid verify)
 */
router.get('/confirm', freeConfirmController);

export default router;
