import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://eouaddaofaevwkqnsmdw.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvdWFkZGFvZmFldndrcW5zbWR3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzQ4MTI4MywiZXhwIjoyMDg5MDU3MjgzfQ.jOBaIb2iI1sEi9Xx_i85pwjG3FjKIcPXIx6IXRxtCp4';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkTransactionColumns() {
  try {
    console.log('🔍 Checking transaction table columns...\n');
    
    // Fetch one transaction with all columns
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('❌ Error:', error);
      return;
    }
    
    if (data.length === 0) {
      console.log('❌ No transactions found');
      return;
    }
    
    const transaction = data[0];
    console.log('✅ Transaction columns and values:\n');
    
    Object.keys(transaction).forEach(key => {
      const value = transaction[key];
      const displayValue = value === null ? 'NULL' : 
                          typeof value === 'object' ? JSON.stringify(value) : 
                          String(value).substring(0, 50);
      console.log(`  ${key}: ${displayValue}`);
    });
    
    // Check for buyer-related fields
    console.log('\n📊 Buyer-related fields:');
    const buyerFields = Object.keys(transaction).filter(k => 
      k.toLowerCase().includes('buyer') || 
      k.toLowerCase().includes('name') ||
      k.toLowerCase().includes('email') ||
      k.toLowerCase().includes('user')
    );
    
    if (buyerFields.length === 0) {
      console.log('  ❌ No buyer-related fields found');
    } else {
      buyerFields.forEach(field => {
        console.log(`  ✅ ${field}: ${transaction[field] || 'NULL'}`);
      });
    }
    
  } catch (err) {
    console.error('❌ Exception:', err.message);
  }
}

checkTransactionColumns();
