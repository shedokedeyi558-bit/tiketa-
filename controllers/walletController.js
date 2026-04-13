import { supabase } from '../utils/supabaseClient.js';
import { logAudit } from '../services/auditService.js';

/**
 * Get organizer wallet balance
 */
export const getWalletBalance = async (req, res) => {
  try {
    const organizerId = req.user?.id;

    if (!organizerId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { data: wallet, error } = await supabase
      .from('wallets')
      .select('*')
      .eq('organizer_id', organizerId)
      .single();

    if (error && error.code !== 'PGRST116') {
      return res.status(500).json({ error: 'Failed to fetch wallet' });
    }

    // Return default wallet if not found
    const defaultWallet = {
      organizer_id: organizerId,
      available_balance: 0,
      pending_balance: 0,
      total_earned: 0,
    };

    res.json({
      success: true,
      wallet: wallet || defaultWallet,
    });
  } catch (error) {
    console.error('Get wallet error:', error);
    res.status(500).json({ error: 'Failed to get wallet' });
  }
};

/**
 * Get wallet transaction history
 */
export const getWalletHistory = async (req, res) => {
  try {
    const organizerId = req.user?.id;
    const { limit = 50, offset = 0 } = req.query;

    if (!organizerId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { data: transactions, error, count } = await supabase
      .from('wallet_transactions')
      .select('*', { count: 'exact' })
      .eq('organizer_id', organizerId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch history' });
    }

    res.json({
      success: true,
      transactions,
      total: count,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Get wallet history error:', error);
    res.status(500).json({ error: 'Failed to get wallet history' });
  }
};

/**
 * Request withdrawal
 * STRICT: Validate KYC, check balance, create withdrawal record
 */
export const requestWithdrawal = async (req, res) => {
  try {
    const organizerId = req.user?.id;
    const { amount } = req.body;

    if (!organizerId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid withdrawal amount' });
    }

    // Fetch organizer profile
    const { data: organizer, error: orgError } = await supabase
      .from('users')
      .select('*')
      .eq('id', organizerId)
      .single();

    if (orgError || !organizer) {
      return res.status(404).json({ error: 'Organizer not found' });
    }

    // Check KYC verification
    if (!organizer.kyc_verified) {
      return res.status(400).json({
        error: 'KYC verification required before withdrawal',
      });
    }

    // Check bank details
    if (!organizer.bank_account_number || !organizer.bank_code) {
      return res.status(400).json({
        error: 'Bank details required for withdrawal',
      });
    }

    // Fetch wallet
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('*')
      .eq('organizer_id', organizerId)
      .single();

    if (walletError || !wallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    // Check available balance
    if (parseFloat(wallet.available_balance) < parseFloat(amount)) {
      return res.status(400).json({
        error: 'Insufficient balance',
        available: wallet.available_balance,
      });
    }

    // Generate withdrawal reference
    const reference = `WTH_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create withdrawal record
    const { data: withdrawal, error: withdrawalError } = await supabase
      .from('withdrawals')
      .insert([
        {
          organizer_id: organizerId,
          wallet_id: wallet.id,
          amount,
          status: 'pending',
          bank_account_number: organizer.bank_account_number,
          bank_code: organizer.bank_code,
          reference,
        },
      ])
      .select()
      .single();

    if (withdrawalError) {
      return res.status(500).json({ error: 'Failed to create withdrawal' });
    }

    // Deduct from available balance, add to pending
    const newAvailable = parseFloat(wallet.available_balance) - parseFloat(amount);
    const newPending = parseFloat(wallet.pending_balance) + parseFloat(amount);

    await supabase
      .from('wallets')
      .update({
        available_balance: newAvailable,
        pending_balance: newPending,
      })
      .eq('id', wallet.id);

    // Record wallet transaction
    await supabase
      .from('wallet_transactions')
      .insert([
        {
          wallet_id: wallet.id,
          organizer_id: organizerId,
          type: 'withdrawal',
          amount: -amount,
          reference_id: withdrawal.id,
          reference_type: 'withdrawal',
          description: `Withdrawal request: ${reference}`,
          balance_before: wallet.available_balance,
          balance_after: newAvailable,
        },
      ]);

    // Log audit
    await logAudit({
      action: 'WITHDRAWAL_REQUESTED',
      entity_type: 'withdrawal',
      entity_id: withdrawal.id,
      user_id: organizerId,
      changes: { amount, status: 'pending' },
    });

    res.json({
      success: true,
      message: 'Withdrawal request created',
      withdrawal,
    });
  } catch (error) {
    console.error('Request withdrawal error:', error);
    res.status(500).json({ error: 'Failed to request withdrawal' });
  }
};

/**
 * Get withdrawal history
 */
export const getWithdrawals = async (req, res) => {
  try {
    const organizerId = req.user?.id;
    const { limit = 50, offset = 0 } = req.query;

    if (!organizerId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { data: withdrawals, error, count } = await supabase
      .from('withdrawals')
      .select('*', { count: 'exact' })
      .eq('organizer_id', organizerId)
      .order('requested_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch withdrawals' });
    }

    res.json({
      success: true,
      withdrawals,
      total: count,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Get withdrawals error:', error);
    res.status(500).json({ error: 'Failed to get withdrawals' });
  }
};

/**
 * Get earnings summary
 */
export const getEarningsSummary = async (req, res) => {
  try {
    const organizerId = req.user?.id;

    if (!organizerId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get wallet
    const { data: wallet } = await supabase
      .from('wallets')
      .select('*')
      .eq('organizer_id', organizerId)
      .single();

    // Get transaction count
    const { count: transactionCount } = await supabase
      .from('transactions')
      .select('*', { count: 'exact' })
      .eq('organizer_id', organizerId)
      .eq('status', 'success');

    // Get total earnings from transactions
    const { data: earnings } = await supabase
      .from('transactions')
      .select('organizer_earnings')
      .eq('organizer_id', organizerId)
      .eq('status', 'success');

    const totalEarnings = earnings?.reduce((sum, tx) => sum + parseFloat(tx.organizer_earnings), 0) || 0;

    // Get pending withdrawals
    const { data: pendingWithdrawals } = await supabase
      .from('withdrawals')
      .select('amount')
      .eq('organizer_id', organizerId)
      .eq('status', 'pending');

    const totalPending = pendingWithdrawals?.reduce((sum, w) => sum + parseFloat(w.amount), 0) || 0;

    res.json({
      success: true,
      summary: {
        total_earned: wallet?.total_earned || 0,
        available_balance: wallet?.available_balance || 0,
        pending_balance: wallet?.pending_balance || 0,
        pending_withdrawals: totalPending,
        transaction_count: transactionCount || 0,
      },
    });
  } catch (error) {
    console.error('Get earnings summary error:', error);
    res.status(500).json({ error: 'Failed to get earnings summary' });
  }
};
