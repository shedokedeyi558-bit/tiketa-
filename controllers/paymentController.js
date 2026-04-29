import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../utils/supabaseClient.js';
import { verifySquadcoPayment, initiateSquadcoPayment } from '../services/squadcoService.js';
import { generateTicket, generateQRCode } from '../services/ticketService.js';
import { logAudit } from '../services/auditService.js';
import { 
  sendBuyerConfirmationEmail, 
  sendOrganizerNotificationEmail, 
  sendTicketDetailsEmail,
  getOrganizerEmail 
} from '../services/emailService.js';

const PLATFORM_COMMISSION_PERCENTAGE = 3;
const PROCESSING_FEE = 100; // ₦100
const ADMIN_CHARGE_PERCENTAGE = 0.35; // 35% (0.35 as decimal)
const ADMIN_MINIMUM_CHARGE = 100; // ₦100 minimum

/**
 * STEP 1: Initiate Payment
 * Generate unique reference and validate event/price
 */
export const initiatePayment = async (req, res) => {
  try {
    console.log('=== PAYMENT INITIATION START ===');
    console.log('Request body:', req.body);

    const { eventId, cartItems, attendees, buyerEmail, buyerName } = req.body;

    // Validate inputs
    if (!eventId || !cartItems || !cartItems.length || !buyerEmail || !buyerName) {
      console.log('❌ Validation failed: Missing fields', { eventId, cartItems, buyerEmail, buyerName });
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: eventId, cartItems, buyerEmail, buyerName' 
      });
    }

    // Validate email format
    if (!isValidEmail(buyerEmail)) {
      console.log('❌ Invalid email format:', buyerEmail);
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid email format' 
      });
    }

    // Fetch event to verify it exists
    console.log('🔍 Fetching event with ID:', eventId);
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (eventError) {
      console.log('❌ Event fetch error:', eventError);
      return res.status(404).json({ 
        success: false, 
        message: 'Event not found or database error',
        error: eventError.message 
      });
    }

    if (!event) {
      console.log('❌ Event not found - no data returned');
      return res.status(404).json({ 
        success: false, 
        message: 'Event not found' 
      });
    }
    
    console.log('✅ Event found:', { id: event.id, title: event.title, organizer_id: event.organizer_id });

    // ✅ CRITICAL: Validate organizer exists before creating transaction
    console.log('🔍 Validating organizer exists...');
    const { data: organizer, error: orgError } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', event.organizer_id)
      .eq('role', 'organizer')
      .single();

    if (orgError || !organizer) {
      console.error('❌ Organizer not found or invalid:', {
        organizer_id: event.organizer_id,
        error: orgError?.message,
      });
      return res.status(400).json({
        success: false,
        message: 'Event organizer is invalid. Please contact support.',
        error: 'Invalid organizer',
      });
    }

    console.log('✅ Organizer validated:', organizer.id);

    // Generate unique transaction reference
    const reference = `TXN_${Date.now()}_${uuidv4()}`;
    
    console.log('🔑 GENERATED REFERENCE:', reference);

    // ✅ Calculate fees according to exact business logic
    const ticketPrice = cartItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const processingFee = PROCESSING_FEE; // ₦100 flat (paid by attendee, goes to platform)
    const totalAmount = ticketPrice + processingFee; // What attendee actually pays
    
    const squadcoFee = (totalAmount * 1.2) / 100; // 1.2% of total_amount (deducted by Squadco)
    const platformCommission = (ticketPrice * PLATFORM_COMMISSION_PERCENTAGE) / 100; // 3% of ticket_price ONLY
    const organizerEarnings = ticketPrice - platformCommission; // ticket_price - platform_commission
    const platformNetProfit = processingFee - squadcoFee + platformCommission; // processing_fee - squadco_fee + platform_commission

    console.log('📋 Transaction fee breakdown:', {
      reference,
      ticketPrice,
      processingFee,
      totalAmount,
      squadcoFee: squadcoFee.toFixed(2),
      platformCommission: platformCommission.toFixed(2),
      organizerEarnings: organizerEarnings.toFixed(2),
      platformNetProfit: platformNetProfit.toFixed(2),
    });

    // Create pending transaction record
    console.log('Creating transaction record...');
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .insert([
        {
          reference,
          event_id: eventId,
          organizer_id: event.organizer_id,
          buyer_email: buyerEmail,
          buyer_name: buyerName,
          ticket_price: ticketPrice,
          processing_fee: processingFee,
          total_amount: totalAmount,
          platform_commission: platformCommission,
          organizer_earnings: organizerEarnings,
          status: 'pending',
          squadco_response: { cartItems, attendees }, // Temporarily store payload avoiding DB migrations
          ip_address: req.ip || 'unknown',
          user_agent: req.headers['user-agent'] || 'unknown',
        },
      ])
      .select()
      .single();

    if (txError) {
      console.error('❌ Transaction creation error:', txError);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to create transaction',
        error: txError.message 
      });
    }

    console.log('✅ Transaction created in DB:', { 
      id: transaction.id, 
      reference: transaction.reference,
      status: transaction.status 
    });

    // Initiate payment with Squadco
    console.log('Initiating Squadco payment...');
    console.log('📤 PASSING REFERENCE TO SQUADCO:', reference);
    const frontendOrigin = req.headers.origin || 'http://localhost:5173';
    const callbackUrl = `${frontendOrigin}/payment-confirmation`;
    
    let squadcoInitiation;
    try {
      squadcoInitiation = await initiateSquadcoPayment({
        reference,
        amount: totalAmount,
        email: buyerEmail,
        fullName: buyerName,
        eventTitle: event.title,
        callbackUrl,
      });
      
      console.log('✅ Squadco payment initiated:', {
        reference: squadcoInitiation.reference,
        checkoutUrl: squadcoInitiation.checkoutUrl,
      });
    } catch (squadcoError) {
      console.error('❌ Squadco initiation error:', squadcoError);
      // Update transaction status to failed
      await supabase
        .from('transactions')
        .update({ status: 'failed' })
        .eq('id', transaction.id)
        .catch(err => console.error('Failed to update transaction status:', err));
        
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to initiate payment with payment provider',
        error: squadcoError.message 
      });
    }

    if (!squadcoInitiation || !squadcoInitiation.success) {
      console.error('❌ Squadco initiation failed:', squadcoInitiation);
      // Update transaction status to failed
      try {
        await supabase
          .from('transactions')
          .update({ status: 'failed' })
          .eq('id', transaction.id);
      } catch (updateErr) {
        console.error('Failed to update transaction status:', updateErr);
      }
        
      return res.status(500).json({ 
        success: false, 
        message: 'Payment provider rejected the request',
        error: squadcoInitiation?.error || 'Unknown error' 
      });
    }

    console.log('✅ Squadco payment initiated:', squadcoInitiation.checkoutUrl);

    // Log audit
    try {
      await logAudit({
        action: 'PAYMENT_INITIATED',
        entity_type: 'transaction',
        entity_id: reference,
        changes: { status: 'pending', amount: totalAmount },
        ip_address: req.ip || 'unknown',
        user_agent: req.headers['user-agent'] || 'unknown',
      });
    } catch (auditError) {
      console.warn('Failed to log audit:', auditError);
      // Don't fail the request if audit logging fails
    }

    console.log('=== PAYMENT INITIATION SUCCESS ===');
    console.log('FINAL CHECKOUT URL:', squadcoInitiation.checkoutUrl);

    // Return reference and payment details
    return res.status(200).json({
      success: true,
      message: 'Payment initialized',
      data: {
        reference,
        checkoutUrl: squadcoInitiation.checkoutUrl,
        amount: totalAmount,
      }
    });
  } catch (error) {
    console.error('=== PAYMENT INITIATION CRITICAL ERROR ===');
    console.error('Error:', error);
    console.error('Stack:', error.stack);
    
    // ALWAYS return a valid JSON response
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error during payment initiation',
      error: error.message || 'Unknown error' 
    });
  }
};

