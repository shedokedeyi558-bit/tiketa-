import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { verifyToken } from '../middlewares/authMiddleware.js';
import crypto from 'crypto';

const router = express.Router({ mergeParams: true }); // mergeParams gives access to :eventId

// ✅ In-memory store for check-in tokens: { token -> { eventId, organizerId, expiresAt } }
// Simple and fast — no DB round-trip needed for token validation
const checkinTokenStore = new Map();

// Clean up expired tokens every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of checkinTokenStore.entries()) {
    if (data.expiresAt < now) checkinTokenStore.delete(token);
  }
}, 10 * 60 * 1000);

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Middleware: allow organizer JWT OR valid checkin_token
 * Sets req.organizerId and req.checkinMode on success
 */
const checkinAuth = async (req, res, next) => {
  const { eventId } = req.params;

  // Try checkin_token first (from query or body)
  const token = req.query.checkin_token || req.body?.checkin_token;
  if (token) {
    const stored = checkinTokenStore.get(token);
    if (!stored) {
      return res.status(401).json({ success: false, error: 'Invalid or expired check-in token' });
    }
    if (stored.expiresAt < Date.now()) {
      checkinTokenStore.delete(token);
      return res.status(401).json({ success: false, error: 'Check-in token has expired' });
    }
    if (stored.eventId !== eventId) {
      return res.status(403).json({ success: false, error: 'Token not valid for this event' });
    }
    req.organizerId = stored.organizerId;
    req.checkinMode = 'token';
    return next();
  }

  // Fall back to organizer JWT
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  try {
    const jwtToken = authHeader.split(' ')[1];
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(jwtToken);
    if (error || !user) {
      return res.status(401).json({ success: false, error: 'Invalid token' });
    }
    req.organizerId = user.id;
    req.checkinMode = 'jwt';
    return next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Authentication failed' });
  }
};

/**
 * Verify event belongs to the requesting organizer
 */
const verifyEventOwnership = async (eventId, organizerId) => {
  const { data: event, error } = await supabaseAdmin
    .from('events')
    .select('id, organizer_id, title, ticket_types')
    .eq('id', eventId)
    .single();

  if (error || !event) return { valid: false, error: 'Event not found' };
  if (event.organizer_id !== organizerId) return { valid: false, error: 'Not your event' };
  return { valid: true, event };
};

