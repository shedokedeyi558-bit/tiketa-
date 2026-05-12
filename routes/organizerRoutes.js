import express from 'express';
import { verifyToken } from '../middlewares/authMiddleware.js';
import { deleteEventIfNoSales } from '../services/eventExpiryService.js';

const router = express.Router();

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
 * GET /api/v1/organizer/transactions
 * Returns all successful transactions for the logged-in organizer's events
 */
router.get('/transactions', verifyToken, async (req, res) => {
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

    // Fetch transactions directly by organizer_id
    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('id, buyer_name, buyer_email, ticket_price, processing_fee, total_amount, organizer_earnings, created_at, event_id, organizer_id')
      .eq('organizer_id', organizerId)
      .eq('status', 'success')
      .order('created_at', { ascending: false });

    if (txError) {
      console.error('❌ Error fetching transactions:', txError);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch transactions',
        message: txError.message
      });
    }

    // Then fetch event titles separately
    const eventIds = [...new Set((transactions || []).map(t => t.event_id).filter(Boolean))];
    let eventMap = {};

    if (eventIds.length > 0) {
      const { data: events } = await supabase
        .from('events')
        .select('id, title')
        .in('id', eventIds);

      eventMap = Object.fromEntries((events || []).map(e => [e.id, e.title]));
    }

    // Enrich transactions with event titles
    const enrichedTransactions = (transactions || []).map(t => ({
      id: t.id,
      buyer_name: t.buyer_name,
      buyer_email: t.buyer_email,
      ticket_price: Number(t.ticket_price || 0),
      processing_fee: Number(t.processing_fee || 0),
      total_amount: Number(t.total_amount || 0),
      organizer_earnings: Number(t.organizer_earnings || 0),
      event_title: eventMap[t.event_id] || 'Unknown Event',
      created_at: t.created_at
    }));

    return res.status(200).json({
      success: true,
      data: enrichedTransactions
    });
  } catch (err) {
    console.error('❌ Transactions error:', err);
    return res.status(500).json({
      success: false,
      error: 'Server error',
      message: 'Internal server error'
    });
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
      const { data: transactions } = await supabase
        .from('transactions')
        .select('event_id, organizer_earnings')
        .in('event_id', eventIds)
        .eq('status', 'success');

      if (transactions) {
        transactionMap = transactions.reduce((acc, t) => {
          if (!acc[t.event_id]) {
            acc[t.event_id] = { count: 0, revenue: 0 };
          }
          acc[t.event_id].count += 1;
          acc[t.event_id].revenue += Number(t.organizer_earnings || 0);
          return acc;
        }, {});
      }
    }

    // Enrich events with transaction data
    const enrichedEvents = (events || []).map(e => ({
      id: e.id,
      title: e.title,
      date: e.date,
      start_time: e.start_time,
      end_time: e.end_time,
      total_tickets: Number(e.total_tickets || 0),
      tickets_sold: transactionMap[e.id]?.count || 0,
      total_revenue: Number((transactionMap[e.id]?.revenue || 0).toFixed(2))
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

export default router;