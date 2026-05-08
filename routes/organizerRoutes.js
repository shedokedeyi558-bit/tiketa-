import express from 'express';
import { verifyToken } from '../middlewares/authMiddleware.js';
import { deleteEventIfNoSales } from '../services/eventExpiryService.js';

const router = express.Router();

/**
 * DELETE /api/v1/organizer/events/:id
 * Delete organizer event - only owner can delete, only if no tickets sold
 */
router.delete('/events/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const organizerId = req.user.id;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Event ID is required',
        message: 'Event ID is required'
      });
    }

    if (!organizerId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'You must be logged in to delete an event'
      });
    }

    console.log('🗑️ Organizer attempting to delete event:', { eventId: id, organizerId });

    // Check event exists and belongs to this organizer
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: event, error: fetchError } = await supabase
      .from('events')
      .select('id, title, organizer_id, tickets_sold')
      .eq('id', id)
      .eq('organizer_id', organizerId)
      .single();

    if (fetchError || !event) {
      console.error('❌ Event not found or access denied:', fetchError?.message);
      return res.status(404).json({
        success: false,
        error: 'Event not found',
        message: 'Event not found or access denied'
      });
    }

    console.log('✅ Event found:', event.title);

    // Check no transactions exist
    const { data: transactions } = await supabase
      .from('transactions')
      .select('id')
      .eq('event_id', id)
      .limit(1);

    if (transactions && transactions.length > 0) {
      console.warn('❌ Cannot delete: Event has transactions');
      return res.status(400).json({
        success: false,
        error: 'Cannot delete event with existing ticket sales',
        message: 'Cannot delete event with existing ticket sales'
      });
    }

    console.log('✅ No transactions found, proceeding with deletion');

    // Delete the event
    const { error: deleteError } = await supabase
      .from('events')
      .delete()
      .eq('id', id)
      .eq('organizer_id', organizerId);

    if (deleteError) {
      console.error('❌ Error deleting event:', deleteError);
      return res.status(500).json({
        success: false,
        error: 'Failed to delete event',
        message: deleteError.message
      });
    }

    console.log('✅ Event deleted successfully:', id);

    return res.status(200).json({
      success: true,
      message: 'Event deleted successfully'
    });
  } catch (err) {
    console.error('❌ Delete event error:', err);
    return res.status(500).json({
      success: false,
      error: 'Server error',
      message: 'Internal server error'
    });
  }
});

export default router;