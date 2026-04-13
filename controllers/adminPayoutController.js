import axios from 'axios';
import { supabase } from '../utils/supabaseClient.js';
import { validateAndGetBankCode } from '../utils/bankCodes.js';

/**
 * GET /api/v1/admin/payouts/withdrawals
 * Fetch all withdrawal requests with organizer info
 * Admin only
 */
export const getWithdrawalsController = async (req, res) => {
  try {
    console.log('📋 Fetching all withdrawal requests...');

    const { data: withdrawals, error } = await supabase
      .from('withdrawals')
      .select('*')
      .order('requested_at', { ascending: false });

    if (error) {
      console.error('❌ Failed to fetch withdrawals:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch withdrawals',
        message: error.message,
      });
    }

    // Fetch organizer info for each withdrawal
    const enrichedWithdrawals = await Promise.all(
      (withdrawals || []).map(async (w) => {
        const { data: user } = await supabase
          .from('users')
          .select('full_name, email')
          .eq('id', w.organizer_id)
          .single();

        return {
          ...w,
          organizer_name: user?.full_name || 'Unknown',
          organizer_email: user?.email || 'Unknown',
        };
      })
    );

    console.log(`✅ Fetched ${enrichedWithdrawals.length} withdrawal requests`);

    return res.status(200).json({
      success: true,
      data: enrichedWithdrawals,
    });
  } catch (error) {
    console.error('❌ Get Withdrawals Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
};

/**
 * POST /api/v1/admin/payouts/withdrawals/:id/approve
 * Admin approves a withdrawal request
 * Admin only
 */
export const approveWithdrawalController = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user?.id;

    if (!id || !adminId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters',
      });
    }

    console.log(`✅ Approving withdrawal: ${id}`);

    // Fetch withdrawal request
    const { data: withdrawal, error: fetchError } = await supabase
      .from('withdrawals')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !withdrawal) {
      console.error('❌ Withdrawal not found:', id);
      return res.status(404).json({
        success: false,
        error: 'Withdrawal request not found',
      });
    }

    if (withdrawal.status !== 'pending') {
      console.warn('❌ Withdrawal is not pending:', withdrawal.status);
      return res.status(400).json({
        success: false,
        error: 'Invalid status',
        message: `Withdrawal is already ${withdrawal.status}`,
      });
    }

    // Update withdrawal status to processing (admin approved it)
    const { error: updateError } = await supabase
      .from('withdrawals')
      .update({
        status: 'processing',
        processed_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      console.error('❌ Failed to update withdrawal:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Failed to approve withdrawal',
        message: updateError.message,
      });
    }

    // Log action
    await supabase.from('payout_logs').insert({
      withdrawal_request_id: id,
      admin_id: adminId,
      action: 'approved',
      note: 'Withdrawal approved by admin',
    });

    console.log(`✅ Withdrawal approved: ${id}`);

    return res.status(200).json({
      success: true,
      message: 'Withdrawal approved successfully',
    });
  } catch (error) {
    console.error('❌ Approve Withdrawal Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
};

/**
 * POST /api/v1/admin/payouts/withdrawals/:id/reject
 * Admin rejects a withdrawal request and refunds organizer
 * Admin only
 */
export const rejectWithdrawalController = async (req, res) => {
  try {
    const { id } = req.params;
    const { admin_note } = req.body;
    const adminId = req.user?.id;

    if (!id || !adminId || !admin_note) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters',
        message: 'admin_note is required',
      });
    }

    console.log(`❌ Rejecting withdrawal: ${id}`);

    // Fetch withdrawal request
    const { data: withdrawal, error: fetchError } = await supabase
      .from('withdrawals')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !withdrawal) {
      console.error('❌ Withdrawal not found:', id);
      return res.status(404).json({
        success: false,
        error: 'Withdrawal request not found',
      });
    }

    if (withdrawal.status !== 'pending') {
      console.warn('❌ Withdrawal is not pending:', withdrawal.status);
      return res.status(400).json({
        success: false,
        error: 'Invalid status',
        message: `Withdrawal is already ${withdrawal.status}`,
      });
    }

    // Update withdrawal status to failed
    const { error: updateError } = await supabase
      .from('withdrawals')
      .update({
        status: 'failed',
        processed_at: new Date().toISOString(),
        failure_reason: admin_note,
      })
      .eq('id', id);

    if (updateError) {
      console.error('❌ Failed to update withdrawal:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Failed to reject withdrawal',
        message: updateError.message,
      });
    }

    // Refund organizer wallet
    console.log(`💰 Refunding ₦${withdrawal.amount} to organizer ${withdrawal.organizer_id}`);
    const { error: refundError } = await supabase.rpc('reject_withdrawal_refund', {
      org_id: withdrawal.organizer_id,
      amount: withdrawal.amount,
    });

    if (refundError) {
      console.error('❌ Failed to refund wallet:', refundError);
      return res.status(500).json({
        success: false,
        error: 'Failed to refund wallet',
        message: refundError.message,
      });
    }

    // Log action
    await supabase.from('payout_logs').insert({
      withdrawal_request_id: id,
      admin_id: adminId,
      action: 'rejected',
      note: `Rejected: ${admin_note}`,
    });

    console.log(`✅ Withdrawal rejected and refunded: ${id}`);

    return res.status(200).json({
      success: true,
      message: 'Withdrawal rejected and balance refunded',
    });
  } catch (error) {
    console.error('❌ Reject Withdrawal Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
};

/**
 * POST /api/v1/admin/payouts/withdrawals/:id/pay
 * Admin triggers payout via Squadco Transfer API
 * Admin only
 */
export const payWithdrawalController = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user?.id;

    if (!id || !adminId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters',
      });
    }

    console.log(`💳 Processing payout: ${id}`);

    // Fetch withdrawal request
    const { data: withdrawal, error: fetchError } = await supabase
      .from('withdrawals')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !withdrawal) {
      console.error('❌ Withdrawal not found:', id);
      return res.status(404).json({
        success: false,
        error: 'Withdrawal request not found',
      });
    }

    if (withdrawal.status !== 'processing') {
      console.warn('❌ Withdrawal is not processing:', withdrawal.status);
      return res.status(400).json({
        success: false,
        error: 'Invalid status',
        message: `Withdrawal must be in processing status before payment. Current status: ${withdrawal.status}`,
      });
    }

    // Get bank code
    let bankCode;
    try {
      bankCode = validateAndGetBankCode(withdrawal.bank_name);
    } catch (bankError) {
      console.error('❌ Bank code error:', bankError.message);
      return res.status(400).json({
        success: false,
        error: 'Bank not recognized',
        message: bankError.message,
      });
    }

    // Call Squadco Transfer API
    console.log(`📤 Calling Squadco Transfer API for ₦${withdrawal.amount}...`);

    const squadcoUrl = process.env.SQUADCO_API_URL || 'https://sandbox-api-d.squadco.com';
    const transferReference = `PAY_${Date.now()}_${withdrawal.id}`;

    let squadcoResponse;
    try {
      squadcoResponse = await axios.post(
        `${squadcoUrl}/payout/initiate`,
        {
          transaction_reference: transferReference,
          amount: Math.round(withdrawal.amount * 100), // Convert to kobo
          bank_code: bankCode,
          account_number: withdrawal.bank_account_number,
          account_name: withdrawal.account_name,
          currency: 'NGN',
          narration: `Ticketa payout - ${withdrawal.account_name}`,
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.SQUADCO_API_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      console.log('✅ Squadco Transfer API response:', {
        status: squadcoResponse.status,
        reference: squadcoResponse.data?.transaction_reference,
      });
    } catch (squadcoError) {
      console.error('❌ Squadco Transfer API error:', {
        status: squadcoError.response?.status,
        message: squadcoError.response?.data?.message || squadcoError.message,
      });

      return res.status(502).json({
        success: false,
        error: 'Payment gateway error',
        message: squadcoError.response?.data?.message || 'Failed to process payout with Squadco',
      });
    }

    // Update withdrawal status to completed
    const { error: updateError } = await supabase
      .from('withdrawals')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        payment_reference: squadcoResponse.data?.transaction_reference || transferReference,
      })
      .eq('id', id);

    if (updateError) {
      console.error('❌ Failed to update withdrawal status:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Failed to update withdrawal status',
        message: updateError.message,
      });
    }

    // Complete withdrawal in wallet
    console.log(`✅ Completing withdrawal in wallet...`);
    const { error: completeError } = await supabase.rpc('complete_withdrawal', {
      org_id: withdrawal.organizer_id,
      amount: withdrawal.amount,
    });

    if (completeError) {
      console.error('❌ Failed to complete withdrawal:', completeError);
      return res.status(500).json({
        success: false,
        error: 'Failed to complete withdrawal',
        message: completeError.message,
      });
    }

    // Log action
    await supabase.from('payout_logs').insert({
      withdrawal_request_id: id,
      admin_id: adminId,
      action: 'paid',
      note: `Paid via Squadco: ${squadcoResponse.data?.transaction_reference || transferReference}`,
    });

    console.log(`✅ Payout completed: ${id}`);

    return res.status(200).json({
      success: true,
      message: 'Payment sent successfully',
      data: {
        squadco_reference: squadcoResponse.data?.transaction_reference || transferReference,
      },
    });
  } catch (error) {
    console.error('❌ Pay Withdrawal Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
};

/**
 * GET /api/v1/admin/payouts/organizers/recent
 * Fetch recently registered organizers (last 30 days)
 * Admin only
 */
export const getRecentOrganizersController = async (req, res) => {
  try {
    console.log('👥 Fetching recently registered organizers...');

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: organizers, error } = await supabase
      .from('users')
      .select(`
        id,
        full_name,
        email,
        created_at,
        wallets (
          available_balance,
          total_earned
        )
      `)
      .eq('role', 'organizer')
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('❌ Failed to fetch organizers:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch organizers',
        message: error.message,
      });
    }

    const enriched = (organizers || []).map((org) => {
      const wallet = org.wallets?.[0];
      console.log(`📊 Organizer ${org.full_name}: wallet=${wallet ? 'found' : 'not found'}, balance=${wallet?.available_balance || 0}, earned=${wallet?.total_earned || 0}`);
      
      return {
        id: org.id,
        name: org.full_name,
        email: org.email,
        created_at: org.created_at,
        available_balance: wallet?.available_balance || 0,
        total_earned: wallet?.total_earned || 0,
      };
    });

    console.log(`✅ Fetched ${enriched.length} recent organizers`);

    return res.status(200).json({
      success: true,
      data: enriched,
    });
  } catch (error) {
    console.error('❌ Get Recent Organizers Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
};

/**
 * GET /api/v1/admin/payouts/tickets/recent
 * Fetch recent ticket purchases
 * Admin only
 */
export const getRecentTicketsController = async (req, res) => {
  try {
    console.log('🎫 Fetching recent ticket purchases...');

    const { data: transactions, error } = await supabase
      .from('transactions')
      .select(`
        id,
        reference,
        buyer_email,
        buyer_name,
        total_amount,
        organizer_earnings,
        platform_commission,
        created_at,
        events (
          title
        ),
        organizer_id
      `)
      .eq('status', 'success')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('❌ Failed to fetch transactions:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch transactions',
        message: error.message,
      });
    }

    // Get unique organizer IDs
    const organizerIds = [...new Set((transactions || []).map(t => t.organizer_id).filter(Boolean))];

    // Batch fetch organizer names
    let organizerMap = {};
    if (organizerIds.length > 0) {
      const { data: organizers, error: orgError } = await supabase
        .from('users')
        .select('id, full_name')
        .in('id', organizerIds);

      if (orgError) {
        console.error('⚠️ Failed to fetch organizer names:', orgError);
      } else {
        organizerMap = (organizers || []).reduce((acc, org) => {
          acc[org.id] = org.full_name;
          return acc;
        }, {});
      }
    }

    // Enrich transactions with organizer names
    const enriched = (transactions || []).map((t) => ({
      id: t.id,
      reference: t.reference,
      buyer_email: t.buyer_email,
      buyer_name: t.buyer_name,
      event_title: t.events?.title || 'Unknown Event',
      organizer_name: organizerMap[t.organizer_id] || 'Unknown',
      total_amount: t.total_amount,
      organizer_earnings: t.organizer_earnings,
      platform_commission: t.platform_commission,
      created_at: t.created_at,
    }));

    console.log(`✅ Fetched ${enriched.length} recent transactions`);

    return res.status(200).json({
      success: true,
      data: enriched,
    });
  } catch (error) {
    console.error('❌ Get Recent Tickets Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
};
