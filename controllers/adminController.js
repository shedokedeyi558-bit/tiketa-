import { supabase } from '../utils/supabaseClient.js';

// Get all events (admin view with stats)
export const getAdminEvents = async (req, res) => {
  try {
    console.log('📅 Fetching all events for admin...');

    // Fetch all events
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .order('date', { ascending: false });

    if (eventsError) {
      console.error('❌ Failed to fetch events:', eventsError);
      throw eventsError;
    }

    // Get unique organizer IDs
    const organizerIds = [...new Set((events || []).map(e => e.organizer_id).filter(Boolean))];

    // Batch fetch organizer names
    let organizerMap = {};
    if (organizerIds.length > 0) {
      const { data: organizers, error: orgError } = await supabase
        .from('users')
        .select('id, full_name, email')
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

    // Enrich events with organizer names and revenue
    const enriched = (events || []).map((event) => {
      const organizer = organizerMap[event.organizer_id];
      const eventTx = txMap[event.id] || { revenue: 0, organizer_earnings: 0 };
      const now = new Date();
      const eventDate = new Date(event.date);

      // Determine status badge
      let statusBadge = 'Active';
      if (event.status === 'cancelled') {
        statusBadge = 'Cancelled';
      } else if (event.status === 'completed') {
        statusBadge = 'Completed';
      } else if (eventDate < now && event.status === 'active') {
        statusBadge = 'Ended';
      }

      return {
        id: event.id,
        title: event.title,
        organizer_id: event.organizer_id,
        organizer_name: organizer?.full_name || 'Unknown',
        organizer_email: organizer?.email || '',
        date: event.date,
        location: event.location,
        status: event.status,
        status_badge: statusBadge,
        tickets_sold: event.tickets_sold || 0,
        total_tickets: event.total_tickets || 0,
        revenue: eventTx.revenue,
        organizer_earnings: eventTx.organizer_earnings,
        category: event.category,
        image_url: event.image_url,
      };
    });

    console.log(`✅ Fetched ${enriched.length} events with enriched data`);

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
    const { title, description, date, time, location, image, ticketTypes } = req.body;

    // Validate required fields
    if (!title || !date || !location || !ticketTypes) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: title, date, location, ticketTypes',
      });
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
          created_by: req.user.id,
          created_at: new Date().toISOString(),
        },
      ])
      .select();

    if (error) throw error;

    res.status(201).json({
      success: true,
      message: 'Event created successfully',
      data: data[0],
    });
  } catch (error) {
    console.error('Error creating event:', error);
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

    // Query 1: Total events
    console.log('⏳ Querying total events...');
    const eventsResult = await supabase.from('events').select('id', { count: 'exact', head: true });
    console.log('✅ Events query result:', { count: eventsResult.count, error: eventsResult.error });
    if (eventsResult.error) {
      console.error('❌ Events query error:', eventsResult.error);
      throw new Error(`Events query failed: ${eventsResult.error.message}`);
    }

    // Query 2: Total users
    console.log('⏳ Querying total users...');
    const usersResult = await supabase.from('users').select('id', { count: 'exact', head: true });
    console.log('✅ Users query result:', { count: usersResult.count, error: usersResult.error });
    if (usersResult.error) {
      console.error('❌ Users query error:', usersResult.error);
      throw new Error(`Users query failed: ${usersResult.error.message}`);
    }

    // Query 3: All transactions (for revenue, orders, commission)
    console.log('⏳ Querying all transactions...');
    const transactionsResult = await supabase.from('transactions').select('total_amount, platform_commission, status');
    console.log('✅ Transactions query result:', { rows: transactionsResult.data?.length, error: transactionsResult.error });
    if (transactionsResult.error) {
      console.error('❌ Transactions query error:', transactionsResult.error);
      throw new Error(`Transactions query failed: ${transactionsResult.error.message}`);
    }

    // Query 4: Active events (future dates)
    console.log('⏳ Querying active events (date > now)...');
    const now = new Date().toISOString();
    console.log('   Current timestamp:', now);
    const activeEventsResult = await supabase
      .from('events')
      .select('id', { count: 'exact', head: true })
      .gt('date', now);
    console.log('✅ Active events query result:', { count: activeEventsResult.count, error: activeEventsResult.error });
    if (activeEventsResult.error) {
      console.error('❌ Active events query error:', activeEventsResult.error);
      throw new Error(`Active events query failed: ${activeEventsResult.error.message}`);
    }

    // Query 5: Organizers count
    console.log('⏳ Querying organizers (role = organizer)...');
    const organizersResult = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'organizer');
    console.log('✅ Organizers query result:', { count: organizersResult.count, error: organizersResult.error });
    if (organizersResult.error) {
      console.error('❌ Organizers query error:', organizersResult.error);
      throw new Error(`Organizers query failed: ${organizersResult.error.message}`);
    }

    // Query 6: Pending withdrawal requests
    console.log('⏳ Querying pending withdrawal requests...');
    const pendingWithdrawalsResult = await supabase
      .from('withdrawals')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');
    console.log('✅ Pending withdrawals query result:', { count: pendingWithdrawalsResult.count, error: pendingWithdrawalsResult.error });
    if (pendingWithdrawalsResult.error) {
      console.error('❌ Pending withdrawals query error:', pendingWithdrawalsResult.error);
      throw new Error(`Pending withdrawals query failed: ${pendingWithdrawalsResult.error.message}`);
    }

    // Calculate totals from transactions
    console.log('⏳ Calculating totals from transactions...');
    const successTransactions = transactionsResult.data?.filter(t => t.status === 'success') || [];
    const pendingTransactions = transactionsResult.data?.filter(t => t.status === 'pending') || [];

    const totalRevenue = successTransactions.reduce((sum, t) => sum + Number(t.total_amount || 0), 0);
    const platformCommission = successTransactions.reduce((sum, t) => sum + Number(t.platform_commission || 0), 0);

    console.log('✅ Calculations complete:', {
      successTransactions: successTransactions.length,
      pendingTransactions: pendingTransactions.length,
      totalRevenue,
      platformCommission,
    });

    const stats = {
      totalEvents: eventsResult.count ?? 0,
      totalOrders: transactionsResult.data?.length ?? 0,
      totalRevenue: totalRevenue,
      successfulPayments: successTransactions.length,
      pendingPayments: pendingTransactions.length,
      platformCommission: platformCommission,
      activeEvents: activeEventsResult.count ?? 0,
      organizers: organizersResult.count ?? 0,
      pendingWithdrawals: pendingWithdrawalsResult.count ?? 0,
    };

    console.log('✅ All dashboard stats fetched successfully:', stats);

    return res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('❌ FULL ERROR in getDashboardStats:', error);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard stats',
      message: error.message,
      details: error.stack,
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

    // Fetch all successful transactions
    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('total_amount, platform_commission, organizer_earnings, created_at, event_id')
      .eq('status', 'success')
      .order('created_at', { ascending: true });

    if (txError) {
      console.error('❌ Failed to fetch transactions:', txError);
      throw txError;
    }

    console.log(`✅ Fetched ${transactions?.length || 0} successful transactions`);

    // Calculate summary stats
    const totalRevenue = (transactions || []).reduce((sum, t) => sum + Number(t.total_amount || 0), 0);
    const totalCommission = (transactions || []).reduce((sum, t) => sum + Number(t.platform_commission || 0), 0);
    const totalOrganizerEarnings = (transactions || []).reduce((sum, t) => sum + Number(t.organizer_earnings || 0), 0);
    const totalTransactions = transactions?.length || 0;

    console.log('✅ Summary stats calculated:', {
      totalRevenue,
      totalCommission,
      totalOrganizerEarnings,
      totalTransactions,
    });

    // Group by month for chart data
    const monthlyData = {};
    (transactions || []).forEach(t => {
      const d = new Date(t.created_at);
      // Use UTC to avoid timezone issues
      const month = d.toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
      if (!monthlyData[month]) {
        monthlyData[month] = { revenue: 0, commission: 0, organizer_earnings: 0, count: 0 };
      }
      monthlyData[month].revenue += Number(t.total_amount || 0);
      monthlyData[month].commission += Number(t.platform_commission || 0);
      monthlyData[month].organizer_earnings += Number(t.organizer_earnings || 0);
      monthlyData[month].count += 1;
    });

    const monthlyChartData = Object.entries(monthlyData).map(([month, d]) => ({ month, ...d }));
    console.log(`✅ Monthly data grouped into ${monthlyChartData.length} months`);
    console.log('📊 Monthly breakdown:', monthlyChartData.map(m => ({ month: m.month, revenue: m.revenue, commission: m.commission })));

    // Revenue by event
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
        return {
          event: eventMap[id] || 'Unknown Event',
          revenue: eventTxns.reduce((sum, t) => sum + Number(t.total_amount || 0), 0),
          commission: eventTxns.reduce((sum, t) => sum + Number(t.platform_commission || 0), 0),
          count: eventTxns.length,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);

    console.log(`✅ Revenue by event calculated for ${revenueByEvent.length} events`);

    return res.status(200).json({
      success: true,
      data: {
        summary: {
          totalRevenue,
          totalCommission,
          totalOrganizerEarnings,
          totalTransactions,
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