/**
 * STEP 2: Verify Payment with Squadco
 * CRITICAL: Backend must verify EVERY transaction
 * NEVER trust frontend success messages
 */
export const verifyPayment = async (req, res) => {
  try {
    let { reference } = req.body;

    if (!reference) {
      return res.status(400).json({ error: 'Reference required' });
    }

    // 🔑 CRITICAL: Trim and normalize reference
    reference = reference.trim();
    
    console.log('🔎 INCOMING REFERENCE:', reference);
    console.log('🔎 REFERENCE LENGTH:', reference.length);
    console.log('🔍 Payment Verification Started:', {
      reference,
      timestamp: new Date().toISOString(),
    });

    // RETRY LOGIC: Try up to 3 times with delays
    let transaction = null;
    let txError = null;
    const maxRetries = 3;
    const retryDelays = [500, 1000, 2000]; // ms between retries

    console.log('🔎 LOOKING UP TRANSACTION WITH REFERENCE:', reference);

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      if (attempt > 0) {
        console.log(`⏳ Retry attempt ${attempt}/${maxRetries - 1}...`);
        await new Promise(resolve => setTimeout(resolve, retryDelays[attempt - 1]));
      }

      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('reference', reference)
        .maybeSingle();

      transaction = data;
      txError = error;

      if (data) {
        console.log('✅ Transaction found on attempt', attempt + 1, {
          id: data.id,
          reference: data.reference,
          status: data.status,
        });
        break;
      } else {
        console.log(`⚠️ Transaction not found on attempt ${attempt + 1}`);
      }
    }

    if (txError) {
      console.error("❌ DB error after retries:", txError);
      return res.status(500).json({
        success: false,
        message: txError.message
      });
    }

    if (!transaction) {
      console.warn('⚠️ Transaction not found after retries:', reference);
      return res.status(404).json({ 
        success: false,
        error: 'Transaction not found',
        message: 'Transaction not found. Please try again in a moment.'
      });
    }

    console.log('📋 Transaction found:', {
      id: transaction.id,
      status: transaction.status,
      reference: transaction.reference,
      dbReference: transaction.reference,
      incomingReference: reference,
      match: transaction.reference === reference ? '✅ MATCH' : '❌ MISMATCH',
    });

    // 🔑 CRITICAL: Validate reference matches exactly
    if (transaction.reference !== reference) {
      console.error('❌ REFERENCE MISMATCH:', {
        dbReference: transaction.reference,
        incomingReference: reference,
      });
      return res.status(400).json({
        success: false,
        error: 'Reference mismatch - possible fraud attempt',
        message: 'Reference validation failed'
      });
    }

    // Check if already verified
    if (transaction.status === 'success') {
      // Return existing ticket
      const { data: ticket, error: ticketError } = await supabase
        .from('tickets')
        .select('*')
        .eq('transaction_id', transaction.id)
        .limit(1)
        .maybeSingle();

      if (ticketError) {
        console.error("DB error:", ticketError);
        return res.status(500).json({
          success: false,
          message: ticketError.message
        });
      }

      return res.json({
        success: true,
        message: 'Payment already verified',
        transaction,
        ticket,
      });
    }

    if (transaction.status === 'failed') {
      return res.status(400).json({ error: 'Payment failed' });
    }

    // Query Squadco API to verify payment status
    console.log('🔄 Verifying with Squadco API...');
    const squadcoVerification = await verifySquadcoPayment(reference);

    console.log('📊 Squadco Verification Result:', {
      success: squadcoVerification.success,
      status: squadcoVerification.status,
      reference: squadcoVerification.reference,
      amount: squadcoVerification.amount,
    });

    // Check if verification failed
    if (!squadcoVerification.success) {
      console.error('❌ Squadco verification failed:', squadcoVerification.error);
      
      // Update transaction status to failed
      const { error: updateError } = await supabase
        .from('transactions')
        .update({
          status: 'failed',
          squadco_reference: squadcoVerification.reference || null,
          squadco_response: squadcoVerification.rawData,
        })
        .eq('id', transaction.id);

      if (updateError) {
        console.error("DB error:", updateError);
        return res.status(500).json({
          success: false,
          message: updateError.message
        });
      }

      await logAudit({
        action: 'PAYMENT_VERIFICATION_FAILED',
        entity_type: 'transaction',
        entity_id: reference,
        changes: { status: 'failed', reason: squadcoVerification.error },
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
      });

      return res.status(400).json({ 
        success: false,
        error: squadcoVerification.error || 'Payment verification failed',
        message: squadcoVerification.error || 'Payment verification failed'
      });
    }

    // Check if payment status is success
    if (squadcoVerification.status !== 'success') {
      console.warn('⚠️ Payment status is not success:', squadcoVerification.status);
      
      const { error: updateError } = await supabase
        .from('transactions')
        .update({
          status: squadcoVerification.status || 'failed',
          squadco_reference: squadcoVerification.reference || null,
          squadco_response: squadcoVerification.rawData,
        })
        .eq('id', transaction.id);

      if (updateError) {
        console.error("DB error:", updateError);
      }

      return res.status(400).json({ 
        success: false,
        error: `Payment status: ${squadcoVerification.status}`,
        message: `Payment status: ${squadcoVerification.status}`
      });
    }

    // Validate amount (allow small rounding differences)
    // Convert to same unit for comparison (use Naira)
    const dbAmountInNaira = Math.round(transaction.total_amount / 100);
    const squadcoAmountInNaira = squadcoVerification.amount;
    const amountDifference = Math.abs(squadcoAmountInNaira - dbAmountInNaira);

    console.log('💰 Amount Validation:', {
      dbAmount: dbAmountInNaira,
      squadcoAmount: squadcoAmountInNaira,
      difference: amountDifference,
    });

    if (amountDifference > 1) { // Allow 1 Naira difference for rounding
      console.error('❌ Amount mismatch detected');
      
      await logAudit({
        action: 'FRAUD_ATTEMPT_AMOUNT_MISMATCH',
        entity_type: 'transaction',
        entity_id: reference,
        changes: {
          expected: dbAmountInNaira,
          received: squadcoAmountInNaira,
        },
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
      });

      return res.status(400).json({ 
        success: false,
        error: 'Payment amount mismatch' 
      });
    }

    // Validate reference consistency
    if (squadcoVerification.reference && squadcoVerification.reference !== reference) {
      console.error('❌ Reference mismatch detected');
      
      await logAudit({
        action: 'FRAUD_ATTEMPT_REFERENCE_MISMATCH',
        entity_type: 'transaction',
        entity_id: reference,
        changes: { expected: reference, received: squadcoVerification.reference },
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
      });

      return res.status(400).json({ 
        success: false,
        error: 'Reference mismatch' 
      });
    }

    console.log('✅ All validations passed - Processing payment...');

    // ✅ PAYMENT VERIFIED - Now process it
    await processVerifiedPayment(transaction, squadcoVerification, req);

    // Fetch updated transaction with ticket
    const { data: updatedTx } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', transaction.id)
      .maybeSingle();

    const { data: ticket } = await supabase
      .from('tickets')
      .select('*')
      .eq('transaction_id', transaction.id)
      .limit(1)
      .maybeSingle();

    console.log('✅ Payment verification complete:', {
      reference,
      status: 'success',
      ticketGenerated: !!ticket,
    });

    res.json({
      success: true,
      message: 'Payment verified and processed',
      transaction: updatedTx,
      ticket,
    });
  } catch (error) {
    console.error('Payment verification error:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Payment verification failed',
      message: error.message || 'An unexpected error occurred'
    });
  }
};

