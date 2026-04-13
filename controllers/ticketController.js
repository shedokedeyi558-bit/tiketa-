import { supabase } from '../utils/supabaseClient.js';

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
      return res.status(400).json({ error: error.message });
    }

    res.json({ success: true, ticket: data[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
      return res.status(404).json({ error: 'Ticket not found' });
    }

    res.json({ success: true, ticket: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
      return res.status(400).json({ error: error.message });
    }

    res.json({ success: true, ticket: data[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
