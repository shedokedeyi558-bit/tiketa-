import { supabase } from '../utils/supabaseClient.js';
import { createClient } from '@supabase/supabase-js';
import { updateExpiredEvents } from '../services/eventExpiryService.js';

// ✅ Create admin client with service role key for admin operations
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Get all events (admin view with stats)
export const getAdminEvents = async (req, res) => {
  try {
    console.log('📅 Fetching all events for admin...');

    // ✅ Check for expired events and update them to 'ended' status
    const expiryResult = await updateExpiredEvents();
    console.log('⏰ Expiry check result:', expiryResult);

    // ✅ Fetch all events — narrow select, limit rows
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('id, title, organizer_id, date, location, status, category, image_url, total_tickets, tickets_sold, created_at')
      .order('date', { ascending: false })
      .limit(100);

    if (eventsError) {
      console.error('❌ Failed to fetch events:', eventsError);
      throw eventsError;
    }

    console.log(`✅ Fetched ${events?.length || 0} events`);

    // ✅ Manual organizer lookup - fetch organizer info for all events
    const organizerIds = [...new Set((events || []).map(e => e.organizer_id).filter(Boolean))];
    let organizerMap = {};
    if (organizerIds.length > 0) {
      const { data: organizers } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', organizerIds);
      (organizers || []).forEach(o => {
        organizerMap[o.id] = o;
      });
    }
    console.log(`✅ Fetched organizer info for ${Object.keys(organizerMap).length} organizers`);

    // ✅ Auto-expire past events — only mark ended when end_date+end_time has fully passed.
    // Use end_date (not start date) so multi-day events are not prematurely ended.
    // Delegate to updateExpiredEvents (which already handles WAT→UTC conversion correctly).
    // The call at the top of this function already ran it — no need to duplicate the logic here.

    // Fetch all successful transactions for revenue calculation
    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('event_id, ticket_price, total_amount, organizer_earnings')
      .eq('status', 'success');

    if (txError) {
      console.error('⚠️ Failed to fetch transactions:', txError);
    }

    // Build transaction map by event_id
    const txMap = {};
    (transactions || []).forEach(tx => {
      if (!txMap[tx.event_id]) {
        txMap[tx.event_id] = { revenue: 0, organizer_earnings: 0, tickets_sold: 0 };
      }
      txMap[tx.event_id].revenue += Number(tx.total_amount || 0);
      txMap[tx.event_id].organizer_earnings += Number(tx.organizer_earnings || 0);
      txMap[tx.event_id].tickets_sold += 1;
    });

    // Enrich events with revenue data
    const enriched = (events || []).map((event) => {
      const eventTx = txMap[event.id] || { revenue: 0, organizer_earnings: 0 };
      
      return {
        id: event.id,
        title: event.title,
        organizer_id: event.organizer_id,
        organizer_name: organizerMap[event.organizer_id]?.full_name || organizerMap[event.organizer_id]?.email?.split('@')[0] || 'Unknown',
        organizer_email: organizerMap[event.organizer_id]?.email || '',
        date: event.date,
        location: event.location,
        status: event.status, // ✅ Now includes auto-expired events
        status_badge: event.status.charAt(0).toUpperCase() + event.status.slice(1), // Capitalize first letter
        tickets_sold: txMap[event.id]?.tickets_sold || 0,
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
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (eventsError) {
      console.error('❌ Failed to fetch pending events:', eventsError);
      throw eventsError;
    }

    console.log(`✅ Fetched ${events?.length || 0} pending events`);

    // ✅ Manual organizer lookup for pending events
    const pendingOrgIds = [...new Set((events || []).map(e => e.organizer_id).filter(Boolean))];
    let pendingOrgMap = {};
    if (pendingOrgIds.length > 0) {
      const { data: orgs } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', pendingOrgIds);
      (orgs || []).forEach(o => {
        pendingOrgMap[o.id] = o;
      });
    }

    const enriched = (events || []).map((event) => ({
      id: event.id,
      title: event.title,
      description: event.description,
      organizer_id: event.organizer_id,
      organizer_name: pendingOrgMap[event.organizer_id]?.full_name || pendingOrgMap[event.organizer_id]?.email?.split('@')[0] || 'Unknown',
      organizer_email: pendingOrgMap[event.organizer_id]?.email || '',
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
  // ✅ 10-second timeout — return 504 rather than hanging indefinitely
  const timeoutId = setTimeout(() => {
    if (!res.headersSent) {
      console.error('❌ approveEvent timed out after 10s');
      res.status(504).json({ success: false, message: 'Request timed out' });
    }
  }, 10000);

  try {
    const { id } = req.params;

    console.log(`✅ Approving event ${id}...`);

    // ✅ Fetch only needed fields — no select('*')
    const { data: event, error: fetchError } = await supabase
      .from('events')
      .select('id, title, organizer_id')
      .eq('id', id)
      .single();

    if (fetchError || !event) {
      clearTimeout(timeoutId);
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    // ✅ DB update — this is the only thing that must complete before responding
    const { data: updatedEvent, error: updateError } = await supabase
      .from('events')
      .update({ status: 'active' })
      .eq('id', id)
      .select('id, title, status')
      .single();

    if (updateError) {
      clearTimeout(timeoutId);
      console.error('❌ Failed to approve event:', updateError);
      return res.status(500).json({ success: false, message: updateError.message });
    }

    console.log(`✅ Event ${id} approved successfully`);

    // ✅ Clear public events cache
    try {
      const { getAllEvents } = await import('./eventController.js');
      if (getAllEvents._cache) getAllEvents._cache.clear();
    } catch (_) {}

    // ✅ Respond immediately — don't wait for email
    clearTimeout(timeoutId);
    res.status(200).json({
      success: true,
      message: 'Event approved successfully',
      data: updatedEvent,
    });

    // ✅ Fire-and-forget: fetch organizer email and send notification AFTER response
    (async () => {
      try {
        let orgEmail = '';
        let orgName = 'Organizer';

        // Try profiles first (fast)
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('full_name, email')
          .eq('id', event.organizer_id)
          .single();

        if (profile?.email) {
          orgEmail = profile.email;
          orgName = profile.full_name || 'Organizer';
        } else {
          // Fallback to auth.users only if profiles has no email
          const { data: { user: authUser } } = await supabaseAdmin.auth.admin.getUserById(event.organizer_id);
          orgEmail = authUser?.email || '';
        }

        if (orgEmail) {
          const { sendEventApprovedEmail } = await import('../services/emailService.js');
          await sendEventApprovedEmail(orgEmail, orgName, event.title);
          console.log('✅ Approval email sent to organizer (background)');
        }
      } catch (bgErr) {
        console.error('⚠️ Background approval email failed (non-blocking):', bgErr.message);
      }
    })();

  } catch (error) {
    clearTimeout(timeoutId);
    console.error('❌ Error approving event:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
};

// Reject event
export const rejectEvent = async (req, res) => {
  // ✅ 10-second timeout
  const timeoutId = setTimeout(() => {
    if (!res.headersSent) {
      console.error('❌ rejectEvent timed out after 10s');
      res.status(504).json({ success: false, message: 'Request timed out' });
    }
  }, 10000);

  try {
    const { id } = req.params;
    const rejection_reason = req.body.rejection_reason || req.body.reason;

    console.log(`❌ Rejecting event ${id}...`);

    // ✅ Fetch only needed fields
    const { data: event, error: fetchError } = await supabase
      .from('events')
      .select('id, title, organizer_id')
      .eq('id', id)
      .single();

    if (fetchError || !event) {
      clearTimeout(timeoutId);
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    // ✅ DB update first
    const { data: updatedEvent, error: updateError } = await supabase
      .from('events')
      .update({
        status: 'rejected',
        rejection_reason: rejection_reason || 'No reason provided'
      })
      .eq('id', id)
      .select('id, title, status, rejection_reason')
      .single();

    if (updateError) {
      clearTimeout(timeoutId);
      console.error('❌ Failed to reject event:', updateError);
      return res.status(500).json({ success: false, message: updateError.message });
    }

    console.log(`✅ Event ${id} rejected successfully`);

    // ✅ Respond immediately
    clearTimeout(timeoutId);
    res.status(200).json({
      success: true,
      message: 'Event rejected successfully',
      data: updatedEvent,
    });

    // ✅ Fire-and-forget: send rejection email in background
    (async () => {
      try {
        let orgEmail = '';
        let orgName = 'Organizer';

        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('full_name, email')
          .eq('id', event.organizer_id)
          .single();

        if (profile?.email) {
          orgEmail = profile.email;
          orgName = profile.full_name || 'Organizer';
        } else {
          const { data: { user: authUser } } = await supabaseAdmin.auth.admin.getUserById(event.organizer_id);
          orgEmail = authUser?.email || '';
        }

        if (orgEmail) {
          const { sendEventRejectedEmail } = await import('../services/emailService.js');
          await sendEventRejectedEmail(orgEmail, orgName, event.title, rejection_reason || 'No reason provided');
          console.log('✅ Rejection email sent to organizer (background)');
        }
      } catch (bgErr) {
        console.error('⚠️ Background rejection email failed (non-blocking):', bgErr.message);
      }
    })();

  } catch (error) {
    clearTimeout(timeoutId);
    console.error('❌ Error rejecting event:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: error.message });
    }
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

/**
 * ✅ GET /api/v1/admin/sales-feed
 * Returns all transactions with calculated platform profit per transaction
 * 
 * Formula per transaction:
 * - processing_fee = ₦100 flat (ticket ≤ ₦5,000) OR 1.5% of ticket_price (ticket > ₦5,000)
 * - squadco_fee = total_amount × 1.2%
 * - platform_commission = ticket_price × 3%
 * - organizer_earnings = ticket_price × 97%
 * - platform_net = platform_commission + (processing_fee - squadco_fee)
 */
export const getSalesFeed = async (req, res) => {
  try {
    console.log('📊 Fetching sales feed with transaction details...');

    // Fetch all successful transactions
    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('status', 'success')
      .order('created_at', { ascending: false });

    if (txError) {
      console.error('❌ Error fetching transactions:', txError);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch transactions',
        error: txError.message,
      });
    }

    console.log(`✅ Found ${transactions?.length || 0} successful transactions`);

    // Get unique event IDs and organizer IDs
    const eventIds = [...new Set(transactions.map(t => t.event_id).filter(Boolean))];
    const organizerIds = [...new Set(transactions.map(t => t.organizer_id).filter(Boolean))];

    // Fetch event titles
    const { data: events } = await supabase
      .from('events')
      .select('id, title')
      .in('id', eventIds);

    // Fetch organizer names
    const { data: organizers } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', organizerIds);

    // Build lookup maps
    const eventMap = Object.fromEntries((events || []).map(e => [e.id, e.title]));
    const organizerMap = Object.fromEntries((organizers || []).map(o => [o.id, o.full_name]));

    // Enrich transactions with event title and organizer name
    const enrichedTransactions = transactions.map(t => ({
      ...t,
      event_title: eventMap[t.event_id] || 'Unknown Event',
      organizer_name: organizerMap[t.organizer_id] || 'Unknown Organizer',
    }));

    // Calculate platform profit for each transaction
    const transactionsWithProfit = enrichedTransactions.map(t => {
      const totalAmount = Number(t.total_amount || 0);
      const processingFee = Number(t.processing_fee || 0);
      const platformCommission = Number(t.platform_commission || 0);
      const squadcoFee = Number(t.squadco_fee || 0);

      return {
        id: t.id,
        reference: t.reference,
        event_id: t.event_id,
        event_title: t.event_title,
        organizer_id: t.organizer_id,
        organizer_name: t.organizer_name,
        buyer_name: t.buyer_name,
        buyer_email: t.buyer_email,
        ticket_price: Number(t.ticket_price || 0),
        processing_fee: processingFee,
        total_amount: totalAmount,
        platform_commission: platformCommission,
        squadco_fee: squadcoFee,
        organizer_earnings: Number(t.organizer_earnings || 0),
        status: t.status,
        created_at: t.created_at,
      };
    });

    // Calculate summary statistics
    const totalRevenue = transactionsWithProfit.reduce((sum, t) => sum + t.total_amount, 0);
    const totalProcessingFees = transactionsWithProfit.reduce((sum, t) => sum + t.processing_fee, 0);
    const totalPlatformCommission = transactionsWithProfit.reduce((sum, t) => sum + t.platform_commission, 0);
    const totalSquadcoFees = transactionsWithProfit.reduce((sum, t) => sum + t.squadco_fee, 0);
    const totalOrganizerEarnings = transactionsWithProfit.reduce((sum, t) => sum + t.organizer_earnings, 0);

    console.log('✅ Sales feed calculated:', {
      transactionCount: transactionsWithProfit.length,
      totalRevenue: Number(totalRevenue.toFixed(2)),
      totalProcessingFees: Number(totalProcessingFees.toFixed(2)),
      totalPlatformCommission: Number(totalPlatformCommission.toFixed(2)),
      totalSquadcoFees: Number(totalSquadcoFees.toFixed(2)),
    });

    return res.status(200).json({
      success: true,
      message: 'Sales feed fetched successfully',
      data: transactionsWithProfit,
      summary: {
        total_transactions: transactionsWithProfit.length,
        total_revenue: Number(totalRevenue.toFixed(2)),
        total_processing_fees: Number(totalProcessingFees.toFixed(2)),
        total_platform_commission: Number(totalPlatformCommission.toFixed(2)),
        total_squadco_fees: Number(totalSquadcoFees.toFixed(2)),
        total_organizer_earnings: Number(totalOrganizerEarnings.toFixed(2)),
      },
    });
  } catch (error) {
    console.error('❌ Sales feed error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

// Get dashboard stats - Fetch all stats with detailed logging
export const getDashboardStats = async (req, res) => {
  try {
    // ✅ Prevent caching of dashboard stats
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    console.log('📊 Fetching admin dashboard stats...');

    // Default stats - ensure all values are numbers, never null/undefined
    const stats = {
      activeEventsCount: 0,
      ticketsSold: 0,
      ticketsSoldSubtitle: 'All time',
      totalRevenue: 0,
      totalRevenueSubtitle: 'All time',
      platformNetProfit: 0,
      platformNetProfitSubtitle: 'All time',
      successfulPayments: 0,
      pendingPayments: 0,
      platformCommission: 0,
      totalProcessingFees: 0,
      squadcoCharges: 0,
      organizerEarnings: 0,
      organizers: 0,
      pendingWithdrawals: 0,
      pendingEventApprovals: 0,
      monthlyEarnings: 0,
      recentTransactions: [],
    };

    // ✅ Run all independent count queries in parallel
    console.log('⏳ Running parallel stat queries...');
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

    const [
      eventsResult,
      organizersResult,
      pendingEventsResult,
      pendingWithdrawalsResult,
      transactionsResult,
      monthlyTxResult,
    ] = await Promise.all([
      supabase.from('events').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'organizer'),
      supabase.from('events').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('withdrawals').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase
        .from('transactions')
        .select('id, ticket_price, total_amount, processing_fee, platform_commission, squadco_fee, organizer_earnings, buyer_name, event_id, status, created_at')
        .order('created_at', { ascending: false })
        .limit(500),
      supabase
        .from('transactions')
        .select('platform_commission')
        .eq('status', 'success')
        .gte('created_at', monthStart)
        .lt('created_at', monthEnd),
    ]);

    console.log('✅ Parallel queries complete');

    // Query 1: Active events
    if (eventsResult.error) {
      console.error('❌ Active events query error:', eventsResult.error.message);
    } else {
      stats.activeEventsCount = eventsResult.count ?? 0;
      console.log('✅ Active events:', stats.activeEventsCount);
    }

    // Query 2: Organizers count
    if (organizersResult.error) {
      console.error('❌ Organizers query error:', organizersResult.error.message);
    } else {
      stats.organizers = organizersResult.count ?? 0;
      console.log('✅ Organizers:', stats.organizers);
    }

    // Query 3: Pending event approvals
    if (pendingEventsResult.error) {
      console.error('❌ Pending events query error:', pendingEventsResult.error.message);
    } else {
      stats.pendingEventApprovals = pendingEventsResult.count ?? 0;
      console.log('✅ Pending event approvals:', stats.pendingEventApprovals);
    }

    // Query 4: Pending withdrawals
    if (pendingWithdrawalsResult.error) {
      console.error('❌ Pending withdrawals query error:', pendingWithdrawalsResult.error.message);
    } else {
      stats.pendingWithdrawals = pendingWithdrawalsResult.count ?? 0;
      console.log('✅ Pending withdrawals:', stats.pendingWithdrawals);
    }

    // Query 5: Transactions aggregation
    if (transactionsResult.error) {
      console.error('❌ Transactions query error:', transactionsResult.error.message);
    } else if (transactionsResult.data && transactionsResult.data.length > 0) {
      console.log('📊 Transactions fetched:', transactionsResult.data.length);

      const successTransactions = transactionsResult.data.filter(t => t.status === 'success') || [];
      const pendingTransactions = transactionsResult.data.filter(t => t.status === 'pending') || [];

      stats.ticketsSold = Number(successTransactions.length || 0);
      stats.successfulPayments = Number(successTransactions.length || 0);
      stats.pendingPayments = Number(pendingTransactions.length || 0);
      stats.totalRevenue = Number(successTransactions.reduce((sum, t) => sum + Number(t.total_amount || 0), 0) || 0);
      stats.platformCommission = Number(successTransactions.reduce((sum, t) => sum + Number(t.platform_commission || 0), 0) || 0);
      stats.totalProcessingFees = Number(successTransactions.reduce((sum, t) => sum + Number(t.processing_fee || 0), 0) || 0);
      stats.squadcoCharges = Number(successTransactions.reduce((sum, t) => sum + Number(t.squadco_fee || 0), 0) || 0);
      stats.organizerEarnings = Number(successTransactions.reduce((sum, t) => sum + Number(t.organizer_earnings || 0), 0) || 0);
      stats.platformNetProfit = Number(stats.platformCommission.toFixed(2));

      // Build recent transactions with event names
      const recentSuccessTransactions = successTransactions.slice(0, 5);
      const eventIds = [...new Set(recentSuccessTransactions.map(t => t.event_id).filter(Boolean))];
      let eventMap = {};
      if (eventIds.length > 0) {
        try {
          const eventsResult2 = await supabase.from('events').select('id, title').in('id', eventIds);
          if (eventsResult2.data) {
            eventMap = Object.fromEntries(eventsResult2.data.map(e => [e.id, e.title]));
          }
        } catch (eventErr) {
          console.error('⚠️ Error fetching event names:', eventErr.message);
        }
      }

      stats.recentTransactions = recentSuccessTransactions.map(t => {
        const displayName = t.buyer_name || t.buyer_email || 'Unknown';
        return {
          id: t.id,
          buyer_name: displayName,
          event_title: eventMap[t.event_id] || 'Unknown Event',
          event_id: t.event_id,
          ticket_price: Number(t.ticket_price || 0),
          processing_fee: Number(t.processing_fee || 0),
          platform_commission: Number(t.platform_commission || 0),
          squadco_fee: Number(t.squadco_fee || 0),
          organizer_earnings: Number(t.organizer_earnings || 0),
          amount: Number(t.total_amount || 0),
          created_at: t.created_at,
        };
      });

      console.log('✅ Transactions stats compiled:', {
        successful: stats.successfulPayments,
        pending: stats.pendingPayments,
        revenue: stats.totalRevenue,
        platformNetProfit: stats.platformNetProfit,
      });
    }

    // Query 6: Monthly earnings
    if (monthlyTxResult.error) {
      console.error('❌ Monthly earnings query error:', monthlyTxResult.error.message);
    } else {
      stats.monthlyEarnings = Number(
        (monthlyTxResult.data || []).reduce((sum, t) => sum + Number(t.platform_commission || 0), 0).toFixed(2)
      );
      console.log('✅ Monthly earnings:', stats.monthlyEarnings);
    }

    // ✅ CRITICAL: Ensure all stats are numbers, never null/undefined (except arrays)
    Object.keys(stats).forEach(key => {
      // Skip array fields like recentTransactions
      if (Array.isArray(stats[key])) {
        return;
      }
      
      if (stats[key] === null || stats[key] === undefined || isNaN(stats[key])) {
        console.warn(`⚠️ Stat ${key} was ${stats[key]}, setting to 0`);
        stats[key] = 0;
      }
    });

    console.log('✅ Dashboard stats compiled successfully:', stats);

    // ✅ Log pending actions specifically for debugging
    console.log('🔔 PENDING ACTIONS DEBUG:', {
      pendingWithdrawals: stats.pendingWithdrawals,
      pendingEventApprovals: stats.pendingEventApprovals,
    });

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
        activeEventsCount: 0,
        ticketsSold: 0,
        ticketsSoldSubtitle: 'All time',
        totalRevenue: 0,
        totalRevenueSubtitle: 'All time',
        platformNetProfit: 0,
        platformNetProfitSubtitle: 'All time',
        successfulPayments: 0,
        pendingPayments: 0,
        platformCommission: 0,
        totalProcessingFees: 0,
        squadcoCharges: 0,
        organizerEarnings: 0,
        organizers: 0,
        pendingWithdrawals: 0,
        pendingEventApprovals: 0,
        monthlyEarnings: 0,
        recentTransactions: [],
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
    const { data: organizers, error: orgError } = await supabase
      .from('profiles')
      .select('id, email, full_name, role')
      .eq('role', 'organizer');

    if (orgError) throw orgError;

    const result = await Promise.all(
      (organizers || []).map(async (org) => {
        const { count: eventCount } = await supabase
          .from('events')
          .select('id', { count: 'exact', head: true })
          .eq('organizer_id', org.id);

        const { count: ticketCount } = await supabase
          .from('transactions')
          .select('id', { count: 'exact', head: true })
          .eq('organizer_id', org.id)
          .eq('status', 'success');

        const { data: txData } = await supabase
          .from('transactions')
          .select('organizer_earnings')
          .eq('organizer_id', org.id)
          .eq('status', 'success');

        const { data: walletRows } = await supabase
          .from('wallets')
          .select('available_balance, pending_balance, total_earned')
          .eq('organizer_id', org.id);

        const wallet = walletRows?.[0] || null;

        const { data: lastEventRows } = await supabase
          .from('events')
          .select('created_at, title')
          .eq('organizer_id', org.id)
          .order('created_at', { ascending: false })
          .limit(1);

        const lastEvent = lastEventRows?.[0] || null;

        const totalEarned = (txData || []).reduce(
          (sum, t) => sum + Number(t.organizer_earnings || 0),
          0
        );

        return {
          id: org.id,
          full_name: org.full_name || org.email.split('@')[0],
          email: org.email,
          event_count: eventCount || 0,
          tickets_sold: ticketCount || 0,
          total_earned: totalEarned,
          available_balance: wallet?.available_balance || 0,
          last_event: lastEvent?.created_at || null,
          last_event_title: lastEvent?.title || null,
        };
      })
    );

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('getAdminOrganizers error:', error);
    return res.status(500).json({ success: false, message: error.message });
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
      .select('event_id, organizer_id, ticket_price, platform_commission, organizer_earnings, total_amount, processing_fee, squadco_fee, created_at')
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
    console.log('RAW REVENUE DATA:', JSON.stringify(transactions, null, 2));
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
      const val = Number(t.total_amount || 0);
      return sum + val;
    }, 0);
    
    const totalProcessingFees = (transactions || []).reduce((sum, t) => sum + Number(t.processing_fee || 0), 0);
    const totalAmountCollected = (transactions || []).reduce((sum, t) => sum + Number(t.total_amount || 0), 0);
    const totalSquadcoCharges = Number((transactions || []).reduce((sum, t) => sum + Number(t.squadco_fee || 0), 0).toFixed(2)); // Sum of squadco_fee column
    const totalPlatformCommission = (transactions || []).reduce((sum, t) => sum + Number(t.platform_commission || 0), 0);
    const totalOrganizerEarnings = (transactions || []).reduce((sum, t) => sum + Number(t.organizer_earnings || 0), 0);
    const totalPlatformNetProfit = Number(totalPlatformCommission.toFixed(2));
    const totalTransactions = transactions?.length || 0;

    console.log('\n✅ CALCULATIONS COMPLETE - Summary stats:');
    console.log({
      totalTicketRevenue: Number(totalTicketRevenue),
      totalProcessingFees: Number(totalProcessingFees),
      totalAmountCollected: Number(totalAmountCollected),
      totalSquadcoCharges: Number(totalSquadcoCharges),
      totalPlatformCommission: Number(totalPlatformCommission),
      totalOrganizerEarnings: Number(totalOrganizerEarnings),
      totalPlatformNetProfit: Number(totalPlatformNetProfit),
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
      const squadcoCharge = Number(t.squadco_fee || 0);
      const commission = Number(t.platform_commission || 0);
      
      monthlyData[month].ticketRevenue += ticketPrice;
      monthlyData[month].processingFees += processingFee;
      monthlyData[month].totalAmount += totalAmount;
      monthlyData[month].squadcoCharges += squadcoCharge;
      monthlyData[month].platformCommission += commission;
      monthlyData[month].organizerEarnings += Number(t.organizer_earnings || 0);
      monthlyData[month].platformNetProfit += Number(commission.toFixed(2));
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
        const ticketRevenue = eventTxns.reduce((sum, t) => sum + Number(t.total_amount || 0), 0);
        const processingFees = eventTxns.reduce((sum, t) => sum + Number(t.processing_fee || 0), 0);
        const totalAmount = eventTxns.reduce((sum, t) => sum + Number(t.total_amount || 0), 0);
        const squadcoCharges = Number((eventTxns.reduce((sum, t) => sum + Number(t.squadco_fee || 0), 0)).toFixed(2));
        const platformCommission = eventTxns.reduce((sum, t) => sum + Number(t.platform_commission || 0), 0);
        const organizerEarnings = eventTxns.reduce((sum, t) => sum + Number(t.organizer_earnings || 0), 0);
        const platformNetProfit = Number(platformCommission.toFixed(2));
        
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

    const revenueByOrganizer = organizerIds
      .map(id => {
        const organizerTxns = (transactions || []).filter(t => t.organizer_id === id);
        const ticketsSold = organizerTxns.length;
        const ticketRevenue = organizerTxns.reduce((sum, t) => sum + Number(t.total_amount || 0), 0);
        const processingFees = organizerTxns.reduce((sum, t) => sum + Number(t.processing_fee || 0), 0);
        const totalAmount = organizerTxns.reduce((sum, t) => sum + Number(t.total_amount || 0), 0);
        const squadcoCharges = Number((organizerTxns.reduce((sum, t) => sum + Number(t.squadco_fee || 0), 0)).toFixed(2));
        const platformCommission = organizerTxns.reduce((sum, t) => sum + Number(t.platform_commission || 0), 0);
        const organizerEarnings = organizerTxns.reduce((sum, t) => sum + Number(t.organizer_earnings || 0), 0);
        const platformNetProfit = Number(platformCommission.toFixed(2));
        
        const organizer = organizerMap[id];
        return {
          organizer_id: id,
          organizer_name: organizer?.full_name || 'Unknown',
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


// ✅ Get single event details by ID
export const getAdminEventById = async (req, res) => {
  try {
    const { id } = req.params;

    console.log('📋 Fetching event details for admin:', id);

    // ✅ Use service role key to fetch event (can read all events regardless of status)
    // ✅ Explicitly select start_time and end_time from database
    const { data: event, error } = await supabaseAdmin
      .from('events')
      .select('*, start_time, end_time')
      .eq('id', id)
      .single();

    if (error || !event) {
      console.error('❌ Event not found:', id);
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    console.log('✅ Event found:', event.title);
    console.log('🕐 Raw event data from DB:', {
      id: event.id,
      title: event.title,
      date: event.date,
      start_time: event.start_time,
      end_time: event.end_time,
    });

    // ✅ Fetch ticket_types from ticket_types table if JSONB column is empty
    if (!event.ticket_types || event.ticket_types.length === 0) {
      const { data: ticketTypesRows } = await supabaseAdmin
        .from('ticket_types')
        .select('id, name, price, description')
        .eq('event_id', id);

      if (ticketTypesRows && ticketTypesRows.length > 0) {
        event.ticket_types = ticketTypesRows.map(tt => ({
          id: tt.id,
          name: tt.name,
          price: tt.price,
          description: tt.description || '',
          available: event.total_tickets - (event.tickets_sold || 0),
          quantity: event.total_tickets,
        }));
      }
    }

    // ✅ Fetch organizer details using service role
    const { data: org } = await supabaseAdmin
      .from('profiles')
      .select('full_name, email')
      .eq('id', event.organizer_id)
      .single();

    const organizer_name = org?.full_name || org?.email?.split('@')[0] || 'Unknown';
    const organizer_email = org?.email || '';

    console.log('✅ Organizer found:', organizer_name);

    // ✅ Fetch transaction data for revenue and tickets sold using service role
    console.log('🔍 DEBUG - Querying transactions for event_id:', id);
    const { data: txData } = await supabaseAdmin
      .from('transactions')
      .select('total_amount, organizer_earnings, status')
      .eq('event_id', id)
      .eq('status', 'success');

    console.log('🔍 DEBUG - Transactions found:', txData?.length || 0);

    const tickets_sold = (txData || []).length;
    const total_revenue = (txData || []).reduce((sum, t) => sum + Number(t.total_amount || 0), 0);
    const organizer_earnings = (txData || []).reduce((sum, t) => sum + Number(t.organizer_earnings || 0), 0);

    console.log('✅ Transaction data fetched:', { tickets_sold, total_revenue });
    console.log('🔍 DEBUG - Transaction details:', JSON.stringify(txData, null, 2));

    // ✅ Build comprehensive response with all required fields
    // ✅ Use start_time and end_time directly from database
    return res.status(200).json({
      success: true,
      data: {
        // Event Identification
        id: event.id,
        title: event.title,
        description: event.description || '',
        category: event.category || 'General',
        
        // Date & Time
        date: event.date,
        end_date: event.end_date,
        start_time: event.start_time || null,  // ✅ From database
        end_time: event.end_time || null,      // ✅ From database
        location: event.location,
        
        // Ticket Information
        ticket_price: event.ticket_price || 0,
        total_tickets: event.total_tickets || 0,
        tickets_sold: tickets_sold,
        ticket_types: event.ticket_types || [], // ✅ From JSONB or ticket_types table
        
        // Revenue Information
        revenue: total_revenue,
        
        // Organizer Information
        organizer_id: event.organizer_id,
        organizer_name: organizer_name,
        organizer_email: organizer_email,
        
        // Media
        image_url: event.image_url || null,
        
        // Event Status
        status: event.status,
        rejection_reason: event.rejection_reason || null,
        
        // Metadata
        created_at: event.created_at,
      },
    });
  } catch (error) {
    console.error('❌ Error fetching event details:', error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


// ✅ Get full organizer details by ID
export const getAdminOrganizerById = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: organizer, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .eq('role', 'organizer')
      .single();

    if (error || !organizer) {
      return res.status(404).json({
        success: false,
        message: 'Organizer not found',
      });
    }

    const { data: events } = await supabase
      .from('events')
      .select('id, title, date, status, total_tickets, tickets_sold')
      .eq('organizer_id', id)
      .order('created_at', { ascending: false });

    const { data: transactions } = await supabase
      .from('transactions')
      .select('id, event_id, buyer_name, buyer_email, reference, ticket_price, total_amount, organizer_earnings, created_at, status, events(title)')
      .eq('organizer_id', id)
      .eq('status', 'success');

    const { data: wallet } = await supabase
      .from('wallets')
      .select('available_balance, pending_balance, total_earned')
      .eq('organizer_id', id);

    const { data: withdrawals } = await supabase
      .from('withdrawals')
      .select('amount, status, created_at')
      .eq('organizer_id', id)
      .order('created_at', { ascending: false });

    const totalRevenue = (transactions || []).reduce((sum, t) => sum + Number(t.total_amount || 0), 0);
    const totalEarnings = (transactions || []).reduce((sum, t) => sum + Number(t.organizer_earnings || 0), 0);
    const ticketsSold = (transactions || []).length;

    const mappedTransactions = (transactions || []).map(t => ({
      ...t,
      amount: t.total_amount,          // alias for frontend compatibility
      event_title: t.events?.title || null, // from nested join
      events: undefined,               // strip the nested object — don't expose it raw
    }));

    // Extract wallet data
    const walletData = wallet?.[0] || {};

    return res.status(200).json({
      success: true,
      data: {
        ...organizer,
        // Flatten stats to top level for frontend compatibility
        total_events: (events || []).length,
        total_tickets_sold: ticketsSold,
        total_revenue: totalRevenue,
        total_earnings: totalEarnings,
        // Flatten wallet data to top level
        available_balance: walletData.available_balance || 0,
        pending_balance: walletData.pending_balance || 0,
        total_earned: walletData.total_earned || 0,
        // Keep nested arrays
        events: events || [],
        transactions: mappedTransactions,
        wallet: walletData,
        withdrawals: withdrawals || [],
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ✅ Suspend an organizer
export const suspendOrganizer = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const { error } = await supabase
      .from('profiles')
      .update({
        status: 'suspended',
        suspension_reason: reason || 'Suspended by admin',
      })
      .eq('id', id);

    if (error) throw error;

    return res.status(200).json({
      success: true,
      message: 'Organizer suspended successfully',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ✅ Unsuspend an organizer
export const unsuspendOrganizer = async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('profiles')
      .update({
        status: 'active',
        suspension_reason: null,
      })
      .eq('id', id);

    if (error) throw error;

    return res.status(200).json({
      success: true,
      message: 'Organizer unsuspended successfully',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


// ✅ DIAGNOSTIC: Check transactions for a specific event
export const diagnosticEventTransactions = async (req, res) => {
  try {
    const { eventId } = req.params;
    
    console.log('🔍 DIAGNOSTIC: Checking transactions for event:', eventId);
    
    // Get event details
    const { data: event } = await supabaseAdmin
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single();
    
    // Get ALL transactions (no filters)
    const { data: allTx } = await supabaseAdmin
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    
    // Get transactions for this specific event
    const { data: eventTx } = await supabaseAdmin
      .from('transactions')
      .select('*')
      .eq('event_id', eventId);
    
    // Get transactions with success status
    const { data: successTx } = await supabaseAdmin
      .from('transactions')
      .select('*')
      .eq('event_id', eventId)
      .eq('status', 'success');
    
    return res.json({
      success: true,
      event: {
        id: event?.id,
        title: event?.title,
        tickets_sold: event?.tickets_sold,
        organizer_id: event?.organizer_id,
      },
      transactions: {
        total_in_db: allTx?.length || 0,
        for_this_event: eventTx?.length || 0,
        successful_for_event: successTx?.length || 0,
      },
      recent_transactions: allTx?.slice(0, 10).map(t => ({
        id: t.id,
        event_id: t.event_id,
        status: t.status,
        buyer_email: t.buyer_email,
        ticket_price: t.ticket_price,
        created_at: t.created_at,
      })),
      event_transactions: eventTx?.map(t => ({
        id: t.id,
        status: t.status,
        buyer_email: t.buyer_email,
        ticket_price: t.ticket_price,
        created_at: t.created_at,
      })),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// ✅ GET /api/v1/admin/monthly-earnings
// Returns all successful transactions within a date range with aggregated totals
export const getMonthlyEarnings = async (req, res) => {
  try {
    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({
        success: false,
        message: 'Query params "from" and "to" are required (ISO date strings)',
      });
    }

    console.log('📊 Fetching monthly earnings:', { from, to });

    // Fetch all successful transactions in the date range
    const { data: transactions, error: txError } = await supabaseAdmin
      .from('transactions')
      .select('id, buyer_name, buyer_email, event_id, total_amount, platform_commission, created_at')
      .eq('status', 'success')
      .gte('created_at', from)
      .lt('created_at', to)
      .order('created_at', { ascending: false });

    if (txError) {
      console.error('❌ Monthly earnings query error:', txError);
      return res.status(500).json({
        success: false,
        message: txError.message,
      });
    }

    const rows = transactions || [];

    // Fetch event titles for the transactions
    const eventIds = [...new Set(rows.map(t => t.event_id).filter(Boolean))];
    let eventMap = {};
    if (eventIds.length > 0) {
      const { data: events } = await supabaseAdmin
        .from('events')
        .select('id, title')
        .in('id', eventIds);
      eventMap = Object.fromEntries((events || []).map(e => [e.id, e.title]));
    }

    // Compute aggregates
    const totalRevenue = Number(rows.reduce((sum, t) => sum + Number(t.total_amount || 0), 0).toFixed(2));
    const platformEarnings = Number(rows.reduce((sum, t) => sum + Number(t.platform_commission || 0), 0).toFixed(2));
    const txCount = rows.length;

    const shaped = rows.map(t => ({
      id: t.id,
      buyer_name: t.buyer_name,
      buyer_email: t.buyer_email,
      event_title: eventMap[t.event_id] || 'Unknown Event',
      total_amount: Number(t.total_amount || 0),
      platform_commission: Number(t.platform_commission || 0),
      created_at: t.created_at,
    }));

    console.log('✅ Monthly earnings fetched:', { totalRevenue, platformEarnings, txCount });

    return res.status(200).json({
      success: true,
      data: {
        totalRevenue,
        platformEarnings,
        txCount,
        transactions: shaped,
      },
    });
  } catch (error) {
    console.error('❌ getMonthlyEarnings error:', error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ✅ POST /api/v1/admin/backfill-transactions
// Re-runs the per-type split for all success transactions where
// squadco_response.cartItems exists but tier_id is missing (partial state).
// Also re-syncs events.tickets_sold from transaction data.
// Auth: admin JWT required.
export const backfillTransactions = async (req, res) => {
  try {
    console.log('[BACKFILL] Starting transaction backfill...');

    // 1. Find all primary success rows (no _N suffix) where cartItems survived
    //    but tier_id was never written (partial split state).
    const { data: candidates, error: fetchErr } = await supabaseAdmin
      .from('transactions')
      .select('id, reference, event_id, organizer_id, buyer_email, buyer_name, processing_fee, total_amount, ticket_price, platform_commission, organizer_earnings, squadco_response, quantity, ip_address, user_agent')
      .eq('status', 'success')
      .not('squadco_response', 'is', null)
      .order('created_at', { ascending: false })
      .limit(200);

    if (fetchErr) {
      return res.status(500).json({ success: false, error: fetchErr.message });
    }

    // Filter: primary rows only (no _N suffix) whose squadco_response has cartItems
    // but tier_id is missing (partial state).
    const toFix = (candidates || []).filter(row => {
      // Only process the primary row (TXN_XXX, not TXN_XXX_1)
      if (/_\d+$/.test(row.reference)) return false;

      const sr = typeof row.squadco_response === 'string'
        ? (() => { try { return JSON.parse(row.squadco_response); } catch(_) { return {}; } })()
        : (row.squadco_response || {});

      const cartItems = Array.isArray(sr.cartItems) ? sr.cartItems : [];
      const tierIdMissing = !sr.tier_id;
      const hasMultipleItems = cartItems.length > 1;
      // Need backfill if: tier_id is missing OR multiple items with only 1 row
      return tierIdMissing || hasMultipleItems;
    });

    console.log(`[BACKFILL] Found ${toFix.length} transactions needing backfill`);

    const results = { fixed: 0, skipped: 0, errors: 0 };

    for (const tx of toFix) {
      try {
        const sr = typeof tx.squadco_response === 'string'
          ? (() => { try { return JSON.parse(tx.squadco_response); } catch(_) { return {}; } })()
          : (tx.squadco_response || {});

        const cartItems = Array.isArray(sr.cartItems) ? sr.cartItems : [];
        if (cartItems.length === 0) { results.skipped++; continue; }

        // Check how many rows already exist for this reference
        const { data: existingRows } = await supabaseAdmin
          .from('transactions')
          .select('id')
          .ilike('reference', `${tx.reference}%`)
          .eq('status', 'success');

        const existingCount = existingRows?.length || 0;
        if (existingCount >= cartItems.length) {
          results.skipped++;
          continue; // Already fully split
        }

        // Fetch event ticket_types for name resolution
        const { data: evData } = await supabaseAdmin
          .from('events')
          .select('ticket_types')
          .eq('id', tx.event_id)
          .single();

        const ticketTypeMap = {};
        if (Array.isArray(evData?.ticket_types)) {
          for (const tt of evData.ticket_types) {
            if (tt.id) ticketTypeMap[tt.id] = tt.name || 'Ticket';
          }
        }

        const verifiedAt = new Date().toISOString();

        // Update row 0 with tier info from first cart item
        const firstItem = cartItems[0];
        const firstTypeId = firstItem.id || firstItem.ticket_type_id || null;
        const firstTypeName = firstTypeId ? (ticketTypeMap[firstTypeId] || firstItem.name || null) : null;
        const firstQty = parseInt(firstItem.quantity) || 1;
        const firstPrice = parseFloat(firstItem.price || firstItem.ticket_price || 0) * firstQty;
        const firstProcessingFee = cartItems.length === 1 ? (tx.processing_fee || 0) : 0;

        await supabaseAdmin
          .from('transactions')
          .update({
            squadco_response: { ...sr, tier_id: firstTypeId, tier_name: firstTypeName },
            ticket_price: firstPrice,
            processing_fee: firstProcessingFee,
            total_amount: firstPrice + firstProcessingFee,
            platform_commission: firstPrice * 0.03,
            organizer_earnings: firstPrice * 0.97,
            quantity: firstQty,
          })
          .eq('id', tx.id);

        // Insert remaining rows
        for (let i = 1; i < cartItems.length; i++) {
          // Skip if this row was already inserted
          if (i < existingCount) continue;

          const item = cartItems[i];
          const typeId = item.id || item.ticket_type_id || null;
          const typeName = typeId ? (ticketTypeMap[typeId] || item.name || null) : null;
          const itemQty = parseInt(item.quantity) || 1;
          const itemPrice = parseFloat(item.price || item.ticket_price || 0) * itemQty;

          const { error: insertErr } = await supabaseAdmin
            .from('transactions')
            .insert([{
              reference: `${tx.reference}_${i}`,
              event_id: tx.event_id,
              organizer_id: tx.organizer_id,
              buyer_email: tx.buyer_email,
              buyer_name: tx.buyer_name,
              squadco_response: { ...sr, tier_id: typeId, tier_name: typeName },
              ticket_price: itemPrice,
              processing_fee: 0,
              total_amount: itemPrice,
              platform_commission: itemPrice * 0.03,
              squadco_fee: 0,
              organizer_earnings: itemPrice * 0.97,
              quantity: itemQty,
              status: 'success',
              verified_at: verifiedAt,
              ip_address: tx.ip_address,
              user_agent: tx.user_agent,
            }]);

          if (insertErr) {
            console.error(`[BACKFILL] Insert error for ${tx.reference}_${i}:`, insertErr.message);
          }
        }

        results.fixed++;
        console.log(`[BACKFILL] Fixed: ${tx.reference}`);
      } catch (rowErr) {
        console.error(`[BACKFILL] Error processing ${tx.reference}:`, rowErr.message);
        results.errors++;
      }
    }

    // 2. Re-sync events.tickets_sold from transactions (dynamic count)
    console.log('[BACKFILL] Re-syncing events.tickets_sold...');
    const { data: allTx } = await supabaseAdmin
      .from('transactions')
      .select('event_id, quantity')
      .eq('status', 'success');

    const soldByEvent = {};
    for (const t of (allTx || [])) {
      soldByEvent[t.event_id] = (soldByEvent[t.event_id] || 0) + (parseInt(t.quantity) || 1);
    }

    let syncedEvents = 0;
    for (const [eventId, count] of Object.entries(soldByEvent)) {
      const { error: syncErr } = await supabaseAdmin
        .from('events')
        .update({ tickets_sold: count })
        .eq('id', eventId);

      if (!syncErr) syncedEvents++;
    }

    console.log(`[BACKFILL] Done. fixed=${results.fixed}, skipped=${results.skipped}, errors=${results.errors}, syncedEvents=${syncedEvents}`);

    // 3. Re-sync wallets.available_balance and total_earned from transactions
    console.log('[BACKFILL] Re-syncing wallet balances...');
    const { data: allTxForWallet } = await supabaseAdmin
      .from('transactions')
      .select('organizer_id, organizer_earnings')
      .eq('status', 'success');

    const earningsByOrg = {};
    for (const t of (allTxForWallet || [])) {
      if (t.organizer_id) {
        earningsByOrg[t.organizer_id] = (earningsByOrg[t.organizer_id] || 0) + Number(t.organizer_earnings || 0);
      }
    }

    let syncedWallets = 0;
    const walletCorrections = [];
    for (const [orgId, totalEarned] of Object.entries(earningsByOrg)) {
      const correctBalance = Number(totalEarned.toFixed(2));

      // Fetch current wallet to check for discrepancy and preserve pending_balance
      const { data: wallet } = await supabaseAdmin
        .from('wallets')
        .select('available_balance, total_earned, pending_balance')
        .eq('organizer_id', orgId)
        .maybeSingle();

      if (!wallet) {
        console.log(`[BACKFILL] No wallet found for organizer ${orgId} — skipping`);
        continue;
      }

      const currentBalance = Number(wallet.available_balance || 0);
      if (Math.abs(currentBalance - correctBalance) > 1) {
        walletCorrections.push({ organizer_id: orgId, old_balance: currentBalance, new_balance: correctBalance });

        const { error: walletErr } = await supabaseAdmin
          .from('wallets')
          .update({
            available_balance: correctBalance,
            total_earned: correctBalance,
            // pending_balance is NOT touched — it tracks withdrawal requests in progress
          })
          .eq('organizer_id', orgId);

        if (!walletErr) {
          syncedWallets++;
          console.log(`[BACKFILL] Wallet synced for ${orgId}: ₦${currentBalance} → ₦${correctBalance}`);
        } else {
          console.error(`[BACKFILL] Wallet sync failed for ${orgId}:`, walletErr.message);
        }
      }
    }

    console.log(`[BACKFILL] Wallet sync complete. syncedWallets=${syncedWallets}`);

    return res.status(200).json({
      success: true,
      message: 'Backfill complete',
      results: {
        ...results,
        synced_events: syncedEvents,
        synced_wallets: syncedWallets,
        wallet_corrections: walletCorrections,
      },
    });
  } catch (error) {
    console.error('[BACKFILL] Fatal error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ✅ GET /api/v1/admin/stuck-payments
// Returns pending transactions older than 30 minutes
export const getStuckPayments = async (req, res) => {
  try {
    const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    const { data: stuckTx, error } = await supabaseAdmin
      .from('transactions')
      .select('id, reference, buyer_name, buyer_email, total_amount, event_id, created_at')
      .eq('status', 'pending')
      .lt('created_at', cutoff)
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    // Fetch event titles
    const eventIds = [...new Set((stuckTx || []).map(t => t.event_id).filter(Boolean))];
    let eventMap = {};
    if (eventIds.length > 0) {
      const { data: events } = await supabaseAdmin
        .from('events')
        .select('id, title')
        .in('id', eventIds);
      eventMap = Object.fromEntries((events || []).map(e => [e.id, e.title]));
    }

    const now = Date.now();
    const shaped = (stuckTx || []).map(t => ({
      id: t.id,
      reference: t.reference,
      buyer_name: t.buyer_name,
      buyer_email: t.buyer_email,
      event_title: eventMap[t.event_id] || 'Unknown Event',
      total_amount: Number(t.total_amount || 0),
      created_at: t.created_at,
      minutes_ago: Math.floor((now - new Date(t.created_at).getTime()) / 60000),
    }));

    return res.status(200).json({ success: true, data: shaped, count: shaped.length });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ✅ GET /api/v1/admin/transactions
// Admin transaction ledger with filters, search, pagination, and summary
export const getAdminTransactions = async (req, res) => {
  try {
    const statusFilter = req.query.status || null; // success | pending | failed | stuck
    const search      = req.query.search?.trim() || null;
    const page        = Math.max(1, parseInt(req.query.page)  || 1);
    const limit       = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const offset      = (page - 1) * limit;

    const stuckCutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    // ── Build the transactions query ────────────────────────────────────────
    let query = supabaseAdmin
      .from('transactions')
      .select('id, reference, buyer_name, buyer_email, total_amount, platform_commission, organizer_id, event_id, status, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Status filter
    if (statusFilter === 'stuck') {
      query = query.eq('status', 'pending').lt('created_at', stuckCutoff);
    } else if (statusFilter) {
      query = query.eq('status', statusFilter);
    }

    // Search filter — ilike on buyer_email, buyer_name, reference
    if (search) {
      query = query.or(
        `buyer_email.ilike.%${search}%,buyer_name.ilike.%${search}%,reference.ilike.%${search}%`
      );
    }

    const { data: txRows, error: txErr, count: total } = await query;

    if (txErr) {
      return res.status(500).json({ success: false, error: txErr.message });
    }

    // ── Fetch event titles and organizer names in parallel ──────────────────
    const eventIds     = [...new Set((txRows || []).map(t => t.event_id).filter(Boolean))];
    const organizerIds = [...new Set((txRows || []).map(t => t.organizer_id).filter(Boolean))];

    const [eventsResult, profilesResult] = await Promise.all([
      eventIds.length > 0
        ? supabaseAdmin.from('events').select('id, title').in('id', eventIds)
        : Promise.resolve({ data: [] }),
      organizerIds.length > 0
        ? supabaseAdmin.from('profiles').select('id, full_name').in('id', organizerIds)
        : Promise.resolve({ data: [] }),
    ]);

    const eventMap    = Object.fromEntries((eventsResult.data  || []).map(e => [e.id, e.title]));
    const profileMap  = Object.fromEntries((profilesResult.data || []).map(p => [p.id, p.full_name]));

    const now = Date.now();

    const transactions = (txRows || []).map(t => {
      const isPending = t.status === 'pending';
      const minutesAgo = isPending
        ? Math.floor((now - new Date(t.created_at).getTime()) / 60000)
        : null;

      return {
        id:                  t.id,
        reference:           t.reference,
        buyer_name:          t.buyer_name,
        buyer_email:         t.buyer_email,
        event_title:         eventMap[t.event_id]    || 'Unknown Event',
        organizer_name:      profileMap[t.organizer_id] || 'Unknown',
        total_amount:        Number(t.total_amount || 0),
        platform_commission: Number(t.platform_commission || 0),
        status:              t.status,
        created_at:          t.created_at,
        minutes_ago:         minutesAgo,
      };
    });

    // ── Summary counts — always across ALL transactions (not just current page) ─
    const [successRes, pendingRes, failedRes, stuckRes, successRevRes, pendingRevRes] = await Promise.all([
      supabaseAdmin.from('transactions').select('id', { count: 'exact', head: true }).eq('status', 'success'),
      supabaseAdmin.from('transactions').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabaseAdmin.from('transactions').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
      supabaseAdmin.from('transactions').select('id', { count: 'exact', head: true }).eq('status', 'pending').lt('created_at', stuckCutoff),
      supabaseAdmin.from('transactions').select('total_amount').eq('status', 'success'),
      supabaseAdmin.from('transactions').select('total_amount').eq('status', 'pending'),
    ]);

    const revenueSuccess = (successRevRes.data || []).reduce((s, t) => s + Number(t.total_amount || 0), 0);
    const revenuePending = (pendingRevRes.data || []).reduce((s, t) => s + Number(t.total_amount || 0), 0);

    return res.status(200).json({
      success: true,
      data: {
        transactions,
        total:  total || 0,
        page,
        limit,
        summary: {
          total_success:   successRes.count  || 0,
          total_pending:   pendingRes.count  || 0,
          total_failed:    failedRes.count   || 0,
          total_stuck:     stuckRes.count    || 0,
          revenue_success: Number(revenueSuccess.toFixed(2)),
          revenue_pending: Number(revenuePending.toFixed(2)),
        },
      },
    });
  } catch (err) {
    console.error('❌ getAdminTransactions error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ✅ GET /api/v1/admin/wallet-integrity
// Checks for wallets where available_balance > sum of organizer_earnings from transactions.
// Returns all organizers with a discrepancy so the issue can be diagnosed.
export const getWalletIntegrity = async (req, res) => {
  try {
    // Fetch all wallets
    const { data: wallets, error: walletErr } = await supabaseAdmin
      .from('wallets')
      .select('organizer_id, available_balance, pending_balance, total_earned');

    if (walletErr) return res.status(500).json({ success: false, error: walletErr.message });

    // Fetch sum of organizer_earnings per organizer from transactions
    const { data: txSums, error: txErr } = await supabaseAdmin
      .from('transactions')
      .select('organizer_id, organizer_earnings')
      .eq('status', 'success');

    if (txErr) return res.status(500).json({ success: false, error: txErr.message });

    // Build map: organizer_id → sum of organizer_earnings
    const earningsMap = {};
    for (const tx of (txSums || [])) {
      earningsMap[tx.organizer_id] = (earningsMap[tx.organizer_id] || 0) + Number(tx.organizer_earnings || 0);
    }

    // Fetch organizer names
    const orgIds = (wallets || []).map(w => w.organizer_id).filter(Boolean);
    let nameMap = {};
    if (orgIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, email')
        .in('id', orgIds);
      nameMap = Object.fromEntries((profiles || []).map(p => [p.id, p.full_name || p.email]));
    }

    const now = Date.now();
    const allRows = (wallets || []).map(w => {
      const calculatedEarnings = Number((earningsMap[w.organizer_id] || 0).toFixed(2));
      const availableBalance   = Number(w.available_balance || 0);
      // ✅ FIX: use Math.abs so both over-credited AND under-credited wallets are flagged
      const discrepancy        = Number((availableBalance - calculatedEarnings).toFixed(2));

      return {
        organizer_id:         w.organizer_id,
        organizer_name:       nameMap[w.organizer_id] || 'Unknown',
        available_balance:    availableBalance,
        pending_balance:      Number(w.pending_balance || 0),
        wallet_total_earned:  Number(w.total_earned || 0),
        calculated_earnings:  calculatedEarnings,
        discrepancy,
        // Flag if difference > ₦1 in either direction (over OR under credited)
        has_discrepancy:      Math.abs(discrepancy) > 1,
      };
    });

    const discrepancies = allRows.filter(r => r.has_discrepancy);

    return res.status(200).json({
      success: true,
      data: {
        all_wallets:    allRows,
        discrepancies,
        discrepancy_count: discrepancies.length,
      },
    });
  } catch (err) {
    console.error('❌ getWalletIntegrity error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ✅ POST /api/v1/admin/wallet-integrity/fix
// Resets available_balance and total_earned on wallets to match sum of organizer_earnings
// from successful transactions. Only touches wallets that have a discrepancy.
// Does NOT touch pending_balance (manual/pending payouts are tracked separately).
export const fixWalletIntegrity = async (req, res) => {
  try {
    const dryRun = req.query.dry_run === 'true'; // pass ?dry_run=true to preview without writing

    // Fetch all wallets
    const { data: wallets, error: walletErr } = await supabaseAdmin
      .from('wallets')
      .select('organizer_id, available_balance, total_earned');

    if (walletErr) return res.status(500).json({ success: false, error: walletErr.message });

    // Fetch sum of organizer_earnings per organizer
    const { data: txSums, error: txErr } = await supabaseAdmin
      .from('transactions')
      .select('organizer_id, organizer_earnings')
      .eq('status', 'success');

    if (txErr) return res.status(500).json({ success: false, error: txErr.message });

    const earningsMap = {};
    for (const tx of (txSums || [])) {
      earningsMap[tx.organizer_id] = (earningsMap[tx.organizer_id] || 0) + Number(tx.organizer_earnings || 0);
    }

    const fixes = [];
    let fixedCount = 0;

    for (const wallet of (wallets || [])) {
      const correctBalance = Number((earningsMap[wallet.organizer_id] || 0).toFixed(2));
      const currentBalance = Number(wallet.available_balance || 0);
      const discrepancy    = Number((currentBalance - correctBalance).toFixed(2));

      if (Math.abs(discrepancy) < 0.01) continue; // within 1 kobo — no fix needed

      fixes.push({
        organizer_id:      wallet.organizer_id,
        old_balance:       currentBalance,
        correct_balance:   correctBalance,
        discrepancy,
      });

      if (!dryRun) {
        const { error: updateErr } = await supabaseAdmin
          .from('wallets')
          .update({
            available_balance: correctBalance,
            total_earned:      correctBalance,
          })
          .eq('organizer_id', wallet.organizer_id);

        if (updateErr) {
          console.error(`[WALLET-FIX] Failed to fix wallet for ${wallet.organizer_id}:`, updateErr.message);
        } else {
          fixedCount++;
          console.log(`[WALLET-FIX] Fixed organizer ${wallet.organizer_id}: ${currentBalance} → ${correctBalance}`);
        }
      }
    }

    return res.status(200).json({
      success: true,
      dry_run: dryRun,
      fixes_needed: fixes.length,
      fixes_applied: dryRun ? 0 : fixedCount,
      fixes,
    });
  } catch (err) {
    console.error('❌ fixWalletIntegrity error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ✅ POST /api/v1/admin/transactions/:reference/resend-email
// Rebuilds and resends the Ticketa confirmation email to the buyer.
// Auth: admin JWT required.
export const resendTransactionEmail = async (req, res) => {
  try {
    const { reference } = req.params;

    if (!reference) {
      return res.status(400).json({ success: false, error: 'Reference is required' });
    }

    // Fetch the primary transaction row (strip any _N suffix to get the base row)
    const baseReference = reference.replace(/_\d+$/, '');

    const { data: transaction, error: txErr } = await supabaseAdmin
      .from('transactions')
      .select('id, reference, buyer_name, buyer_email, total_amount, event_id, squadco_response, status')
      .eq('reference', baseReference)
      .maybeSingle();

    if (txErr || !transaction) {
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }

    if (transaction.status !== 'success') {
      return res.status(400).json({ success: false, error: `Transaction status is '${transaction.status}', not success` });
    }

    // Fetch event details
    const { data: event } = await supabaseAdmin
      .from('events')
      .select('id, title, date, start_time, end_time, location')
      .eq('id', transaction.event_id)
      .single();

    // Parse squadco_response for cartItems and attendees
    const sr = typeof transaction.squadco_response === 'string'
      ? (() => { try { return JSON.parse(transaction.squadco_response); } catch(_) { return {}; } })()
      : (transaction.squadco_response || {});

    const cartItems = Array.isArray(sr.cartItems) ? sr.cartItems : [];
    const attendees = Array.isArray(sr.attendees) ? sr.attendees : [];

    // Send the email
    const { sendTicketPurchaseConfirmation } = await import('../services/emailService.js');
    const result = await sendTicketPurchaseConfirmation({
      buyerName:   transaction.buyer_name,
      buyerEmail:  transaction.buyer_email,
      reference:   transaction.reference,
      event,
      cartItems,
      attendees,
      totalAmount: transaction.total_amount,
    });

    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }

    console.log(`[RESEND] Confirmation email resent for ${reference} to ${transaction.buyer_email}`);

    return res.status(200).json({
      success: true,
      sent_to: transaction.buyer_email,
      message_id: result.messageId,
    });
  } catch (err) {
    console.error('❌ resendTransactionEmail error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};
