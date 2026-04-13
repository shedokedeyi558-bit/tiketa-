import express from 'express';
import { adminAuth } from '../middlewares/adminMiddleware.js';
import {
  getAdminEvents,
  createAdminEvent,
  updateAdminEvent,
  deleteAdminEvent,
  getAdminOrders,
  getDashboardStats,
  getRevenueAnalytics,
} from '../controllers/adminController.js';
import {
  getWithdrawalsController,
  approveWithdrawalController,
  rejectWithdrawalController,
  payWithdrawalController,
  getRecentOrganizersController,
  getRecentTicketsController,
} from '../controllers/adminPayoutController.js';

const router = express.Router();

// All admin routes require authentication
router.use(adminAuth);

// Events management
router.get('/events', getAdminEvents);
router.post('/events', createAdminEvent);
router.put('/events/:id', updateAdminEvent);
router.delete('/events/:id', deleteAdminEvent);

// Orders management
router.get('/orders', getAdminOrders);

// Dashboard stats
router.get('/stats', getDashboardStats);

// Revenue analytics
router.get('/revenue', getRevenueAnalytics);

// Payout management
router.get('/payouts/withdrawals', getWithdrawalsController);
router.post('/payouts/withdrawals/:id/approve', approveWithdrawalController);
router.post('/payouts/withdrawals/:id/reject', rejectWithdrawalController);
router.post('/payouts/withdrawals/:id/pay', payWithdrawalController);
router.get('/payouts/organizers/recent', getRecentOrganizersController);
router.get('/payouts/tickets/recent', getRecentTicketsController);

export default router;