/**
 * STEP 3: Process Verified Payment
 * Credit wallet, generate ticket, record earnings, send emails
 */
async function processVerifiedPayment(transaction, squadcoVerification, req) {
  try {
    // Parse out our stored attendees/cart before overwriting squadco_response
    const cartItems = transaction.squadco_response?.cartItems || [];
    const attendees = transaction.squadco_response?.attendees || [{ name: transaction.buyer_name, email: transaction.buyer_email }];
    const totalTicketsSold = cartItems.reduce((acc, item) => acc + item.quantity, 0) || 1;

    // 1. Update transaction status to success
    await supabase
      .from('transactions')
      .update({
        status: 'success',
        squadco_reference: squadcoVerification.reference,
        squadco_response: { ...squadcoVerification.response, orig_cart: cartItems }, // Safe merge
        verified_at: new Date().toISOString(),
        verified_by: 'squadco_api',
      })
      .eq('id', transaction.id);

    // 2. Credit organizer wallet
    await creditOrganizerWallet(transaction);

    // 3. Record platform earnings
    await recordPlatformEarnings(transaction);

    // 4. Generate tickets for EVERY attendee
    const generatedTickets = [];
    for (const attendee of attendees) {
       const tkt = await generateTicketForTransaction(transaction, attendee);
       generatedTickets.push(tkt);
    }

    // 5. Update event ticket count safely without supabase.raw()
    const { data: currentEvent } = await supabase
      .from('events')
      .select('tickets_sold')
      .eq('id', transaction.event_id)
      .maybeSingle();

    if (currentEvent) {
      await supabase
        .from('events')
        .update({ tickets_sold: (currentEvent.tickets_sold || 0) + totalTicketsSold })
        .eq('id', transaction.event_id);
    }

    // 6. Fetch event details for email
    const { data: event } = await supabase
      .from('events')
      .select('*')
      .eq('id', transaction.event_id)
      .single();

    // 7. 📧 SEND EMAILS - New notification flow
    console.log('📧 Starting email notification flow...');

    // 7a. Send buyer confirmation email
    console.log('📧 Sending buyer confirmation email...');
    const buyerEmailResult = await sendBuyerConfirmationEmail(transaction, event);
    if (!buyerEmailResult.success) {
      console.warn('⚠️ Failed to send buyer confirmation email:', buyerEmailResult.error);
      // Don't fail the payment if email fails
    }

    // 7b. Send organizer notification email
    console.log('📧 Sending organizer notification email...');
    const organizerData = await getOrganizerEmail(transaction.organizer_id);
    if (organizerData && organizerData.email) {
      const organizerEmailResult = await sendOrganizerNotificationEmail(transaction, event, organizerData.email);
      if (!organizerEmailResult.success) {
        console.warn('⚠️ Failed to send organizer notification email:', organizerEmailResult.error);
        // Don't fail the payment if email fails
      }
    } else {
      console.warn('⚠️ Could not find organizer email for ID:', transaction.organizer_id);
    }

    // 7c. Send ticket details email to buyer
    if (generatedTickets.length > 0) {
      console.log('📧 Sending ticket details email...');
      const ticketEmailResult = await sendTicketDetailsEmail(transaction, event, generatedTickets);
      if (!ticketEmailResult.success) {
        console.warn('⚠️ Failed to send ticket details email:', ticketEmailResult.error);
        // Don't fail the payment if email fails
      }
    }

    // 8. Log audit
    await logAudit({
      action: 'PAYMENT_PROCESSED',
      entity_type: 'transaction',
      entity_id: transaction.reference,
      changes: {
        status: 'success',
        tickets_generated: generatedTickets.length,
        organizer_earnings: transaction.organizer_earnings,
        emails_sent: {
          buyer_confirmation: buyerEmailResult?.success || false,
          organizer_notification: organizerData ? true : false,
          ticket_details: generatedTickets.length > 0 ? true : false,
        },
      },
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });

    console.log('✅ Payment processing complete with email notifications');
  } catch (error) {
    console.error('Payment processing error:', error);
    throw error;
  }
}

