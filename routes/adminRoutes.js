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
  getAdminOrganizers,
  getPendingEvents,
  approveEvent,
  rejectEvent,
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
router.get('/events/pending', getPendingEvents); // ✅ Get pending events
router.post('/events', createAdminEvent);
router.post('/events/:id/approve', approveEvent); // ✅ Approve event
router.post('/events/:id/reject', rejectEvent); // ✅ Reject event
router.put('/events/:id', updateAdminEvent);
router.delete('/events/:id', deleteAdminEvent);

// Orders management
router.get('/orders', getAdminOrders);

// Organizers management
router.get('/organizers', getAdminOrganizers);

// Dashboard stats
router.get('/stats', getDashboardStats);

// Revenue analytics
router.get('/revenue', getRevenueAnalytics);

// Payout management
router.get('/payouts/withdrawals', getWithdrawalsController);
router.get('/payouts/organizers/recent', getRecentOrganizersController);
router.get('/payouts/tickets/recent', getRecentTicketsController);

// Approve, reject, pay - support both POST and PATCH methods
router.options('/payouts/:id/approve', (req, res) => res.sendStatus(200));
router.post('/payouts/:id/approve', approveWithdrawalController);
router.patch('/payouts/:id/approve', approveWithdrawalController);

router.options('/payouts/:id/reject', (req, res) => res.sendStatus(200));
router.post('/payouts/:id/reject', rejectWithdrawalController);
router.patch('/payouts/:id/reject', rejectWithdrawalController);

router.options('/payouts/:id/pay', (req, res) => res.sendStatus(200));
router.post('/payouts/:id/pay', payWithdrawalController);
router.patch('/payouts/:id/pay', payWithdrawalController);

export default router;
