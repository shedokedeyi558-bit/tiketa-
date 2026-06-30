import { supabase } from '../utils/supabaseClient.js';
import { updateExpiredEvents, deleteEventIfNoSales } from '../services/eventExpiryService.js';

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
    
    // ✅ Check for expired events and update them to 'ended' status
    const expiryResult = await updateExpiredEvents();
    console.log('⏰ Expiry check result:', expiryResult);
    
    // ✅ Parse query parameters with defaults
    const status = req.query.status || 'all';
    const dateFilter = req.query.dateFilter || 'all'; // default 'all' — organizer should see ALL their events, not just upcoming
    const sortBy = req.query.sortBy || 'date';
    const sortOrder = req.query.sortOrder === 'desc' ? false : true;

    console.log('📅 Getting events for organizer:', {
      userId,
      status,
      dateFilter,
      sortBy,
      sortOrder: sortOrder ? 'asc' : 'desc',
    });

    // ✅ Build query — narrow select, filter at DB level, limit rows
    let query = supabase
      .from('events')
      .select('id, title, description, image_url, date, start_time, end_time, end_date, location, category, status, organizer_id, ticket_types, total_tickets, tickets_sold, ticket_price, require_attendee_names, created_at, updated_at')
      .eq('organizer_id', userId)
      .limit(100);

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

    // ✅ Calculate tickets_sold dynamically from transactions table
    // This is always accurate regardless of manual counter drift
    const eventIds = (data ?? []).map(e => e.id).filter(Boolean);
    let ticketsSoldByEvent = {};
    if (eventIds.length > 0) {
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseAdmin = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
      const { data: txCounts } = await supabaseAdmin
        .from('transactions')
        .select('event_id, quantity')
        .in('event_id', eventIds)
        .eq('status', 'success');

      for (const tx of (txCounts || [])) {
        ticketsSoldByEvent[tx.event_id] = (ticketsSoldByEvent[tx.event_id] || 0) + (parseInt(tx.quantity) || 1);
      }
    }

    // ✅ Calculate tickets remaining for each event
    const eventsWithTickets = (data ?? []).map(event => {
      const totalTickets = event.total_tickets;
      const ticketsSold = ticketsSoldByEvent[event.id] || 0; // dynamic from transactions

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
        tickets_sold: ticketsSold,          // ✅ dynamic
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

    // ✅ Check for expired events and update them to 'ended' status
    const expiryResult = await updateExpiredEvents();
    console.log('⏰ Expiry check result:', expiryResult);

    // ✅ Parse query parameters - default to upcoming events only
    const dateFilter = req.query.dateFilter || 'upcoming';
    const sortBy = req.query.sortBy || 'date';
    const sortOrder = req.query.sortOrder === 'desc' ? false : true;

    // ✅ Check in-memory cache (30s TTL, keyed by query params)
    const cacheKey = `public_events:${dateFilter}:${sortBy}:${sortOrder}`;
    const CACHE_TTL = 30 * 1000;
    if (!getAllEvents._cache) getAllEvents._cache = new Map();
    const cached = getAllEvents._cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log('⚡ Returning cached public events');
      return res.json(cached.data);
    }

    // ✅ Build query — status = 'active' is the only gate needed.
    // updateExpiredEvents() already set status = 'ended' at the correct end_date + end_time,
    // so no date math is needed here. All active events are visible regardless of start date.
    let query = supabase
      .from('events')
      .select('id, title, description, image_url, date, start_time, end_time, end_date, location, category, status, organizer_id, ticket_types, total_tickets, tickets_sold, ticket_price, require_attendee_names, created_at, updated_at')
      .eq('status', 'active');

    // dateFilter=past is kept for browsability but no longer hides active events prematurely
    if (dateFilter === 'past') {
      const today = new Date().toISOString().split('T')[0];
      query = query.lt('date', today);
    }
    // dateFilter=upcoming and dateFilter=all: show all active events (expiry service is gatekeeper)

    // ✅ Apply sorting and limit
    query = query.order(sortBy, { ascending: sortOrder }).limit(50);

    const { data, error } = await query;

    if (error) {
      console.error('❌ Error fetching events:', error);
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }

    console.log('✅ Events found:', data?.length ?? 0);

    // ✅ Fetch all ticket_types for these events (bulk join)
    const { data: allTicketTypes } = await supabase
      .from('ticket_types')
      .select('id, event_id, name, price, description');

    // ✅ CRITICAL: Calculate tickets remaining for each event with proper logic
    let events = (data ?? []).map(event => {
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

    // ✅ Merge ticket_types from ticket_types table (if exists, use it; otherwise fall back to JSONB column)
    events = events.map(event => {
      const rows = allTicketTypes?.filter(tt => tt.event_id === event.id) || [];
      if (rows.length > 0) {
        event.ticket_types = rows.map(tt => ({
          id: tt.id,
          name: tt.name,
          price: tt.price,
          description: tt.description || '',
          available: event.total_tickets - (event.tickets_sold || 0),
        }));
      }
      return event;
    });

    const eventsWithTickets = events;

    const responseData = {
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
    };

    // ✅ Store in cache
    getAllEvents._cache.set(cacheKey, { data: responseData, timestamp: Date.now() });

    return res.status(200).json(responseData);
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
    // ✅ Explicitly select start_time and end_time from database
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*, start_time, end_time, ticket_types')
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
    }

    // ✅ Use image_url for the event flyer/poster
    const image_url = event.image_url || null;

    // ✅ Fetch ticket_types and calculate per-type available dynamically from transactions
    const { data: ticketTypesRows } = await supabase
      .from('ticket_types')
      .select('id, name, price, description, quantity')
      .eq('event_id', id);

    // Also get sold counts per tier from transactions
    let soldByTier = {};
    if (ticketTypesRows && ticketTypesRows.length > 0) {
      const { data: tierSales } = await supabase
        .from('transactions')
        .select('squadco_response, quantity')
        .eq('event_id', id)
        .eq('status', 'success');

      for (const tx of (tierSales || [])) {
        const sr = typeof tx.squadco_response === 'string'
          ? (() => { try { return JSON.parse(tx.squadco_response); } catch(_) { return {}; } })()
          : (tx.squadco_response || {});
        const tierId = sr.tier_id || null;
        if (tierId) {
          soldByTier[tierId] = (soldByTier[tierId] || 0) + (parseInt(tx.quantity) || 1);
        }
      }
    }

    if (ticketTypesRows && ticketTypesRows.length > 0) {
      event.ticket_types = ticketTypesRows.map(tt => {
        const capacity = parseInt(tt.quantity) || 0;
        const sold     = soldByTier[tt.id] || 0;
        return {
          id: tt.id,
          name: tt.name,
          price: tt.price,
          description: tt.description || '',
          quantity: capacity,                      // total capacity for this type
          available: capacity > 0 ? Math.max(0, capacity - sold) : null, // null = unlimited
        };
      });
    } else if (event.ticket_types && event.ticket_types.length > 0) {
      // JSONB fallback — use per-type quantity if present, else overall remaining
      event.ticket_types = event.ticket_types.map(tt => ({
        ...tt,
        available: tt.quantity > 0
          ? Math.max(0, tt.quantity - (soldByTier[tt.id] || 0))
          : Math.max(0, (event.total_tickets || 0) - (event.tickets_sold || 0)),
      }));
    }

    // ✅ Build comprehensive response for public page
    // ✅ Use start_time and end_time directly from database
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
      start_time: event.start_time || null,  // ✅ From database
      end_time: event.end_time || null,      // ✅ From database
      
      // Location
      location: event.location,
      
      // Ticket Information
      ticket_price: event.ticket_price || 0,
      ticket_types: event.ticket_types || [], // ✅ Array of {name, price} objects
      total_tickets: displayTotalTickets,
      tickets_sold: ticketsSold,
      tickets_remaining: displayTicketsRemaining,
      
      // Organizer Information
      organizer_id: event.organizer_id,
      organizer_name: organizer_name,
      
      // Media
      image_url: image_url,
      
      // Status
      status: event.status,
      require_attendee_names: event.require_attendee_names || false,
      
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
      start_time: eventData.start_time,
      end_time: eventData.end_time,
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
    
    const { title, description, date, end_date, location, total_tickets, category, image_url, image_base64, ticket_types, require_attendee_names } = req.body;

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
      hasImage: !!(image_url || image_base64),
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
        email: req.user?.email || null,
        role: 'organizer',
        full_name: req.user?.name || req.user?.user_metadata?.full_name || '',
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

    // ✅ Handle image upload if provided
    let finalImageUrl = image_url || null;
    
    if (image_base64) {
      console.log('📸 Processing image upload...');
      try {
        const { uploadEventImage } = await import('../services/imageUploadService.js');
        
        // ✅ Convert base64 to buffer
        const base64Data = image_base64.replace(/^data:image\/\w+;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');
        
        // ✅ Generate file name from title
        const fileName = `${title.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.jpg`;
        
        // ✅ Upload to Supabase Storage
        const uploadResult = await uploadEventImage(imageBuffer, fileName, organizerId);
        
        if (uploadResult.success) {
          finalImageUrl = uploadResult.url;
          console.log('✅ Image uploaded successfully:', finalImageUrl);
        } else {
          console.warn('⚠️ Image upload failed:', uploadResult.error);
          // Don't fail event creation if image upload fails
        }
      } catch (imageError) {
        console.error('⚠️ Error processing image:', imageError.message);
        // Don't fail event creation if image processing fails
      }
    }

    // ✅ Create event with validated organizer_id - status set to 'pending' for admin approval
    console.log('📝 Inserting event into database...');

    // ✅ Validate end date/time is after start date/time
    if (start_time && (end_date || end_time)) {
      const startDateTime = new Date(`${date}T${start_time}`);
      const endDateStr = end_date || date;
      const endTimeStr = end_time || '23:59:00';
      const endDateTime = new Date(`${endDateStr}T${endTimeStr}`);

      if (endDateTime <= startDateTime) {
        return res.status(400).json({
          success: false,
          message: 'End date/time must be after start date/time.'
        });
      }
    }
    
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
          total_tickets: total_tickets || 0, // ✅ Save total_tickets as sum from frontend
          tickets_sold: 0,
          status: 'pending', // ✅ Set to pending - requires admin approval
          category: category || 'General',
          image_url: finalImageUrl, // ✅ Use uploaded image URL or provided URL
          ticket_types: ticket_types || [], // ✅ Save ticket_types as-is from frontend (JSONB column - source of truth)
          require_attendee_names: require_attendee_names === true, // ✅ Save attendee names toggle
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
      image_url: event.image_url,
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
        image_url: event.image_url,
      },
    });

    // ✅ Fire-and-forget: notify admin that a new event is pending review
    (async () => {
      try {
        const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_USER || 'support.ticketa@gmail.com';
        const { sendEmail } = await import('../services/emailService.js');
        await sendEmail({
          to: adminEmail,
          subject: `New event pending review — ${event.title}`,
          html: `
            <h2>New Event Submitted for Review</h2>
            <p>An organizer has submitted a new event that needs your approval.</p>
            <table style="border-collapse:collapse;font-size:14px;">
              <tr><td style="padding:6px 12px;font-weight:bold;">Title</td><td style="padding:6px 12px;">${event.title}</td></tr>
              <tr><td style="padding:6px 12px;font-weight:bold;">Date</td><td style="padding:6px 12px;">${event.date ? event.date.split('T')[0] : 'N/A'}</td></tr>
              <tr><td style="padding:6px 12px;font-weight:bold;">Location</td><td style="padding:6px 12px;">${event.location}</td></tr>
              <tr><td style="padding:6px 12px;font-weight:bold;">Organizer ID</td><td style="padding:6px 12px;">${event.organizer_id}</td></tr>
            </table>
            <br/>
            <a href="https://ticketa.org/admin/events" style="background:#6c47ff;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">
              Review in Admin Dashboard →
            </a>
          `,
        });
        console.log('[NEW EVENT] Admin notification sent for event:', event.id);
      } catch (e) {
        console.error('[NEW EVENT] Admin notification failed (non-blocking):', e.message);
      }
    })();
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

