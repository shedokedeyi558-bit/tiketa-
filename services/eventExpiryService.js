import { supabase } from '../utils/supabaseClient.js';
import { createClient } from '@supabase/supabase-js';

// ✅ Create admin client with service role key for event updates
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * ✅ Update expired events - auto-expire events where date + end_time has passed
 * 
 * Expiry condition:
 * - event.end_date + event.end_time < current Nigeria time (UTC+1)
 * - event.status = 'active' OR 'pending'
 * - Update to status = 'cancelled'
 * 
 * @returns {Promise<{success: boolean, expired: number, error: string|null}>}
 */
export const updateExpiredEvents = async () => {
  try {
    console.log('⏰ Checking for expired events...');

    // ✅ Use Date.now() for current UTC time (Vercel runs in UTC)
    const nowMs = Date.now();
    const BUFFER_MS = 5 * 60 * 1000; // 5 minute buffer to prevent edge cases

    // ✅ Fetch all active AND pending events
    const { data: eventsToCheck, error: fetchError } = await supabaseAdmin
      .from('events')
      .select('id, title, date, end_date, end_time, start_time, status')
      .in('status', ['active', 'pending']);

    if (fetchError) {
      console.error('❌ Error fetching events:', fetchError);
      return {
        success: false,
        expired: 0,
        error: fetchError.message,
      };
    }

    console.log(`📅 Found ${eventsToCheck?.length || 0} active/pending events`);

    if (!eventsToCheck || eventsToCheck.length === 0) {
      return {
        success: true,
        expired: 0,
        error: null,
      };
    }

    // ✅ Find events that have expired
    const expiredEventIds = [];

    for (const event of eventsToCheck) {
      try {
        // Use end_date if available, otherwise fall back to date
        const expiryDateStr = event.end_date || event.date;
        if (!expiryDateStr) continue;
        
        // Build full datetime string
        const timeStr = event.end_time || '23:59:59';
        const fullDateTimeStr = `${expiryDateStr.split('T')[0]}T${timeStr}`;
        
        // Force UTC parsing — append Z if no timezone info present
        const eventEndTimestamp = fullDateTimeStr.includes('Z') || fullDateTimeStr.includes('+') 
          ? fullDateTimeStr 
          : fullDateTimeStr + 'Z';
        
        const eventEndMs = new Date(eventEndTimestamp).getTime();
        
        if (isNaN(eventEndMs)) continue;
        
        // Safety check: skip if end time is before start time (invalid event data)
        if (event.start_time) {
          const startDateStr = event.date?.split('T')[0];
          const startFullStr = `${startDateStr}T${event.start_time}`;
          const startTimestamp = startFullStr.includes('Z') || startFullStr.includes('+')
            ? startFullStr
            : startFullStr + 'Z';
          const eventStartMs = new Date(startTimestamp).getTime();
          if (eventEndMs <= eventStartMs) continue; // skip invalid events
        }
        
        // Only expire if event ended more than 5 minutes ago
        const hasEnded = (nowMs - eventEndMs) > BUFFER_MS;
        
        if (hasEnded) {
          expiredEventIds.push(event.id);
          console.log(`⏰ Event expired: ${event.title} (${event.status}) - End: ${eventEndTimestamp}`);
        }
      } catch (e) {
        console.warn(`⚠️ Error parsing event ${event.id}:`, e.message);
      }
    }

    console.log(`🔍 Found ${expiredEventIds.length} expired events (active + pending)`);

    // ✅ Update expired events to 'cancelled' status (both active and pending)
    if (expiredEventIds.length > 0) {
      const { error: updateError } = await supabaseAdmin
        .from('events')
        .update({
          status: 'cancelled'
        })
        .in('id', expiredEventIds);

      if (updateError) {
        console.error('❌ Error updating expired events:', updateError);
        return {
          success: false,
          expired: 0,
          error: updateError.message,
        };
      }

      console.log(`✅ Updated ${expiredEventIds.length} events to 'cancelled' status`);
    }

    return {
      success: true,
      expired: expiredEventIds.length,
      error: null,
    };
  } catch (error) {
    console.error('❌ Error in updateExpiredEvents:', error);
    return {
      success: false,
      expired: 0,
      error: error.message,
    };
  }
};

/**
 * ✅ Delete event - only owner can delete, only if no tickets sold
 * 
 * @param {string} eventId - Event UUID
 * @param {string} userId - User UUID (organizer)
 * @returns {Promise<{success: boolean, message: string, error: string|null}>}
 */
export const deleteEventIfNoSales = async (eventId, userId) => {
  try {
    console.log('🗑️ Attempting to delete event:', { eventId, userId });

    // ✅ Fetch event to verify ownership
    const { data: event, error: fetchError } = await supabaseAdmin
      .from('events')
      .select('id, title, organizer_id, tickets_sold')
      .eq('id', eventId)
      .single();

    if (fetchError || !event) {
      console.error('❌ Event not found:', eventId);
      return {
        success: false,
        message: 'Event not found',
        error: 'Event does not exist',
      };
    }

    console.log('✅ Event found:', event.title);

    // ✅ Verify ownership
    if (event.organizer_id !== userId) {
      console.warn('❌ Unauthorized: User is not the event owner');
      return {
        success: false,
        message: 'Unauthorized',
        error: 'You can only delete your own events',
      };
    }

    console.log('✅ Ownership verified');

    // ✅ Check if tickets have been sold
    if (event.tickets_sold && event.tickets_sold > 0) {
      console.warn('❌ Cannot delete: Event has ticket sales');
      return {
        success: false,
        message: 'Cannot delete event with existing ticket sales',
        error: `This event has ${event.tickets_sold} ticket(s) sold and cannot be deleted`,
      };
    }

    console.log('✅ No ticket sales found, proceeding with deletion');

    // ✅ Double-check: Verify no transactions exist for this event
    const { data: transactions, error: txError } = await supabaseAdmin
      .from('transactions')
      .select('id')
      .eq('event_id', eventId)
      .limit(1);

    if (txError) {
      console.error('❌ Error checking transactions:', txError);
      return {
        success: false,
        message: 'Failed to verify event transactions',
        error: txError.message,
      };
    }

    if (transactions && transactions.length > 0) {
      console.warn('❌ Cannot delete: Transactions exist for this event');
      return {
        success: false,
        message: 'Cannot delete event with existing ticket sales',
        error: 'This event has ticket transactions and cannot be deleted',
      };
    }

    console.log('✅ No transactions found, safe to delete');

    // ✅ Delete the event
    const { error: deleteError } = await supabaseAdmin
      .from('events')
      .delete()
      .eq('id', eventId);

    if (deleteError) {
      console.error('❌ Error deleting event:', deleteError);
      return {
        success: false,
        message: 'Failed to delete event',
        error: deleteError.message,
      };
    }

    console.log('✅ Event deleted successfully:', eventId);

    return {
      success: true,
      message: 'Event deleted successfully',
      error: null,
    };
  } catch (error) {
    console.error('❌ Error in deleteEventIfNoSales:', error);
    return {
      success: false,
      message: 'Internal server error',
      error: error.message,
    };
  }
};
