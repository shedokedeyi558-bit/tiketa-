import axios from 'axios';
import { supabase } from '../utils/supabaseClient.js';
import { createClient } from '@supabase/supabase-js';
import { validateAndGetBankCode } from '../utils/bankCodes.js';

// ✅ Explicit service-role client — bypasses RLS on all payout queries
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * GET /api/v1/admin/payouts/withdrawals
 * Fetch all withdrawal requests with organizer info and bank details
 * Admin only
 */
export const getWithdrawalsController = async (req, res) => {
  try {
    // Use supabaseAdmin (service role) to bypass any RLS on withdrawals table
    const { data: withdrawals, error } = await supabaseAdmin
      .from('withdrawals')
      .select('id, organizer_id, amount, status, bank_name, bank_account_number, account_name, bank_code, reference, requested_at, processed_at, completed_at, payment_reference, failure_reason')
      .order('requested_at', { ascending: false });

    if (error) {
      console.error('❌ Failed to fetch withdrawals:', error.message);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch withdrawals',
        message: error.message,
      });
    }

    console.log(`✅ Withdrawals fetched: ${withdrawals?.length || 0}`);

    // Fetch organizer profiles in one batch query
    const organizerIds = [...new Set((withdrawals || []).map(w => w.organizer_id).filter(Boolean))];
    let profileMap = {};
    if (organizerIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, email')
        .in('id', organizerIds);
      (profiles || []).forEach(p => { profileMap[p.id] = p; });
    }

    const enrichedWithdrawals = (withdrawals || []).map((w) => ({
      ...w,
      organizer_name:  profileMap[w.organizer_id]?.full_name || 'Unknown',
      organizer_email: profileMap[w.organizer_id]?.email    || 'Unknown',
      profiles: {
        name:  profileMap[w.organizer_id]?.full_name || 'Unknown',
        email: profileMap[w.organizer_id]?.email    || 'Unknown',
      },
    }));

    return res.status(200).json({
      success: true,
      data: enrichedWithdrawals,
    });
  } catch (error) {
    console.error('❌ Get Withdrawals Error:', error.message);
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

    console.log('🔍 Approve Withdrawal Request:', {
      withdrawalId: id,
      adminId,
      method: req.method,
      path: req.path,
      url: req.originalUrl,
      timestamp: new Date().toISOString(),
    });

    if (!id || !adminId) {
      console.error('❌ Missing required parameters:', { id, adminId });
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters',
        message: 'Withdrawal ID and admin ID are required',
      });
    }

    console.log(`📋 Fetching withdrawal: ${id}`);

    // Fetch withdrawal request
    const { data: withdrawal, error: fetchError } = await supabase
      .from('withdrawals')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) {
      console.error('❌ Withdrawal fetch error:', {
        message: fetchError.message,
        code: fetchError.code,
        details: fetchError.details,
        hint: fetchError.hint,
        withdrawalId: id,
      });
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch withdrawal',
        message: fetchError.message,
        details: fetchError.details,
      });
    }

    if (!withdrawal) {
      console.error('❌ Withdrawal not found:', id);
      return res.status(404).json({
        success: false,
        error: 'Withdrawal request not found',
        message: `No withdrawal found with ID: ${id}`,
      });
    }

    console.log('✅ Withdrawal found:', {
      id: withdrawal.id,
      status: withdrawal.status,
      amount: withdrawal.amount,
      organizer_id: withdrawal.organizer_id,
    });

    if (withdrawal.status !== 'pending') {
      console.warn('❌ Withdrawal is not pending:', {
        withdrawalId: id,
        currentStatus: withdrawal.status,
      });
      return res.status(400).json({
        success: false,
        error: 'Invalid status',
        message: `Withdrawal is already ${withdrawal.status}. Only pending withdrawals can be approved.`,
      });
    }

    console.log(`📝 Updating withdrawal status to 'processing'...`);

    // Update withdrawal status to processing (admin approved it)
    const { data: updatedWithdrawal, error: updateError } = await supabase
      .from('withdrawals')
      .update({
        status: 'processing',
        processed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Withdrawal update error:', {
        message: updateError.message,
        code: updateError.code,
        details: updateError.details,
        hint: updateError.hint,
        withdrawalId: id,
        stack: updateError.stack,
      });
      return res.status(500).json({
        success: false,
        error: 'Failed to approve withdrawal',
        message: updateError.message,
        details: updateError.details,
      });
    }

    if (!updatedWithdrawal) {
      console.error('❌ No data returned from update:', id);
      return res.status(500).json({
        success: false,
        error: 'Failed to approve withdrawal',
        message: 'No data returned from database update',
      });
    }

    console.log('✅ Withdrawal status updated:', {
      id: updatedWithdrawal.id,
      status: updatedWithdrawal.status,
      processed_at: updatedWithdrawal.processed_at,
    });

    console.log(`📝 Logging approval action...`);

    // Log action
    const { error: logError } = await supabase
      .from('payout_logs')
      .insert({
        withdrawal_request_id: id,
        admin_id: adminId,
        action: 'approved',
        note: 'Withdrawal approved by admin',
      });

    if (logError) {
      console.warn('⚠️ Failed to log approval action (non-blocking):', {
        message: logError.message,
        code: logError.code,
      });
      // Don't fail the approval if logging fails
    } else {
      console.log('✅ Approval action logged');
    }

    console.log(`✅ Withdrawal approved successfully: ${id}`);

    return res.status(200).json({
      success: true,
      message: 'Withdrawal approved successfully',
      data: {
        id: updatedWithdrawal.id,
        status: updatedWithdrawal.status,
        processed_at: updatedWithdrawal.processed_at,
      },
    });
  } catch (error) {
    console.error('❌ Approve Withdrawal Error:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      timestamp: new Date().toISOString(),
    });
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
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

    console.log('🔍 Reject Withdrawal Request:', {
      withdrawalId: id,
      adminId,
      admin_note,
      timestamp: new Date().toISOString(),
    });

    if (!id || !adminId || !admin_note) {
      console.error('❌ Missing required parameters:', { id, adminId, admin_note });
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters',
        message: 'Withdrawal ID, admin ID, and admin_note are required',
      });
    }

    console.log(`📋 Fetching withdrawal: ${id}`);

    // Fetch withdrawal request
    const { data: withdrawal, error: fetchError } = await supabase
      .from('withdrawals')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) {
      console.error('❌ Withdrawal fetch error:', {
        message: fetchError.message,
        code: fetchError.code,
        details: fetchError.details,
        withdrawalId: id,
      });
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch withdrawal',
        message: fetchError.message,
        details: fetchError.details,
      });
    }

    if (!withdrawal) {
      console.error('❌ Withdrawal not found:', id);
      return res.status(404).json({
        success: false,
        error: 'Withdrawal request not found',
        message: `No withdrawal found with ID: ${id}`,
      });
    }

    console.log('✅ Withdrawal found:', {
      id: withdrawal.id,
      status: withdrawal.status,
      amount: withdrawal.amount,
      organizer_id: withdrawal.organizer_id,
    });

    if (withdrawal.status !== 'pending') {
      console.warn('❌ Withdrawal is not pending:', {
        withdrawalId: id,
        currentStatus: withdrawal.status,
      });
      return res.status(400).json({
        success: false,
        error: 'Invalid status',
        message: `Withdrawal is already ${withdrawal.status}. Only pending withdrawals can be rejected.`,
      });
    }

    console.log(`📝 Updating withdrawal status to 'failed'...`);

    // Update withdrawal status to failed
    const { data: updatedWithdrawal, error: updateError } = await supabase
      .from('withdrawals')
      .update({
        status: 'failed',
        processed_at: new Date().toISOString(),
        failure_reason: admin_note,
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Withdrawal update error:', {
        message: updateError.message,
        code: updateError.code,
        details: updateError.details,
        withdrawalId: id,
      });
      return res.status(500).json({
        success: false,
        error: 'Failed to reject withdrawal',
        message: updateError.message,
        details: updateError.details,
      });
    }

    console.log('✅ Withdrawal status updated to failed:', {
      id: updatedWithdrawal.id,
      status: updatedWithdrawal.status,
    });

    // Refund organizer wallet — direct UPDATE instead of unreliable RPC
    console.log(`💰 Refunding ₦${withdrawal.amount} to organizer ${withdrawal.organizer_id}`);
    const { data: currentWallet, error: walletFetchErr } = await supabase
      .from('wallets')
      .select('available_balance, pending_balance')
      .eq('organizer_id', withdrawal.organizer_id)
      .single();

    if (walletFetchErr || !currentWallet) {
      console.error('❌ Failed to fetch wallet for refund:', walletFetchErr?.message);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch wallet for refund',
        message: walletFetchErr?.message || 'Wallet not found',
      });
    }

    const { error: refundError } = await supabase
      .from('wallets')
      .update({
        available_balance: (currentWallet.available_balance || 0) + withdrawal.amount,
        pending_balance:   Math.max(0, (currentWallet.pending_balance || 0) - withdrawal.amount),
      })
      .eq('organizer_id', withdrawal.organizer_id);

    if (refundError) {
      console.error('❌ Refund error:', refundError.message);
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

    console.log(`💳 Processing payout request:`, {
      withdrawalId: id,
      adminId,
      timestamp: new Date().toISOString(),
    });

    if (!id || !adminId) {
      console.error('❌ Missing required parameters:', { id, adminId });
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters',
        message: 'Withdrawal ID and admin ID are required',
      });
    }

    // Fetch withdrawal request
    const { data: withdrawal, error: fetchError } = await supabase
      .from('withdrawals')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !withdrawal) {
      console.error('❌ Withdrawal not found:', {
        id,
        error: fetchError?.message,
      });
      return res.status(404).json({
        success: false,
        error: 'Withdrawal request not found',
        message: fetchError?.message || 'No withdrawal found with this ID',
      });
    }

    console.log('✅ Withdrawal found:', {
      id: withdrawal.id,
      status: withdrawal.status,
      amount: withdrawal.amount,
      bank_name: withdrawal.bank_name,
      account_number: withdrawal.bank_account_number,
      account_name: withdrawal.account_name,
    });

    if (withdrawal.status !== 'processing') {
      console.warn('❌ Withdrawal is not processing:', withdrawal.status);
      return res.status(400).json({
        success: false,
        error: 'Invalid status',
        message: `Withdrawal must be in processing status before payment. Current status: ${withdrawal.status}`,
      });
    }

    // Get bank code — use stored value first, fall back to name lookup
    let bankCode;
    try {
      bankCode = withdrawal.bank_code || validateAndGetBankCode(withdrawal.bank_name);
      console.log(`✅ Bank code resolved:`, { bank_name: withdrawal.bank_name, bank_code: bankCode, source: withdrawal.bank_code ? 'stored' : 'lookup' });
    } catch (bankError) {
      console.error('❌ Bank code error:', {
        bank_name: withdrawal.bank_name,
        error: bankError.message,
      });
      return res.status(400).json({
        success: false,
        error: 'Bank not recognized',
        message: bankError.message,
      });
    }

    // Call Squadco Transfer API
    const squadcoUrl      = process.env.SQUADCO_API_URL || 'https://sandbox-api-d.squadco.com';
    const merchantId      = process.env.SQUAD_MERCHANT_ID || 'SBS3U9LRZR';
    const transferReference = `${merchantId}_${withdrawal.id}`;
    const amountInKobo    = Math.round(withdrawal.amount * 100);

    const squadcoPayload = {
      transaction_reference: transferReference,
      amount: String(amountInKobo),   // Squad requires amount as string in kobo
      bank_code: bankCode,
      account_number: withdrawal.bank_account_number,
      account_name: withdrawal.account_name,
      currency_id: 'NGN',
      remark: `Organizer payout - Ticketa`,
    };

    console.log(`📤 Calling Squadco Transfer API:`, {
      url: `${squadcoUrl}/payout/transfer`,
      payload: squadcoPayload,
      amount_ngn: withdrawal.amount,
      amount_kobo: amountInKobo,
    });

    let squadcoResponse;
    try {
      squadcoResponse = await axios.post(
        `${squadcoUrl}/payout/transfer`,
        squadcoPayload,
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
        data: squadcoResponse.data,
        reference: squadcoResponse.data?.transaction_reference,
      });
    } catch (squadcoError) {
      // ✅ Log exact error message
      const errorMessage = squadcoError.response?.data?.message || 
                          squadcoError.message || 
                          'Failed to process payout with Squadco';
      
      console.error('❌ Squadco Transfer API error:', {
        status: squadcoError.response?.status,
        statusText: squadcoError.response?.statusText,
        data: squadcoError.response?.data,
        message: squadcoError.message,
        url: squadcoError.config?.url,
        payload: squadcoError.config?.data,
        errorMessage: errorMessage,
      });

      // ✅ Always return proper JSON response - never let it crash
      return res.status(502).json({
        success: false,
        error: 'Payment gateway error',
        message: errorMessage,
        details: squadcoError.response?.data || { error: squadcoError.message },
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

    // Complete withdrawal in wallet — direct UPDATE instead of unreliable RPC
    console.log(`✅ Completing withdrawal in wallet...`);
    const { data: orgWallet, error: orgWalletErr } = await supabase
      .from('wallets')
      .select('pending_balance, total_withdrawn')
      .eq('organizer_id', withdrawal.organizer_id)
      .single();

    if (!orgWalletErr && orgWallet) {
      await supabase
        .from('wallets')
        .update({
          pending_balance: Math.max(0, (orgWallet.pending_balance || 0) - withdrawal.amount),
          total_withdrawn: (orgWallet.total_withdrawn || 0) + withdrawal.amount,
        })
        .eq('organizer_id', withdrawal.organizer_id);
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
        amount: withdrawal.amount,
        account_number: withdrawal.bank_account_number,
        bank_name: withdrawal.bank_name,
      },
    });
  } catch (error) {
    // ✅ Catch any unhandled errors and return proper JSON response
    console.error('❌ Pay Withdrawal Error:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
    
    // ✅ Always return valid JSON - never crash without responding
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message || 'An unexpected error occurred during payout processing',
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
      .from('profiles')
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
        .from('profiles')
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

/**
 * POST /api/v1/admin/withdrawals/:id/approve-and-pay
 * Atomically approves a pending withdrawal AND triggers the Squadco transfer in one step.
 * Admin only.
 */
export const approveAndPayController = async (req, res) => {
  const { id } = req.params;
  const adminId = req.user?.id;

  try {
    // 1. Fetch the withdrawal
    const { data: withdrawal, error: fetchErr } = await supabase
      .from('withdrawals')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !withdrawal) {
      return res.status(404).json({ success: false, error: 'Withdrawal not found' });
    }

    // 2. Must be pending
    if (withdrawal.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'Invalid status',
        message: `Withdrawal is already ${withdrawal.status}. Only pending withdrawals can be processed.`,
      });
    }

    // 3. Resolve bank code
    let bankCode;
    try {
      bankCode = withdrawal.bank_code || validateAndGetBankCode(withdrawal.bank_name);
    } catch (bankErr) {
      return res.status(400).json({ success: false, error: 'Bank not recognised', message: bankErr.message });
    }

    // 4. Call Squadco Transfer API
    const squadcoUrl    = process.env.SQUADCO_API_URL || 'https://sandbox-api-d.squadco.com';
    const merchantId    = process.env.SQUAD_MERCHANT_ID || 'SBS3U9LRZR';
    const transferReference = `${merchantId}_${id}`;
    const amountInKobo  = Math.round(withdrawal.amount * 100);

    const payload = {
      transaction_reference: transferReference,
      amount:                String(amountInKobo),  // Squad requires amount as string in kobo
      bank_code:             bankCode,
      account_number:        withdrawal.bank_account_number,
      account_name:          withdrawal.account_name,
      currency_id:           'NGN',
      remark:                `Organizer payout - Ticketa`,
    };

    console.log('[APPROVE-AND-PAY] Calling Squadco:', { url: `${squadcoUrl}/payout/transfer`, payload });

    let squadcoResponse;
    try {
      squadcoResponse = await axios.post(
        `${squadcoUrl}/payout/transfer`,
        payload,
        {
          headers: { Authorization: `Bearer ${process.env.SQUADCO_API_KEY}`, 'Content-Type': 'application/json' },
          timeout: 30000,
        }
      );
      console.log('[APPROVE-AND-PAY] Squadco response:', squadcoResponse.data);
    } catch (squadcoErr) {
      const errMsg = squadcoErr.response?.data?.message || squadcoErr.message || 'Transfer failed';
      console.error('[APPROVE-AND-PAY] Squadco error:', squadcoErr.response?.data || squadcoErr.message);
      // Leave withdrawal as 'pending' so admin can retry
      return res.status(400).json({ success: false, message: errMsg, details: squadcoErr.response?.data });
    }

    // 5. Transfer succeeded — mark as paid
    const squadRef = squadcoResponse.data?.transaction_reference || transferReference;

    const { error: updateErr } = await supabase
      .from('withdrawals')
      .update({ status: 'paid', completed_at: new Date().toISOString(), payment_reference: squadRef })
      .eq('id', id);

    if (updateErr) {
      console.error('[APPROVE-AND-PAY] Failed to update withdrawal:', updateErr.message);
      // Transfer already sent — log the error but return success so admin knows money went out
      console.error('[APPROVE-AND-PAY] CRITICAL: Transfer sent but DB update failed. Manual fix needed for withdrawal', id);
    }

    // 6. Update wallet: deduct pending_balance, add to total_withdrawn
    const { data: orgWallet } = await supabase
      .from('wallets').select('pending_balance, total_withdrawn').eq('organizer_id', withdrawal.organizer_id).single();
    if (orgWallet) {
      await supabase.from('wallets').update({
        pending_balance: Math.max(0, (orgWallet.pending_balance || 0) - withdrawal.amount),
        total_withdrawn: (orgWallet.total_withdrawn || 0) + withdrawal.amount,
      }).eq('organizer_id', withdrawal.organizer_id);
    }

    // 7. Log the action
    await supabase.from('payout_logs').insert({
      withdrawal_request_id: id,
      admin_id: adminId,
      action: 'paid',
      note: `Approve-and-pay via Squadco: ${squadRef}`,
    }).catch(e => console.warn('[APPROVE-AND-PAY] Log write failed (non-blocking):', e.message));

    console.log(`[APPROVE-AND-PAY] ✅ Complete: withdrawal ${id}, squadco_ref ${squadRef}`);

    return res.status(200).json({
      success: true,
      message: 'Transfer initiated successfully. Funds are on their way.',
      data: {
        squadco_reference: squadRef,
        amount:            withdrawal.amount,
        account_number:    withdrawal.bank_account_number,
        bank_name:         withdrawal.bank_name,
        account_name:      withdrawal.account_name,
      },
    });
  } catch (err) {
    console.error('[APPROVE-AND-PAY] Unhandled error:', err.message);
    return res.status(500).json({ success: false, error: 'Internal server error', message: err.message });
  }
};
