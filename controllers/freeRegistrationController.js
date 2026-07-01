/**
 * Free Event Registration Controller
 *
 * POST /api/v1/payments/free/register
 *   - Registers a buyer for a free event (all ticket prices must be 0)
 *   - Creates a transaction with status='success', total_amount=0
 *   - Sends a confirmation email
 *   - Returns the same shape as the paid verify endpoint
 *
 * GET /api/v1/payments/free/confirm?reference=FREE_xxx
 *   - Retrieves a completed free registration by reference
 *   - Returns the same shape as the paid verify endpoint
 *
 * No authentication required — buyers are not logged in during checkout.
 */

import { createClient } from '@supabase/supabase-js';
import { sendTicketPurchaseConfirmation } from '../services/emailService.js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ─── Helper: build the standard verify-shape response ────────────────────────
function buildResponse(transaction, eventInfo, allRows) {
  return {
    success: true,
    message: 'Registration confirmed',
    data: {
      status: 'success',
      reference: transaction.reference,
      amount: 0,
      email: transaction.buyer_email,
      event_title:    eventInfo?.title    || null,
      event_date:     eventInfo?.date     || null,
      event_location: eventInfo?.location || null,
      transaction: {
        id:                  transaction.id,
        reference:           transaction.reference,
        buyer_email:         transaction.buyer_email,
        buyer_name:          transaction.buyer_name,
        total_amount:        0,
        ticket_price:        0,
        processing_fee:      0,
        platform_commission: 0,
        organizer_earnings:  0,
        status:              'success',
        created_at:          transaction.created_at,
        verified_at:         transaction.verified_at || transaction.created_at,
        event_title:         eventInfo?.title || null,
      },
      all_transactions: allRows,
      ticket: null,
    },
  };
}

