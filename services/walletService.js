import { supabase } from '../utils/supabaseClient.js';

/**
 * Credit organizer wallet after successful payment
 * Uses RPC function to avoid race conditions
 */
export async function creditOrganizerWallet(organizerId, amount) {
  try {
    if (!organizerId || !amount || amount <= 0) {
      console.error('❌ Invalid wallet credit params:', { organizerId, amount });
      return { success: false, error: 'Invalid parameters' };
    }

    console.log(`⏳ Crediting wallet: ₦${amount} to organizer ${organizerId}`);

    const { error } = await supabase.rpc('credit_organizer_wallet', {
      org_id: organizerId,
      amount: parseFloat(amount),
    });

    if (error) {
      console.error('❌ Wallet credit failed:', error);
      return { success: false, error: error.message };
    }

    console.log(`✅ Wallet credited: ₦${amount} to organizer ${organizerId}`);
    return { success: true };
  } catch (err) {
    console.error('❌ Wallet credit error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Get organizer wallet details
 */
export async function getOrganizerWallet(organizerId) {
  try {
    const { data, error } = await supabase
      .from('wallets')
      .select('*')
      .eq('organizer_id', organizerId)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows found, which is expected for new organizers
      console.error('❌ Failed to fetch wallet:', error);
      return { success: false, error: error.message };
    }

    return { success: true, wallet: data };
  } catch (err) {
    console.error('❌ Wallet fetch error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Create wallet for new organizer
 */
export async function createOrganizerWallet(organizerId) {
  try {
    if (!organizerId) {
      console.error('❌ Invalid organizer ID');
      return { success: false, error: 'Invalid organizer ID' };
    }

    console.log(`⏳ Creating wallet for organizer ${organizerId}`);

    const { data, error } = await supabase
      .from('wallets')
      .insert({
        organizer_id: organizerId,
        available_balance: 0,
        pending_balance: 0,
        total_earned: 0,
        total_withdrawn: 0,
      })
      .select()
      .single();

    if (error) {
      // If wallet already exists, that's fine
      if (error.code === '23505') {
        console.log(`ℹ️ Wallet already exists for organizer ${organizerId}`);
        return { success: true, wallet: null };
      }
      console.error('❌ Wallet creation failed:', error);
      return { success: false, error: error.message };
    }

    console.log(`✅ Wallet created for organizer ${organizerId}`);
    return { success: true, wallet: data };
  } catch (err) {
    console.error('❌ Wallet creation error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Create withdrawal request
 */
export async function createWithdrawalRequest(organizerId, withdrawalData) {
  try {
    const { amount, bankName, accountNumber, accountName } = withdrawalData;

    if (!organizerId || !amount || !bankName || !accountNumber || !accountName) {
      console.error('❌ Invalid withdrawal request params');
      return { success: false, error: 'Missing required fields' };
    }

    console.log(`⏳ Creating withdrawal request: ₦${amount} from organizer ${organizerId}`);

    // Fetch organizer's wallet ID
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('id')
      .eq('organizer_id', organizerId)
      .single();

    if (walletError || !wallet) {
      console.error('❌ Wallet not found for organizer:', organizerId);
      return { success: false, error: 'Wallet not found' };
    }

    // Get bank code from bank name
    const bankCode = getBankCode(bankName);

    const { data, error } = await supabase
      .from('withdrawals')
      .insert({
        organizer_id: organizerId,
        wallet_id: wallet.id,
        amount: parseFloat(amount),
        bank_name: bankName,
        bank_account_number: accountNumber,
        bank_code: bankCode,
        account_name: accountName,
        reference: `WDR_${Date.now()}_${organizerId.slice(0, 8)}`,
        status: 'pending',
        requested_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Withdrawal request creation failed:', error);
      return { success: false, error: error.message };
    }

    console.log(`✅ Withdrawal request created: ${data.id}`);
    return { success: true, request: data };
  } catch (err) {
    console.error('❌ Withdrawal request creation error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Get bank code from bank name
 */
function getBankCode(bankName) {
  // Simple mapping - in production, use the bankCodes utility
  const bankMap = {
    'First Bank': '011',
    'GTBank': '058',
    'Access Bank': '044',
    'Zenith Bank': '057',
    'UBA': '033',
    'FCMB': '214',
    'Stanbic': '221',
    'Fidelity': '070',
  };
  return bankMap[bankName] || '999';
}

/**
 * Get withdrawal requests for organizer
 */
export async function getOrganizerWithdrawals(organizerId) {
  try {
    const { data, error } = await supabase
      .from('withdrawals')
      .select('*')
      .eq('organizer_id', organizerId)
      .order('requested_at', { ascending: false });

    if (error) {
      console.error('❌ Failed to fetch withdrawals:', error);
      return { success: false, error: error.message };
    }

    return { success: true, withdrawals: data };
  } catch (err) {
    console.error('❌ Withdrawal fetch error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Get all pending withdrawal requests (admin only)
 */
export async function getPendingWithdrawals() {
  try {
    const { data, error } = await supabase
      .from('withdrawals')
      .select('*, organizer_id')
      .eq('status', 'pending')
      .order('requested_at', { ascending: true });

    if (error) {
      console.error('❌ Failed to fetch pending withdrawals:', error);
      return { success: false, error: error.message };
    }

    return { success: true, withdrawals: data };
  } catch (err) {
    console.error('❌ Pending withdrawal fetch error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Log payout action (admin only)
 */
export async function logPayoutAction(withdrawalRequestId, adminId, action, note) {
  try {
    const { error } = await supabase
      .from('payout_logs')
      .insert({
        withdrawal_request_id: withdrawalRequestId,
        admin_id: adminId,
        action,
        note,
      });

    if (error) {
      console.error('❌ Failed to log payout action:', error);
      return { success: false, error: error.message };
    }

    console.log(`✅ Payout action logged: ${action} for request ${withdrawalRequestId}`);
    return { success: true };
  } catch (err) {
    console.error('❌ Payout log error:', err);
    return { success: false, error: err.message };
  }
}