// ─────────────────────────────────────────────────────────────
// POST /api/v1/organizer/events/:eventId/checkin-token
// Generate a short-lived check-in token for this event
// Auth: organizer JWT only
// ─────────────────────────────────────────────────────────────
router.post('/checkin-token', verifyToken, async (req, res) => {
  try {
    const { eventId } = req.params;
    const organizerId = req.user.id;

    // Verify ownership
    const ownership = await verifyEventOwnership(eventId, organizerId);
    if (!ownership.valid) {
      return res.status(ownership.error === 'Event not found' ? 404 : 403).json({
        success: false,
        error: ownership.error,
      });
    }

    // Generate a cryptographically random token
    const token = crypto.randomBytes(24).toString('hex'); // 48-char hex string
    const TTL_MS = 8 * 60 * 60 * 1000; // 8 hours
    const expiresAt = Date.now() + TTL_MS;

    checkinTokenStore.set(token, { eventId, organizerId, expiresAt });

    console.log(`✅ Check-in token generated for event ${eventId} by organizer ${organizerId}`);

    return res.status(200).json({
      success: true,
      data: {
        token,
        expires_at: new Date(expiresAt).toISOString(),
        event_id: eventId,
      },
    });
  } catch (err) {
    console.error('❌ checkin-token error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/v1/organizer/events/:eventId/checkin?ref=TXN_...
// Look up a ticket by reference for this event
// Auth: organizer JWT OR valid checkin_token
// ─────────────────────────────────────────────────────────────
router.get('/checkin', checkinAuth, async (req, res) => {
  try {
    const { eventId } = req.params;
    const ref = req.query.ref;

    if (!ref) {
      return res.status(400).json({ success: false, error: 'ref query param is required' });
    }

    // Case-insensitive reference lookup for this event
    const { data: transactions, error: txError } = await supabaseAdmin
      .from('transactions')
      .select('id, reference, buyer_name, buyer_email, ticket_type_id, quantity, status, checked_in_at, checked_in_by, event_id, squadco_response')
      .ilike('reference', ref.trim())
      .eq('status', 'success')
      .limit(5);

    if (txError) {
      console.error('❌ Check-in lookup error:', txError);
      return res.status(500).json({ success: false, error: 'Database error' });
    }

    if (!transactions || transactions.length === 0) {
      return res.status(404).json({ success: false, error: 'Ticket not found' });
    }

    // Find the row that belongs to this event
    const tx = transactions.find(t => t.event_id === eventId);
    if (!tx) {
      return res.status(400).json({ success: false, error: 'Ticket not valid for this event' });
    }

    // Resolve ticket type name:
    // 1. Try ticket_type_id (UUID) against event's ticket_types JSONB
    // 2. Fall back to squadco_response.tier_name (stored for non-UUID string tier IDs)
    let ticketTypeName = null;
    const srRaw = tx.squadco_response;
    const sr = typeof srRaw === 'string' ? (() => { try { return JSON.parse(srRaw); } catch(_) { return {}; } })() : (srRaw || {});

    if (tx.ticket_type_id) {
      const { data: event } = await supabaseAdmin
        .from('events')
        .select('ticket_types')
        .eq('id', eventId)
        .single();

      const ticketTypes = event?.ticket_types || [];
      const matched = ticketTypes.find(tt => tt.id === tx.ticket_type_id);
      ticketTypeName = matched?.name || null;
    }

    // Fallback: tier_name stored in squadco_response when ticket_type_id is not a UUID
    if (!ticketTypeName && sr.tier_name) {
      ticketTypeName = sr.tier_name;
    }

    const alreadyCheckedIn = !!tx.checked_in_at;

    // Fetch all split rows for this reference (TXN_XXX, TXN_XXX_1, TXN_XXX_2 etc.)
    // Strip any _N suffix to get the base reference
    const baseRef = tx.reference.replace(/_\d+$/, '');
    const { data: allRows } = await supabaseAdmin
      .from('transactions')
      .select('id, reference, buyer_name, buyer_email, ticket_price, quantity, status, squadco_response')
      .ilike('reference', `${baseRef}%`)
      .eq('event_id', eventId)
      .eq('status', 'success')
      .order('created_at', { ascending: true });

    const all_transactions = (allRows || []).map(row => {
      const rowSr = typeof row.squadco_response === 'string'
        ? (() => { try { return JSON.parse(row.squadco_response); } catch(_) { return {}; } })()
        : (row.squadco_response || {});
      return {
        reference:        row.reference,
        ticket_type_name: rowSr.tier_name || null,
        ticket_price:     Number(row.ticket_price || 0),
        quantity:         row.quantity || 1,
        buyer_name:       row.buyer_name,
        buyer_email:      row.buyer_email,
        status:           row.status,
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        valid: true,
        already_checked_in: alreadyCheckedIn,
        checked_in_at: tx.checked_in_at || null,
        transaction: {
          id: tx.id,
          reference: baseRef,
          buyer_name: tx.buyer_name,
          buyer_email: tx.buyer_email,
          ticket_type_id: tx.ticket_type_id || sr.tier_id || null,
          ticket_type_name: ticketTypeName,
          quantity: tx.quantity || 1,
          status: tx.status,
        },
        all_transactions,
      },
    });
  } catch (err) {
    console.error('❌ GET checkin error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/v1/organizer/events/:eventId/checkin
// Mark a ticket as checked in
// Auth: organizer JWT OR valid checkin_token
// Body: { reference: "TXN_..." }
// ─────────────────────────────────────────────────────────────
router.post('/checkin', checkinAuth, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { reference } = req.body;

    if (!reference) {
      return res.status(400).json({ success: false, error: 'reference is required' });
    }

    // Find the transaction
    const { data: transactions, error: txError } = await supabaseAdmin
      .from('transactions')
      .select('id, reference, event_id, status, checked_in_at, checked_in_by')
      .ilike('reference', reference.trim())
      .eq('status', 'success')
      .limit(5);

    if (txError) {
      return res.status(500).json({ success: false, error: 'Database error' });
    }

    if (!transactions || transactions.length === 0) {
      return res.status(404).json({ success: false, error: 'Ticket not found' });
    }

    const tx = transactions.find(t => t.event_id === eventId);
    if (!tx) {
      return res.status(400).json({ success: false, error: 'Ticket not valid for this event' });
    }

    // Already checked in?
    if (tx.checked_in_at) {
      return res.status(200).json({
        success: false,
        already_checked_in: true,
        checked_in_at: tx.checked_in_at,
        message: 'This ticket has already been checked in',
      });
    }

    // Mark as checked in
    const now = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin
      .from('transactions')
      .update({
        checked_in_at: now,
        checked_in_by: req.organizerId,
      })
      .eq('id', tx.id);

    if (updateError) {
      console.error('❌ Check-in update error:', updateError);
      return res.status(500).json({ success: false, error: 'Failed to check in ticket' });
    }

    console.log(`✅ Checked in: ${reference} for event ${eventId} by ${req.organizerId}`);

    return res.status(200).json({
      success: true,
      message: 'Checked in successfully',
      checked_in_at: now,
    });
  } catch (err) {
    console.error('❌ POST checkin error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
