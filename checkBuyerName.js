import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://eouaddaofaevwkqnsmdw.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvdWFkZGFvZmFldndrcW5zbWR3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzQ4MTI4MywiZXhwIjoyMDg5MDU3MjgzfQ.jOBaIb2iI1sEi9Xx_i85pwjG3FjKIcPXIx6IXRxtCp4';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkBuyerName() {
  try {
    console.log('🔍 Checking transaction buyer name fields...\n');
    
    // Run the SQL query
    console.log('SQL Query:');
    console.log('SELECT id, buyer_name, buyer_email, user_id, metadata FROM transactions LIMIT 3;\n');
    
    const { data, error } = await supabase
      .from('transactions')
      .select('id, buyer_name, buyer_email, user_id, metadata');
    
    if (error) {
      console.error('❌ Error:', error);
      return;
    }
    
    console.log(`✅ Found ${data.length} transactions:\n`);
    
    // Show all transactions
    data.forEach((row, idx) => {
      console.log(`${idx + 1}. ID: ${row.id.substring(0, 8)}...`);
      console.log(`   buyer_name: ${row.buyer_name || 'NULL'}`);
      console.log(`   buyer_email: ${row.buyer_email || 'NULL'}`);
      console.log(`   user_id: ${row.user_id || 'NULL'}`);
      console.log(`   metadata: ${row.metadata ? JSON.stringify(row.metadata) : 'NULL'}`);
      console.log();
    });
    
    // Check which fields have data
    console.log('📊 Field Analysis:');
    const hasBuyerName = data.some(t => t.buyer_name);
    const hasBuyerEmail = data.some(t => t.buyer_email);
    const hasUserId = data.some(t => t.user_id);
    const hasMetadata = data.some(t => t.metadata);
    
    console.log(`  buyer_name populated: ${hasBuyerName ? '✅ YES' : '❌ NO'}`);
    console.log(`  buyer_email populated: ${hasBuyerEmail ? '✅ YES' : '❌ NO'}`);
    console.log(`  user_id populated: ${hasUserId ? '✅ YES' : '❌ NO'}`);
    console.log(`  metadata populated: ${hasMetadata ? '✅ YES' : '❌ NO'}`);
    
    // Check for NULL values
    console.log('\n📊 NULL Value Analysis:');
    const nullBuyerName = data.filter(t => !t.buyer_name).length;
    const nullBuyerEmail = data.filter(t => !t.buyer_email).length;
    const nullUserId = data.filter(t => !t.user_id).length;
    
    console.log(`  buyer_name NULL: ${nullBuyerName}/${data.length}`);
    console.log(`  buyer_email NULL: ${nullBuyerEmail}/${data.length}`);
    console.log(`  user_id NULL: ${nullUserId}/${data.length}`);
    
    // Recommendation
    console.log('\n💡 Recommendation:');
    if (hasBuyerName && !nullBuyerName) {
      console.log('  ✅ Use buyer_name (all transactions have it)');
    } else if (hasBuyerEmail && !nullBuyerEmail) {
      console.log('  ✅ Use buyer_email (all transactions have it)');
    } else if (hasUserId && !nullUserId) {
      console.log('  ✅ Use user_id to lookup from profiles table');
    } else {
      console.log('  ⚠️ Mixed approach needed:');
      if (hasBuyerName) console.log('    - Try buyer_name first');
      if (hasBuyerEmail) console.log('    - Fall back to buyer_email');
      if (hasUserId) console.log('    - Fall back to profiles table lookup');
    }
    
  } catch (err) {
    console.error('❌ Exception:', err.message);
  }
}

checkBuyerName();
