import express from 'express';
import rateLimit from 'express-rate-limit';
import { createClient } from '@supabase/supabase-js';
import {
  initiatePaymentController,
  verifyPaymentController,
  callbackHandler,
  getPaymentStatusController,
} from '../controllers/squadPaymentController.js';

// Service-role client for debug endpoint (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const router = express.Router();

// Rate limiting middleware
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 requests per window
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

// ─────────────────────────────────────────────────────────────────────────────
// TEMPORARY DEBUG ENDPOINT — remove after diagnosis is complete
// GET /api/v1/payments/squad/debug/transaction/:reference
//
// Returns every transaction row for a reference, including:
//   - ticket_type_id on each row
//   - quantity on each row
//   - the full squadco_response (contains stored cartItems)
//
// Usage:
//   GET https://<backend>/api/v1/payments/squad/debug/transaction/TXN_XXXXX
// ─────────────────────────────────────────────────────────────────────────────
router.get('/debug/transaction/:reference', async (req, res) => {
  try {
    const reference = req.params.reference.trim().toUpperCase();

    // Fetch all rows for this reference (there should be 1 per cart item after expansion)
    const { data: rows, error } = await supabaseAdmin
      .from('transactions')
      .select('id, reference, status, ticket_type_id, quantity, total_amount, ticket_price, processing_fee, created_at, verified_at, squadco_response')
      .ilike('reference', reference)
      .order('created_at', { ascending: true });

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No transactions found for reference: ${reference}`,
      });
    }

    // Parse squadco_response on the first row to expose stored cartItems clearly
    const firstRow = rows[0];
    let storedCartItems = null;
    let storedAttendees = null;
    try {
      const raw = typeof firstRow.squadco_response === 'string'
        ? JSON.parse(firstRow.squadco_response)
        : (firstRow.squadco_response || {});
      storedCartItems = raw.cartItems || null;
      storedAttendees = raw.attendees || null;
    } catch (_) {}

    // Build a per-row summary for easy reading
    const rowSummary = rows.map((row, i) => ({
      row: i,
      id: row.id,
      status: row.status,
      ticket_type_id: row.ticket_type_id,   // null = not set correctly
      quantity: row.quantity,
      ticket_price: row.ticket_price,
      processing_fee: row.processing_fee,
      total_amount: row.total_amount,
      verified_at: row.verified_at,
    }));

    // Per-item summary of what was stored in squadco_response.cartItems
    const cartItemSummary = Array.isArray(storedCartItems)
      ? storedCartItems.map((item, i) => ({
          index: i,
          keys: Object.keys(item),
          id: item.id,
          ticket_type_id: item.ticket_type_id,
          ticketTypeId: item.ticketTypeId,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        }))
      : null;

    return res.status(200).json({
      success: true,
      reference,
      diagnosis: {
        total_rows: rows.length,
        expected_rows: storedCartItems ? storedCartItems.length : 'unknown (no cartItems in squadco_response)',
        rows_match_cart: storedCartItems ? rows.length === storedCartItems.length : null,
        all_ticket_type_ids_set: rowSummary.every(r => r.ticket_type_id !== null),
      },
      rows: rowSummary,
      stored_cart_items: cartItemSummary,
      stored_attendees_count: Array.isArray(storedAttendees) ? storedAttendees.length : null,
      raw_squadco_response: firstRow.squadco_response,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
// ─── END TEMPORARY DEBUG ENDPOINT ────────────────────────────────────────────

export default router;
