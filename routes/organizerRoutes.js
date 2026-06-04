import express from 'express';
import { verifyToken } from '../middlewares/authMiddleware.js';
import { deleteEventIfNoSales } from '../services/eventExpiryService.js';
import checkinRoutes from './checkinRoutes.js';

const router = express.Router();

/**
 * GET /api/v1/organizer/stats
 * Returns dashboard stats for the logged-in organizer
 */
router.get('/stats', verifyToken, async (req, res) => {
  try {
    const organizerId = req.user.id;

    if (!organizerId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'You must be logged in'
      });
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Get total events count (all statuses)
    const { count: totalEvents, error: evCountError } = await supabase
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('organizer_id', organizerId);

    if (evCountError) {
      console.error('❌ Error counting events:', evCountError);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch events',
        message: evCountError.message
      });
    }

    // Get all successful transactions for this organizer
    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('id, organizer_earnings, quantity')
      .eq('organizer_id', organizerId)
      .eq('status', 'success');

    if (txError) {
      console.error('❌ Error fetching transactions:', txError);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch transactions',
        message: txError.message
      });
    }

    // ✅ Dynamic tickets_sold = SUM of quantity across all rows
    const ticketsSold = (transactions || []).reduce((sum, t) => sum + (parseInt(t.quantity) || 1), 0);
    const totalEarned = Number((transactions || []).reduce((sum, t) => sum + Number(t.organizer_earnings || 0), 0).toFixed(2));

    return res.status(200).json({
      success: true,
      data: {
        total_events: totalEvents || 0,
        tickets_sold: ticketsSold,
        total_earned: totalEarned
      }
    });
  } catch (err) {
    console.error('❌ Stats error:', err);
    return res.status(500).json({
      success: false,
      error: 'Server error',
      message: 'Internal server error'
    });
  }
});

/**
 * DELETE /api/v1/organizer/events/:id
 * Delete organizer event - only owner can delete, only if no tickets sold
 */
router.delete('/events/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const organizerId = req.user.id;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Event ID is required',
        message: 'Event ID is required'
      });
    }

    if (!organizerId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'You must be logged in to delete an event'
      });
    }

    console.log('🗑️ Organizer attempting to delete event:', { eventId: id, organizerId });

    // Check event exists and belongs to this organizer
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: event, error: fetchError } = await supabase
      .from('events')
      .select('id, title, organizer_id, tickets_sold')
      .eq('id', id)
      .eq('organizer_id', organizerId)
      .single();

    if (fetchError || !event) {
      console.error('❌ Event not found or access denied:', fetchError?.message);
      return res.status(404).json({
        success: false,
        error: 'Event not found',
        message: 'Event not found or access denied'
      });
    }

    console.log('✅ Event found:', event.title);

    // Check no transactions exist
    const { data: transactions } = await supabase
      .from('transactions')
      .select('id')
      .eq('event_id', id)
      .limit(1);

    if (transactions && transactions.length > 0) {
      console.warn('❌ Cannot delete: Event has transactions');
      return res.status(400).json({
        success: false,
        error: 'Cannot delete event with existing ticket sales',
        message: 'Cannot delete event with existing ticket sales'
      });
    }

    console.log('✅ No transactions found, proceeding with deletion');

    // Delete the event
    const { error: deleteError } = await supabase
      .from('events')
      .delete()
      .eq('id', id)
      .eq('organizer_id', organizerId);

    if (deleteError) {
      console.error('❌ Error deleting event:', deleteError);
      return res.status(500).json({
        success: false,
        error: 'Failed to delete event',
        message: deleteError.message
      });
    }

    console.log('✅ Event deleted successfully:', id);

    return res.status(200).json({
      success: true,
      message: 'Event deleted successfully'
    });
  } catch (err) {
    console.error('❌ Delete event error:', err);
    return res.status(500).json({
      success: false,
      error: 'Server error',
      message: 'Internal server error'
    });
  }
});

