import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';

/**
 * Generate unique ticket number
 * Format: TKT_TIMESTAMP_RANDOM
 */
export const generateTicket = () => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9).toUpperCase();
  return `TKT_${timestamp}_${random}`;
};

/**
 * Generate QR code for ticket
 * Returns base64 encoded QR code image
 */
export const generateQRCode = async (ticketNumber) => {
  try {
    // Generate QR code as data URL
    const qrCode = await QRCode.toDataURL(ticketNumber, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      quality: 0.95,
      margin: 1,
      width: 300,
    });

    return qrCode;
  } catch (error) {
    console.error('QR code generation error:', error);
    throw error;
  }
};

/**
 * Validate ticket
 * Check if ticket exists and is valid
 */
export const validateTicket = async (supabase, ticketNumber) => {
  try {
    const { data: ticket, error } = await supabase
      .from('tickets')
      .select('*')
      .eq('ticket_number', ticketNumber)
      .single();

    if (error || !ticket) {
      return {
        valid: false,
        error: 'Ticket not found',
      };
    }

    if (ticket.status === 'used') {
      return {
        valid: false,
        error: 'Ticket already used',
        ticket,
      };
    }

    if (ticket.status === 'cancelled') {
      return {
        valid: false,
        error: 'Ticket cancelled',
        ticket,
      };
    }

    return {
      valid: true,
      ticket,
    };
  } catch (error) {
    console.error('Ticket validation error:', error);
    return {
      valid: false,
      error: 'Validation failed',
    };
  }
};

/**
 * Mark ticket as used
 */
export const markTicketAsUsed = async (supabase, ticketNumber) => {
  try {
    const { data: ticket, error } = await supabase
      .from('tickets')
      .update({
        status: 'used',
        used_at: new Date().toISOString(),
      })
      .eq('ticket_number', ticketNumber)
      .select()
      .single();

    if (error) {
      return {
        success: false,
        error: 'Failed to mark ticket as used',
      };
    }

    return {
      success: true,
      ticket,
    };
  } catch (error) {
    console.error('Mark ticket as used error:', error);
    return {
      success: false,
      error: 'Failed to mark ticket as used',
    };
  }
};

/**
 * Get ticket details
 */
export const getTicketDetails = async (supabase, ticketNumber) => {
  try {
    const { data: ticket, error } = await supabase
      .from('tickets')
      .select(`
        *,
        event:events(*),
        transaction:transactions(*)
      `)
      .eq('ticket_number', ticketNumber)
      .single();

    if (error || !ticket) {
      return {
        success: false,
        error: 'Ticket not found',
      };
    }

    return {
      success: true,
      ticket,
    };
  } catch (error) {
    console.error('Get ticket details error:', error);
    return {
      success: false,
      error: 'Failed to get ticket details',
    };
  }
};