/**
 * Credit organizer wallet
 * ✅ CRITICAL: Validates organizer exists before crediting
 */
async function creditOrganizerWallet(transaction) {
  try {
    const organizerId = transaction.organizer_id;

    // ✅ CRITICAL: Validate organizer exists
    console.log('🔍 Validating organizer exists before wallet credit...');
    const { data: organizer, error: orgError } = await supabase
      .from('users')
      .select('id')
      .eq('id', organizerId)
      .eq('role', 'organizer')
      .single();

    if (orgError || !organizer) {
      console.error('❌ Organizer not found for wallet credit:', {
        organizerId,
        error: orgError?.message,
      });
      throw new Error(`Organizer ${organizerId} not found`);
    }

    console.log('✅ Organizer validated for wallet credit');

    // Get or create wallet
    let { data: wallet } = await supabase
      .from('wallets')
      .select('*')
      .eq('organizer_id', organizerId)
      .maybeSingle();

    if (!wallet) {
      console.log('⏳ Wallet not found, creating one...');
      const { data: newWallet } = await supabase
        .from('wallets')
        .insert([{ organizer_id: organizerId }])
        .select()
        .single();
      wallet = newWallet;
      console.log('✅ Wallet created');
    }

    // Update wallet balance
    const newBalance = parseFloat(wallet.available_balance) + parseFloat(transaction.organizer_earnings);
    const newTotal = parseFloat(wallet.total_earned) + parseFloat(transaction.organizer_earnings);

    await supabase
      .from('wallets')
      .update({
        available_balance: newBalance,
        total_earned: newTotal,
        last_updated: new Date().toISOString(),
      })
      .eq('id', wallet.id);

    // Record wallet transaction
    await supabase
      .from('wallet_transactions')
      .insert([
        {
          wallet_id: wallet.id,
          organizer_id: organizerId,
          type: 'credit',
          amount: transaction.organizer_earnings,
          reference_id: transaction.id,
          reference_type: 'transaction',
          description: `Payment for event: ${transaction.event_id}`,
          balance_before: wallet.available_balance,
          balance_after: newBalance,
        },
      ]);

    console.log('✅ Wallet credited successfully');
  } catch (error) {
    console.error('❌ Wallet credit error:', error);
    throw error;
  }
}