/**
 * ─── Shared helper: group flat transaction rows by base reference ────────────
 * Per-type rows have references like TXN_XXX_1, TXN_XXX_2.
 * The primary row is TXN_XXX (no suffix).
 * Groups them into one purchase object with a ticket_types array.
 *
 * ⚠️  PRODUCTION CONTRACT — DO NOT CHANGE SHAPE WITHOUT FRONTEND SIGN-OFF
 *
 *  Applies to both:
 *    GET /api/v1/organizer/transactions
 *    GET /api/v1/organizer/events/:eventId/transactions
 *
 *  Required fields (frontend reads these directly):
 *    [].reference
 *    [].buyer_name
 *    [].buyer_email
 *    [].buyer_phone
 *    [].total_amount
 *    [].organizer_earnings
 *    [].platform_commission
 *    [].quantity
 *    [].status
 *    [].created_at
 *    [].event_title
 *    [].attendees
 *    [].ticket_types[].ticket_type_id
 *    [].ticket_types[].ticket_type_name
 *    [].ticket_types[].quantity
 *    [].ticket_types[].ticket_price
 *    [].ticket_types[].organizer_earnings
 *    [].ticket_types[].platform_commission
 */
function groupTransactionsByReference(rows, eventTitleMap = {}) {
  // Map: baseRef → { primary row, all rows }
  const groups = new Map();

  for (const row of rows) {
    const sr = typeof row.squadco_response === 'string'
      ? (() => { try { return JSON.parse(row.squadco_response); } catch(_) { return {}; } })()
      : (row.squadco_response || {});

    // Strip _N suffix to find the canonical base reference
    const baseRef = row.reference.replace(/_\d+$/, '');
    const isPrimary = row.reference === baseRef;

    if (!groups.has(baseRef)) {
      groups.set(baseRef, { primary: null, rows: [] });
    }
    const group = groups.get(baseRef);
    if (isPrimary) group.primary = { row, sr };
    group.rows.push({ row, sr });
  }

  const result = [];

  for (const [baseRef, { primary, rows: groupRows }] of groups) {
    // Fall back to first row if no primary (shouldn't happen)
    const { row: p, sr: pSr } = primary || groupRows[0];

    const attendees = pSr.attendees || [];
    const buyerPhone = attendees.length > 0
      ? (attendees[0]?.phone || attendees[0]?.phoneNumber || null)
      : null;

    // Aggregate totals across all rows in this group
    const totalAmount       = groupRows.reduce((s, { row: r }) => s + Number(r.total_amount || 0), 0);
    const orgEarnings       = groupRows.reduce((s, { row: r }) => s + Number(r.organizer_earnings || 0), 0);
    const platCommission    = groupRows.reduce((s, { row: r }) => s + Number(r.platform_commission || 0), 0);
    const totalQty          = groupRows.reduce((s, { row: r }) => s + (parseInt(r.quantity) || 1), 0);

    // Build per-type breakdown
    const ticketTypes = groupRows.map(({ row: r, sr: rSr }) => ({
      ticket_type_id:   rSr.tier_id   || null,
      ticket_type_name: rSr.tier_name || null,
      quantity:         parseInt(r.quantity) || 1,
      ticket_price:     Number(r.ticket_price || 0),
      organizer_earnings:  Number(r.organizer_earnings || 0),
      platform_commission: Number(r.platform_commission || 0),
    }));

    result.push({
      id:                  p.id,
      reference:           baseRef,
      event_id:            p.event_id,
      event_title:         eventTitleMap[p.event_id] || null,
      buyer_name:          p.buyer_name,
      buyer_email:         p.buyer_email,
      buyer_phone:         buyerPhone,
      total_amount:        Number(totalAmount.toFixed(2)),
      organizer_earnings:  Number(orgEarnings.toFixed(2)),
      platform_commission: Number(platCommission.toFixed(2)),
      // First ticket type's price for backward compat
      ticket_price:        Number((groupRows[0].row.ticket_price || 0)),
      quantity:            totalQty,
      status:              p.status,
      created_at:          p.created_at,
      attendees:           attendees,
      ticket_types:        ticketTypes,
    });
  }

  // Sort by created_at descending (groups are unsorted after Map iteration)
  result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return result;
}

