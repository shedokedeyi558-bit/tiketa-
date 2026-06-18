/**
 * Pending Transaction Cleanup Service
 *
 * Problem: When a buyer initiates payment but abandons (hits back, closes tab,
 * session times out), the transaction row stays as status='pending' forever.
 * This also prevents the reserve_tickets RPC from correctly holding seats for
 * in-progress checkouts, because the RPC only counts status='success' rows.
 *
 * Fix:
 *   1. This job marks stale pending transactions (older than PENDING_TTL_MS)
 *      as 'failed' so they no longer pollute availability checks.
 *   2. The reserve_tickets RPC (SQL) should also count recent pending rows
 *      as "held" seats — see migrations/create_reserve_tickets_rpc.sql.
 *
 * Runs every CLEANUP_INTERVAL_MS via setInterval in server.js.
 */

import { createClient } from '@supabase/supabase-js';

const PENDING_TTL_MS       = 15 * 60 * 1000; // 15 minutes — matches checkout timeout
const CLEANUP_INTERVAL_MS  = 5  * 60 * 1000; // run every 5 minutes

let _supabaseAdmin = null;
function getAdmin() {
  if (!_supabaseAdmin) {
    _supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return _supabaseAdmin;
}

/**
 * Expire pending transactions older than PENDING_TTL_MS.
 * Only touches rows that are still status='pending'.
 * Returns { expired: number, error: string|null }
 */
export async function expireStalePendingTransactions() {
  try {
    const supabaseAdmin = getAdmin();
    const cutoff = new Date(Date.now() - PENDING_TTL_MS).toISOString();

    const { data, error } = await supabaseAdmin
      .from('transactions')
      .update({ status: 'failed' })
      .eq('status', 'pending')
      .lt('created_at', cutoff)
      .select('id, reference');

    if (error) {
      console.error('[CLEANUP] Error expiring stale pending transactions:', error.message);
      return { expired: 0, error: error.message };
    }

    const count = data?.length ?? 0;
    if (count > 0) {
      console.log(`[CLEANUP] Expired ${count} stale pending transaction(s) older than 15 min`);
    }
    return { expired: count, error: null };
  } catch (err) {
    console.error('[CLEANUP] Unexpected error:', err.message);
    return { expired: 0, error: err.message };
  }
}

/**
 * Start the cleanup job. Call once from server.js after app.listen().
 */
export function startPendingCleanupJob() {
  console.log(`[CLEANUP] Pending transaction cleanup job started (every ${CLEANUP_INTERVAL_MS / 60000} min, TTL=${PENDING_TTL_MS / 60000} min)`);

  // Run once immediately on startup to clear any backlog
  expireStalePendingTransactions();

  // Then run on the interval
  setInterval(expireStalePendingTransactions, CLEANUP_INTERVAL_MS);
}
