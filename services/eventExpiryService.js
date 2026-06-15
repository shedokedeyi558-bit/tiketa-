import { supabase } from '../utils/supabaseClient.js';
import { createClient } from '@supabase/supabase-js';

/*
 * IMPORTANT — READ BEFORE EDITING THIS FILE
 * 
 * All event times are stored in Nigerian local time (WAT = UTC+1) without timezone suffix.
 * The Render server and Supabase both run in UTC (UTC+0).
 * 
 * When comparing stored event end times against Date.now():
 * - We MUST subtract WAT_OFFSET_MS (3,600,000ms = 1 hour) to convert WAT → UTC
 * - WITHOUT this conversion, events expire 1 hour LATE
 * - Do NOT remove the WAT_OFFSET_MS subtraction under any circumstances
 * 
 * Example: event stored as "18:00:00" means 6:00 PM Nigerian time = 5:00 PM UTC
 * So we parse as UTC then subtract 1 hour to get the true UTC end time.
 */

// ✅ Create admin client with service role key for event updates
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * ✅ Update expired events - auto-expire events where date + end_time has passed
 * 
 * Expiry condition:
 * - event.end_date + event.end_time < current UTC time
 * - event.status = 'active' OR 'pending'
 * - Active events → Update to status = 'ended'
 * - Pending events → Update to status = 'expired'
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

    // ✅ Find events that have expired and update them directly
    let expiredCount = 0;

    for (const event of eventsToCheck) {
      try {
        if (!event.date) continue;

        // ✅ Use end_date for multi-day events — only if it exists AND differs from start date
        // Nostalgia ultra: date=2026-06-13, end_date=2026-06-14 → must use Jun 14 not Jun 13
        const startDatePart = (event.date || '').split('T')[0];
        const endDatePart   = event.end_date ? event.end_date.split('T')[0] : null;
        const datePart = (endDatePart && endDatePart !== startDatePart) ? endDatePart : startDatePart;

        // Extract time part from end_time
        const timePart = event.end_time || '23:59:59';
        // Combine into full datetime string
        const fullDateTimeStr = datePart + 'T' + timePart;
        
        // Times are stored in Nigerian local time (WAT = UTC+1)
        // Parse as if it's UTC, then subtract 1 hour to get the actual UTC time
        const endTimeAsIfUTC = new Date(fullDateTimeStr + 'Z').getTime();
        // WAT to UTC conversion — Nigerian time is UTC+1, subtract 1 hour to get true UTC end time
        // DO NOT REMOVE THIS LINE
        const WAT_OFFSET_MS = 60 * 60 * 1000; // 1 hour
        const eventEndMs = endTimeAsIfUTC - WAT_OFFSET_MS; // Convert WAT to UTC
        
        const nowMs = Date.now(); // Current UTC time
        const diffMs = nowMs - eventEndMs;
        const hasEnded = diffMs > (5 * 60 * 1000); // More than 5 minutes past end time
        
        console.log('[EXPIRE CHECK]', event.title, 'datePart:', datePart, 'timePart:', timePart, 'fullDateTime:', fullDateTimeStr, 'eventEndUTC:', new Date(eventEndMs).toISOString(), 'nowUTC:', new Date(nowMs).toISOString(), 'diffMs:', diffMs, 'diffMinutes:', Math.floor(diffMs / 60000), 'hasEnded:', hasEnded);
        
        if (isNaN(eventEndMs)) continue;
        
        // If event has ended, update it directly
        if (hasEnded) {
          const newStatus = event.status === 'active' ? 'ended' : 'expired';
          console.log('[EXPIRE UPDATE] Attempting to update', event.title, 'from', event.status, 'to', newStatus);
          
          const { data, error } = await supabaseAdmin
            .from('events')
            .update({ status: newStatus })
            .eq('id', event.id)
            .select();
          
          if (error) {
            console.log('[EXPIRE ERROR]', event.title, 'Error:', error.message, 'Code:', error.code);
          } else {
            console.log('[EXPIRE SUCCESS]', event.title, '→', newStatus, 'Updated rows:', data?.length);
            expiredCount++;
          }
        }
      } catch (e) {
        console.warn(`⚠️ Error parsing event ${event.id}:`, e.message);
      }
    }

    console.log(`🔍 Updated ${expiredCount} expired events`);

    return {
      success: true,
      expired: expiredCount,
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