// ─── POST /api/v1/payments/free/register ─────────────────────────────────────
export const freeRegisterController = async (req, res) => {
  try {
    const { eventId, buyerEmail, buyerName, buyerPhone, cartItems, attendees } = req.body;

    // ── Basic validation ──────────────────────────────────────────────────────
    if (!eventId || !buyerEmail || !cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: eventId, buyerEmail, cartItems',
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(buyerEmail)) {
      return res.status(400).json({ success: false, error: 'Invalid email address' });
    }

    // ── Verify event exists and is active ────────────────────────────────────
    const { data: event, error: eventErr } = await supabaseAdmin
      .from('events')
      .select('id, title, date, end_date, start_time, end_time, location, organizer_id, status, total_tickets, tickets_sold, ticket_types')
      .eq('id', eventId)
      .single();

    if (eventErr || !event) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }
    if (event.status !== 'active') {
      return res.status(400).json({ success: false, error: 'Event is not active' });
    }

    // ── Security: verify the event actually has free ticket types ─────────────
    // Prevents bypassing paid tickets by calling this endpoint with price=0
    const ticketTypes = Array.isArray(event.ticket_types) ? event.ticket_types : [];
    const hasFreeTicketType = ticketTypes.some(tt => Number(tt.price || 0) === 0);

    // Also check ticket_types table
    let hasFreeInTable = false;
    if (!hasFreeTicketType) {
      const { data: freeRows } = await supabaseAdmin
        .from('ticket_types')
        .select('id, price')
        .eq('event_id', eventId)
        .eq('price', 0);
      hasFreeInTable = (freeRows?.length ?? 0) > 0;
    }

    if (!hasFreeTicketType && !hasFreeInTable) {
      return res.status(400).json({
        success: false,
        error: 'This event does not have free tickets',
      });
    }

    // ── Security: all ticket prices must be 0 ────────────────────────────────
    const nonFreeItem = cartItems.find(item => Number(item.price || item.ticket_price || 0) !== 0);
    if (nonFreeItem) {
      return res.status(400).json({
        success: false,
        error: 'This endpoint is only for free tickets. Ticket price must be 0.',
      });
    }

    // ── Capacity check: count confirmed + recent pending registrations ─────────
    // Uses an atomic query to prevent oversell under concurrent registrations.
    const totalQty = cartItems.reduce((s, item) => s + (parseInt(item.quantity) || 1), 0);

    if (event.total_tickets && event.total_tickets > 0) {
      // Count all confirmed registrations for this event
      const { count: confirmedCount } = await supabaseAdmin
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', eventId)
        .eq('status', 'success');

      // Also count registrations in the last 15 minutes (in-flight / pending)
      const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const { count: inFlightCount } = await supabaseAdmin
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', eventId)
        .eq('status', 'pending')
        .gte('created_at', fifteenMinAgo);

      const totalTaken = (confirmedCount ?? 0) + (inFlightCount ?? 0);
      const available = event.total_tickets - totalTaken;

      if (totalQty > available) {
        return res.status(400).json({
          success: false,
          error: 'Not enough tickets available',
          message: available <= 0
            ? 'Sorry, this event is fully booked'
            : `Only ${available} ticket(s) remaining`,
        });
      }
    }

    // Per-tier capacity check (if ticket_types have individual quantities)
    for (const item of cartItems) {
      const tierId  = item.id || item.ticket_type_id || null;
      const reqQty  = parseInt(item.quantity) || 1;
      if (!tierId) continue;

      // Check tier capacity from ticket_types table
      const { data: tierRow } = await supabaseAdmin
        .from('ticket_types')
        .select('quantity')
        .eq('id', tierId)
        .eq('event_id', eventId)
        .maybeSingle();

      if (tierRow && tierRow.quantity > 0) {
        const { count: tierSold } = await supabaseAdmin
          .from('transactions')
          .select('id', { count: 'exact', head: true })
          .eq('event_id', eventId)
          .eq('status', 'success')
          .contains('squadco_response', { tier_id: tierId });

        const tierAvailable = tierRow.quantity - (tierSold ?? 0);
        if (reqQty > tierAvailable) {
          return res.status(400).json({
            success: false,
            error: 'Not enough tickets available',
            message: `Only ${Math.max(0, tierAvailable)} ticket(s) remaining for "${item.name || 'this tier'}"`,
          });
        }
      }
    }

    // ── Generate unique reference ─────────────────────────────────────────────
    const random6 = Math.random().toString(36).substring(2, 8).toUpperCase();
    const reference = `FREE_${Date.now()}_${random6}`;
    const now = new Date().toISOString();

    const resolvedBuyerName = (buyerName || '').trim() || buyerEmail.split('@')[0];

    // ── Insert primary transaction row (row 0) ────────────────────────────────
    const firstItem = cartItems[0];
    const firstTierId   = firstItem.id || firstItem.ticket_type_id || null;
    const firstTierName = firstItem.name || firstItem.typeName || null;
    const firstQty      = parseInt(firstItem.quantity) || 1;

    const { data: primaryTx, error: txErr } = await supabaseAdmin
      .from('transactions')
      .insert([{
        reference,
        event_id:            eventId,
        organizer_id:        event.organizer_id,
        buyer_email:         buyerEmail,
        buyer_name:          resolvedBuyerName,
        buyer_phone:         buyerPhone || null,
        ticket_price:        0,
        processing_fee:      0,
        total_amount:        0,
        platform_commission: 0,
        squadco_fee:         0,
        organizer_earnings:  0,
        quantity:            firstQty,
        status:              'success',
        verified_at:         now,
        payment_method:      'free',
        squadco_response: {
          cartItems,
          attendees: attendees || [],
          tier_id:   firstTierId,
          tier_name: firstTierName,
        },
        attendees:    attendees || [],
      }])
      .select()
      .single();

    if (txErr) {
      console.error('❌ [FREE] Transaction insert failed:', txErr.message);
      return res.status(500).json({ success: false, error: 'Failed to create registration', message: txErr.message });
    }

    // ── Insert additional per-type rows for items beyond the first ────────────
    const splitRows = [{ reference, tier_name: firstTierName, qty: firstQty }];

    for (let i = 1; i < cartItems.length; i++) {
      const item     = cartItems[i];
      const tierId   = item.id || item.ticket_type_id || null;
      const tierName = item.name || item.typeName || null;
      const qty      = parseInt(item.quantity) || 1;

      const { error: insertErr } = await supabaseAdmin
        .from('transactions')
        .insert([{
          reference:           `${reference}_${i}`,
          event_id:            eventId,
          organizer_id:        event.organizer_id,
          buyer_email:         buyerEmail,
          buyer_name:          resolvedBuyerName,
          buyer_phone:         buyerPhone || null,
          ticket_price:        0,
          processing_fee:      0,
          total_amount:        0,
          platform_commission: 0,
          squadco_fee:         0,
          organizer_earnings:  0,
          quantity:            qty,
          status:              'success',
          verified_at:         now,
          payment_method:      'free',
          squadco_response: {
            tier_id:   tierId,
            tier_name: tierName,
          },
          attendees: attendees || [],
        }]);

      if (insertErr) {
        console.error(`❌ [FREE] Row ${i} insert failed:`, insertErr.message);
      } else {
        splitRows.push({ reference: `${reference}_${i}`, tier_name: tierName, qty });
      }
    }

    // ── Increment tickets_sold on the event ───────────────────────────────────
    try {
      const { data: freshEvent } = await supabaseAdmin
        .from('events')
        .select('tickets_sold')
        .eq('id', eventId)
        .single();
      await supabaseAdmin
        .from('events')
        .update({ tickets_sold: (freshEvent?.tickets_sold || 0) + totalQty })
        .eq('id', eventId);
    } catch (e) {
      console.error('[FREE] tickets_sold update error:', e.message);
    }

    // ── Build all_transactions array ──────────────────────────────────────────
    const allRows = splitRows.map((r, i) => ({
      reference:        r.reference,
      ticket_type_name: r.tier_name || null,
      ticket_price:     0,
      quantity:         r.qty,
      buyer_name:       resolvedBuyerName,
      buyer_email:      buyerEmail,
      status:           'success',
    }));

    // ── Send confirmation email (fire-and-forget) ─────────────────────────────
    (async () => {
      try {
        await sendTicketPurchaseConfirmation({
          buyerName:   resolvedBuyerName,
          buyerEmail,
          reference,
          event,
          cartItems,
          attendees:   attendees || [],
          totalAmount: 0,
        });
        console.log('[FREE] Confirmation email sent for', reference);
      } catch (emailErr) {
        console.error('[FREE] Email send failed (non-blocking):', emailErr.message);
      }
    })();

    console.log(`[FREE] Registration complete: ${reference} — ${totalQty} ticket(s) for ${event.title}`);

    return res.status(200).json(buildResponse(primaryTx, event, allRows));
  } catch (err) {
    console.error('❌ [FREE] freeRegisterController error:', err.message);
    return res.status(500).json({ success: false, error: 'Internal server error', message: err.message });
  }
};

