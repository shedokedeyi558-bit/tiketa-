import { supabase } from '../utils/supabaseClient.js';

// Get all events (admin view with stats)
export const getAdminEvents = async (req, res) => {
  try {
    console.log('📅 Fetching all events for admin...');

    // ✅ Fetch all events with organizer info using join
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('*, users:organizer_id(full_name, email)')
      .order('date', { ascending: false });

    if (eventsError) {
      console.error('❌ Failed to fetch events:', eventsError);
      throw eventsError;
    }

    console.log(`✅ Fetched ${events?.length || 0} events with organizer info`);

    // ✅ Auto-expire past events - update status in database
    const now = new Date();
    const pastActiveEvents = (events || []).filter(event => {
      const eventDate = new Date(event.date);
      return eventDate < now && event.status === 'active';
    });

    if (pastActiveEvents.length > 0) {
      console.log(`⏰ Found ${pastActiveEvents.length} past active events to expire`);
      
      // Update all past active events to 'ended' status
      const pastEventIds = pastActiveEvents.map(e => e.id);
      const { error: updateError } = await supabase
        .from('events')
        .update({ status: 'ended' })
        .in('id', pastEventIds);

      if (updateError) {
        console.error('⚠️ Failed to update past events:', updateError);
      } else {
        console.log(`✅ Updated ${pastActiveEvents.length} events to 'ended' status`);
        // Update the local events array to reflect the change
        events.forEach(event => {
          if (pastEventIds.includes(event.id)) {
            event.status = 'ended';
          }
        });
      }
    }

    // Fetch all successful transactions for revenue calculation
    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('event_id, total_amount, organizer_earnings')
      .eq('status', 'success');

    if (txError) {
      console.error('⚠️ Failed to fetch transactions:', txError);
    }

    // Build transaction map by event_id
    const txMap = {};
    (transactions || []).forEach(tx => {
      if (!txMap[tx.event_id]) {
        txMap[tx.event_id] = { revenue: 0, organizer_earnings: 0 };
      }
      txMap[tx.event_id].revenue += Number(tx.total_amount || 0);
      txMap[tx.event_id].organizer_earnings += Number(tx.organizer_earnings || 0);
    });

    // Enrich events with revenue data
    const enriched = (events || []).map((event) => {
      const eventTx = txMap[event.id] || { revenue: 0, organizer_earnings: 0 };
      
      return {
        id: event.id,
        title: event.title,
        organizer_id: event.organizer_id,
        organizer_name: event.users?.full_name || 'Unknown',
        organizer_email: event.users?.email || '',
        date: event.date,
        location: event.location,
        status: event.status, // ✅ Now includes auto-expired events
        status_badge: event.status.charAt(0).toUpperCase() + event.status.slice(1), // Capitalize first letter
        tickets_sold: event.tickets_sold || 0,
        total_tickets: event.total_tickets || 0,
        revenue: eventTx.revenue,
        organizer_earnings: eventTx.organizer_earnings,
        category: event.category,
        image_url: event.image_url,
      };
    });

    console.log(`✅ Enriched ${enriched.length} events with revenue data`);

    return res.status(200).json({
      success: true,
      message: 'Events fetched successfully',
      data: enriched,
    });
  } catch (error) {
    console.error('❌ Error fetching events:', error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get pending events (awaiting approval)
export const getPendingEvents = async (req, res) => {
  try {
    console.log('⏳ Fetching pending events...');

    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('*, users:organizer_id(full_name, email)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (eventsError) {
      console.error('❌ Failed to fetch pending events:', eventsError);
      throw eventsError;
    }

    console.log(`✅ Fetched ${events?.length || 0} pending events`);

    const enriched = (events || []).map((event) => ({
      id: event.id,
      title: event.title,
      description: event.description,
      organizer_id: event.organizer_id,
      organizer_name: event.users?.full_name || 'Unknown',
      organizer_email: event.users?.email || '',
      date: event.date,
      end_date: event.end_date,
      location: event.location,
      status: event.status,
      category: event.category,
      image_url: event.image_url,
      total_tickets: event.total_tickets || 0,
      created_at: event.created_at,
    }));

    return res.status(200).json({
      success: true,
      message: 'Pending events fetched successfully',
      data: enriched,
    });
  } catch (error) {
    console.error('❌ Error fetching pending events:', error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Approve event
export const approveEvent = async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`✅ Approving event ${id}...`);

    // Get event details before updating
    const { data: event, error: fetchError } = await supabase
      .from('events')
      .select('*, users:organizer_id(full_name, email)')
      .eq('id', id)
      .single();

    if (fetchError || !event) {
      console.error('❌ Event not found:', fetchError);
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    // Update event status to active
    const { data: updatedEvent, error: updateError } = await supabase
      .from('events')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Failed to approve event:', updateError);
      throw updateError;
    }

    console.log(`✅ Event ${id} approved successfully`);

    // Send email notification to organizer
    try {
      const { sendEventApprovedEmail } = await import('../services/emailService.js');
      await sendEventApprovedEmail(
        event.users?.email || '',
        event.users?.full_name || 'Organizer',
        event.title
      );
      console.log('✅ Approval email sent to organizer');
    } catch (emailError) {
      console.error('⚠️ Failed to send approval email:', emailError);
      // Don't fail the approval if email fails
    }

    return res.status(200).json({
      success: true,
      message: 'Event approved successfully',
      data: updatedEvent,
    });
  } catch (error) {
    console.error('❌ Error approving event:', error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Reject event
export const rejectEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejection_reason } = req.body;

    console.log(`❌ Rejecting event ${id}...`);

    // Get event details before updating
    const { data: event, error: fetchError } = await supabase
      .from('events')
      .select('*, users:organizer_id(full_name, email)')
      .eq('id', id)
      .single();

    if (fetchError || !event) {
      console.error('❌ Event not found:', fetchError);
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    // Update event status to rejected
    const { data: updatedEvent, error: updateError } = await supabase
      .from('events')
      .update({ 
        status: 'rejected',
        rejection_reason: rejection_reason || 'No reason provided',
        updated_at: new Date().toISOString() 
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Failed to reject event:', updateError);
      throw updateError;
    }

    console.log(`✅ Event ${id} rejected successfully`);

    // Send email notification to organizer
    try {
      const { sendEventRejectedEmail } = await import('../services/emailService.js');
      await sendEventRejectedEmail(
        event.users?.email || '',
        event.users?.full_name || 'Organizer',
        event.title,
        rejection_reason || 'No reason provided'
      );
      console.log('✅ Rejection email sent to organizer');
    } catch (emailError) {
      console.error('⚠️ Failed to send rejection email:', emailError);
      // Don't fail the rejection if email fails
    }

    return res.status(200).json({
      success: true,
      message: 'Event rejected successfully',
      data: updatedEvent,
    });
  } catch (error) {
    console.error('❌ Error rejecting event:', error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Create event
export const createAdminEvent = async (req, res) => {
  try {
    const { title, description, date, time, location, image, ticketTypes, organizer_id } = req.body;

    // ✅ Validate required fields
    if (!title || !date || !location || !ticketTypes) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: title, date, location, ticketTypes',
      });
    }

    // ✅ CRITICAL: If organizer_id is provided, validate it exists
    let validatedOrganizerId = null;
    if (organizer_id) {
      console.log('🔍 Validating organizer exists...');
      const { data: organizer, error: orgError } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('id', organizer_id)
        .eq('role', 'organizer')
        .single();

      if (orgError || !organizer) {
        console.error('❌ Organizer not found:', {
          organizer_id,
          error: orgError?.message,
        });
        return res.status(400).json({
          success: false,
          message: 'Organizer not found',
          code: 'ORGANIZER_NOT_FOUND',
        });
      }
      validatedOrganizerId = organizer_id;
      console.log('✅ Organizer validated');
    }

    const { data, error } = await supabase
      .from('events')
      .insert([
        {
          title,
          description,
          date,
          time,
          location,
          image,
          ticket_types: ticketTypes,
          organizer_id: validatedOrganizerId, // ✅ Use validated organizer_id
          created_by: req.user.id,
          created_at: new Date().toISOString(),
        },
      ])
      .select();

    if (error) {
      console.error('❌ Event creation failed:', {
        error: error.message,
        code: error.code,
      });

      // Handle foreign key constraint error
      if (error.code === '23503') {
        return res.status(400).json({
          success: false,
          message: 'Invalid organizer ID',
          code: 'INVALID_ORGANIZER_ID',
        });
      }

      throw error;
    }

    console.log('✅ Event created successfully:', data[0].id);

    res.status(201).json({
      success: true,
      message: 'Event created successfully',
      data: data[0],
    });
  } catch (error) {
    console.error('❌ Error creating event:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update event
export const updateAdminEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, date, time, location, image, ticketTypes } = req.body;

    const { data, error } = await supabase
      .from('events')
      .update({
        title,
        description,
        date,
        time,
        location,
        image,
        ticket_types: ticketTypes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select();

    if (error) throw error;

    if (!data || data.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Event updated successfully',
      data: data[0],
    });
  } catch (error) {
    console.error('Error updating event:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete event
export const deleteAdminEvent = async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.status(200).json({
      success: true,
      message: 'Event deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get all orders
export const getAdminOrders = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        user:user_id(id, email, full_name),
        event:event_id(id, title)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.status(200).json({
      success: true,
      message: 'Orders fetched successfully',
      data: data || [],
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get dashboard stats - Fetch all stats with detailed logging
export const getDashboardStats = async (req, res) => {
  try {
    console.log('📊 Fetching admin dashboard stats...');

    // Default stats - ensure all values are numbers, never null/undefined
    const stats = {
      totalEvents: 0,
      totalOrders: 0,
      totalRevenue: 0,
      successfulPayments: 0,
      pendingPayments: 0,
      platformCommission: 0,
      activeEvents: 0,
      organizers: 0,
      pendingWithdrawals: 0,
    };

    // Query 1: Total events (with error handling)
    try {
      console.log('⏳ Querying total events from events table...');
      const eventsResult = await supabase.from('events').select('id', { count: 'exact', head: true });
      if (eventsResult.error) {
        console.error('❌ Events query error:', {
          message: eventsResult.error.message,
          code: eventsResult.error.code,
          details: eventsResult.error.details,
        });
      } else {
        stats.totalEvents = eventsResult.count ?? 0;
        console.log('✅ Total events:', stats.totalEvents);
      }
    } catch (err) {
      console.error('❌ Events query exception:', {
        message: err.message,
        stack: err.stack,
      });
    }

    // Query 2: Total users (with error handling)
    try {
      console.log('⏳ Querying total users from profiles table...');
      const usersResult = await supabase.from('profiles').select('id', { count: 'exact', head: true });
      if (usersResult.error) {
        console.error('❌ Users query error:', {
          message: usersResult.error.message,
          code: usersResult.error.code,
          details: usersResult.error.details,
        });
      } else {
        console.log('✅ Total users:', usersResult.count ?? 0);
      }
    } catch (err) {
      console.error('❌ Users query exception:', {
        message: err.message,
        stack: err.stack,
      });
    }

    // Query 3: All transactions (with error handling)
    try {
      console.log('⏳ Querying all transactions from transactions table...');
      const transactionsResult = await supabase
        .from('transactions')
        .select('total_amount, platform_commission, status');
      
      if (transactionsResult.error) {
        console.error('❌ Transactions query error:', {
          message: transactionsResult.error.message,
          code: transactionsResult.error.code,
          details: transactionsResult.error.details,
        });
      } else if (transactionsResult.data) {
        console.log('📊 Transactions fetched:', transactionsResult.data.length);
        
        const successTransactions = transactionsResult.data.filter(t => t.status === 'success') || [];
        const pendingTransactions = transactionsResult.data.filter(t => t.status === 'pending') || [];

        stats.totalOrders = Number(transactionsResult.data.length || 0);
        stats.successfulPayments = Number(successTransactions.length || 0);
        stats.pendingPayments = Number(pendingTransactions.length || 0); // ✅ Ensure it's always a number
        stats.totalRevenue = Number(successTransactions.reduce((sum, t) => sum + Number(t.total_amount || 0), 0) || 0);
        stats.platformCommission = Number(successTransactions.reduce((sum, t) => sum + Number(t.platform_commission || 0), 0) || 0);

        console.log('✅ Transactions stats:', {
          total: stats.totalOrders,
          successful: stats.successfulPayments,
          pending: stats.pendingPayments,
          revenue: stats.totalRevenue,
          commission: stats.platformCommission,
        });
      }
    } catch (err) {
      console.error('❌ Transactions query exception:', {
        message: err.message,
        stack: err.stack,
      });
    }

    // Query 4: Active events (with error handling)
    try {
      console.log('⏳ Querying active events from events table...');
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      const activeEventsResult = await supabase
        .from('events')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active')
        .gte('date', today); // ✅ Only count events with future dates
      
      if (activeEventsResult.error) {
        console.error('❌ Active events query error:', {
          message: activeEventsResult.error.message,
          code: activeEventsResult.error.code,
          details: activeEventsResult.error.details,
        });
      } else {
        stats.activeEvents = activeEventsResult.count ?? 0;
        console.log('✅ Active events:', stats.activeEvents);
      }
    } catch (err) {
      console.error('❌ Active events query exception:', {
        message: err.message,
        stack: err.stack,
      });
    }

    // Query 5: Organizers count (with error handling)
    try {
      console.log('⏳ Querying organizers from profiles table...');
      const organizersResult = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'organizer');
      
      if (organizersResult.error) {
        console.error('❌ Organizers query error:', {
          message: organizersResult.error.message,
          code: organizersResult.error.code,
          details: organizersResult.error.details,
        });
      } else {
        stats.organizers = organizersResult.count ?? 0;
        console.log('✅ Organizers:', stats.organizers);
      }
    } catch (err) {
      console.error('❌ Organizers query exception:', {
        message: err.message,
        stack: err.stack,
      });
    }

    // Query 6: Pending withdrawals (with error handling)
    try {
      console.log('⏳ Querying pending withdrawals from withdrawals table...');
      const pendingWithdrawalsResult = await supabase
        .from('withdrawals')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');
      
      if (pendingWithdrawalsResult.error) {
        console.error('❌ Pending withdrawals query error:', {
          message: pendingWithdrawalsResult.error.message,
          code: pendingWithdrawalsResult.error.code,
          details: pendingWithdrawalsResult.error.details,
        });
      } else {
        stats.pendingWithdrawals = pendingWithdrawalsResult.count ?? 0;
        console.log('✅ Pending withdrawals:', stats.pendingWithdrawals);
      }
    } catch (err) {
      console.error('❌ Pending withdrawals query exception:', {
        message: err.message,
        stack: err.stack,
      });
    }

    // ✅ CRITICAL: Ensure all stats are numbers, never null/undefined
    Object.keys(stats).forEach(key => {
      if (stats[key] === null || stats[key] === undefined || isNaN(stats[key])) {
        console.warn(`⚠️ Stat ${key} was ${stats[key]}, setting to 0`);
        stats[key] = 0;
      }
    });

    console.log('✅ Dashboard stats compiled successfully:', stats);

    return res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('❌ FULL ERROR in getDashboardStats:', {
      message: error.message,
      code: error.code,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
    
    // ✅ Even on error, return valid stats with zeros
    return res.status(200).json({
      success: true,
      data: {
        totalEvents: 0,
        totalOrders: 0,
        totalRevenue: 0,
        successfulPayments: 0,
        pendingPayments: 0,
        platformCommission: 0,
        activeEvents: 0,
        organizers: 0,
        pendingWithdrawals: 0,
      },
      error: error.message,
    });
  }
};

// Get all users
export const getAdminUsers = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.status(200).json({
      success: true,
      message: 'Users fetched successfully',
      data: data || [],
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get all organizers with detailed stats - REWRITTEN
export const getAdminOrganizers = async (req, res) => {
  try {
    console.log('👥 [REWRITTEN] Fetching ALL organizers from profiles table...');

    // ✅ STEP 1: Fetch ALL organizers from profiles table where role = 'organizer'
    console.log('🔍 Querying profiles table for all organizers...');
    const { data: organizers, error: orgError } = await supabase
      .from('profiles')
      .select('id, email, role')
      .eq('role', 'organizer');

    if (orgError) {
      console.error('❌ Failed to fetch organizers from profiles:', orgError);
      throw orgError;
    }

    console.log(`✅ Fetched ${organizers?.length || 0} organizers from profiles table`);

    // Return empty array if no organizers (don't filter anyone out)
    if (!organizers || organizers.length === 0) {
      console.log('⚠️ No organizers found in profiles table');
      return res.status(200).json({
        success: true,
        message: 'No organizers found',
        data: [],
      });
    }

    const organizerIds = organizers.map(o => o.id);
    console.log(`📋 Organizer IDs: ${organizerIds.join(', ')}`);

    // ✅ STEP 2: Fetch events for each organizer (count how many events they created)
    console.log('🎪 Fetching events for each organizer...');
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('id, organizer_id, created_at')
      .in('organizer_id', organizerIds);

    if (eventsError) {
      console.warn('⚠️ Failed to fetch events:', eventsError);
    }

    console.log(`✅ Fetched ${events?.length || 0} events`);

    // Build events map: organizer_id -> { count, lastDate }
    const eventsMap = {};
    const eventIds = [];
    (events || []).forEach(event => {
      if (!eventsMap[event.organizer_id]) {
        eventsMap[event.organizer_id] = { count: 0, lastDate: null };
      }
      eventsMap[event.organizer_id].count += 1;
      eventIds.push(event.id);
      
      const eventDate = new Date(event.created_at);
      if (!eventsMap[event.organizer_id].lastDate || eventDate > eventsMap[event.organizer_id].lastDate) {
        eventsMap[event.organizer_id].lastDate = eventDate;
      }
    });

    console.log(`📊 Events map: ${Object.keys(eventsMap).length} organizers have events`);

    // ✅ STEP 3: Fetch transactions where status = 'success' to get:
    // - Total tickets sold (COUNT)
    // - Total earned (SUM of organizer_earnings)
    console.log('📈 Fetching successful transactions...');
    let transactions = [];
    
    const { data: txData, error: txError } = await supabase
      .from('transactions')
      .select('organizer_id, organizer_earnings, status, created_at')
      .eq('status', 'success')
      .in('organizer_id', organizerIds);

    if (txError) {
      console.warn('⚠️ Failed to fetch transactions:', txError);
    } else {
      transactions = txData || [];
      console.log(`✅ Fetched ${transactions.length} successful transactions`);
    }

    // Build transactions map: organizer_id -> { count, earnings }
    const txMap = {};
    (transactions || []).forEach(tx => {
      if (!txMap[tx.organizer_id]) {
        txMap[tx.organizer_id] = { count: 0, earnings: 0 };
      }
      txMap[tx.organizer_id].count += 1;
      txMap[tx.organizer_id].earnings += Number(tx.organizer_earnings || 0);
    });

    console.log(`📊 Transactions map: ${Object.keys(txMap).length} organizers have transactions`);

    // ✅ STEP 4: Fetch wallet balances for each organizer
    console.log('💰 Fetching wallet balances...');
    let wallets = [];
    
    const { data: walletData, error: walletError } = await supabase
      .from('wallets')
      .select('organizer_id, available_balance')
      .in('organizer_id', organizerIds);

    if (walletError) {
      console.warn('⚠️ Failed to fetch wallets:', walletError);
    } else {
      wallets = walletData || [];
      console.log(`✅ Fetched ${wallets.length} wallet records`);
    }

    // Build wallets map: organizer_id -> available_balance
    const walletMap = {};
    (wallets || []).forEach(wallet => {
      walletMap[wallet.organizer_id] = Number(wallet.available_balance || 0);
    });

    console.log(`📊 Wallets map: ${Object.keys(walletMap).length} organizers have wallets`);

    // ✅ STEP 5: Build response - return ALL organizers even if they have zero events or zero sales
    console.log('🔨 Building response with all organizers...');
    
    const result = organizers.map(org => {
      const eventData = eventsMap[org.id] || { count: 0, lastDate: null };
      const txData = txMap[org.id] || { count: 0, earnings: 0 };
      const balance = walletMap[org.id] || 0;

      return {
        id: org.id,
        name: org.email || '',
        email: org.email || '',
        total_events_created: eventData.count,
        total_tickets_sold: txData.count,
        total_earned: Number(txData.earnings || 0),
        available_balance: balance,
        last_event_date: eventData.lastDate ? eventData.lastDate.toISOString() : null,
      };
    });

    console.log(`✅ Built response with ${result.length} organizers`);
    console.log('📊 Sample organizer:', result[0] || 'No organizers');

    // Log summary
    const totalOrganizers = result.length;
    const totalEvents = result.reduce((sum, o) => sum + o.total_events_created, 0);
    const totalTickets = result.reduce((sum, o) => sum + o.total_tickets_sold, 0);
    const totalEarnings = result.reduce((sum, o) => sum + o.total_earned, 0);

    console.log('📊 Summary:');
    console.log(`   Total organizers: ${totalOrganizers}`);
    console.log(`   Total events: ${totalEvents}`);
    console.log(`   Total tickets sold: ${totalTickets}`);
    console.log(`   Total earnings: ₦${totalEarnings.toFixed(2)}`);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('❌ Error fetching organizers:', error);
    console.error('   Error message:', error.message);
    console.error('   Error code:', error.code);
    return res.status(500).json({
      success: false,
      message: error.message,
      error: error.code,
    });
  }
};


// Diagnostic endpoint - check transaction count
export const getTransactionDiagnostics = async (req, res) => {
  try {
    console.log('🔍 TRANSACTION DIAGNOSTICS ENDPOINT');
    
    // Count all transactions by status
    const { data: allTx, error: allError } = await supabase
      .from('transactions')
      .select('status', { count: 'exact' });
    
    const { data: successTx, error: successError } = await supabase
      .from('transactions')
      .select('*', { count: 'exact' })
      .eq('status', 'success');
    
    const { data: pendingTx, error: pendingError } = await supabase
      .from('transactions')
      .select('*', { count: 'exact' })
      .eq('status', 'pending');
    
    const { data: failedTx, error: failedError } = await supabase
      .from('transactions')
      .select('*', { count: 'exact' })
      .eq('status', 'failed');

    return res.status(200).json({
      success: true,
      diagnostics: {
        total_transactions: allTx?.length || 0,
        successful_count: successTx?.length || 0,
        successful_data: successTx || [],
        pending_count: pendingTx?.length || 0,
        failed_count: failedTx?.length || 0,
        errors: {
          all: allError?.message,
          success: successError?.message,
          pending: pendingError?.message,
          failed: failedError?.message,
        }
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Get revenue analytics
export const getRevenueAnalytics = async (req, res) => {
  try {
    console.log('\n\n🔥🔥🔥 REVENUE ANALYTICS ENDPOINT CALLED 🔥🔥🔥');
    console.log('💰 Fetching revenue analytics...');
    console.log('⏰ Timestamp:', new Date().toISOString());

    // Fetch all successful transactions with all needed fields
    console.log('🔍 Querying transactions table with status = "success"...');
    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('event_id, organizer_id, ticket_price, platform_commission, organizer_earnings, total_amount, processing_fee, created_at')
      .eq('status', 'success')
      .order('created_at', { ascending: true });

    if (txError) {
      console.error('❌ QUERY ERROR - Failed to fetch transactions:', txError);
      console.error('   Error Code:', txError.code);
      console.error('   Error Message:', txError.message);
      console.error('   Error Details:', txError.details);
      throw txError;
    }

    console.log(`\n✅ QUERY SUCCESS - Fetched ${transactions?.length || 0} successful transactions`);
    console.log('📊 RAW TRANSACTIONS DATA FROM DATABASE:');
    console.log(JSON.stringify(transactions, null, 2));
    
    if (transactions && transactions.length > 0) {
      console.log('\n📊 FIRST TRANSACTION DETAILS:');
      console.log(JSON.stringify(transactions[0], null, 2));
      
      console.log('\n📊 FIRST 3 TRANSACTIONS:');
      console.log(JSON.stringify(transactions.slice(0, 3), null, 2));
      
      console.log('\n📊 TRANSACTION FIELD TYPES:');
      const firstTx = transactions[0];
      console.log('   ticket_price:', typeof firstTx.ticket_price, '=', firstTx.ticket_price);
      console.log('   processing_fee:', typeof firstTx.processing_fee, '=', firstTx.processing_fee);
      console.log('   total_amount:', typeof firstTx.total_amount, '=', firstTx.total_amount);
      console.log('   platform_commission:', typeof firstTx.platform_commission, '=', firstTx.platform_commission);
      console.log('   organizer_earnings:', typeof firstTx.organizer_earnings, '=', firstTx.organizer_earnings);
    } else {
      console.warn('\n⚠️ NO SUCCESSFUL TRANSACTIONS FOUND!');
      console.warn('⚠️ Database returned empty array');
      console.warn('⚠️ Check if there are any transactions with status = "success" in the database');
    }

    // ✅ Calculate summary stats according to exact business logic
    console.log('\n📊 STARTING CALCULATIONS...');
    const totalTicketRevenue = (transactions || []).reduce((sum, t) => {
      const val = Number(t.ticket_price || 0);
      return sum + val;
    }, 0);
    
    const totalProcessingFees = (transactions || []).reduce((sum, t) => sum + Number(t.processing_fee || 0), 0);
    const totalAmountCollected = (transactions || []).reduce((sum, t) => sum + Number(t.total_amount || 0), 0);
    const totalSquadcoCharges = totalAmountCollected * 0.012; // 1.2% of total_amount
    const totalPlatformCommission = (transactions || []).reduce((sum, t) => sum + Number(t.platform_commission || 0), 0);
    const totalOrganizerEarnings = (transactions || []).reduce((sum, t) => sum + Number(t.organizer_earnings || 0), 0);
    const totalPlatformNetProfit = totalProcessingFees - totalSquadcoCharges + totalPlatformCommission;
    const totalTransactions = transactions?.length || 0;

    console.log('\n✅ CALCULATIONS COMPLETE - Summary stats:');
    console.log({
      totalTicketRevenue: Number(totalTicketRevenue),
      totalProcessingFees: Number(totalProcessingFees),
      totalAmountCollected: Number(totalAmountCollected),
      totalSquadcoCharges: Number(totalSquadcoCharges.toFixed(2)),
      totalPlatformCommission: Number(totalPlatformCommission),
      totalOrganizerEarnings: Number(totalOrganizerEarnings),
      totalPlatformNetProfit: Number(totalPlatformNetProfit.toFixed(2)),
      totalTransactions,
    });

    // Group by month for chart data
    const monthlyData = {};
    (transactions || []).forEach(t => {
      const d = new Date(t.created_at);
      const month = d.toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
      if (!monthlyData[month]) {
        monthlyData[month] = { 
          ticketRevenue: 0,
          processingFees: 0,
          totalAmount: 0,
          squadcoCharges: 0,
          platformCommission: 0, 
          organizerEarnings: 0,
          platformNetProfit: 0,
          count: 0 
        };
      }
      const ticketPrice = Number(t.ticket_price || 0);
      const processingFee = Number(t.processing_fee || 0);
      const totalAmount = Number(t.total_amount || 0);
      const squadcoCharge = totalAmount * 0.012;
      const commission = Number(t.platform_commission || 0);
      
      monthlyData[month].ticketRevenue += ticketPrice;
      monthlyData[month].processingFees += processingFee;
      monthlyData[month].totalAmount += totalAmount;
      monthlyData[month].squadcoCharges += squadcoCharge;
      monthlyData[month].platformCommission += commission;
      monthlyData[month].organizerEarnings += Number(t.organizer_earnings || 0);
      monthlyData[month].platformNetProfit += (processingFee - squadcoCharge + commission);
      monthlyData[month].count += 1;
    });

    const monthlyChartData = Object.entries(monthlyData).map(([month, d]) => ({ month, ...d }));
    console.log(`✅ Monthly data grouped into ${monthlyChartData.length} months`);

    // ✅ Breakdown per event
    const eventIds = [...new Set((transactions || []).map(t => t.event_id).filter(Boolean))];
    console.log(`✅ Found ${eventIds.length} unique events`);

    let eventMap = {};
    if (eventIds.length > 0) {
      const { data: events, error: evError } = await supabase
        .from('events')
        .select('id, title')
        .in('id', eventIds);

      if (evError) {
        console.error('⚠️ Failed to fetch event titles:', evError);
      } else {
        eventMap = (events || []).reduce((acc, e) => {
          acc[e.id] = e.title;
          return acc;
        }, {});
      }
    }

    const revenueByEvent = eventIds
      .map(id => {
        const eventTxns = (transactions || []).filter(t => t.event_id === id);
        const ticketsSold = eventTxns.length;
        const ticketRevenue = eventTxns.reduce((sum, t) => sum + Number(t.ticket_price || 0), 0);
        const processingFees = eventTxns.reduce((sum, t) => sum + Number(t.processing_fee || 0), 0);
        const totalAmount = eventTxns.reduce((sum, t) => sum + Number(t.total_amount || 0), 0);
        const squadcoCharges = totalAmount * 0.012;
        const platformCommission = eventTxns.reduce((sum, t) => sum + Number(t.platform_commission || 0), 0);
        const organizerEarnings = eventTxns.reduce((sum, t) => sum + Number(t.organizer_earnings || 0), 0);
        const platformNetProfit = processingFees - squadcoCharges + platformCommission;
        
        return {
          event: eventMap[id] || 'Unknown Event',
          tickets_sold: ticketsSold,
          ticket_revenue: ticketRevenue,
          processing_fees: processingFees,
          total_amount: totalAmount,
          squadco_charges: squadcoCharges,
          platform_commission: platformCommission,
          organizer_earnings: organizerEarnings,
          platform_net_profit: platformNetProfit,
        };
      })
      .sort((a, b) => b.ticket_revenue - a.ticket_revenue);

    console.log(`✅ Revenue by event calculated for ${revenueByEvent.length} events`);

    // ✅ Breakdown per organizer
    const organizerIds = [...new Set((transactions || []).map(t => t.organizer_id).filter(Boolean))];
    console.log(`✅ Found ${organizerIds.length} unique organizers`);

    let organizerMap = {};
    if (organizerIds.length > 0) {
      const { data: organizers, error: orgError } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', organizerIds);

      if (orgError) {
        console.error('⚠️ Failed to fetch organizer names:', orgError);
      } else {
        organizerMap = (organizers || []).reduce((acc, org) => {
          acc[org.id] = org;
          return acc;
        }, {});
      }
    }

    const revenueByOrganizer = organizerIds
      .map(id => {
        const organizerTxns = (transactions || []).filter(t => t.organizer_id === id);
        const ticketsSold = organizerTxns.length;
        const ticketRevenue = organizerTxns.reduce((sum, t) => sum + Number(t.ticket_price || 0), 0);
        const processingFees = organizerTxns.reduce((sum, t) => sum + Number(t.processing_fee || 0), 0);
        const totalAmount = organizerTxns.reduce((sum, t) => sum + Number(t.total_amount || 0), 0);
        const squadcoCharges = totalAmount * 0.012;
        const platformCommission = organizerTxns.reduce((sum, t) => sum + Number(t.platform_commission || 0), 0);
        const organizerEarnings = organizerTxns.reduce((sum, t) => sum + Number(t.organizer_earnings || 0), 0);
        const platformNetProfit = processingFees - squadcoCharges + platformCommission;
        
        const organizer = organizerMap[id];
        return {
          organizer_id: id,
          organizer_name: organizer?.name || 'Unknown',
          organizer_email: organizer?.email || '',
          tickets_sold: ticketsSold,
          ticket_revenue: ticketRevenue,
          processing_fees: processingFees,
          total_amount: totalAmount,
          squadco_charges: squadcoCharges,
          platform_commission: platformCommission,
          organizer_earnings: organizerEarnings,
          platform_net_profit: platformNetProfit,
        };
      })
      .sort((a, b) => b.ticket_revenue - a.ticket_revenue);

    console.log(`✅ Revenue by organizer calculated for ${revenueByOrganizer.length} organizers`);

    console.log('\n🎯 FINAL RESPONSE DATA:');
    console.log('Summary:', {
      total_ticket_revenue: totalTicketRevenue,
      total_processing_fees: totalProcessingFees,
      total_amount_collected: totalAmountCollected,
      total_squadco_charges: totalSquadcoCharges,
      total_platform_commission: totalPlatformCommission,
      total_organizer_earnings: totalOrganizerEarnings,
      total_platform_net_profit: totalPlatformNetProfit,
      total_transactions: totalTransactions,
    });
    console.log('Monthly Data Count:', monthlyChartData.length);
    console.log('Revenue by Event Count:', revenueByEvent.length);
    console.log('Revenue by Organizer Count:', revenueByOrganizer.length);
    console.log('\n✅ REVENUE ANALYTICS ENDPOINT COMPLETE - Returning data to frontend\n\n');

    return res.status(200).json({
      success: true,
      data: {
        summary: {
          total_ticket_revenue: totalTicketRevenue,
          total_processing_fees: totalProcessingFees,
          total_amount_collected: totalAmountCollected,
          total_squadco_charges: totalSquadcoCharges,
          total_platform_commission: totalPlatformCommission,
          total_organizer_earnings: totalOrganizerEarnings,
          total_platform_net_profit: totalPlatformNetProfit,
          total_transactions: totalTransactions,
        },
        monthlyData: monthlyChartData,
        revenueByEvent,
        revenueByOrganizer,
      },
    });
  } catch (error) {
    console.error('❌ Revenue Analytics Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch revenue analytics',
      message: error.message,
    });
  }
};
