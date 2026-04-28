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
        .from('users')
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
      console.log('⏳ Querying total users from users table...');
      const usersResult = await supabase.from('users').select('id', { count: 'exact', head: true });
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

        stats.totalOrders = transactionsResult.data.length || 0;
        stats.successfulPayments = successTransactions.length || 0;
        stats.pendingPayments = pendingTransactions.length || 0;
        stats.totalRevenue = successTransactions.reduce((sum, t) => sum + Number(t.total_amount || 0), 0) || 0;
        stats.platformCommission = successTransactions.reduce((sum, t) => sum + Number(t.platform_commission || 0), 0) || 0;

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
      console.log('⏳ Querying organizers from users table...');
      const organizersResult = await supabase
        .from('users')
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
      .from('users')
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


// Get revenue analytics
export const getRevenueAnalytics = async (req, res) => {
  try {
    console.log('💰 Fetching revenue analytics...');

    // Fetch all successful transactions with all needed fields
    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('event_id, ticket_price, platform_commission, organizer_earnings, total_amount, processing_fee, created_at')
      .eq('status', 'success')
      .order('created_at', { ascending: true });

    if (txError) {
      console.error('❌ Failed to fetch transactions:', txError);
      throw txError;
    }

    console.log(`✅ Fetched ${transactions?.length || 0} successful transactions`);
    
    // ✅ Log raw transaction data for debugging
    if (transactions && transactions.length > 0) {
      console.log('📊 Sample transaction:', transactions[0]);
      console.log('📊 All transactions:', JSON.stringify(transactions, null, 2));
    } else {
      console.warn('⚠️ No successful transactions found!');
    }

    // ✅ Calculate summary stats - simplified and correct
    const totalRevenue = (transactions || []).reduce((sum, t) => sum + Number(t.total_amount || 0), 0);
    const totalCommission = (transactions || []).reduce((sum, t) => sum + Number(t.platform_commission || 0), 0);
    const totalOrganizerEarnings = (transactions || []).reduce((sum, t) => sum + Number(t.organizer_earnings || 0), 0);
    const totalTransactions = transactions?.length || 0;
    
    // Additional calculations
    const SQUADCO_FEE_PERCENTAGE = 1.2;
    const squadcoFees = totalRevenue * (SQUADCO_FEE_PERCENTAGE / 100);
    const netReceived = totalRevenue - squadcoFees;
    const buyerFeesCollected = (transactions || []).reduce((sum, t) => sum + Number(t.processing_fee || 0), 0);
    const platformNetProfit = totalCommission + buyerFeesCollected - squadcoFees;

    console.log('✅ Summary stats calculated:', {
      totalRevenue,
      totalCommission,
      totalOrganizerEarnings,
      totalTransactions,
      squadcoFees,
      netReceived,
      buyerFeesCollected,
      platformNetProfit,
    });

    // Group by month for chart data
    const monthlyData = {};
    (transactions || []).forEach(t => {
      const d = new Date(t.created_at);
      const month = d.toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
      if (!monthlyData[month]) {
        monthlyData[month] = { 
          revenue: 0, 
          commission: 0, 
          organizerEarnings: 0,
          count: 0 
        };
      }
      monthlyData[month].revenue += Number(t.total_amount || 0);
      monthlyData[month].commission += Number(t.platform_commission || 0);
      monthlyData[month].organizerEarnings += Number(t.organizer_earnings || 0);
      monthlyData[month].count += 1;
    });

    const monthlyChartData = Object.entries(monthlyData).map(([month, d]) => ({ month, ...d }));
    console.log(`✅ Monthly data grouped into ${monthlyChartData.length} months`);

    // Revenue by event with detailed breakdown
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
        const grossRevenue = eventTxns.reduce((sum, t) => sum + Number(t.total_amount || 0), 0);
        const squadcoFees = grossRevenue * (SQUADCO_FEE_PERCENTAGE / 100);
        const netReceived = grossRevenue - squadcoFees;
        const platformCommission = eventTxns.reduce((sum, t) => sum + Number(t.platform_commission || 0), 0);
        const organizerEarnings = eventTxns.reduce((sum, t) => sum + Number(t.organizer_earnings || 0), 0);
        const buyerFees = eventTxns.reduce((sum, t) => sum + Number(t.processing_fee || 0), 0);
        const platformNetProfit = platformCommission + buyerFees - squadcoFees;
        
        return {
          event: eventMap[id] || 'Unknown Event',
          ticketsSold,
          grossRevenue,
          squadcoFees,
          netReceived,
          platformCommission,
          organizerEarnings,
          platformNetProfit,
        };
      })
      .sort((a, b) => b.grossRevenue - a.grossRevenue);

    console.log(`✅ Revenue by event calculated for ${revenueByEvent.length} events`);
    console.log('📊 Revenue by event data:', JSON.stringify(revenueByEvent, null, 2));

    return res.status(200).json({
      success: true,
      data: {
        summary: {
          totalRevenue,
          totalCommission,
          totalOrganizerEarnings,
          totalTransactions,
          grossRevenue: totalRevenue,
          squadcoFees,
          netReceived,
          buyerFeesCollected,
          platformNetProfit,
        },
        monthlyData: monthlyChartData,
        revenueByEvent,
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