/**
 * Record platform earnings and admin charges
 */
async function recordPlatformEarnings(transaction) {
  try {
    // Calculate admin charges: 35% of ticket price + ₦100
    const adminCharge = (parseFloat(transaction.ticket_price) * ADMIN_CHARGE_PERCENTAGE) + ADMIN_MINIMUM_CHARGE;
    
    // Calculate Squadco fee (3% of total amount)
    const squadcoFee = (parseFloat(transaction.total_amount) * 0.03);
    
    // Calculate what goes to admin wallet
    // Admin gets: 3% platform commission + admin charges
    // But if admin charges > 100, the excess goes to admin wallet
    const adminCommission = parseFloat(transaction.platform_commission);
    let adminWalletCredit = adminCommission;
    
    // If admin charge is more than 100, transfer the difference to admin wallet
    if (adminCharge > ADMIN_MINIMUM_CHARGE) {
      const excess = adminCharge - ADMIN_MINIMUM_CHARGE;
      adminWalletCredit += excess;
    }

    // Record platform earnings
    await supabase
      .from('platform_earnings')
      .insert([
        {
          transaction_id: transaction.id,
          commission_amount: transaction.platform_commission,
          commission_percentage: PLATFORM_COMMISSION_PERCENTAGE,
          admin_charge: adminCharge,
          squadco_fee: squadcoFee,
          admin_wallet_credit: adminWalletCredit,
          status: 'pending',
        },
      ]);

    // Credit admin wallet
    await creditAdminWallet(adminWalletCredit, transaction);
  } catch (error) {
    console.error('Platform earnings error:', error);
    throw error;
  }
}

