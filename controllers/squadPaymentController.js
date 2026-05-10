import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../utils/supabaseClient.js';
import { initiateSquadPayment, verifySquadPayment } from '../services/squadPaymentService.js';
import { normalizeReference, logReference, isValidReferenceFormat } from '../utils/referenceNormalizer.js';
import { creditOrganizerWallet } from '../services/walletService.js';

/**
 * Initialize payment endpoint
 * POST /api/v1/payments/squad/initiate
 * 
 * Request body:
 * {
 *   "eventId": "event-uuid",
 *   "cartItems": [...],
 *   "attendees": [...],
 *   "buyerEmail": "user@example.com",
 *   "buyerName": "John Doe",
 *   "amount": 5000,
 *   "callbackUrl": "http://localhost:5001/api/v1/payments/squad/callback"
 * }
 */
export const initiatePaymentController = async (req, res) => {
  console.log('🚀 [SQUAD PAYMENT] Initiate payment handler called');
  console.log('📨 Request origin:', req.headers.origin);
  console.log('📨 Request method:', req.method);
  console.log('📨 Request body:', req.body);
  
  try {
    const { eventId, cartItems, attendees, buyerEmail, buyerName, amount, callbackUrl } = req.body;

    // 🔑 CRITICAL: Log incoming request
    console.log('📥 REQUEST BODY:', req.body);
    console.log('🎯 EVENT ID RECEIVED:', eventId);

    // 🔑 CRITICAL: Validate eventId is present
    if (!eventId) {
      console.error('❌ Missing eventId in request:', req.body);
      return res.status(400).json({
        success: false,
        error: 'eventId is required',
        message: 'Event ID is missing from request',
      });
    }

    // Validate required fields
    if (!amount || !buyerEmail || !callbackUrl) {
      console.error('❌ Missing required fields:', { amount, buyerEmail, callbackUrl });
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: amount, buyerEmail, callbackUrl',
      });
    }

    // Validate amount is a number
    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Amount must be a positive number (in Naira)',
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(buyerEmail)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email address',
      });
    }

    console.log('🔄 Payment Initiation Request:', {
      eventId,
      amount,
      buyerEmail,
      callbackUrl,
      timestamp: new Date().toISOString(),
    });

    // 🔑 CRITICAL: Verify event exists with timeout
    console.log('⏳ Step 1: Looking up event with ID:', eventId);
    
    // Create timeout promise
    const eventTimeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Supabase event lookup timed out after 5 seconds')), 5000)
    );
    
    // Race between Supabase query and timeout
    const { data: event, error: eventError } = await Promise.race([
      supabase
        .from('events')
        .select('id, title, organizer_id')
        .eq('id', eventId)
        .single(),
      eventTimeoutPromise
    ]);

    if (eventError || !event) {
      console.error('❌ Event not found:', eventError);
      return res.status(404).json({
        success: false,
        error: 'Event not found',
        message: 'The event you are trying to purchase tickets for does not exist',
      });
    }

    console.log('✅ Step 1 done - Event found:', { id: event.id, title: event.title });

    // 🔑 CRITICAL: Generate reference BEFORE calling Squad
    console.log('⏳ Step 2: Generating reference...');
    const reference = normalizeReference(`TXN_${Date.now()}_${uuidv4()}`);
    logReference('🧾 GENERATED REFERENCE', reference);

    // Validate reference format
    if (!isValidReferenceFormat(reference)) {
      console.error('❌ Invalid reference format:', reference);
      return res.status(500).json({
        success: false,
        error: 'Failed to generate valid reference',
      });
    }
    console.log('✅ Step 2 done - Reference generated');

    // 🔑 CRITICAL: Create transaction record in database BEFORE calling Squad
    console.log('⏳ Step 3: Creating transaction record in database...');
    
    // 🔑 CRITICAL: Extract ticket_price from cartItems
    const ticketPrice = cartItems?.[0]?.price ?? cartItems?.[0]?.ticket_price ?? 0;
    console.log('💰 TICKET PRICE EXTRACTED:', ticketPrice);
    
    // 🔑 CRITICAL: Calculate fees and commission
    const processingFee = 100; // ₦100 fixed processing fee
    const squadcoFee = (amount * 1.2) / 100; // 1.2% of total_amount
    const platformCommission = Math.round(ticketPrice * 0.03); // ✅ 3% of ticket_price ONLY
    const organizerEarnings = ticketPrice - platformCommission; // ✅ ticket_price - platform_commission
    
    console.log('💵 FEES CALCULATED:', {
      processingFee,
      squadcoFee: squadcoFee.toFixed(2),
      platformCommission,
      organizerEarnings,
      total: amount,
    });
    
    // Create timeout promise for transaction insert
    const txTimeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Supabase transaction insert timed out after 5 seconds')), 5000)
    );
    
    const { data: transaction, error: txError } = await Promise.race([
      supabase
        .from('transactions')
        .insert([
          {
            reference, // ✅ Already normalized
            event_id: eventId, // ✅ CRITICAL: Include event_id
            organizer_id: event.organizer_id, // ✅ Include organizer_id
            buyer_email: buyerEmail,
            buyer_name: buyerName || buyerEmail.split('@')[0],
            ticket_price: ticketPrice, // ✅ Unit price of ticket
            processing_fee: processingFee, // ✅ Fixed ₦100 fee
            total_amount: amount, // ✅ Total paid by buyer
            platform_commission: platformCommission, // ✅ 3% platform fee
            squadco_fee: squadcoFee, // ✅ 1.2% of total_amount
            organizer_earnings: organizerEarnings, // ✅ What organizer receives
            status: 'pending',
            squadco_response: { cartItems, attendees, amount, buyerEmail },
            ip_address: req.ip || 'unknown',
            user_agent: req.headers['user-agent'] || 'unknown',
          },
        ])
        .select()
        .single(),
      txTimeoutPromise
    ]);

    if (txError) {
      console.error('❌ Transaction creation error:', txError);
      return res.status(500).json({
        success: false,
        error: 'Failed to create transaction',
        message: txError.message,
      });
    }

    console.log('✅ Step 3 done - Transaction created in DB:', {
      id: transaction.id,
      reference: transaction.reference,
      event_id: transaction.event_id,
      status: transaction.status,
    });

    // Call Squad payment service
    console.log('⏳ Step 4: Calling Squad API with reference:', reference);
    const result = await initiateSquadPayment(amount, buyerEmail, callbackUrl, reference);

    if (!result.success) {
      console.error('❌ Squad payment initiation failed:', result.error);
      
      // Update transaction to failed
      try {
        console.log('⏳ Step 5: Marking transaction as failed...');
        await supabase
          .from('transactions')
          .update({ status: 'failed' })
          .eq('id', transaction.id);
        console.log('✅ Step 5 done - Transaction marked as failed in DB');
      } catch (updateErr) {
        console.error('⚠️ Failed to update transaction status:', updateErr);
      }

      return res.status(500).json({
        success: false,
        error: result.error,
        details: result.details,
      });
    }

    console.log('✅ Step 5 done - Squad payment initiated:', {
      reference: result.transactionRef,
      checkoutUrl: result.checkoutUrl,
    });

    // Return success response with reference
    return res.status(200).json({
      success: true,
      message: result.message,
      data: {
        reference, // 🔑 CRITICAL: Return the normalized reference
        checkoutUrl: result.checkoutUrl,
        transactionRef: result.transactionRef,
        amount: result.amountInNaira,
        amountInKobo: result.amount,
        email: result.email,
      },
    });
  } catch (error) {
    console.error('❌ Payment Initiation Controller Error:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });

    return res.status(500).json({
      success: false,
      error: 'Internal server error during payment initiation',
      message: error.message,
    });
  }
};

