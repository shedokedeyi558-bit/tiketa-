import { supabase } from '../utils/supabaseClient.js';
import {
  validateTicket,
  markTicketAsUsed,
  getTicketDetails,
} from '../services/ticketService.js';
import { logAudit } from '../services/auditService.js';

/**
 * Validate ticket at event
 * Admin/Organizer only
 */
export const validateTicketAtEvent = async (req, res) => {
  try {
    const { ticketNumber } = req.body;
    const userId = req.user?.id;

    if (!ticketNumber) {
      return res.status(400).json({ error: 'Ticket number required' });
    }

    // Validate ticket
    const validation = await validateTicket(supabase, ticketNumber);

    if (!validation.valid) {
      await logAudit({
        action: 'TICKET_VALIDATION_FAILED',
        entity_type: 'ticket',
        entity_id: ticketNumber,
        user_id: userId,
        changes: { error: validation.error },
      });

      return res.status(400).json({
        success: false,
        error: validation.error,
      });
    }

    // Mark ticket as used
    const result = await markTicketAsUsed(supabase, ticketNumber);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error,
      });
    }

    // Log audit
    await logAudit({
      action: 'TICKET_VALIDATED',
      entity_type: 'ticket',
      entity_id: ticketNumber,
      user_id: userId,
      changes: { status: 'used' },
    });

    res.json({
      success: true,
      message: 'Ticket validated successfully',
      ticket: result.ticket,
    });
  } catch (error) {
    console.error('Ticket validation error:', error);
    res.status(500).json({ error: 'Ticket validation failed' });
  }
};

/**
 * Get ticket details
 * Public endpoint - no auth required
 */
export const getTicket = async (req, res) => {
  try {
    const { ticketNumber } = req.params;

    if (!ticketNumber) {
      return res.status(400).json({ error: 'Ticket number required' });
    }

    const details = await getTicketDetails(supabase, ticketNumber);

    if (!details.success) {
      return res.status(404).json({
        success: false,
        error: details.error,
      });
    }

    res.json({
      success: true,
      ticket: details.ticket,
    });
  } catch (error) {
    console.error('Get ticket error:', error);
    res.status(500).json({ error: 'Failed to get ticket' });
  }
};

/**
 * Get event tickets
 * Organizer/Admin only
 */
export const getEventTickets = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user?.id;
    const { limit = 50, offset = 0 } = req.query;

    if (!eventId) {
      return res.status(400).json({ error: 'Event ID required' });
    }

    // Verify organizer owns event
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('organizer_id')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Check authorization
    const { data: user } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (event.organizer_id !== userId && user?.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Fetch tickets
    const { data: tickets, error, count } = await supabase
      .from('tickets')
      .select('*', { count: 'exact' })
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch tickets' });
    }

    res.json({
      success: true,
      tickets,
      total: count,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Get event tickets error:', error);
    res.status(500).json({ error: 'Failed to get event tickets' });
  }
};

/**
 * Get ticket statistics for event
 */
export const getTicketStats = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user?.id;

    if (!eventId) {
      return res.status(400).json({ error: 'Event ID required' });
    }

    // Verify organizer owns event
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('organizer_id, total_tickets, tickets_sold')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Check authorization
    const { data: user } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (event.organizer_id !== userId && user?.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Get ticket stats
    const { data: tickets } = await supabase
      .from('tickets')
      .select('status')
      .eq('event_id', eventId);

    const stats = {
      total_tickets: event.total_tickets,
      tickets_sold: event.tickets_sold,
      tickets_available: event.total_tickets - event.tickets_sold,
      tickets_used: tickets?.filter(t => t.status === 'used').length || 0,
      tickets_valid: tickets?.filter(t => t.status === 'valid').length || 0,
      tickets_cancelled: tickets?.filter(t => t.status === 'cancelled').length || 0,
    };

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('Get ticket stats error:', error);
    res.status(500).json({ error: 'Failed to get ticket statistics' });
  }
};
