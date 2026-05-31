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
    console.log('💰 AMOUNT RECEIVED FROM FRONTEND:', amount);
    console.log('🛒 CART ITEMS RECEIVED:', JSON.stringify(cartItems));

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
    
    // 🔑 CRITICAL: Calculate total ticket price from ALL cartItems with quantities
    const ticketPrice = cartItems && cartItems.length > 0
      ? cartItems.reduce((acc, item) => {
          const price = parseFloat(item.price || item.ticket_price || 0);
          const qty = parseInt(item.quantity || 1);
          return acc + (price * qty);
        }, 0)
      : 0;
    
    console.log('💰 Ticket price calculation:', {
      cartItems_length: cartItems?.length,
      cartItems,
      calculated_ticketPrice: ticketPrice,
    });
    
    // 🔑 CRITICAL: Calculate fees and commission
    // Processing fee: ₦100 flat for tickets ≤ ₦5,000, or 1.5% for > ₦5,000
    const processingFee = ticketPrice <= 5000 ? 100 : Math.round((ticketPrice * 1.5) / 100);
    const totalAmount = ticketPrice + processingFee;
    const squadcoFee = (totalAmount * 1.2) / 100;
    const platformCommission = (ticketPrice * 3) / 100;
    // ✅ CRITICAL FIX: Organizer gets 97% of ticket price ONLY (not affected by fees)
    const organizerEarnings = ticketPrice * 0.97;
    const platformNetProfit = platformCommission;
    
    console.log('💰 Fee calculation:', {
      ticketPrice,
      processingFee,
      totalAmount,
      squadcoFee: squadcoFee.toFixed(2),
      platformCommission: platformCommission.toFixed(2),
      organizerEarnings: organizerEarnings.toFixed(2),
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
            ticket_price: ticketPrice,
            processing_fee: processingFee,
            total_amount: totalAmount,
            platform_commission: platformCommission,
            squadco_fee: squadcoFee,
            organizer_earnings: organizerEarnings,
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
            squadco_response: { 
              ...transaction.squadco_response, // Preserve original cartItems and attendees
              ...result.rawData // Add Squad verification data
            },
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

    // ✅ Extract cartItems and attendees from the ORIGINAL in-memory transaction
    // CRITICAL: Do this BEFORE any further DB operations that might overwrite squadco_response
    // Also handle case where squadco_response is stored as a JSON string
    let rawResponse = transaction.squadco_response || {};
    if (typeof rawResponse === 'string') {
      try { rawResponse = JSON.parse(rawResponse); } catch (_) { rawResponse = {}; }
    }
    const cartItems = Array.isArray(rawResponse.cartItems) ? rawResponse.cartItems : [];
    const attendees = Array.isArray(rawResponse.attendees) ? rawResponse.attendees : [];
    const buyerPhone = attendees.length > 0
      ? (attendees[0]?.phone || attendees[0]?.phoneNumber || null)
      : null;

    console.log('🛒 Cart items for per-type transactions:', JSON.stringify(cartItems));
    console.log('👥 Attendees:', JSON.stringify(attendees));
    console.log('🛒 Cart items count:', cartItems.length);

    // ✅ Fetch event details for email and ticket_type names
    let eventData = null;
    try {
      const { data: ev } = await supabase
        .from('events')
        .select('id, title, date, end_date, start_time, end_time, location, organizer_id, tickets_sold, total_tickets, ticket_types')
        .eq('id', transaction.event_id)
        .single();
      eventData = ev;
    } catch (e) {
      console.error('⚠️ Failed to fetch event for post-payment processing:', e.message);
    }

    // ✅ Create one transaction row per ticket type in cartItems
    const perTypeTxIds = [transaction.id];

    if (cartItems.length > 0) {
      // Update the original pending transaction to reflect the FIRST cart item
      const firstItem = cartItems[0];
      const firstItemQty = parseInt(firstItem.quantity) || 1;
      const firstItemUnitPrice = parseFloat(firstItem.price || firstItem.ticket_price || 0);
      const firstItemPrice = firstItemUnitPrice * firstItemQty;
      // Processing fee only on first row (charged once for the whole order)
      const firstProcessingFee = cartItems.length === 1
        ? (firstItemPrice <= 5000 ? 100 : Math.round((firstItemPrice * 1.5) / 100))
        : 0;
      const firstPlatformCommission = firstItemPrice * 0.03;
      const firstOrganizerEarnings = firstItemPrice * 0.97;

      console.log(`[PER-TYPE] Updating row 0 (original): ticket_type_id=${firstItem.id}, qty=${firstItemQty}, price=${firstItemPrice}`);

      const { error: updateFirstErr } = await supabase
        .from('transactions')
        .update({
          ticket_type_id: firstItem.id || null,
          ticket_price: firstItemPrice,
          processing_fee: firstProcessingFee,
          total_amount: firstItemPrice + firstProcessingFee,
          platform_commission: firstPlatformCommission,
          organizer_earnings: firstOrganizerEarnings,
          quantity: firstItemQty,
          attendees: attendees,
          buyer_phone: buyerPhone,
        })
        .eq('id', transaction.id);

      if (updateFirstErr) {
        console.error('[PER-TYPE] Failed to update first row:', updateFirstErr.message);
      } else {
        console.log('[PER-TYPE] First row updated successfully');
      }

      // Insert one row for each remaining cart item (index 1+)
      for (let i = 1; i < cartItems.length; i++) {
        const item = cartItems[i];
        const itemQty = parseInt(item.quantity) || 1;
        const itemUnitPrice = parseFloat(item.price || item.ticket_price || 0);
        const itemPrice = itemUnitPrice * itemQty;
        const itemPlatformCommission = itemPrice * 0.03;
        const itemOrganizerEarnings = itemPrice * 0.97;

        console.log(`[PER-TYPE] Inserting row ${i}: ticket_type_id=${item.id}, qty=${itemQty}, price=${itemPrice}`);

        const { data: newTx, error: newTxErr } = await supabase
          .from('transactions')
          .insert([{
            reference: transaction.reference,
            event_id: transaction.event_id,
            organizer_id: transaction.organizer_id,
            buyer_email: transaction.buyer_email,
            buyer_name: transaction.buyer_name,
            buyer_phone: buyerPhone,
            ticket_type_id: item.id || null,
            ticket_price: itemPrice,
            processing_fee: 0,
            total_amount: itemPrice,
            platform_commission: itemPlatformCommission,
            squadco_fee: 0,
            organizer_earnings: itemOrganizerEarnings,
            quantity: itemQty,
            attendees: attendees,
            status: 'success',
            verified_at: new Date().toISOString(),
            squadco_response: transaction.squadco_response,
            ip_address: transaction.ip_address,
            user_agent: transaction.user_agent,
          }])
          .select('id')
          .single();

        if (newTxErr) {
          console.error(`[PER-TYPE] Failed to insert row ${i} for item ${item.id}:`, newTxErr.message);
        } else {
          console.log(`[PER-TYPE] Row ${i} inserted: ${newTx.id} for ticket_type_id=${item.id}`);
          perTypeTxIds.push(newTx.id);
        }
      }

      console.log(`[PER-TYPE] Done. Created ${perTypeTxIds.length} rows for ${cartItems.length} cart items`);
    } else {
      // No cartItems — just store attendees on the original transaction
      console.warn('[PER-TYPE] No cartItems found — storing attendees only on original row');
      await supabase
        .from('transactions')
        .update({ attendees: attendees, buyer_phone: buyerPhone })
        .eq('id', transaction.id);
    }

    // ✅ Update event tickets_sold count
    console.log('🎫 Updating event tickets_sold count...');
    try {
      const totalQuantity = cartItems.length > 0
        ? cartItems.reduce((acc, item) => acc + (parseInt(item.quantity) || 1), 0)
        : 1;

      const currentTicketsSold = eventData?.tickets_sold || 0;
      const newTicketsSold = currentTicketsSold + totalQuantity;

      const { error: updateEventError } = await supabase
        .from('events')
        .update({ tickets_sold: newTicketsSold })
        .eq('id', transaction.event_id);

      if (updateEventError) {
        console.error('⚠️ Failed to update event tickets_sold:', updateEventError);
      } else {
        console.log('✅ Event tickets_sold updated to', newTicketsSold);
      }
    } catch (eventError) {
      console.error('⚠️ Error updating event tickets_sold (non-blocking):', eventError);
    }

    // ✅ Credit organizer wallet (total organizer earnings across all cart items)
    const totalOrganizerEarnings = cartItems.length > 0
      ? cartItems.reduce((sum, item) => {
          const itemPrice = parseFloat(item.price || item.ticket_price || 0) * (parseInt(item.quantity) || 1);
          return sum + (itemPrice * 0.97);
        }, 0)
      : transaction.organizer_earnings;

    if (totalOrganizerEarnings > 0) {
      console.log('💰 Crediting organizer wallet:', totalOrganizerEarnings);
      const walletResult = await creditOrganizerWallet(
        transaction.organizer_id,
        totalOrganizerEarnings,
        transaction.reference
      );
      if (walletResult.success) {
        console.log(`✅ Wallet credited: ₦${totalOrganizerEarnings} to organizer ${transaction.organizer_id}`);
      } else {
        console.error('⚠️ Wallet credit failed (non-blocking):', walletResult.error);
      }
    }

    // ✅ BUG 2 FIX: Send Ticketa custom confirmation email
    try {
      const { sendTicketPurchaseConfirmation } = await import('../services/emailService.js');
      await sendTicketPurchaseConfirmation({
        buyerName: transaction.buyer_name,
        buyerEmail: transaction.buyer_email,
        reference: transaction.reference,
        event: eventData,
        cartItems,
        attendees,
        totalAmount: transaction.total_amount,
      });
      console.log('✅ Ticketa confirmation email sent to', transaction.buyer_email);
    } catch (emailErr) {
      console.error('⚠️ Failed to send confirmation email (non-blocking):', emailErr.message);
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