/**
 * Verify payment endpoint
 * POST /api/v1/payments/squad/verify
 * 
 * Request body:
 * {
 *   "reference": "TXN_1712577890123_..."
 * }
 */
export const verifyPaymentController = async (req, res) => {
  try {
    let { reference } = req.body;

    if (!reference) {
      return res.status(400).json({
        success: false,
        error: 'Transaction reference is required',
      });
    }

    // 🔑 CRITICAL: Log incoming reference with hidden character detection
    logReference('🔎 INCOMING REF', reference);

    // 🔑 CRITICAL: Normalize reference
    const normalizedReference = normalizeReference(reference);
    logReference('🧠 NORMALIZED REF', normalizedReference);

    console.log('🔄 Payment Verification Request:', {
      incomingReference: reference,
      normalizedReference,
      timestamp: new Date().toISOString(),
    });

    // Validate reference format
    if (!isValidReferenceFormat(normalizedReference)) {
      console.warn('⚠️ Invalid reference format:', normalizedReference);
      return res.status(400).json({
        success: false,
        error: 'Invalid reference format',
        message: 'Reference must start with TXN_ and be at least 20 characters',
      });
    }

    // 🔑 CRITICAL: Look up transaction in database with normalized reference
    console.log('🔎 LOOKING UP TRANSACTION WITH NORMALIZED REFERENCE:', normalizedReference);
    
    // Create timeout promise for transaction lookup
    const lookupTimeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Supabase transaction lookup timed out after 5 seconds')), 5000)
    );
    
    const { data: transaction, error: txError } = await Promise.race([
      supabase
        .from('transactions')
        .select('*')
        .eq('reference', normalizedReference)
        .maybeSingle(),
      lookupTimeoutPromise
    ]);

    if (txError) {
      console.error('❌ DB error:', txError);
      return res.status(500).json({
        success: false,
        error: 'Database error',
        message: txError.message,
      });
    }

    if (!transaction) {
      console.warn('⚠️ Transaction not found in database:', normalizedReference);
      
      // 🔑 FALLBACK: Try case-insensitive search
      console.log('🔄 Attempting case-insensitive fallback search...');
      
      // Create timeout promise for fallback search
      const fallbackTimeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Supabase fallback search timed out after 5 seconds')), 5000)
      );
      
      const { data: fallbackTransaction, error: fallbackError } = await Promise.race([
        supabase
          .from('transactions')
          .select('*')
          .ilike('reference', normalizedReference)
          .maybeSingle(),
        fallbackTimeoutPromise
      ]);

      if (fallbackError) {
        console.error('❌ Fallback search error:', fallbackError);
      }

      if (fallbackTransaction) {
        console.log('✅ Found via fallback search:', fallbackTransaction.reference);
        // Use the fallback transaction
        transaction = fallbackTransaction;
      } else {
        return res.status(404).json({
          success: false,
          error: 'Transaction not found',
          message: 'Transaction not found. Please try again in a moment.',
          debug: {
            searchedFor: normalizedReference,
            format: 'TXN_TIMESTAMP_UUID',
          },
        });
      }
    }

    console.log('✅ Transaction found in DB:', {
      id: transaction.id,
      reference: transaction.reference,
      status: transaction.status,
      dbRefNormalized: normalizeReference(transaction.reference),
      incomingRefNormalized: normalizedReference,
      match: normalizeReference(transaction.reference) === normalizedReference ? '✅ MATCH' : '❌ MISMATCH',
    });

    // Check if already verified
    if (transaction.status === 'success') {
      console.log('✅ Transaction already verified');
      return res.status(200).json({
        success: true,
        message: 'Payment already verified',
        data: {
          status: 'success',
          reference: transaction.reference,
          amount: transaction.total_amount,
          email: transaction.buyer_email,
          transaction: {
            id: transaction.id,
            reference: transaction.reference,
            buyer_email: transaction.buyer_email,
            buyer_name: transaction.buyer_name,
            total_amount: transaction.total_amount,
            ticket_price: transaction.ticket_price,
            processing_fee: transaction.processing_fee,
            platform_commission: transaction.platform_commission,
            organizer_earnings: transaction.organizer_earnings,
            status: transaction.status,
            created_at: transaction.created_at,
            verified_at: transaction.verified_at,
          },
        },
      });
    }

    if (transaction.status === 'failed') {
      console.log('❌ Transaction already marked as failed');
      return res.status(400).json({
        success: false,
        error: 'Payment failed',
        message: 'This payment has already been marked as failed',
      });
    }

    // 🔑 CRITICAL: Call Squad verification service with separate error handling
    console.log('🔄 Verifying with Squad API...');
    console.log('📤 Calling Squad API with reference:', normalizedReference);
    
    let result;
    try {
      result = await verifySquadPayment(normalizedReference);
      console.log('✅ Squad API call completed:', {
        success: result.success,
        error: result.error,
        status: result.status,
      });
    } catch (squadError) {
      console.error('❌ Squad API fetch failed:', {
        message: squadError.message,
        code: squadError.code,
        stack: squadError.stack,
        timestamp: new Date().toISOString(),
      });
      
      return res.status(502).json({
        success: false,
        error: 'Payment gateway error',
        message: `Failed to verify payment with Squad: ${squadError.message}`,
        details: {
          reference: normalizedReference,
          timestamp: new Date().toISOString(),
        },
      });
    }

    if (!result.success) {
      console.error('❌ Squad verification failed:', result.error);
      
      // Update transaction to failed
      try {
        await supabase
          .from('transactions')
          .update({ status: 'failed' })
          .eq('id', transaction.id);
        console.log('✅ Transaction marked as failed in DB');
      } catch (updateErr) {
        console.error('⚠️ Failed to update transaction status:', updateErr);
      }

      return res.status(400).json({
        success: false,
        error: result.error,
        details: result.details,
      });
    }

    console.log('✅ Squad verification successful:', {
      status: result.status,
      reference: result.reference,
      amount: result.amount,
    });

    // 🔑 CRITICAL: Update transaction to success with separate error handling
    console.log('📝 Updating transaction status to success...');
    
    // Create timeout promise for update
    const updateTimeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Supabase transaction update timed out after 5 seconds')), 5000)
    );
    
    let updateError;
    try {
      const { error: dbUpdateError } = await Promise.race([
        supabase
          .from('transactions')
          .update({
            status: 'success',
            squadco_response: result.rawData,
            verified_at: new Date().toISOString(),
          })
          .eq('id', transaction.id),
        updateTimeoutPromise
      ]);
      
      updateError = dbUpdateError;
      
      if (updateError) {
        console.error('❌ Database update error:', updateError);
      } else {
        console.log('✅ Transaction updated to success in DB');
      }
    } catch (dbError) {
      console.error('❌ Database operation failed:', {
        message: dbError.message,
        stack: dbError.stack,
        timestamp: new Date().toISOString(),
      });
      updateError = dbError;
    }

    if (updateError) {
      console.error('❌ Failed to update transaction status:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Failed to update transaction status',
        message: updateError.message,
      });
    }

    console.log('✅ Transaction updated to success');

    // 🔑 CRITICAL: Update event tickets_sold count
    console.log('🎫 Updating event tickets_sold count...');
    try {
      const { data: event, error: eventFetchError } = await supabase
        .from('events')
        .select('tickets_sold, total_tickets')
        .eq('id', transaction.event_id)
        .single();

      if (eventFetchError) {
        console.error('⚠️ Failed to fetch event:', eventFetchError);
      } else {
        const currentTicketsSold = event?.tickets_sold || 0;
        const ticketQuantity = transaction.quantity || 1; // Default to 1 if not specified
        const newTicketsSold = currentTicketsSold + ticketQuantity;

        console.log('📊 Ticket count update:', {
          event_id: transaction.event_id,
          current_tickets_sold: currentTicketsSold,
          quantity_purchased: ticketQuantity,
          new_tickets_sold: newTicketsSold,
          total_tickets: event?.total_tickets,
        });

        const { error: updateEventError } = await supabase
          .from('events')
          .update({ tickets_sold: newTicketsSold })
          .eq('id', transaction.event_id);

        if (updateEventError) {
          console.error('⚠️ Failed to update event tickets_sold:', updateEventError);
        } else {
          console.log('✅ Event tickets_sold updated successfully');
        }
      }
    } catch (eventError) {
      console.error('⚠️ Error updating event tickets_sold (non-blocking):', eventError);
      // Don't fail the payment verification if event update fails
    }

    // 🔑 CRITICAL: Credit organizer wallet after successful payment
    if (transaction.organizer_earnings && transaction.organizer_earnings > 0) {
      console.log('💰 Crediting organizer wallet...');
      const walletResult = await creditOrganizerWallet(
        transaction.organizer_id,
        transaction.organizer_earnings
      );
      
      if (walletResult.success) {
        console.log(`✅ Wallet credited: ₦${transaction.organizer_earnings} to organizer ${transaction.organizer_id}`);
      } else {
        console.error('⚠️ Wallet credit failed (non-blocking):', walletResult.error);
        // Don't fail the payment verification if wallet credit fails
        // The transaction is already marked as success
      }
    } else {
      console.warn('⚠️ No organizer earnings to credit:', {
        organizer_id: transaction.organizer_id,
        organizer_earnings: transaction.organizer_earnings,
      });
    }

    // 🔑 CRITICAL: Return full transaction data in response
    console.log('📤 Returning verification response with full transaction data:', {
      reference: transaction.reference,
      amount: transaction.total_amount,
      buyer_email: transaction.buyer_email,
      buyer_name: transaction.buyer_name,
    });

    return res.status(200).json({
      success: true,
      message: 'Payment verified successfully',
      data: {
        status: 'success',
        reference: transaction.reference,
        amount: transaction.total_amount, // ✅ Use DB value, not Squad response
        email: transaction.buyer_email,
        transaction: {
          id: transaction.id,
          reference: transaction.reference,
          buyer_email: transaction.buyer_email,
          buyer_name: transaction.buyer_name,
          total_amount: transaction.total_amount,
          ticket_price: transaction.ticket_price,
          processing_fee: transaction.processing_fee,
          platform_commission: transaction.platform_commission,
          organizer_earnings: transaction.organizer_earnings,
          status: transaction.status,
          created_at: transaction.created_at,
          verified_at: transaction.verified_at,
        },
      },
    });
  } catch (error) {
    console.error('❌ Payment Verification Controller Error:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });

    return res.status(500).json({
      success: false,
      error: 'Internal server error during payment verification',
      message: error.message,
    });
  }
};

