import express from 'express';
import { verifyToken } from '../middlewares/authMiddleware.js';
import {
  getWalletBalance,
  getWalletHistory,
  requestWithdrawal,
  getWithdrawals,
  getEarningsSummary,
} from '../controllers/walletController.js';

const router = express.Router();

// All wallet routes require authentication
router.use(verifyToken);

// Routes
router.get('/balance', getWalletBalance);
router.get('/history', getWalletHistory);
router.get('/withdrawals', getWithdrawals);
router.get('/summary', getEarningsSummary);
router.post('/withdraw', requestWithdrawal);

export default router;
