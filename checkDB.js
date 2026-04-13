const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function checkEvents() {
  const { data, error } = await supabase.from('events').select('id, title, status');
  if (error) {
    console.error('Error fetching events:', error);
    process.exit(1);
  }
  console.log('Events in DB:', JSON.stringify(data, null, 2));
  if (data.length === 0) {
    console.log('DB is empty. Seeding a test event...');
    // I don't have an organizer_id, need to find one
    const { data: users } = await supabase.from('users').select('id').limit(1);
    if (users && users.length > 0) {
      const { data: newEvent, error: insertError } = await supabase.from('events').insert([
        {
          organizer_id: users[0].id,
          title: 'Test Event',
          description: 'A test event for checkout verification',
          location: 'Lagos, Nigeria',
          date: new Date(Date.now() + 86400000).toISOString(),
          ticket_price: 1000,
          total_tickets: 100,
          tickets_sold: 0,
          status: 'active'
        }
      ]).select();
      if (insertError) console.error('Error seeding:', insertError);
      else console.log('Seeded event:', JSON.stringify(newEvent, null, 2));
    } else {
      console.log('No users found in DB to assign as organizer.');
    }
  }
}

checkEvents();