/**
 * Callback handler for Squad webhook
 * POST /api/v1/payments/squad/callback
 * 
 * Squad will send payment status to this endpoint
 */
export const callbackHandler = async (req, res) => {
  try {
    const callbackData = req.body;

    console.log('📨 Squad Callback Received:', {
      transactionRef: callbackData.transaction_ref,
      status: callbackData.status,
      amount: callbackData.amount,
      email: callbackData.customer_email,
      timestamp: new Date().toISOString(),
      fullPayload: JSON.stringify(callbackData, null, 2),
    });

    // Validate callback data
    if (!callbackData.transaction_ref || !callbackData.status) {
      console.warn('⚠️ Invalid callback data received');
      return res.status(400).json({
        success: false,
        error: 'Invalid callback data',
      });
    }

    // Process based on payment status
    const { transaction_ref, status, amount, customer_email } = callbackData;

    if (status === 'success') {
      console.log('✅ Payment Successful:', {
        transactionRef: transaction_ref,
        amount,
        email: customer_email,
      });

      // TODO: Update your database with successful payment
      // TODO: Generate tickets/send confirmation email
      // TODO: Credit user account/wallet
    } else if (status === 'failed') {
      console.log('❌ Payment Failed:', {
        transactionRef: transaction_ref,
        reason: callbackData.reason || 'Unknown',
      });

      // TODO: Update database with failed payment
      // TODO: Send failure notification to user
    } else if (status === 'pending') {
      console.log('⏳ Payment Pending:', {
        transactionRef: transaction_ref,
      });

      // TODO: Update database with pending status
    }

    // Always return 200 to acknowledge receipt
    return res.status(200).json({
      success: true,
      message: 'Callback received and processed',
      transactionRef: transaction_ref,
    });
  } catch (error) {
    console.error('❌ Callback Handler Error:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });

    // Still return 200 to prevent Squad from retrying
    return res.status(200).json({
      success: false,
      message: 'Callback processed with error',
      error: error.message,
    });
  }
};

/**
 * Get payment status endpoint
 * GET /api/v1/payments/squad/status/:transactionRef
 */
export const getPaymentStatusController = async (req, res) => {
  try {
    const { transactionRef } = req.params;

    if (!transactionRef) {
      return res.status(400).json({
        success: false,
        error: 'Transaction reference is required',
      });
    }

    console.log('🔍 Checking Payment Status:', {
      transactionRef,
      timestamp: new Date().toISOString(),
    });

    const result = await verifySquadPayment(transactionRef);

    if (!result.success) {
      return res.status(404).json({
        success: false,
        error: result.error,
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        status: result.status,
        transactionRef: result.transactionRef,
        amount: result.amount,
        email: result.email,
      },
    });
  } catch (error) {
    console.error('❌ Get Payment Status Error:', {
      message: error.message,
      timestamp: new Date().toISOString(),
    });

    return res.status(500).json({
      success: false,
      error: 'Failed to get payment status',
      message: error.message,
    });
  }
};
