import { supabase } from '../utils/supabaseClient.js';

// Get organizer's upcoming events
export const getOrganizerEvents = async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString();
    console.log('Getting events for organizer:', userId);

    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('organizer_id', userId)
      .eq('status', 'active')
      .gte('date', today)
      .order('date', { ascending: true });

    if (error) {
      console.error('Events fetch error:', error);
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }

    console.log('Events found:', data?.length ?? 0);

    // 🔑 CRITICAL: Calculate tickets remaining for each event with proper logic
    const eventsWithTickets = (data ?? []).map(event => {
      const totalTickets = event.total_tickets;
      const ticketsSold = event.tickets_sold || 0;

      let displayTotalTickets;
      let displayTicketsRemaining;

      if (!totalTickets || totalTickets === 0) {
        displayTotalTickets = 'Unlimited';
        displayTicketsRemaining = 'Unlimited';
      } else {
        displayTotalTickets = totalTickets;
        displayTicketsRemaining = Math.max(0, totalTickets - ticketsSold);
      }

      return {
        ...event,
        total_tickets: displayTotalTickets,
        tickets_remaining: displayTicketsRemaining,
      };
    });

    return res.json({
      success: true,
      message: 'Events fetched successfully',
      data: eventsWithTickets,
    });
  } catch (err) {
    console.error('getOrganizerEvents error:', err);
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

// Get all events
export const getAllEvents = async (req, res) => {
  try {
    console.log('📖 Fetching all public events');

    // Fetch all active events from database
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('status', 'active')
      .order('date', { ascending: true });

    if (error) {
      console.error('❌ Error fetching events:', error);
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }

    console.log('✅ Events found:', data?.length ?? 0);

    // 🔑 CRITICAL: Calculate tickets remaining for each event with proper logic
    const eventsWithTickets = (data ?? []).map(event => {
      const totalTickets = event.total_tickets;
      const ticketsSold = event.tickets_sold || 0;

      let displayTotalTickets;
      let displayTicketsRemaining;

      if (!totalTickets || totalTickets === 0) {
        displayTotalTickets = 'Unlimited';
        displayTicketsRemaining = 'Unlimited';
      } else {
        displayTotalTickets = totalTickets;
        displayTicketsRemaining = Math.max(0, totalTickets - ticketsSold);
      }

      return {
        ...event,
        total_tickets: displayTotalTickets,
        tickets_remaining: displayTicketsRemaining,
      };
    });

    return res.status(200).json({
      success: true,
      message: 'Events fetched successfully',
      data: eventsWithTickets,
    });
  } catch (error) {
    console.error('❌ Get All Events Error:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get event by ID
export const getEventById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Event ID is required',
      });
    }

    console.log('📖 Fetching event details for ID:', id);

    // Fetch event from database
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .single();

    if (eventError) {
      console.error('❌ Error fetching event:', eventError);
      return res.status(404).json({
        success: false,
        error: 'Event not found',
        message: eventError.message,
      });
    }

    console.log('✅ Event found:', event.title);

    // 🔑 CRITICAL: Calculate tickets remaining with proper logic
    const totalTickets = event.total_tickets;
    const ticketsSold = event.tickets_sold || 0;

    // Determine display values
    let displayTotalTickets;
    let displayTicketsRemaining;

    if (!totalTickets || totalTickets === 0) {
      // If total_tickets is 0 or null, show "Unlimited"
      displayTotalTickets = 'Unlimited';
      displayTicketsRemaining = 'Unlimited';
      console.log('🎫 Event has unlimited tickets');
    } else {
      // Calculate remaining tickets, never go below 0
      displayTotalTickets = totalTickets;
      displayTicketsRemaining = Math.max(0, totalTickets - ticketsSold);
      console.log('🎫 Ticket calculation:', {
        total: totalTickets,
        sold: ticketsSold,
        remaining: displayTicketsRemaining,
      });
    }

    // Build response with calculated values
    const eventData = {
      id: event.id,
      title: event.title,
      description: event.description,
      date: event.date,
      end_date: event.end_date,
      location: event.location,
      organizer_id: event.organizer_id,
      status: event.status,
      total_tickets: displayTotalTickets,
      tickets_sold: ticketsSold,
      tickets_remaining: displayTicketsRemaining,
      created_at: event.created_at,
      updated_at: event.updated_at,
    };

    console.log('✅ Event details compiled:', {
      title: eventData.title,
      total_tickets: eventData.total_tickets,
      tickets_sold: eventData.tickets_sold,
      tickets_remaining: eventData.tickets_remaining,
    });

    return res.status(200).json({
      success: true,
      message: 'Event fetched successfully',
      data: eventData,
    });
  } catch (error) {
    console.error('❌ Get Event By ID Error:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });

    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Create event
export const createEvent = async (req, res) => {
  try {
    const { title, description, date, location, price } = req.body;
    // TODO: Save to database
    res.status(201).json({
      success: true,
      message: 'Event created successfully',
      data: {},
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update event
export const updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    // TODO: Update in database
    res.status(200).json({
      success: true,
      message: 'Event updated successfully',
      data: {},
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get event performance stats (with debugging)
export const getEventStats = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Event ID is required',
      });
    }

    console.log('📊 Fetching event stats for event_id:', id);

    // Get event details
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .single();

    if (eventError) {
      console.error('❌ Error fetching event:', eventError);
      return res.status(404).json({
        success: false,
        error: 'Event not found',
        message: eventError.message,
      });
    }

    console.log('✅ Event found:', event.title);
    console.log('📋 Event details:', {
      id: event.id,
      title: event.title,
      tickets_sold: event.tickets_sold,
      total_tickets: event.total_tickets,
    });

    // Get all transactions for this event
    console.log('🔍 Querying transactions for event_id:', id);
    const { data: allTransactions, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('event_id', id);

    if (txError) {
      console.error('❌ Error fetching transactions:', txError);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch transactions',
        message: txError.message,
      });
    }

    console.log('📊 All transactions for event:', allTransactions?.length ?? 0);
    if (allTransactions && allTransactions.length > 0) {
      console.log('📋 Transaction details:');
      allTransactions.forEach((tx, idx) => {
        console.log(`  [${idx}] ID: ${tx.id}, Status: ${tx.status}, Amount: ${tx.amount}, Organizer Earnings: ${tx.organizer_earnings}`);
      });
    }

    // Filter successful transactions
    const successfulTransactions = allTransactions?.filter(t => t.status === 'success') ?? [];
    console.log('✅ Successful transactions:', successfulTransactions.length);

    // Calculate stats
    const totalRevenue = successfulTransactions.reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const totalOrganizerEarnings = successfulTransactions.reduce((sum, t) => sum + Number(t.organizer_earnings || 0), 0);
    const totalPlatformCommission = successfulTransactions.reduce((sum, t) => {
      const commission = Number(t.amount || 0) - Number(t.organizer_earnings || 0);
      return sum + commission;
    }, 0);

    console.log('💰 Revenue breakdown:', {
      totalRevenue,
      totalOrganizerEarnings,
      totalPlatformCommission,
    });

    // Get tickets for this event
    const { data: tickets, error: ticketError } = await supabase
      .from('tickets')
      .select('*')
      .eq('event_id', id);

    if (ticketError) {
      console.warn('⚠️ Error fetching tickets:', ticketError);
    } else {
      console.log('🎫 Tickets for event:', tickets?.length ?? 0);
      if (tickets && tickets.length > 0) {
        const totalTicketsQuantity = tickets.reduce((sum, t) => sum + Number(t.quantity || 0), 0);
        console.log('📊 Total ticket quantity:', totalTicketsQuantity);
      }
    }

    const stats = {
      event: {
        id: event.id,
        title: event.title,
        date: event.date,
        location: event.location,
        tickets_sold: event.tickets_sold,
        total_tickets: event.total_tickets,
      },
      transactions: {
        total: allTransactions?.length ?? 0,
        successful: successfulTransactions.length,
        pending: allTransactions?.filter(t => t.status === 'pending').length ?? 0,
        failed: allTransactions?.filter(t => t.status === 'failed').length ?? 0,
      },
      revenue: {
        total: totalRevenue,
        organizer_earnings: totalOrganizerEarnings,
        platform_commission: totalPlatformCommission,
      },
      tickets: {
        count: tickets?.length ?? 0,
        total_quantity: tickets?.reduce((sum, t) => sum + Number(t.quantity || 0), 0) ?? 0,
      },
      debug: {
        event_id_queried: id,
        transactions_raw: allTransactions,
        tickets_raw: tickets,
      },
    };

    console.log('✅ Event stats compiled:', stats);

    return res.status(200).json({
      success: true,
      message: 'Event stats fetched successfully',
      data: stats,
    });
  } catch (error) {
    console.error('❌ Get Event Stats Error:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });

    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Delete event
export const deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id; // Assuming auth middleware sets req.user

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Event ID is required',
      });
    }

    // 🔑 CRITICAL: Check for existing transactions before deleting
    console.log('🔍 Checking for transactions linked to event:', id);
    
    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('id')
      .eq('event_id', id)
      .limit(1);

    if (txError) {
      console.error('❌ Error checking transactions:', txError);
      return res.status(500).json({
        success: false,
        error: 'Failed to check event transactions',
        message: txError.message,
      });
    }

    // 🔑 CRITICAL: If transactions exist, prevent deletion
    if (transactions && transactions.length > 0) {
      console.warn('⚠️ Cannot delete event with existing transactions:', id);
      return res.status(409).json({
        success: false,
        error: 'Cannot delete event with existing ticket purchases',
        message: 'This event has ticket purchases and cannot be deleted. You can archive or cancel the event instead.',
        code: 'EVENT_HAS_TRANSACTIONS',
      });
    }

    console.log('✅ No transactions found, proceeding with deletion');

    // Only delete if no transactions exist
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', id)
      .eq('organizer_id', userId);

    if (error) {
      console.error('❌ Error deleting event:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to delete event',
        message: error.message,
      });
    }

    console.log('✅ Event deleted successfully:', id);
    return res.status(200).json({
      success: true,
      message: 'Event deleted successfully',
    });
  } catch (error) {
    console.error('❌ Delete Event Controller Error:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });

    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
};
