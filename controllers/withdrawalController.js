import { supabase } from '../utils/supabaseClient.js';
import {
  getOrganizerWallet,
  createWithdrawalRequest,
  getOrganizerWithdrawals,
} from '../services/walletService.js';

/**
 * GET /api/v1/withdrawals/wallet
 * Returns the authenticated organizer's wallet balance
 * Auth required: organizer role only
 */
export const getWalletController = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'User not authenticated',
      });
    }

    console.log(`📊 Fetching wallet for organizer: ${userId}`);

    const result = await getOrganizerWallet(userId);

    if (!result.success) {
      console.error('❌ Failed to fetch wallet:', result.error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch wallet',
        message: result.error,
      });
    }

    // If wallet doesn't exist, return zeros
    const wallet = result.wallet || {
      available_balance: 0,
      pending_balance: 0,
      total_earned: 0,
      total_withdrawn: 0,
    };

    console.log(`✅ Wallet fetched:`, wallet);

    return res.status(200).json({
      success: true,
      data: {
        available_balance: wallet.available_balance || 0,
        pending_balance: wallet.pending_balance || 0,
        total_earned: wallet.total_earned || 0,
        total_withdrawn: wallet.total_withdrawn || 0,
      },
    });
  } catch (error) {
    console.error('❌ Get Wallet Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
};

/**
 * POST /api/v1/withdrawals/request
 * Organizer submits a withdrawal request
 * Auth required: organizer role only
 * 
 * Request body:
 * {
 *   "amount": 5000,
 *   "bank_name": "First Bank",
 *   "account_number": "1234567890",
 *   "account_name": "John Doe"
 * }
 */
export const createWithdrawalRequestController = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { amount, bank_name, account_number, account_name, bank_code } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'User not authenticated',
      });
    }

    console.log('📝 Creating withdrawal request...');

    const WITHDRAWAL_FEE = 100; // ₦100 flat fee per withdrawal

    // ✅ RULE 1: Validate minimum amount (₦5,000) and that fee leaves something to send
    if (!amount || amount < 5000) {
      console.warn('❌ Minimum withdrawal amount not met:', amount);
      return res.status(400).json({
        success: false,
        error: 'Invalid amount',
        message: 'Minimum withdrawal amount is ₦5,000',
      });
    }

    const amountToSend = amount - WITHDRAWAL_FEE; // what actually reaches the bank

    if (amountToSend <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid amount',
        message: 'Requested amount must be greater than the ₦100 withdrawal fee',
      });
    }

    // ✅ RULE 2: Check sufficient balance — calculate dynamically from transactions
    // (same logic as organizer stats endpoint — wallet table may be stale)
    const { createClient: createClientForBalance } = await import('@supabase/supabase-js');
    const supabaseForBalance = createClientForBalance(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: txRows } = await supabaseForBalance
      .from('transactions')
      .select('organizer_earnings')
      .eq('organizer_id', userId)
      .eq('status', 'success');

    const totalEarned = (txRows || []).reduce((sum, t) => sum + Number(t.organizer_earnings || 0), 0);

    const { data: withdrawalRows } = await supabaseForBalance
      .from('withdrawals')
      .select('amount, status')
      .eq('organizer_id', userId)
      .in('status', ['pending', 'approved', 'paid']);

    const totalWithdrawn = (withdrawalRows || []).reduce((sum, w) => sum + Number(w.amount || 0), 0);
    const dynamicAvailableBalance = totalEarned - totalWithdrawn;

    console.log('💰 Balance check: available=₦%s requested=₦%s', dynamicAvailableBalance, amount);

    if (dynamicAvailableBalance < amount) {
      console.warn('❌ Insufficient balance:', { requested: amount, available: dynamicAvailableBalance });
      return res.status(400).json({
        success: false,
        error: 'Insufficient balance',
        message: `Insufficient balance. Available: ₦${dynamicAvailableBalance.toLocaleString('en-NG')}`,
      });
    }

    // Also fetch wallet for the deduction step below
    const walletResult = await getOrganizerWallet(userId);
    const wallet = walletResult.wallet;

    // ✅ RULE 3: Check withdrawal days (Monday–Friday WAT only)
    // WAT = UTC+1
    const nowWAT = new Date(Date.now() + 60 * 60 * 1000);
    const dayOfWeek = nowWAT.getUTCDay(); // 0=Sun, 1=Mon, 5=Fri, 6=Sat

    if (dayOfWeek === 0 || dayOfWeek === 6) {
      console.warn('❌ Withdrawal attempted on weekend:', {
        dayOfWeek,
        date: nowWAT.toISOString(),
      });
      return res.status(400).json({
        success: false,
        error: 'Weekend withdrawal',
        message: 'Withdrawals are only processed Monday to Friday. Please try again on a weekday.',
      });
    }

    // ✅ RULE 4: Check for duplicate pending request
    const withdrawalsResult = await getOrganizerWithdrawals(userId);
    if (withdrawalsResult.success && withdrawalsResult.withdrawals) {
      const hasPending = withdrawalsResult.withdrawals.some(
        (w) => w.status === 'pending'
      );

      if (hasPending) {
        console.warn('❌ Organizer already has pending withdrawal:', userId);
        return res.status(400).json({
          success: false,
          error: 'Pending withdrawal exists',
          message: 'You already have a pending withdrawal request. Please wait for it to be processed.',
        });
      }
    }

    // ✅ Deduct from wallet — use dynamic balance to avoid stale value issues
    const { error: updateError } = await supabase
      .from('wallets')
      .update({
        available_balance: Math.max(0, dynamicAvailableBalance - amount),
        pending_balance: ((wallet?.pending_balance || 0) + amount),
        last_updated: new Date().toISOString(),
      })
      .eq('organizer_id', userId);

    if (updateError) {
      console.error('❌ Failed to update wallet balance:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Failed to update wallet',
        message: updateError.message,
      });
    }

    console.log(`✅ Wallet balance updated`);

    // ✅ Create withdrawal request
    const requestResult = await createWithdrawalRequest(userId, {
      amount,                    // full requested amount — leaves wallet
      amountToSend,              // amount_received: what reaches the bank after ₦100 fee
      withdrawalFee: WITHDRAWAL_FEE,
      bankName: bank_name,
      accountNumber: account_number,
      accountName: account_name,
      bankCode: bank_code || null,
    });

    if (!requestResult.success) {
      console.error('❌ Failed to create withdrawal request:', requestResult.error);
      // Rollback wallet update
      await supabase
        .from('wallets')
        .update({
          available_balance: wallet.available_balance,
          pending_balance: wallet.pending_balance,
          last_updated: new Date().toISOString(),
        })
        .eq('organizer_id', userId);

      return res.status(500).json({
        success: false,
        error: 'Failed to create withdrawal request',
        message: requestResult.error,
      });
    }

    // ✅ Persist bank details to profiles for auto-fill on next withdrawal
    // Fire-and-forget — don't block the response
    supabase
      .from('profiles')
      .update({
        bank_name:           bank_name        || null,
        bank_account_number: account_number   || null,
        account_name:        account_name     || null,
        bank_code:           bank_code        || null,
      })
      .eq('id', userId)
      .then(({ error }) => {
        if (error) console.warn('⚠️ Failed to save bank details to profile (non-blocking):', error.message);
        else console.log('✅ Bank details saved to profile for auto-fill');
      });

    console.log('✅ Withdrawal request created: %s', requestResult.request.id);

    return res.status(201).json({
      success: true,
      message: 'Withdrawal request submitted successfully',
      data: {
        request_id:      requestResult.request.id,
        amount:          requestResult.request.amount,           // full requested amount
        withdrawal_fee:  requestResult.request.withdrawal_fee,   // ₦100
        amount_received: requestResult.request.amount_received,  // what reaches bank
        status:          requestResult.request.status,
        requested_at:    requestResult.request.requested_at,
      },
    });
  } catch (error) {
    console.error('❌ Create Withdrawal Request Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
};

/**
 * GET /api/v1/withdrawals/history
 * Returns the organizer's withdrawal request history
 * Auth required: organizer role only
 */
export const getWithdrawalHistoryController = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'User not authenticated',
      });
    }

    console.log(`📋 Fetching withdrawal history for organizer: ${userId}`);

    const result = await getOrganizerWithdrawals(userId);

    if (!result.success) {
      console.error('❌ Failed to fetch withdrawal history:', result.error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch withdrawal history',
        message: result.error,
      });
    }

    console.log(`✅ Withdrawal history fetched:`, result.withdrawals?.length || 0);

    return res.status(200).json({
      success: true,
      data: result.withdrawals || [],
    });
  } catch (error) {
    console.error('❌ Get Withdrawal History Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
};