/**
 * GET /api/v1/organizer/transactions
 * Returns all successful transactions for the logged-in organizer's events,
 * grouped by reference (one object per purchase).
 */
router.get('/transactions', verifyToken, async (req, res) => {
  try {
    const organizerId = req.user.id;

    if (!organizerId) {
      return res.status(401).json({ success: false, error: 'Unauthorized', message: 'You must be logged in' });
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    // Fetch all rows (primary + per-type rows TXN_XXX_1 etc.)
    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('id, reference, buyer_name, buyer_email, ticket_price, processing_fee, total_amount, platform_commission, organizer_earnings, quantity, status, created_at, event_id, squadco_response')
      .eq('organizer_id', organizerId)
      .eq('status', 'success')
      .order('created_at', { ascending: false });

    if (txError) {
      console.error('❌ Error fetching transactions:', txError);
      return res.status(500).json({ success: false, error: 'Failed to fetch transactions', message: txError.message });
    }

    // Fetch event titles
    const eventIds = [...new Set((transactions || []).map(t => t.event_id).filter(Boolean))];
    let eventMap = {};
    if (eventIds.length > 0) {
      const { data: events } = await supabase.from('events').select('id, title').in('id', eventIds);
      eventMap = Object.fromEntries((events || []).map(e => [e.id, e.title]));
    }

    const grouped = groupTransactionsByReference(transactions || [], eventMap);

    return res.status(200).json({ success: true, data: grouped });
  } catch (err) {
    console.error('❌ Transactions error:', err);
    return res.status(500).json({ success: false, error: 'Server error', message: 'Internal server error' });
  }
});

/**
 * GET /api/v1/organizer/events/:eventId/transactions
 * Returns all successful transactions for a specific event, grouped by reference.
 */
router.get('/events/:eventId/transactions', verifyToken, async (req, res) => {
  try {
    const { eventId } = req.params;
    const organizerId = req.user.id;

    if (!organizerId) {
      return res.status(401).json({ success: false, error: 'Unauthorized', message: 'You must be logged in' });
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Verify event ownership
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, organizer_id, title')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      return res.status(404).json({ success: false, error: 'Event not found', message: 'Event not found' });
    }
    if (event.organizer_id !== organizerId) {
      return res.status(403).json({ success: false, error: 'Forbidden', message: 'This event does not belong to you' });
    }

    // Fetch all rows for this event (primary + per-type rows)
    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('id, reference, buyer_name, buyer_email, ticket_price, total_amount, platform_commission, organizer_earnings, quantity, status, created_at, event_id, squadco_response')
      .eq('event_id', eventId)
      .eq('status', 'success')
      .order('created_at', { ascending: false });

    if (txError) {
      console.error('❌ Error fetching event transactions:', txError);
      return res.status(500).json({ success: false, error: 'Failed to fetch transactions', message: txError.message });
    }

    const eventTitleMap = { [eventId]: event.title };
    const grouped = groupTransactionsByReference(transactions || [], eventTitleMap);

    return res.status(200).json({ success: true, data: grouped });
  } catch (err) {
    console.error('❌ Event transactions error:', err);
    return res.status(500).json({ success: false, error: 'Server error', message: 'Internal server error' });
  }
});

/**
 * GET /api/v1/organizer/past-events
 * Returns all ended or cancelled events for the logged-in organizer
 */
router.get('/past-events', verifyToken, async (req, res) => {
  try {
    const organizerId = req.user.id;

    if (!organizerId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'You must be logged in'
      });
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Get all ended or cancelled events for this organizer
    const { data: events, error: evError } = await supabase
      .from('events')
      .select('id, title, date, start_time, end_time, total_tickets')
      .eq('organizer_id', organizerId)
      .in('status', ['ended', 'cancelled'])
      .order('date', { ascending: false });

    if (evError) {
      console.error('❌ Error fetching events:', evError);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch events',
        message: evError.message
      });
    }

    // Get transaction data for each event
    const eventIds = (events || []).map(e => e.id);
    let transactionMap = {};

    if (eventIds.length > 0) {
      // Fetch transactions with tier info from squadco_response
      const { data: transactions } = await supabase
        .from('transactions')
        .select('event_id, organizer_earnings, quantity, squadco_response')
        .in('event_id', eventIds)
        .eq('status', 'success');

      if (transactions) {
        transactionMap = transactions.reduce((acc, t) => {
          if (!acc[t.event_id]) {
            acc[t.event_id] = { count: 0, revenue: 0, byTier: {} };
          }
          const qty = parseInt(t.quantity) || 1;
          acc[t.event_id].count += qty;
          acc[t.event_id].revenue += Number(t.organizer_earnings || 0);

          // Accumulate sold count per tier
          const sr = typeof t.squadco_response === 'string'
            ? (() => { try { return JSON.parse(t.squadco_response); } catch(_) { return {}; } })()
            : (t.squadco_response || {});
          const tierId = sr.tier_id || null;
          if (tierId) {
            acc[t.event_id].byTier[tierId] = (acc[t.event_id].byTier[tierId] || 0) + qty;
          }
          return acc;
        }, {});
      }
    }

    // Fetch ticket_types for all events from the ticket_types table
    let ticketTypesMap = {};
    if (eventIds.length > 0) {
      const { data: ticketTypeRows } = await supabase
        .from('ticket_types')
        .select('id, event_id, name, price, quantity')
        .in('event_id', eventIds);

      // Fall back to JSONB column if ticket_types table has no rows for an event
      const { data: eventsWithJsonb } = await supabase
        .from('events')
        .select('id, ticket_types')
        .in('id', eventIds);

      const jsonbMap = Object.fromEntries((eventsWithJsonb || []).map(e => [e.id, e.ticket_types || []]));

      for (const eventId of eventIds) {
        const rows = (ticketTypeRows || []).filter(tt => tt.event_id === eventId);
        const source = rows.length > 0 ? rows : (jsonbMap[eventId] || []);
        const byTier = transactionMap[eventId]?.byTier || {};

        ticketTypesMap[eventId] = source.map(tt => ({
          id: tt.id || null,
          name: tt.name || 'Ticket',
          price: Number(tt.price || 0),
          quantity: Number(tt.quantity || 0),         // total capacity
          quantity_sold: byTier[tt.id] || 0,          // sold for this tier
        }));
      }
    }

    // Enrich events with transaction data and ticket_types
    const enrichedEvents = (events || []).map(e => ({
      id: e.id,
      title: e.title,
      date: e.date,
      start_time: e.start_time,
      end_time: e.end_time,
      total_tickets: Number(e.total_tickets || 0),
      tickets_sold: transactionMap[e.id]?.count || 0,
      total_revenue: Number((transactionMap[e.id]?.revenue || 0).toFixed(2)),
      ticket_types: ticketTypesMap[e.id] || [],
    }));

    return res.status(200).json({
      success: true,
      data: enrichedEvents
    });
  } catch (err) {
    console.error('❌ Past events error:', err);
    return res.status(500).json({
      success: false,
      error: 'Server error',
      message: 'Internal server error'
    });
  }
});

// ✅ Check-in routes: GET/POST /api/v1/organizer/events/:eventId/checkin
//                    POST /api/v1/organizer/events/:eventId/checkin-token
router.use('/events/:eventId', checkinRoutes);

export default router;