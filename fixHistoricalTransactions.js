import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Fix historical transactions where platform_commission was calculated incorrectly
 * 
 * CORRECT: platform_commission = ticket_price * 0.03
 * WRONG: platform_commission = total_amount * 0.03 (includes ₦100 processing fee)
 */
async function fixHistoricalTransactions() {
  try {
    console.log('🔧 Starting historical transaction fix...\n');

    // Fetch all transactions
    const { data: transactions, error: fetchError } = await supabaseAdmin
      .from('transactions')
      .select('id, ticket_price, processing_fee, total_amount, platform_commission, organizer_earnings, status');

    if (fetchError) {
      console.error('❌ Error fetching transactions:', fetchError);
      return;
    }

    console.log(`📊 Found ${transactions?.length || 0} transactions\n`);

    if (!transactions || transactions.length === 0) {
      console.log('✅ No transactions to fix');
      return;
    }

    let fixedCount = 0;
    let alreadyCorrectCount = 0;

    for (const tx of transactions) {
      // Calculate what the correct values should be
      const correctPlatformCommission = (tx.ticket_price * 3) / 100; // 3% of ticket_price only
      const correctOrganizerEarnings = tx.ticket_price - correctPlatformCommission;

      // Check if current values are incorrect (with small tolerance for rounding)
      const commissionDiff = Math.abs(tx.platform_commission - correctPlatformCommission);
      const earningsDiff = Math.abs(tx.organizer_earnings - correctOrganizerEarnings);

      if (commissionDiff > 0.01 || earningsDiff > 0.01) {
        console.log(`🔄 Fixing transaction ${tx.id}:`);
        console.log(`   Ticket Price: ₦${tx.ticket_price}`);
        console.log(`   OLD Commission: ₦${tx.platform_commission} → NEW: ₦${correctPlatformCommission.toFixed(2)}`);
        console.log(`   OLD Earnings: ₦${tx.organizer_earnings} → NEW: ₦${correctOrganizerEarnings.toFixed(2)}\n`);

        // Update the transaction
        const { error: updateError } = await supabaseAdmin
          .from('transactions')
          .update({
            platform_commission: correctPlatformCommission,
            organizer_earnings: correctOrganizerEarnings,
            updated_at: new Date().toISOString(),
          })
          .eq('id', tx.id);

        if (updateError) {
          console.error(`❌ Error updating transaction ${tx.id}:`, updateError);
        } else {
          fixedCount++;
        }
      } else {
        alreadyCorrectCount++;
      }
    }

    console.log('\n📊 Summary:');
    console.log(`   Total transactions: ${transactions.length}`);
    console.log(`   Fixed: ${fixedCount}`);
    console.log(`   Already correct: ${alreadyCorrectCount}`);
    console.log('\n✅ Historical transaction fix completed!');

  } catch (error) {
    console.error('❌ Error in fixHistoricalTransactions:', error);
  }
}

// Run the fix
fixHistoricalTransactions();
