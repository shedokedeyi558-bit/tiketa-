import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function checkEvents() {
  const { data, error } = await supabase.from('events').select('id, title, status').limit(5);
  if (error) {
    console.error('Error:', error);
    return;
  }
  console.log('EVENT_LIST:', JSON.stringify(data));
  
  if (data.length === 0) {
    console.log('NO_EVENTS_FOUND');
    // Find a user to be organizer
    const { data: users } = await supabase.from('profiles').select('id').limit(1);
    if (users?.length > 0) {
      const { data: newEvent, error: insErr } = await supabase.from('events').insert([{
        organizer_id: users[0].id,
        title: 'Test Event 1',
        description: 'Test description',
        location: 'Test Location',
        date: new Date(Date.now() + 86400000).toISOString(),
        ticket_price: 1000,
        total_tickets: 100,
        status: 'active'
      }]).select();
      console.log('SEEDED:', JSON.stringify(newEvent));
    }
  }
}

checkEvents();