/**
 * Credit admin wallet
 */
async function creditAdminWallet(amount, transaction) {
  try {
    // Get admin user (assuming there's a system admin)
    const { data: adminUser } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'admin')
      .limit(1)
      .maybeSingle();

    if (!adminUser) {
      console.warn('No admin user found for wallet credit');
      return;
    }

    // Get or create admin wallet
    let { data: wallet } = await supabase
      .from('wallets')
      .select('*')
      .eq('organizer_id', adminUser.id)
      .maybeSingle();

    if (!wallet) {
      const { data: newWallet } = await supabase
        .from('wallets')
        .insert([{ organizer_id: adminUser.id }])
        .select()
        .single();
      wallet = newWallet;
    }

    // Update wallet balance
    const newBalance = parseFloat(wallet.available_balance) + parseFloat(amount);
    const newTotal = parseFloat(wallet.total_earned) + parseFloat(amount);

    await supabase
      .from('wallets')
      .update({
        available_balance: newBalance,
        total_earned: newTotal,
        last_updated: new Date().toISOString(),
      })
      .eq('id', wallet.id);

    // Record wallet transaction
    await supabase
      .from('wallet_transactions')
      .insert([
        {
          wallet_id: wallet.id,
          organizer_id: adminUser.id,
          type: 'credit',
          amount: amount,
          reference_id: transaction.id,
          reference_type: 'admin_charge',
          description: `Admin charge from ticket sale: ${transaction.reference}`,
          balance_before: wallet.available_balance,
          balance_after: newBalance,
        },
      ]);
  } catch (error) {
    console.error('Admin wallet credit error:', error);
    throw error;
  }
}

/**
 * Generate ticket for transaction
 */
async function generateTicketForTransaction(transaction, attendee = null) {
  try {
    const ticketNumber = generateTicket();
    const qrCode = await generateQRCode(ticketNumber); // BUG FIX: Added await

    const buyerName = attendee?.name || transaction.buyer_name;
    const buyerEmail = attendee?.email || transaction.buyer_email;

    const { data: ticket, error } = await supabase
      .from('tickets')
      .insert([
        {
          event_id: transaction.event_id,
          transaction_id: transaction.id,
          organizer_id: transaction.organizer_id,
          buyer_email: buyerEmail,
          buyer_name: buyerName,
          ticket_number: ticketNumber,
          qr_code: qrCode,
          status: 'valid',
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return ticket;
  } catch (error) {
    console.error('Ticket generation error:', error);
    throw error;
  }
}

/**
 * Get payment status
 */
export const getPaymentStatus = async (req, res) => {
  try {
    const { reference } = req.params;

    const { data: transaction, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('reference', reference)
      .single();

    if (error || !transaction) {
      return res.status(404).json({ 
        success: false,
        error: 'Transaction not found',
        message: error?.message || 'No transaction found with this reference'
      });
    }

    // Get ticket if successful
    let ticket = null;
    if (transaction.status === 'success') {
      const { data: ticketData } = await supabase
        .from('tickets')
        .select('*')
        .eq('transaction_id', transaction.id)
        .single();
      ticket = ticketData;
    }

    res.json({
      success: true,
      transaction,
      ticket,
    });
  } catch (error) {
    console.error('Get payment status error:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Failed to get payment status',
      message: error.message || 'An unexpected error occurred'
    });
  }
};

/**
 * Validate email format
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