// Update event — organizer only, tiered field rules
export const updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const organizerId = req.user?.id;

    if (!organizerId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // ── Fetch the event and verify ownership ──────────────────────────────────
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: event, error: fetchErr } = await supabaseAdmin
      .from('events')
      .select('id, title, organizer_id, status, date, end_date, start_time, end_time, ticket_types, total_tickets')
      .eq('id', id)
      .single();

    if (fetchErr || !event) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }
    if (event.organizer_id !== organizerId) {
      return res.status(403).json({ success: false, error: 'You can only edit your own events' });
    }
    if (event.status === 'ended' || event.status === 'cancelled') {
      return res.status(400).json({ success: false, error: 'Ended or cancelled events cannot be edited' });
    }

    // ── Check if any tickets have been sold ────────────────────────────────────
    const { count: soldCount } = await supabaseAdmin
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', id)
      .eq('status', 'success');

    const hasSales = (soldCount ?? 0) > 0;

    // ── Build the update payload with tiered rules ─────────────────────────────
    const {
      // Always editable
      title, description, image_url, location, category,
      // Editable only before sales
      ticket_types, total_tickets, ticket_price,
      // Date/time — editable but notifies buyers
      date, end_date, start_time, end_time,
    } = req.body;

    const updates = {};

    // Tier 1: always editable
    if (title       !== undefined) updates.title       = title.trim();
    if (description !== undefined) updates.description = description;
    if (image_url   !== undefined) updates.image_url   = image_url;
    if (location    !== undefined) updates.location    = location.trim();
    if (category    !== undefined) updates.category    = category;

    // Tier 2: locked after first sale
    if (hasSales) {
      const lockedFields = ['ticket_types', 'total_tickets', 'ticket_price'].filter(f => req.body[f] !== undefined);
      if (lockedFields.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Cannot change ticket types, capacity or prices after tickets have been sold',
          locked_fields: lockedFields,
        });
      }
    } else {
      if (ticket_types   !== undefined) updates.ticket_types   = ticket_types;
      if (total_tickets  !== undefined) updates.total_tickets  = total_tickets;
      if (ticket_price   !== undefined) updates.ticket_price   = ticket_price;
    }

    // Tier 3: date/time — editable, flag for buyer notification
    const dateChanged = (date && date !== event.date?.split('T')[0]) ||
                        (end_date && end_date !== event.end_date?.split('T')[0]) ||
                        (start_time && start_time !== event.start_time) ||
                        (end_time && end_time !== event.end_time);

    if (date       !== undefined) updates.date       = date;
    if (end_date   !== undefined) updates.end_date   = end_date;
    if (start_time !== undefined) updates.start_time = start_time;
    if (end_time   !== undefined) updates.end_time   = end_time;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, error: 'No valid fields provided to update' });
    }

    updates.updated_at = new Date().toISOString();

    // ── Apply the update ───────────────────────────────────────────────────────
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('events')
      .update(updates)
      .eq('id', id)
      .select('id, title, status, date, end_date, start_time, end_time, location, category, image_url, description, ticket_types, total_tickets, ticket_price, updated_at')
      .single();

    if (updateErr) {
      console.error('❌ Event update failed:', updateErr.message);
      return res.status(500).json({ success: false, error: updateErr.message });
    }

    console.log(`✅ Event ${id} updated by organizer ${organizerId}`);

    // ── Fire-and-forget: notify buyers if date/time changed ───────────────────
    if (dateChanged && hasSales) {
      (async () => {
        try {
          const { data: buyers } = await supabaseAdmin
            .from('transactions')
            .select('buyer_email, buyer_name')
            .eq('event_id', id)
            .eq('status', 'success');

          const uniqueBuyers = [...new Map((buyers || []).map(b => [b.buyer_email, b])).values()];
          const { sendEmail } = await import('../services/emailService.js');

          for (const buyer of uniqueBuyers) {
            await sendEmail({
              to: buyer.buyer_email,
              subject: `Event date update — ${updated.title}`,
              html: `
                <p>Hi ${buyer.buyer_name},</p>
                <p>The organizer of <strong>${updated.title}</strong> has updated the event date or time.</p>
                <p><strong>New date:</strong> ${updated.date ? updated.date.split('T')[0] : ''}</p>
                ${updated.start_time ? `<p><strong>New time:</strong> ${updated.start_time}${updated.end_time ? ' – ' + updated.end_time : ''}</p>` : ''}
                <p><strong>Location:</strong> ${updated.location}</p>
                <p>If this no longer works for you, please contact the event organizer.</p>
                <p>— Ticketa</p>
              `,
            }).catch(e => console.warn('[EVENT UPDATE] Email to buyer failed (non-blocking):', e.message));
          }
          console.log(`[EVENT UPDATE] Date-change emails sent to ${uniqueBuyers.length} buyer(s)`);
        } catch (e) {
          console.error('[EVENT UPDATE] Buyer notification error (non-blocking):', e.message);
        }
      })();
    }

    return res.status(200).json({
      success: true,
      message: 'Event updated successfully',
      data: updated,
      warnings: dateChanged && hasSales
        ? ['Buyers have been notified of the date/time change by email']
        : [],
    });
  } catch (error) {
    console.error('❌ updateEvent error:', error.message);
    return res.status(500).json({ success: false, error: error.message });
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
    const { data: allTransactions, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('event_id', id)
      .eq('status', 'success');

    console.log('📊 Transactions for event: %s', allTransactions?.length ?? 0);
    
    if (txError) {
      console.error('❌ Error fetching transactions:', txError);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch transactions',
        message: txError.message,
      });
    }

    const successfulTransactions = allTransactions ?? [];

    // ✅ Calculate stats with correct business logic
    // Gross Revenue = sum of ticket_price (NOT total_amount which includes ₦100 buyer fee)
    const grossRevenue = successfulTransactions.reduce((sum, t) => sum + Number(t.ticket_price || 0), 0);
    const platformFee = successfulTransactions.reduce((sum, t) => sum + Number(t.platform_commission || 0), 0);
    const netEarnings = grossRevenue - platformFee;
    const storedOrganizerEarnings = successfulTransactions.reduce((sum, t) => sum + Number(t.organizer_earnings || 0), 0);

    // Get tickets for this event
    const { data: tickets, error: ticketError } = await supabase
      .from('tickets')
      .select('*')
      .eq('event_id', id);

    if (ticketError) {
      console.warn('⚠️ Error fetching tickets:', ticketError);
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

/**
 * ✅ DELETE /api/v1/organizer/events/:id
 * Delete event - only owner can delete, only if no tickets sold
 * 
 * Conditions:
 * - User must be the event owner (organizer_id = user.id)
 * - Event must have no ticket sales (tickets_sold = 0)
 * - No transactions must exist for this event
 */
export const deleteOrganizerEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Event ID is required',
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'You must be logged in to delete an event',
      });
    }

    console.log('🗑️ Organizer attempting to delete event:', { eventId: id, userId });

    // ✅ Use the helper function from eventExpiryService
    const result = await deleteEventIfNoSales(id, userId);

    if (!result.success) {
      const statusCode = result.error === 'You can only delete your own events' ? 403 : 400;
      return res.status(statusCode).json({
        success: false,
        error: result.message,
        message: result.error,
      });
    }

    return res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error('❌ Delete Organizer Event Error:', {
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
