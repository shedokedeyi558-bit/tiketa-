import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { verifyToken } from '../middlewares/authMiddleware.js';
import {
  getWalletController,
  createWithdrawalRequestController,
  getWithdrawalHistoryController,
} from '../controllers/withdrawalController.js';

const router = express.Router();

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Middleware: Ensure organizer role (verify from DB)
 */
const requireOrganizerRole = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'User not authenticated',
      });
    }

    // Verify organizer role directly from profiles table
    const { data: userProfile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (!userProfile || !['organizer', 'admin'].includes(userProfile.role)) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Only organizers can access this resource',
      });
    }

    next();
  } catch (error) {
    console.error('Role verification error:', error);
    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: 'Only organizers can access this resource',
    });
  }
};

/**
 * GET /api/v1/withdrawals/wallet
 * Get organizer's wallet balance
 */
router.get('/wallet', verifyToken, requireOrganizerRole, getWalletController);

/**
 * POST /api/v1/withdrawals/request
 * Create a withdrawal request
 */
router.post(
  '/request',
  verifyToken,
  requireOrganizerRole,
  createWithdrawalRequestController
);

/**
 * GET /api/v1/withdrawals/history
 * Get withdrawal request history
 */
router.get(
  '/history',
  verifyToken,
  requireOrganizerRole,
  getWithdrawalHistoryController
);

export default router;
