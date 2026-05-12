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

    // ✅ Fetch all events
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .order('date', { ascending: false });

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

    // ✅ Auto-expire past events - update status in database
    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const pastActiveEvents = (events || []).filter(event => {
      const eventDate = new Date(event.date);
      return eventDate < today && event.status === 'active';
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
  try {
    const { id } = req.params;

    console.log(`✅ Approving event ${id}...`);

    // Get event details before updating
    const { data: event, error: fetchError } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !event) {
      console.error('❌ Event not found:', fetchError);
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    // ✅ Fetch organizer details manually
    const { data: approveOrg } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', event.organizer_id)
      .single();

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
        approveOrg?.email || '',
        approveOrg?.full_name || 'Organizer',
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
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !event) {
      console.error('❌ Event not found:', fetchError);
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    // ✅ Fetch organizer details manually
    const { data: rejectOrg } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', event.organizer_id)
      .single();

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
        rejectOrg?.email || '',
        rejectOrg?.full_name || 'Organizer',
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

/**
 * ✅ GET /api/v1/admin/sales-feed
 * Returns all transactions with calculated platform profit per transaction
 * 
 * Formula per transaction:
 * - squadco_fee = (total_amount * 1.2) / 100
 * - platform_profit = processing_fee + platform_commission - squadco_fee
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

    // Calculate platform profit for each transaction
    const transactionsWithProfit = (transactions || []).map(t => {
      const totalAmount = Number(t.total_amount || 0);
      const processingFee = Number(t.processing_fee || 0);
      const platformCommission = Number(t.platform_commission || 0);
      const squadcoFee = Number(t.squadco_fee || 0);
      
      // Calculate platform profit: platform_commission only
      const platformProfit = Number(platformCommission.toFixed(2));

      return {
        id: t.id,
        reference: t.reference,
        event_id: t.event_id,
        organizer_id: t.organizer_id,
        buyer_name: t.buyer_name,
        buyer_email: t.buyer_email,
        ticket_price: Number(t.ticket_price || 0),
        processing_fee: processingFee,
        total_amount: totalAmount,
        platform_commission: platformCommission,
        squadco_fee: squadcoFee,
        platform_profit: platformProfit,
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
    const totalPlatformProfit = transactionsWithProfit.reduce((sum, t) => sum + t.platform_profit, 0);
    const totalOrganizerEarnings = transactionsWithProfit.reduce((sum, t) => sum + t.organizer_earnings, 0);

    console.log('✅ Sales feed calculated:', {
      transactionCount: transactionsWithProfit.length,
      totalRevenue: Number(totalRevenue.toFixed(2)),
      totalProcessingFees: Number(totalProcessingFees.toFixed(2)),
      totalPlatformCommission: Number(totalPlatformCommission.toFixed(2)),
      totalSquadcoFees: Number(totalSquadcoFees.toFixed(2)),
      totalPlatformProfit: Number(totalPlatformProfit.toFixed(2)),
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
        total_platform_profit: Number(totalPlatformProfit.toFixed(2)),
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
      recentTransactions: [],
    };

    // Query 1: Active events (with error handling)
    try {
      console.log('⏳ Querying active events from events table...');
      const eventsResult = await supabase
        .from('events')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active');
      if (eventsResult.error) {
        console.error('❌ Active events query error:', {
          message: eventsResult.error.message,
          code: eventsResult.error.code,
          details: eventsResult.error.details,
        });
      } else {
        stats.activeEventsCount = eventsResult.count ?? 0;
        console.log('✅ Active events:', stats.activeEventsCount);
      }
    } catch (err) {
      console.error('❌ Active events query exception:', {
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
        .select('id, ticket_price, total_amount, processing_fee, platform_commission, squadco_fee, organizer_earnings, buyer_name, event_id, status, created_at')
        .order('created_at', { ascending: false });
      
      console.log('TRANSACTIONS QUERY RESULT:', JSON.stringify({
        error: transactionsResult.error,
        count: transactionsResult.data?.length,
        firstItem: transactionsResult.data?.[0],
        statuses: transactionsResult.data?.map(t => t.status)
      }));
      
      if (transactionsResult.error) {
        console.error('❌ Transactions query error:', {
          message: transactionsResult.error.message,
          code: transactionsResult.error.code,
          details: transactionsResult.error.details,
        });
      } else if (transactionsResult.data && transactionsResult.data.length > 0) {
        console.log('📊 Transactions fetched:', transactionsResult.data.length);
        console.log('📊 Raw transaction data:', JSON.stringify(transactionsResult.data, null, 2));
        
        // ✅ DEBUG: Log all unique status values
        const uniqueStatuses = [...new Set(transactionsResult.data.map(t => t.status))];
        console.log('📊 Unique transaction statuses:', uniqueStatuses);
        
        const successTransactions = transactionsResult.data.filter(t => t.status === 'success') || [];
        const pendingTransactions = transactionsResult.data.filter(t => t.status === 'pending') || [];

        console.log('📊 Success transactions:', successTransactions.length);
        console.log('📊 Pending transactions:', pendingTransactions.length);
        console.log('📊 Success transactions data:', JSON.stringify(successTransactions, null, 2));

        stats.ticketsSold = Number(successTransactions.length || 0);
        stats.successfulPayments = Number(successTransactions.length || 0);
        stats.pendingPayments = Number(pendingTransactions.length || 0);
        stats.totalRevenue = Number(successTransactions.reduce((sum, t) => sum + Number(t.total_amount || 0), 0) || 0);
        stats.platformCommission = Number(successTransactions.reduce((sum, t) => sum + Number(t.platform_commission || 0), 0) || 0);
        stats.totalProcessingFees = Number(successTransactions.reduce((sum, t) => sum + Number(t.processing_fee || 0), 0) || 0);
        stats.squadcoCharges = Number(successTransactions.reduce((sum, t) => sum + Number(t.squadco_fee || 0), 0) || 0);
        stats.organizerEarnings = Number(successTransactions.reduce((sum, t) => sum + Number(t.organizer_earnings || 0), 0) || 0);
        
        // ✅ CRITICAL: Platform Net Profit = sum of platform_commission only
        console.log('💰 Platform Net Profit Calculation:', {
          platformCommission: stats.platformCommission,
          formula: 'sum of platform_commission',
          result: stats.platformCommission,
        });
        
        stats.platformNetProfit = Number(stats.platformCommission.toFixed(2));

        // ✅ Get event IDs from recent transactions and fetch event names
        const recentSuccessTransactions = successTransactions.slice(0, 5);
        const eventIds = [...new Set(recentSuccessTransactions.map(t => t.event_id).filter(Boolean))];
        
        let eventMap = {};
        if (eventIds.length > 0) {
          try {
            const eventsResult = await supabase
              .from('events')
              .select('id, title')
              .in('id', eventIds);
            
            if (eventsResult.data) {
              eventMap = Object.fromEntries(eventsResult.data.map(e => [e.id, e.title]));
            }
          } catch (eventErr) {
            console.error('⚠️ Error fetching event names:', eventErr.message);
          }
        }

        // ✅ Build recent transactions with event names
        stats.recentTransactions = recentSuccessTransactions.map(t => {
          const displayName = t.buyer_name || t.buyer_email || 'Unknown';
          console.log(`📋 Transaction ${t.id.substring(0, 8)}... - Buyer: ${displayName} (buyer_name: ${t.buyer_name}, buyer_email: ${t.buyer_email})`);
          return {
            id: t.id,
            buyer_name: displayName,
            event_name: eventMap[t.event_id] || 'Unknown Event',
            event_id: t.event_id,
            amount: Number(t.total_amount || 0),
            created_at: t.created_at,
          };
        });

        console.log('✅ Transactions stats:', {
          successful: stats.successfulPayments,
          pending: stats.pendingPayments,
          revenue: stats.totalRevenue,
          commission: stats.platformCommission,
          processingFees: stats.totalProcessingFees,
          squadcoCharges: stats.squadcoCharges,
          organizerEarnings: stats.organizerEarnings,
          platformNetProfit: stats.platformNetProfit,
          recentTransactionsCount: stats.recentTransactions.length,
        });
      }
    } catch (err) {
      console.error('❌ Transactions query exception:', {
        message: err.message,
        stack: err.stack,
      });
    }

    // Query 4: Organizers count (with error handling)
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

    // Query 5: Pending event approvals (with error handling)
    try {
      console.log('⏳ Querying pending event approvals from events table...');
      const pendingEventsResult = await supabase
        .from('events')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');
      
      if (pendingEventsResult.error) {
        console.error('❌ Pending events query error:', {
          message: pendingEventsResult.error.message,
          code: pendingEventsResult.error.code,
          details: pendingEventsResult.error.details,
        });
      } else {
        stats.pendingEventApprovals = pendingEventsResult.count ?? 0;
        console.log('✅ Pending event approvals:', stats.pendingEventApprovals);
      }
    } catch (err) {
      console.error('❌ Pending events query exception:', {
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
      const val = Number(t.ticket_price || 0);
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
    const { data: txData } = await supabaseAdmin
      .from('transactions')
      .select('total_amount, organizer_earnings, status')
      .eq('event_id', id)
      .eq('status', 'success');

    const tickets_sold = (txData || []).length;
    const total_revenue = (txData || []).reduce((sum, t) => sum + Number(t.total_amount || 0), 0);
    const organizer_earnings = (txData || []).reduce((sum, t) => sum + Number(t.organizer_earnings || 0), 0);

    console.log('✅ Transaction data fetched:', { tickets_sold, total_revenue });

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
        start_time: event.start_time || null,  // ✅ From database
        end_time: event.end_time || null,      // ✅ From database
        location: event.location,
        
        // Ticket Information
        ticket_price: event.ticket_price || 0,
        total_tickets: event.total_tickets || 0,
        tickets_sold: tickets_sold,
        
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
      .select('id, title, date, status, total_tickets')
      .eq('organizer_id', id)
      .order('created_at', { ascending: false });

    const { data: transactions } = await supabase
      .from('transactions')
      .select('ticket_price, organizer_earnings, created_at, status')
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

    return res.status(200).json({
      success: true,
      data: {
        ...organizer,
        events: events || [],
        transactions: transactions || [],
        wallet: wallet?.[0] || null,
        withdrawals: withdrawals || [],
        stats: {
          total_events: (events || []).length,
          tickets_sold: ticketsSold,
          total_revenue: totalRevenue,
          total_earnings: totalEarnings,
        },
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
