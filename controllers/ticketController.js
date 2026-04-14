import { supabase } from '../utils/supabaseClient.js';
import { successResponse, errorResponse, createdResponse, notFoundResponse } from '../utils/responseFormatter.js';

// Anonymous ticket purchase (no auth required)
export const createTicket = async (req, res) => {
  try {
    const { eventId, ticketType, buyerEmail, buyerName, quantity, price, paymentReference } = req.body;

    const { data, error } = await supabase
      .from('tickets')
      .insert([
        {
          event_id: eventId,
          ticket_type: ticketType,
          buyer_email: buyerEmail,
          buyer_name: buyerName,
          quantity,
          price,
          payment_reference: paymentReference,
          payment_status: 'pending',
        },
      ])
      .select();

    if (error) {
      return errorResponse(res, error, 'Failed to create ticket', 400);
    }

    return createdResponse(res, data[0], 'Ticket created successfully');
  } catch (error) {
    return errorResponse(res, error, 'Failed to create ticket', 500);
  }
};

// Get ticket by reference (for anonymous users)
export const getTicketByReference = async (req, res) => {
  try {
    const { reference } = req.params;

    const { data, error } = await supabase
      .from('tickets')
      .select('*')
      .eq('payment_reference', reference)
      .single();

    if (error) {
      return notFoundResponse(res, 'Ticket not found');
    }

    return successResponse(res, data, 'Ticket fetched successfully');
  } catch (error) {
    return errorResponse(res, error, 'Failed to fetch ticket', 500);
  }
};

// Update ticket payment status
export const updateTicketPaymentStatus = async (req, res) => {
  try {
    const { reference, status } = req.body;

    const { data, error } = await supabase
      .from('tickets')
      .update({ payment_status: status })
      .eq('payment_reference', reference)
      .select();

    if (error) {
      return errorResponse(res, error, 'Failed to update ticket', 400);
    }

    return successResponse(res, data[0], 'Ticket updated successfully');
  } catch (error) {
    return errorResponse(res, error, 'Failed to update ticket', 500);
  }
};