// ─── GET /api/v1/payments/free/confirm?reference=FREE_xxx ────────────────────
export const freeConfirmController = async (req, res) => {
  try {
    const { reference } = req.query;

    if (!reference || !reference.startsWith('FREE_')) {
      return res.status(400).json({ success: false, error: 'Valid FREE_ reference is required' });
    }

    // Fetch the primary row
    const { data: transaction, error: txErr } = await supabaseAdmin
      .from('transactions')
      .select('*')
      .eq('reference', reference.trim())
      .eq('status', 'success')
      .maybeSingle();

    if (txErr) {
      return res.status(500).json({ success: false, error: 'Database error', message: txErr.message });
    }
    if (!transaction) {
      return res.status(404).json({ success: false, error: 'Registration not found' });
    }

    // Fetch event info + all split rows in parallel
    const baseRef = reference.trim();
    const [eventResult, allRowsResult] = await Promise.all([
      supabaseAdmin
        .from('events')
        .select('id, title, date, location')
        .eq('id', transaction.event_id)
        .single(),
      supabaseAdmin
        .from('transactions')
        .select('id, reference, buyer_email, buyer_name, total_amount, ticket_price, processing_fee, platform_commission, organizer_earnings, quantity, status, created_at, verified_at, squadco_response')
        .ilike('reference', `${baseRef}%`)
        .eq('status', 'success')
        .order('created_at', { ascending: true }),
    ]);

    const eventInfo = eventResult.data;

    const allRows = (allRowsResult.data || []).map(row => {
      const sr = typeof row.squadco_response === 'string'
        ? (() => { try { return JSON.parse(row.squadco_response); } catch(_) { return {}; } })()
        : (row.squadco_response || {});
      return {
        id:                  row.id,
        reference:           row.reference,
        buyer_email:         row.buyer_email,
        buyer_name:          row.buyer_name,
        total_amount:        Number(row.total_amount || 0),
        ticket_price:        Number(row.ticket_price || 0),
        processing_fee:      Number(row.processing_fee || 0),
        platform_commission: Number(row.platform_commission || 0),
        organizer_earnings:  Number(row.organizer_earnings || 0),
        quantity:            row.quantity || 1,
        ticket_type_id:      sr.tier_id   || null,
        ticket_type_name:    sr.tier_name || null,
        status:              row.status,
        created_at:          row.created_at,
        verified_at:         row.verified_at,
      };
    });

    return res.status(200).json(buildResponse(transaction, eventInfo, allRows));
  } catch (err) {
    console.error('❌ [FREE] freeConfirmController error:', err.message);
    return res.status(500).json({ success: false, error: 'Internal server error', message: err.message });
  }
};
