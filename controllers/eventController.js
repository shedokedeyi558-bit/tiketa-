import { supabase } from '../utils/supabaseClient.js';

// Get organizer's upcoming events
export const getOrganizerEvents = async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString();
    console.log('Getting events for organizer:', userId);

    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('organizer_id', userId)
      .eq('status', 'active')
      .gte('date', today)
      .order('date', { ascending: true });

    if (error) {
      console.error('Events fetch error:', error);
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }

    console.log('Events found:', data?.length ?? 0);

    return res.json({
      success: true,
      message: 'Events fetched successfully',
      data: data ?? [],
    });
  } catch (err) {
    console.error('getOrganizerEvents error:', err);
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

// Get all events
export const getAllEvents = async (req, res) => {
  try {
    // TODO: Fetch from database
    res.status(200).json({
      success: true,
      message: 'Events fetched successfully',
      data: [],
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get event by ID
export const getEventById = async (req, res) => {
  try {
    const { id } = req.params;
    // TODO: Fetch from database
    res.status(200).json({
      success: true,
      message: 'Event fetched successfully',
      data: {},
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Create event
export const createEvent = async (req, res) => {
  try {
    const { title, description, date, location, price } = req.body;
    // TODO: Save to database
    res.status(201).json({
      success: true,
      message: 'Event created successfully',
      data: {},
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update event
export const updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    // TODO: Update in database
    res.status(200).json({
      success: true,
      message: 'Event updated successfully',
      data: {},
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete event
export const deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id; // Assuming auth middleware sets req.user

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Event ID is required',
      });
    }

    // 🔑 CRITICAL: Check for existing transactions before deleting
    console.log('🔍 Checking for transactions linked to event:', id);
    
    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('id')
      .eq('event_id', id)
      .limit(1);

    if (txError) {
      console.error('❌ Error checking transactions:', txError);
      return res.status(500).json({
        success: false,
        error: 'Failed to check event transactions',
        message: txError.message,
      });
    }

    // 🔑 CRITICAL: If transactions exist, prevent deletion
    if (transactions && transactions.length > 0) {
      console.warn('⚠️ Cannot delete event with existing transactions:', id);
      return res.status(409).json({
        success: false,
        error: 'Cannot delete event with existing ticket purchases',
        message: 'This event has ticket purchases and cannot be deleted. You can archive or cancel the event instead.',
        code: 'EVENT_HAS_TRANSACTIONS',
      });
    }

    console.log('✅ No transactions found, proceeding with deletion');

    // Only delete if no transactions exist
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', id)
      .eq('organizer_id', userId);

    if (error) {
      console.error('❌ Error deleting event:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to delete event',
        message: error.message,
      });
    }

    console.log('✅ Event deleted successfully:', id);
    return res.status(200).json({
      success: true,
      message: 'Event deleted successfully',
    });
  } catch (error) {
    console.error('❌ Delete Event Controller Error:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });

    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
};
