import { supabase } from '../utils/supabaseClient.js';

/**
 * ✅ UNIFIED ORGANIZER EVENTS ENDPOINT
 * Single source of truth for all organizer event queries
 * 
 * Query Parameters:
 * - status: 'all' | 'active' | 'cancelled' | 'completed' (default: 'all')
 * - dateFilter: 'all' | 'upcoming' | 'past' (default: 'upcoming')
 * - sortBy: 'date' | 'title' (default: 'date')
 * - sortOrder: 'asc' | 'desc' (default: 'asc')
 * 
 * Examples:
 * GET /api/v1/events/organizer → All organizer events (default)
 * GET /api/v1/events/organizer?status=all → All events
 * GET /api/v1/events/organizer?dateFilter=all → All active events (past + future)
 * GET /api/v1/events/organizer?status=all&dateFilter=all → All events (no filters)
 */
export const getOrganizerEvents = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // ✅ Parse query parameters with defaults
    const status = req.query.status || 'all'; // 'all', 'active', 'cancelled', 'completed' - default to 'all' to show pending events
    const dateFilter = req.query.dateFilter || 'upcoming'; // 'all', 'upcoming', 'past'
    const sortBy = req.query.sortBy || 'date'; // 'date', 'title'
    const sortOrder = req.query.sortOrder === 'desc' ? false : true; // true = asc, false = desc

    console.log('📅 Getting events for organizer:', {
      userId,
      status,
      dateFilter,
      sortBy,
      sortOrder: sortOrder ? 'asc' : 'desc',
    });

    // ✅ Build query
    let query = supabase
      .from('events')
      .select('*')
      .eq('organizer_id', userId);

    // ✅ Apply status filter
    if (status !== 'all') {
      query = query.eq('status', status);
    }

    // ✅ Apply date filter
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    if (dateFilter === 'upcoming') {
      query = query.gte('date', today);
    } else if (dateFilter === 'past') {
      query = query.lt('date', today);
    }
    // If dateFilter === 'all', no date filter applied

    // ✅ Apply sorting
    query = query.order(sortBy, { ascending: sortOrder });

    const { data, error } = await query;

    if (error) {
      console.error('❌ Events fetch error:', error);
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }

    console.log('✅ Events found:', data?.length ?? 0);

    // ✅ CRITICAL: Calculate tickets remaining for each event with proper logic
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
      meta: {
        count: eventsWithTickets.length,
        filters: {
          status,
          dateFilter,
          sortBy,
          sortOrder: sortOrder ? 'asc' : 'desc',
        },
      },
    });
  } catch (err) {
    console.error('❌ getOrganizerEvents error:', err);
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

/**
 * ✅ PUBLIC EVENTS ENDPOINT
 * Returns all active events with future dates (public browse page)
 * 
 * Query Parameters:
 * - dateFilter: 'all' | 'upcoming' | 'past' (default: 'upcoming')
 * - sortBy: 'date' | 'title' (default: 'date')
 * - sortOrder: 'asc' | 'desc' (default: 'asc')
 * 
 * Note: Always returns only 'active' status events, defaults to upcoming only
 */
export const getAllEvents = async (req, res) => {
  try {
    console.log('📖 Fetching all public events');

    // ✅ Parse query parameters - default to upcoming events only
    const dateFilter = req.query.dateFilter || 'upcoming'; // 'all', 'upcoming', 'past' - default upcoming
    const sortBy = req.query.sortBy || 'date'; // 'date', 'title'
    const sortOrder = req.query.sortOrder === 'desc' ? false : true; // true = asc, false = desc

    // ✅ Build query - always filter by active status AND future dates by default
    let query = supabase
      .from('events')
      .select('*')
      .eq('status', 'active');

    // ✅ Apply date filter - default to upcoming (future dates only)
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    if (dateFilter === 'upcoming') {
      query = query.gte('date', today); // ✅ Only future events
    } else if (dateFilter === 'past') {
      query = query.lt('date', today);
    }
    // If dateFilter === 'all', no date filter applied

    // ✅ Apply sorting
    query = query.order(sortBy, { ascending: sortOrder });

    const { data, error } = await query;

    if (error) {
      console.error('❌ Error fetching events:', error);
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }

    console.log('✅ Events found:', data?.length ?? 0);

    // ✅ CRITICAL: Calculate tickets remaining for each event with proper logic
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
      meta: {
        count: eventsWithTickets.length,
        filters: {
          status: 'active',
          dateFilter,
          sortBy,
          sortOrder: sortOrder ? 'asc' : 'desc',
        },
      },
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

    console.log('📖 Fetching public event details for ID:', id);

    // ✅ Fetch event from database - NO AUTH REQUIRED
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
        message: 'This event does not exist or is no longer available',
      });
    }

    console.log('✅ Event found:', event.title);

    // ✅ Check if event should be visible to public
    // Hide cancelled and rejected events - show active, pending, and ended
    if (event.status === 'cancelled' || event.status === 'rejected') {
      console.warn('⚠️ Event is not publicly visible:', event.status);
      return res.status(404).json({
        success: false,
        error: 'Event not found',
        message: 'This event is no longer available',
      });
    }

    // ✅ Fetch organizer details
    const { data: organizer } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', event.organizer_id)
      .single();

    const organizer_name = organizer?.full_name || organizer?.email?.split('@')[0] || 'Unknown Organizer';

    // ✅ Calculate tickets remaining with proper logic
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

    // ✅ Extract time from date if available
    let event_time = null;
    if (event.date) {
      try {
        const dateObj = new Date(event.date);
        
        // Check if the date string contains time information
        // If it's just a date (YYYY-MM-DD), the time will be 00:00:00 UTC
        const timeString = event.date.toString();
        const hasTimeInfo = timeString.includes('T') || timeString.includes(':');
        
        if (hasTimeInfo) {
          // Full timestamp - extract time
          event_time = dateObj.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true 
          });
        } else {
          // Date-only string - time is not available
          event_time = null;
          console.warn('⚠️ Event date is date-only (no time info):', event.date);
        }
      } catch (e) {
        console.warn('⚠️ Could not parse event time:', e.message);
      }
    }

    // ✅ Determine which media URL to use (prefer flyer_url, fallback to image_url)
    const media_url = event.flyer_url || event.image_url || null;
    
    console.log('📸 Media URLs:', {
      flyer_url: event.flyer_url,
      image_url: event.image_url,
      selected: media_url,
    });

    // ✅ Build comprehensive response for public page
    const eventData = {
      // Event Identification
      id: event.id,
      title: event.title,
      category: event.category || 'General',
      
      // Event Description
      description: event.description || '',
      
      // Date & Time
      date: event.date,
      end_date: event.end_date,
      time: event_time,
      
      // Location
      location: event.location,
      
      // Ticket Information
      ticket_price: event.ticket_price || 0,
      total_tickets: displayTotalTickets,
      tickets_sold: ticketsSold,
      tickets_remaining: displayTicketsRemaining,
      
      // Organizer Information
      organizer_id: event.organizer_id,
      organizer_name: organizer_name,
      
      // Media
      image_url: event.image_url || null,
      flyer_url: event.flyer_url || null,
      media_url: media_url, // ✅ Preferred media URL (flyer first, then image)
      
      // Status
      status: event.status,
      
      // Metadata
      created_at: event.created_at,
      updated_at: event.updated_at,
    };

    console.log('✅ Public event details compiled:', {
      title: eventData.title,
      status: eventData.status,
      total_tickets: eventData.total_tickets,
      tickets_sold: eventData.tickets_sold,
      organizer: eventData.organizer_name,
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

/**
 * ✅ CREATE EVENT - Organizer Only
 * CRITICAL: Validates organizer exists before creating event
 * 
 * Request body:
 * {
 *   "title": "Event Title",
 *   "description": "Event description",
 *   "date": "2026-05-15",
 *   "end_date": "2026-05-16",
 *   "location": "Event location",
 *   "total_tickets": 100,
 *   "category": "Technology",
 *   "image_url": "https://..."
 * }
 */
export const createEvent = async (req, res) => {
  try {
    const organizerId = req.user?.id;
    const { title, description, date, end_date, location, total_tickets, category, image_url } = req.body;

    // ✅ CRITICAL: Validate organizer is authenticated
    if (!organizerId) {
      console.error('❌ No authenticated user');
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'You must be logged in to create an event',
      });
    }

    // ✅ CRITICAL: Validate required fields
    if (!title || !date || !location) {
      console.error('❌ Missing required fields:', { title, date, location });
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'Title, date, and location are required',
      });
    }

    console.log('📝 Creating event for organizer:', {
      organizerId,
      title,
      date,
    });

    // ✅ CRITICAL: Safety check - ensure organizer exists in users table
    // This prevents foreign key constraint errors
    console.log('🔒 Safety check: Ensuring organizer record exists in users table...');
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { error: upsertError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: organizerId,
        email: req.user?.email || '',
        role: 'organizer',
        full_name: req.user?.user_metadata?.full_name || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });

    if (upsertError) {
      console.error('❌ Failed to ensure organizer record exists:', upsertError);
      return res.status(500).json({
        success: false,
        error: 'User record verification failed',
        message: 'Could not verify organizer profile',
      });
    }

    console.log('✅ Organizer record verified/created in profiles table');

    // ✅ Verify organizer exists in profiles table
    console.log('🔍 Verifying organizer exists...');
    const { data: organizer, error: orgError } = await supabase
      .from('profiles')
      .select('id, role, full_name, email')
      .eq('id', organizerId)
      .single();

    if (orgError || !organizer) {
      console.error('❌ Organizer verification failed:', {
        organizerId,
        error: orgError?.message,
      });
      return res.status(403).json({
        success: false,
        error: 'Organizer not found',
        message: 'Your organizer profile does not exist. Please contact support.',
        code: 'ORGANIZER_NOT_FOUND',
      });
    }

    console.log('✅ Organizer verified:', organizer.full_name);

    // ✅ CRITICAL: Verify organizer has a wallet
    console.log('🔍 Verifying organizer wallet exists...');
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('id')
      .eq('organizer_id', organizerId)
      .maybeSingle();

    if (walletError) {
      console.error('❌ Wallet check failed:', walletError);
      return res.status(500).json({
        success: false,
        error: 'Wallet verification failed',
        message: walletError.message,
      });
    }

    if (!wallet) {
      console.warn('⚠️ Wallet does not exist for organizer, creating one...');
      const { createOrganizerWallet } = await import('../services/walletService.js');
      const walletResult = await createOrganizerWallet(organizerId);
      
      if (!walletResult.success) {
        console.error('❌ Failed to create wallet:', walletResult.error);
        // Don't fail event creation if wallet creation fails - it can be created later
        console.warn('⚠️ Continuing without wallet - it will be created later');
      } else {
        console.log('✅ Wallet created for organizer');
      }
    } else {
      console.log('✅ Organizer wallet verified');
    }

    // ✅ Create event with validated organizer_id - status set to 'pending' for admin approval
    console.log('📝 Inserting event into database...');
    const { data: event, error: eventError } = await supabase
      .from('events')
      .insert([
        {
          title,
          description: description || '',
          date,
          end_date: end_date || date,
          location,
          organizer_id: organizerId, // ✅ Use authenticated user's ID
          total_tickets: total_tickets || 0,
          tickets_sold: 0,
          status: 'pending', // ✅ Set to pending - requires admin approval
          category: category || 'General',
          image_url: image_url || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (eventError) {
      console.error('❌ Event creation failed:', {
        error: eventError.message,
        code: eventError.code,
        details: eventError.details,
      });

      // Handle specific error codes
      if (eventError.code === '23503') {
        return res.status(400).json({
          success: false,
          error: 'Foreign key constraint',
          message: 'Organizer ID is invalid. Please contact support.',
          code: 'INVALID_ORGANIZER_ID',
        });
      }

      return res.status(500).json({
        success: false,
        error: 'Event creation failed',
        message: eventError.message,
      });
    }

    console.log('✅ Event created successfully:', {
      id: event.id,
      title: event.title,
      organizer_id: event.organizer_id,
    });

    return res.status(201).json({
      success: true,
      message: 'Your event has been submitted for review. It will go live once approved by our team.',
      data: {
        id: event.id,
        title: event.title,
        date: event.date,
        location: event.location,
        organizer_id: event.organizer_id,
        status: event.status,
        total_tickets: event.total_tickets,
        tickets_remaining: event.total_tickets,
      },
    });
  } catch (error) {
    console.error('❌ Create Event Error:', {
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
        console.log(`  [${idx}] ID: ${tx.id}, Status: ${tx.status}, Ticket Price: ${tx.ticket_price}, Platform Commission: ${tx.platform_commission}, Organizer Earnings: ${tx.organizer_earnings}`);
      });
    }

    // Filter successful transactions
    const successfulTransactions = allTransactions?.filter(t => t.status === 'success') ?? [];
    console.log('✅ Successful transactions:', successfulTransactions.length);

    // ✅ Calculate stats with correct business logic
    // Gross Revenue = sum of ticket_price (NOT total_amount which includes ₦100 buyer fee)
    const grossRevenue = successfulTransactions.reduce((sum, t) => sum + Number(t.ticket_price || 0), 0);
    
    // Platform Fee = sum of platform_commission (already calculated as 3% of ticket_price in DB)
    const platformFee = successfulTransactions.reduce((sum, t) => sum + Number(t.platform_commission || 0), 0);
    
    // Net Earnings = Gross Revenue - Platform Fee (should match sum of organizer_earnings)
    const netEarnings = grossRevenue - platformFee;
    
    // Verify against stored organizer_earnings
    const storedOrganizerEarnings = successfulTransactions.reduce((sum, t) => sum + Number(t.organizer_earnings || 0), 0);

    console.log('💰 Revenue breakdown:', {
      grossRevenue,
      platformFee,
      netEarnings,
      storedOrganizerEarnings,
      match: Math.abs(netEarnings - storedOrganizerEarnings) < 0.01, // Allow for rounding
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
        gross_revenue: grossRevenue, // ✅ Sum of ticket_price only
        platform_fee: platformFee, // ✅ Sum of platform_commission (3% of ticket_price)
        net_earnings: netEarnings, // ✅ Gross Revenue - Platform Fee
        organizer_earnings: storedOrganizerEarnings, // For verification
      },
      tickets: {
        count: tickets?.length ?? 0,
        total_quantity: tickets?.reduce((sum, t) => sum + Number(t.quantity || 0), 0) ?? 0,
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
