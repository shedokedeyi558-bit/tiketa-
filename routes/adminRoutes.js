import express from 'express';
import { adminAuth } from '../middlewares/adminMiddleware.js';
import {
  getAdminEvents,
  createAdminEvent,
  updateAdminEvent,
  deleteAdminEvent,
  getAdminOrders,
  getSalesFeed,
  getDashboardStats,
  getRevenueAnalytics,
  getAdminOrganizers,
  getPendingEvents,
  approveEvent,
  rejectEvent,
  getTransactionDiagnostics,
  getAdminEventById,
  getAdminOrganizerById,
  suspendOrganizer,
  unsuspendOrganizer,
  diagnosticEventTransactions,
  getMonthlyEarnings,
  backfillTransactions,
  getStuckPayments,
  getAdminTransactions,
  getWalletIntegrity,
  fixWalletIntegrity,
  resendTransactionEmail,
  getFraudFlags,
  reviewFraudFlag,
} from '../controllers/adminController.js';
import {
  getWithdrawalsController,
  approveWithdrawalController,
  rejectWithdrawalController,
  payWithdrawalController,
  getRecentOrganizersController,
  getRecentTicketsController,
  approveAndPayController,
} from '../controllers/adminPayoutController.js';
import {
  getPlatformSettings,
  updatePlatformSettings,
} from '../controllers/platformSettingsController.js';

const router = express.Router();

// All admin routes require authentication
router.use(adminAuth);

// Events management
router.get('/events', getAdminEvents);
router.get('/events/:id', getAdminEventById); // ✅ Get single event details
router.get('/events/pending', getPendingEvents); // ✅ Get pending events
router.post('/events', createAdminEvent);
router.post('/events/:id/approve', approveEvent); // ✅ Approve event
router.post('/events/:id/reject', rejectEvent); // ✅ Reject event
router.put('/events/:id', updateAdminEvent);
router.delete('/events/:id', deleteAdminEvent);

// Orders management
router.get('/orders', getAdminOrders);

// Sales feed (transactions with platform profit)
router.get('/sales-feed', getSalesFeed);

// Organizers management
router.get('/organizers', getAdminOrganizers);
router.get('/organizers/:id', getAdminOrganizerById); // ✅ Get organizer details
router.post('/organizers/:id/suspend', suspendOrganizer); // ✅ Suspend organizer
router.post('/organizers/:id/unsuspend', unsuspendOrganizer); // ✅ Unsuspend organizer

// Dashboard stats
router.get('/stats', getDashboardStats);

// Revenue analytics
router.get('/revenue', getRevenueAnalytics);

// Monthly earnings breakdown
router.get('/monthly-earnings', getMonthlyEarnings);

// Transaction diagnostics (for debugging)
router.get('/diagnostics/transactions', getTransactionDiagnostics);
router.get('/diagnostics/event/:eventId/transactions', diagnosticEventTransactions);

// Backfill: re-run per-type split for broken transactions + re-sync tickets_sold
router.post('/backfill-transactions', backfillTransactions);

// Stuck payments: pending transactions older than 30 minutes
router.get('/stuck-payments', getStuckPayments);

// Transaction ledger with filters, search, pagination
router.get('/transactions', getAdminTransactions);

// Wallet integrity check and fix
router.get('/wallet-integrity', getWalletIntegrity);
router.post('/wallet-integrity/fix', fixWalletIntegrity);

// Resend confirmation email to buyer
router.post('/transactions/:reference/resend-email', resendTransactionEmail);

// Fraud detection flags
router.get('/fraud-flags', getFraudFlags);
router.patch('/fraud-flags/:id/review', reviewFraudFlag);

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

// ✅ Combined approve-and-pay — single step payout
router.post('/withdrawals/:id/approve-and-pay', approveAndPayController);

// Platform settings management
router.get('/settings', getPlatformSettings); // ✅ Get platform settings (public read)
router.put('/settings', updatePlatformSettings); // ✅ Update platform settings (admin only)

export default router;
