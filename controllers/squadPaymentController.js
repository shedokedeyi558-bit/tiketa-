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
  
  try {
    const { eventId, cartItems, attendees, buyerEmail, buyerName, amount, callbackUrl } = req.body;

    if (!eventId) {
      return res.status(400).json({
        success: false,
        error: 'eventId is required',
        message: 'Event ID is missing from request',
      });
    }

    if (!amount || !buyerEmail || !callbackUrl) {
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

    console.log('🔄 Payment Initiation Request: eventId=%s amount=%s', eventId, amount);

    // 🔑 CRITICAL: Verify event exists with timeout
    console.log('⏳ Step 1: Looking up event...');
    
    // Create timeout promise
    const eventTimeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Supabase event lookup timed out after 5 seconds')), 5000)
    );
    
    // Race between Supabase query and timeout
    const { data: event, error: eventError } = await Promise.race([
      supabase
        .from('events')
        .select('id, title, organizer_id, ticket_types, total_tickets')
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

    // ✅ Step 1b: Atomic availability check via Postgres RPC (row-level lock)
    // reserve_tickets locks the ticket_types row so concurrent requests serialize at DB level
    if (cartItems && cartItems.length > 0) {
      for (const item of cartItems) {
        const tierId   = item.id || item.ticket_type_id || item.ticketTypeId || null;
        const tierName = item.name || 'Ticket';
        const reqQty   = parseInt(item.quantity) || 1;

        if (!tierId) continue; // no tier ID = can't check capacity

        const { data: reserveResult, error: reserveErr } = await supabase.rpc('reserve_tickets', {
          p_event_id: eventId,
          p_tier_id:  tierId,
          p_quantity: reqQty,
        });

        if (reserveErr) {
          // RPC not yet deployed — fall through to soft check below
          console.warn('[AVAILABILITY] RPC error (non-blocking):', reserveErr.message);
        } else if (reserveResult && reserveResult.success === false) {
          console.warn(`❌ Availability check failed: ${tierName} requested=${reqQty} available=${reserveResult.available}`);
          return res.status(400).json({
            success: false,
            error: 'Tickets unavailable',
            message: reserveResult.message || `Not enough tickets available for ${tierName}.`,
          });
        }
      }
      console.log('✅ Step 1b done - Availability check passed');
    }

    // ── Step 1c: Non-blocking fraud detection ────────────────────────────────
    // Flags are written AFTER the transaction is created (reference is needed).
    // We pre-calculate the checks here so we know what to flag later.
    const cartTotalNaira = cartItems && cartItems.length > 0
      ? cartItems.reduce((acc, item) => acc + (parseFloat(item.price || item.ticket_price || 0) * (parseInt(item.quantity) || 1)), 0)
      : (amount || 0);

    const HIGH_VALUE_THRESHOLD = 500000; // ₦500,000
    const isHighValue = cartTotalNaira > HIGH_VALUE_THRESHOLD;

    // Check rapid repeat purchases (same email + event in last 30 min)
    let rapidRepeatCount = 0;
    try {
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('buyer_email', buyerEmail)
        .eq('event_id', eventId)
        .eq('status', 'success')
        .gte('created_at', thirtyMinAgo);
      rapidRepeatCount = count || 0;
    } catch (_) {}

    const isRapidRepeat = rapidRepeatCount > 3;
    console.log('[FRAUD] isHighValue=%s isRapidRepeat=%s', isHighValue, isRapidRepeat);
    // ─────────────────────────────────────────────────────────────────────────

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
    
    // 🔑 CRITICAL: Calculate fees and commission
    // Processing fee: ₦100 flat for tickets ≤ ₦7,000, or 1.5% for > ₦7,000
    const processingFee = ticketPrice <= 7000 ? 100 : Math.round((ticketPrice * 1.5) / 100);
    const totalAmount = ticketPrice + processingFee;
    const squadcoFee = (totalAmount * 1.2) / 100;
    const platformCommission = (ticketPrice * 3) / 100;
    // ✅ CRITICAL FIX: Organizer gets 97% of ticket price ONLY (not affected by fees)
    const organizerEarnings = ticketPrice * 0.97;
    const platformNetProfit = platformCommission;
    
    console.log('💰 ticketPrice=₦%s processingFee=₦%s total=₦%s', ticketPrice, processingFee, totalAmount);
    
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
            // Normalize cartItems so ticket_type_id is always stored under item.id
            // regardless of what field name the frontend used (id, ticket_type_id, typeId, etc.)
            squadco_response: {
              cartItems: (cartItems || []).map(item => ({
                ...item,
                id: item.id || item.ticket_type_id || item.ticketTypeId || item.typeId || item.type_id || null,
              })),
              attendees,
              amount,
              buyerEmail,
            },
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

    // ── Step 3b: Write fraud flags (fire-and-forget, never blocks the purchase) ─
    if (isHighValue || isRapidRepeat) {
      (async () => {
        try {
          const flags = [];
          if (isHighValue) {
            flags.push({
              transaction_reference: reference,
              buyer_email: buyerEmail,
              event_id: eventId,
              amount: cartTotalNaira,
              flag_reason: `High value purchase: ₦${cartTotalNaira.toLocaleString('en-NG')}`,
            });
          }
          if (isRapidRepeat) {
            flags.push({
              transaction_reference: reference,
              buyer_email: buyerEmail,
              event_id: eventId,
              amount: cartTotalNaira,
              flag_reason: `Rapid repeat purchase: ${rapidRepeatCount} purchases in 30 minutes`,
            });
          }
          await supabase.from('fraud_flags').insert(flags);
          console.log(`[FRAUD] Flagged transaction ${reference}: ${flags.map(f => f.flag_reason).join('; ')}`);
        } catch (flagErr) {
          console.error('[FRAUD] Failed to write fraud flag (non-blocking):', flagErr.message);
        }
      })();
    }
    // ─────────────────────────────────────────────────────────────────────────

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

    // 🔑 CRITICAL: Normalize reference
    const normalizedReference = normalizeReference(reference);

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
    const lookupTimeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Supabase transaction lookup timed out after 5 seconds')), 5000)
    );
    let { data: transaction, error: txError } = await Promise.race([
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
        // Reassign to fallback result (requires let declaration above)
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

    console.log('✅ Transaction found in DB: status=%s', transaction.status);

    // Check if already verified — return the same full shape as the normal path
    if (transaction.status === 'success') {
      console.log('✅ Transaction already verified — building full response shape');

      // Fetch event info and all split rows in parallel
      const [allRowsResult, eventResult] = await Promise.all([
        supabase
          .from('transactions')
          .select('id, reference, buyer_email, buyer_name, total_amount, ticket_price, processing_fee, platform_commission, organizer_earnings, quantity, status, created_at, verified_at, squadco_response')
          .ilike('reference', `${transaction.reference}%`)
          .eq('status', 'success')
          .order('created_at', { ascending: true }),
        supabase
          .from('events')
          .select('id, title, date, location')
          .eq('id', transaction.event_id)
          .single(),
      ]);

      const eventInfo = eventResult.data;

      const allRows = (allRowsResult.data || []).map(row => {
        const sr = typeof row.squadco_response === 'string'
          ? (() => { try { return JSON.parse(row.squadco_response); } catch(_) { return {}; } })()
          : (row.squadco_response || {});
        return {
          id: row.id,
          reference: row.reference,
          buyer_email: row.buyer_email,
          buyer_name: row.buyer_name,
          total_amount: Number(row.total_amount || 0),
          ticket_price: Number(row.ticket_price || 0),
          processing_fee: Number(row.processing_fee || 0),
          platform_commission: Number(row.platform_commission || 0),
          organizer_earnings: Number(row.organizer_earnings || 0),
          quantity: row.quantity || 1,
          ticket_type_id: sr.tier_id || null,
          ticket_type_name: sr.tier_name || null,
          status: row.status,
          created_at: row.created_at,
          verified_at: row.verified_at,
        };
      });

      return res.status(200).json({
        success: true,
        message: 'Payment already verified',
        data: {
          status: 'success',
          reference: transaction.reference,
          amount: transaction.total_amount,
          email: transaction.buyer_email,
          event_title:    eventInfo?.title    || null,
          event_date:     eventInfo?.date     || null,
          event_location: eventInfo?.location || null,
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
            event_title: eventInfo?.title || null,
          },
          all_transactions: allRows,
          ticket: null,
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

    // 🔑 CRITICAL: Call Squad verification service with 8s timeout (Vercel limit is 10s)
    console.log('🔄 Verifying with Squad API...');
    
    let result;
    try {
      // Race Squad API call against an 8-second hard deadline so we always return JSON
      const squadTimeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Squad API verification timed out after 8 seconds')), 8000)
      );
      result = await Promise.race([
        verifySquadPayment(normalizedReference),
        squadTimeoutPromise,
      ]);
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

    // ✅ ATOMIC CHECK-AND-UPDATE: Only the first concurrent call wins.
    // Using .eq('status', 'pending') means Supabase only updates if still pending.
    // If another call (webhook or retry) already set status=success, this returns no rows
    // and we exit cleanly — no double processing.
    console.log('📝 Atomically claiming transaction (pending → success)...');
    const { data: claimedRow, error: claimError } = await supabase
      .from('transactions')
      .update({
        status: 'success',
        squadco_response: {
          ...transaction.squadco_response, // cartItems, attendees preserved
          squad_verification: result.rawData,
        },
        verified_at: new Date().toISOString(),
      })
      .eq('id', transaction.id)
      .eq('status', 'pending') // ← atomic gate: only updates if still pending
      .select('id')
      .single();

    if (claimError || !claimedRow) {
      // Another call (webhook or concurrent verify) already processed this
      console.log('[RACE] Transaction already claimed by another call — returning success response without re-processing');
      // Still return a valid success response using the in-memory transaction data
      const [allRowsResult, eventInfoResult] = await Promise.all([
        supabase.from('transactions').select('id, reference, buyer_email, buyer_name, total_amount, ticket_price, processing_fee, platform_commission, organizer_earnings, quantity, status, created_at, verified_at, squadco_response').ilike('reference', `${transaction.reference}%`).eq('status', 'success').order('created_at', { ascending: true }),
        supabase.from('events').select('id, title, date, location').eq('id', transaction.event_id).single(),
      ]);
      const eventInfo = eventInfoResult.data;
      const allRows = (allRowsResult.data || []).map(row => {
        const sr = typeof row.squadco_response === 'string' ? (() => { try { return JSON.parse(row.squadco_response); } catch(_) { return {}; } })() : (row.squadco_response || {});
        return { id: row.id, reference: row.reference, buyer_email: row.buyer_email, buyer_name: row.buyer_name, total_amount: Number(row.total_amount || 0), ticket_price: Number(row.ticket_price || 0), processing_fee: Number(row.processing_fee || 0), platform_commission: Number(row.platform_commission || 0), organizer_earnings: Number(row.organizer_earnings || 0), quantity: row.quantity || 1, ticket_type_id: sr.tier_id || null, ticket_type_name: sr.tier_name || null, status: row.status, created_at: row.created_at, verified_at: row.verified_at };
      });
      return res.status(200).json({ success: true, message: 'Payment verified successfully', data: { status: 'success', reference: transaction.reference, amount: transaction.total_amount, email: transaction.buyer_email, event_title: eventInfo?.title || null, event_date: eventInfo?.date || null, event_location: eventInfo?.location || null, transaction: { id: transaction.id, reference: transaction.reference, buyer_email: transaction.buyer_email, buyer_name: transaction.buyer_name, total_amount: transaction.total_amount, ticket_price: transaction.ticket_price, processing_fee: transaction.processing_fee, platform_commission: transaction.platform_commission, organizer_earnings: transaction.organizer_earnings, status: 'success', created_at: transaction.created_at, verified_at: new Date().toISOString(), event_title: eventInfo?.title || null }, all_transactions: allRows, ticket: null } });
    }

    console.log('✅ [RACE WON] This call claimed the transaction — proceeding with full processing');

    // ─── Extract cartItems / attendees from the stored squadco_response ──────────
    let rawResponse = transaction.squadco_response || {};
    if (typeof rawResponse === 'string') {
      try { rawResponse = JSON.parse(rawResponse); } catch (_) { rawResponse = {}; }
    }
    const cartItems = Array.isArray(rawResponse.cartItems) ? rawResponse.cartItems : [];
    const attendees = Array.isArray(rawResponse.attendees) ? rawResponse.attendees : [];
    const buyerPhone = attendees.length > 0
      ? (attendees[0]?.phone || attendees[0]?.phoneNumber || null)
      : null;

    console.log(`[PER-TYPE] Processing ${cartItems.length} cart item(s)`);

    // ─── Fetch event details (for email only — name resolution uses item.name directly) ──
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
    // NOTE: tier_name comes directly from item.name sent by the frontend —
    // ticketTypeMap lookup removed because frontend IDs never match JSONB IDs.

    // ─── Idempotency guard ────────────────────────────────────────────────────
    // tier_name is written to squadco_response ONLY during the per-type update.
    // It is never set by a DB default. So tier_name = null → not yet processed.
    // quantity has DEFAULT 1 from migration — cannot be used as a reliable signal.
    const { data: existingPerTypeRows } = await supabase
      .from('transactions')
      .select('id, quantity, squadco_response')
      .ilike('reference', `${transaction.reference}%`)
      .eq('status', 'success');

    const existingCount = Array.isArray(existingPerTypeRows) ? existingPerTypeRows.length : 0;
    const originalRowData = existingPerTypeRows?.find(r => r.id === transaction.id);
    const originalRowSr = typeof originalRowData?.squadco_response === 'string'
      ? (() => { try { return JSON.parse(originalRowData.squadco_response); } catch(_) { return {}; } })()
      : (originalRowData?.squadco_response || {});
    // tier_name is null until the per-type update runs → reliable processed signal
    const originalRowHasQuantity = originalRowSr.tier_name !== null && originalRowSr.tier_name !== undefined;

    const alreadyExpanded = cartItems.length > 1
      ? existingCount >= cartItems.length   // multi-item: all rows written
      : originalRowHasQuantity;             // single-item: tier_name written = already processed

    console.log(`[PER-TYPE] idempotency check: existingCount=${existingCount}, cartItems.length=${cartItems.length}, tier_name=${originalRowSr.tier_name ?? 'null'}, alreadyExpanded=${alreadyExpanded}`);

    // ─── Per-ticket-type transaction rows ─────────────────────────────────────
    // Strategy: one DB row per cart item (ticket type).
    //   • Row 0  → update the original pending transaction in-place
    //   • Row 1+ → insert new rows, each with their own ticket_type_id
    // The processing fee (charged once per order) lives on row 0 only.
    const perTypeTxIds = [transaction.id];
    const verifiedAt = new Date().toISOString();

    if (cartItems.length > 0 && !alreadyExpanded) {
      // ── Row 0: update the original transaction ──────────────────────────────
      const firstItem = cartItems[0];
      // Resolve tier ID — cart items use string IDs like "1780299070611-uck9go" (not UUIDs)
      // ticket_type_id column is UUID type so we CANNOT write these string IDs there.
      // Instead we store tier_id and tier_name inside squadco_response JSONB on each row.
      const firstTypeId = firstItem.id || firstItem.ticket_type_id || firstItem.ticketTypeId || firstItem.typeId || firstItem.type_id || null;
      // ✅ FIX: Use item.name directly — frontend always populates it.
      // ticketTypeMap lookup removed — frontend IDs never match event JSONB IDs.
      const firstTypeName = firstItem.name || firstItem.typeName || firstItem.type_name || null;
      const firstItemQty = parseInt(firstItem.quantity) || 1;
      const firstItemUnitPrice = parseFloat(firstItem.price || firstItem.ticket_price || 0);
      const firstItemPrice = firstItemUnitPrice * firstItemQty;
      // Processing fee belongs entirely on the first row (charged once per order)
      const orderProcessingFee = transaction.processing_fee || 0;
      const firstPlatformCommission = firstItemPrice * 0.03;
      const firstOrganizerEarnings = firstItemPrice * 0.97;

      console.log(`[PER-TYPE] Updating row 0: tier_id=${firstTypeId} (${firstTypeName}), qty=${firstItemQty}, unit=₦${firstItemUnitPrice}, total=₦${firstItemPrice}`);

      const { error: updateFirstErr } = await supabase
        .from('transactions')
        .update({
          // ticket_type_id is UUID type — cannot store string tier IDs there
          // Store tier info in squadco_response JSONB instead
          squadco_response: {
            ...(typeof transaction.squadco_response === 'object' ? transaction.squadco_response : {}),
            tier_id: firstTypeId,
            tier_name: firstTypeName,
          },
          ticket_price: firstItemPrice,
          processing_fee: orderProcessingFee,
          total_amount: firstItemPrice + orderProcessingFee,
          platform_commission: firstPlatformCommission,
          organizer_earnings: firstOrganizerEarnings,
          quantity: firstItemQty,
          attendees: attendees,
          buyer_phone: buyerPhone,
        })
        .eq('id', transaction.id);

      if (updateFirstErr) {
        console.error('❌ Row 0 update failed:', updateFirstErr.message);
        // Don't throw — but log clearly so we can catch it in Render logs
      } else {
        console.log(`[PER-TYPE] Row 0 updated: tier_id=${firstTypeId}, tier_name=${firstTypeName}`);
      }

      // ── Rows 1+: insert one row per additional cart item ───────────────────
      for (let i = 1; i < cartItems.length; i++) {
        const item = cartItems[i];
        // Resolve tier ID for this specific item (NOT firstItem)
        const typeId = item.id || item.ticket_type_id || item.ticketTypeId || item.typeId || item.type_id || null;
        // ✅ FIX: Use item.name directly
        const typeName = item.name || item.typeName || item.type_name || null;
        const itemQty = parseInt(item.quantity) || 1;
        const itemUnitPrice = parseFloat(item.price || item.ticket_price || 0);
        const itemPrice = itemUnitPrice * itemQty;
        const itemPlatformCommission = itemPrice * 0.03;
        const itemOrganizerEarnings = itemPrice * 0.97;

        console.log(`[PER-TYPE] Inserting row ${i}: tier_id=${typeId} (${typeName}), qty=${itemQty}, unit=₦${itemUnitPrice}, total=₦${itemPrice}`);

        const { data: newTx, error: newTxErr } = await supabase
          .from('transactions')
          .insert([{
            // Append _N suffix so this row has a unique reference
            // (the transactions table has a unique constraint on reference)
            reference: `${transaction.reference}_${i}`,
            event_id: transaction.event_id,
            organizer_id: transaction.organizer_id,
            buyer_email: transaction.buyer_email,
            buyer_name: transaction.buyer_name,
            buyer_phone: buyerPhone,
            // ticket_type_id is UUID type — store tier info in squadco_response instead
            squadco_response: {
              ...(typeof transaction.squadco_response === 'object' ? transaction.squadco_response : {}),
              tier_id: typeId,
              tier_name: typeName,
            },
            ticket_price: itemPrice,
            processing_fee: 0,          // fee is on row 0 only
            total_amount: itemPrice,
            platform_commission: itemPlatformCommission,
            squadco_fee: 0,
            organizer_earnings: itemOrganizerEarnings,
            quantity: itemQty,
            attendees: attendees,
            status: 'success',
            verified_at: verifiedAt,
            ip_address: transaction.ip_address,
            user_agent: transaction.user_agent,
          }])
          .select('id')
          .single();

        if (newTxErr) {
          console.error(`[PER-TYPE] Failed to insert row ${i} for ticket_type_id=${typeId}:`, newTxErr.message);
        } else {
          console.log(`[PER-TYPE] Row ${i} inserted: id=${newTx.id}, ticket_type_id=${typeId}`);
          perTypeTxIds.push(newTx.id);
        }
      }

      console.log(`[PER-TYPE] Done. ${perTypeTxIds.length} row(s) for ${cartItems.length} cart item(s).`);

    } else if (cartItems.length === 0) {
      // No cartItems — store attendees on the original row only
      console.warn('[PER-TYPE] No cartItems found — storing attendees on original row only');
      await supabase
        .from('transactions')
        .update({ attendees, buyer_phone: buyerPhone })
        .eq('id', transaction.id);

    } else {
      // alreadyExpanded — rows were written on a previous verify call, skip
      console.log('[PER-TYPE] Per-type rows already exist — skipping re-insertion (idempotent)');
      for (const row of existingPerTypeRows) {
        if (row.id !== transaction.id) perTypeTxIds.push(row.id);
      }
    }

    // ─── Update event tickets_sold count ──────────────────────────────────────
    console.log('🎫 Updating event tickets_sold count...');
    try {
      const totalQuantity = cartItems.length > 0
        ? cartItems.reduce((acc, item) => acc + (parseInt(item.quantity) || 1), 0)
        : 1;

      // Only increment if we actually wrote new rows this call
      if (!alreadyExpanded) {
        // ✅ Atomic increment — read then write with fresh DB value to avoid stale-read double-count
        const { data: freshEvent, error: freshErr } = await supabase
          .from('events')
          .select('tickets_sold')
          .eq('id', transaction.event_id)
          .single();

        if (freshErr) {
          console.error('⚠️ Failed to re-fetch event for tickets_sold:', freshErr.message);
        } else {
          const currentTicketsSold = freshEvent?.tickets_sold || 0;
          const newTicketsSold = currentTicketsSold + totalQuantity;

          const { error: updateEventError } = await supabase
            .from('events')
            .update({ tickets_sold: newTicketsSold })
            .eq('id', transaction.event_id);

          if (updateEventError) {
            console.error('⚠️ Failed to update event tickets_sold:', updateEventError);
          } else {
            console.log(`✅ Event tickets_sold: ${currentTicketsSold} → ${newTicketsSold} (+${totalQuantity})`);
          }
        }
      } else {
        console.log('[PER-TYPE] Skipping tickets_sold increment — already counted on first verify');
      }
    } catch (eventError) {
      console.error('⚠️ Error updating event tickets_sold (non-blocking):', eventError);
    }

    // ─── Credit organizer wallet ───────────────────────────────────────────────
    if (!alreadyExpanded) {
      const totalOrganizerEarnings = cartItems.length > 0
        ? cartItems.reduce((sum, item) => {
            const itemPrice = parseFloat(item.price || item.ticket_price || 0) * (parseInt(item.quantity) || 1);
            return sum + (itemPrice * 0.97);
          }, 0)
        : (transaction.organizer_earnings || 0);

      if (totalOrganizerEarnings > 0) {
        console.log('💰 Crediting organizer wallet: ₦' + totalOrganizerEarnings);
        const walletResult = await creditOrganizerWallet(
          transaction.organizer_id,
          totalOrganizerEarnings
        );
        if (walletResult.success) {
          console.log(`✅ Wallet credited: ₦${totalOrganizerEarnings} to organizer ${transaction.organizer_id}`);
        } else {
          console.error('⚠️ Wallet credit failed (non-blocking):', walletResult.error);
        }
      }
    } else {
      console.log('[PER-TYPE] Skipping wallet credit — already credited on first verify');
    }

    // ─── Send confirmation email ───────────────────────────────────────────────
    if (!alreadyExpanded) {
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
    }

    // 🔑 Fetch all rows for this reference (per-type split rows)
    // Use both reference prefix match AND direct ID lookup via perTypeTxIds for reliability
    const allRowsResult = await supabase
      .from('transactions')
      .select('id, reference, buyer_email, buyer_name, total_amount, ticket_price, processing_fee, platform_commission, organizer_earnings, quantity, status, created_at, verified_at, squadco_response')
      .in('id', perTypeTxIds.length > 1 ? perTypeTxIds : [transaction.id])
      .order('created_at', { ascending: true });

    const allRows = (allRowsResult.data || []).map(row => {
      const sr = typeof row.squadco_response === 'string'
        ? (() => { try { return JSON.parse(row.squadco_response); } catch(_) { return {}; } })()
        : (row.squadco_response || {});
      return {
        id: row.id,
        reference: row.reference,
        buyer_email: row.buyer_email,
        buyer_name: row.buyer_name,
        total_amount: Number(row.total_amount || 0),
        ticket_price: Number(row.ticket_price || 0),
        processing_fee: Number(row.processing_fee || 0),
        platform_commission: Number(row.platform_commission || 0),
        organizer_earnings: Number(row.organizer_earnings || 0),
        quantity: row.quantity || 1,
        ticket_type_id: sr.tier_id || null,
        ticket_type_name: sr.tier_name || null,
        status: row.status,
        created_at: row.created_at,
        verified_at: row.verified_at,
      };
    });

    // Use eventData already fetched above — no redundant DB call needed
    return res.status(200).json({
      // ─────────────────────────────────────────────────────────────────────────
      // ⚠️  PRODUCTION CONTRACT — DO NOT CHANGE SHAPE WITHOUT FRONTEND SIGN-OFF
      //
      //  POST /api/v1/payments/squad/verify
      //  Required fields (frontend reads these directly):
      //    data.transaction.reference
      //    data.transaction.buyer_name
      //    data.transaction.buyer_email
      //    data.transaction.total_amount
      //    data.transaction.status
      //    data.transaction.created_at
      //    data.transaction.event_title
      //    data.all_transactions[].ticket_type_name
      //    data.all_transactions[].ticket_price
      //    data.all_transactions[].quantity
      //    data.all_transactions[].total_amount
      //    data.event_title
      //    data.event_date
      //    data.event_location
      // ─────────────────────────────────────────────────────────────────────────
      success: true,
      message: 'Payment verified successfully',
      data: {
        status: 'success',
        reference: transaction.reference,
        amount: transaction.total_amount,
        email: transaction.buyer_email,
        event_title: eventData?.title || null,
        event_date: eventData?.date || null,
        event_location: eventData?.location || null,
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
          status: 'success',
          created_at: transaction.created_at,
          verified_at: new Date().toISOString(),
          event_title: eventData?.title || null,
        },
        all_transactions: allRows,
        ticket: null,
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
 * Webhook handler for Squad payment notifications
 * POST /api/v1/payments/squad/callback
 *
 * Squad POSTs here when a payment is finalized.
 * ALWAYS return 200 — Squad retries on non-200 which would double-process.
 * Signature: x-squad-encrypted-body header = HMAC-SHA512(rawBody, SQUADCO_API_KEY)
 */
export const callbackHandler = async (req, res) => {
  const startTs = new Date().toISOString();

  // ── 1. Signature verification ─────────────────────────────────────────────
  // Squad signs the raw body with HMAC-SHA512 using your secret key.
  // The signature is in the x-squad-encrypted-body header.
  try {
    const signature = req.headers['x-squad-encrypted-body'];
    if (signature && process.env.SQUADCO_API_KEY) {
      const { createHmac } = await import('crypto');
      const rawBody = JSON.stringify(req.body);
      const expected = createHmac('sha512', process.env.SQUADCO_API_KEY)
        .update(rawBody)
        .digest('hex');
      if (signature.toLowerCase() !== expected.toLowerCase()) {
        console.warn('[WEBHOOK] ⚠️ Signature mismatch — possible spoofed request. Ignoring.', {
          received: signature.substring(0, 20) + '...',
          timestamp: startTs,
        });
        // Return 200 so Squad doesn't retry (the payload is invalid anyway)
        return res.status(200).json({ success: false, message: 'Signature mismatch' });
      }
      console.log('[WEBHOOK] ✅ Signature verified');
    } else {
      console.warn('[WEBHOOK] ⚠️ No signature header — proceeding without verification');
    }
  } catch (sigErr) {
    console.error('[WEBHOOK] Signature check error (non-blocking):', sigErr.message);
  }

  const callbackData = req.body;
  console.log('[WEBHOOK] Received:', {
    transaction_ref: callbackData.transaction_ref,
    status: callbackData.status,
    amount: callbackData.amount,
    timestamp: startTs,
  });

  // ── 2. Always return 200 immediately so Squad doesn't retry ───────────────
  // Processing happens asynchronously below.
  res.status(200).json({ success: true, message: 'Webhook received' });

  // ── 3. Only process success events ───────────────────────────────────────
  const transactionRef = callbackData.transaction_ref;
  const paymentStatus  = callbackData.transaction_status || callbackData.status;

  if (!transactionRef) {
    console.warn('[WEBHOOK] Missing transaction_ref — skipping');
    return;
  }
  if (paymentStatus !== 'success') {
    console.log(`[WEBHOOK] Status is '${paymentStatus}' — no action needed`);
    return;
  }

  // ── 4. Full post-payment processing (async, after 200 already sent) ───────
  (async () => {
    try {
      const normalizedRef = normalizeReference(transactionRef);
      console.log('[WEBHOOK] Processing success for reference:', normalizedRef);

      // Look up the transaction
      const { data: transaction, error: txErr } = await supabase
        .from('transactions')
        .select('*')
        .eq('reference', normalizedRef)
        .maybeSingle();

      if (txErr || !transaction) {
        console.error('[WEBHOOK] Transaction not found:', normalizedRef, txErr?.message);
        return;
      }

      // ── Idempotency: already processed ──────────────────────────────────
      if (transaction.status === 'success') {
        console.log('[WEBHOOK] Already success — skipping (idempotent)');
        return;
      }

      console.log('[WEBHOOK] Marking transaction as success:', transaction.id);

      // ✅ ATOMIC CHECK-AND-UPDATE: Only the first concurrent call wins.
      const { data: claimedRow, error: claimErr } = await supabase
        .from('transactions')
        .update({
          status: 'success',
          squadco_response: {
            ...transaction.squadco_response,
            squad_webhook: callbackData,
          },
          verified_at: new Date().toISOString(),
        })
        .eq('id', transaction.id)
        .eq('status', 'pending') // ← atomic gate
        .select('id')
        .single();

      if (claimErr || !claimedRow) {
        console.log('[WEBHOOK] [RACE] Transaction already claimed — skipping processing');
        return;
      }

      console.log('[WEBHOOK] ✅ [RACE WON] Claimed transaction — proceeding with full processing');

      // ── Parse cartItems / attendees ──────────────────────────────────────
      let rawResponse = transaction.squadco_response || {};
      if (typeof rawResponse === 'string') {
        try { rawResponse = JSON.parse(rawResponse); } catch(_) { rawResponse = {}; }
      }
      const cartItems = Array.isArray(rawResponse.cartItems) ? rawResponse.cartItems : [];
      const attendees = Array.isArray(rawResponse.attendees) ? rawResponse.attendees : [];
      const buyerPhone = attendees.length > 0
        ? (attendees[0]?.phone || attendees[0]?.phoneNumber || null)
        : null;

      // ── Fetch event for email (name comes from item.name, not ticketTypeMap) ──
      let eventData = null;
      try {
        const { data: ev } = await supabase
          .from('events')
          .select('id, title, date, end_date, start_time, end_time, location, organizer_id, tickets_sold, total_tickets, ticket_types')
          .eq('id', transaction.event_id)
          .single();
        eventData = ev;
      } catch (_) {}
      // NOTE: tier_name comes directly from item.name — ticketTypeMap removed.

      // ── Per-type split (same idempotency as verify path) ─────────────────
      const { data: existingRows } = await supabase
        .from('transactions')
        .select('id, quantity')
        .ilike('reference', `${transaction.reference}%`)
        .eq('status', 'success');

      const existingCount = Array.isArray(existingRows) ? existingRows.length : 0;
      const alreadyExpanded = cartItems.length > 0
        ? existingCount >= cartItems.length
        : existingCount > 1;

      console.log(`[WEBHOOK] Per-type: existingCount=${existingCount}, cartItems=${cartItems.length}, alreadyExpanded=${alreadyExpanded}`);

      if (cartItems.length > 0 && !alreadyExpanded) {
        const verifiedAt = new Date().toISOString();
        const splitRows = []; // track for verification log
        const firstItem = cartItems[0];
        const firstTypeId = firstItem.id || firstItem.ticket_type_id || null;
        // ✅ FIX: Use item.name directly — frontend always sends it
        const firstTypeName = firstItem.name || null;
        const firstQty = parseInt(firstItem.quantity) || 1;
        const firstPrice = parseFloat(firstItem.price || firstItem.ticket_price || 0) * firstQty;
        const orderProcessingFee = transaction.processing_fee || 0;

        const { error: row0Err } = await supabase.from('transactions').update({
          squadco_response: { ...(typeof transaction.squadco_response === 'object' ? transaction.squadco_response : {}), tier_id: firstTypeId, tier_name: firstTypeName },
          ticket_price: firstPrice,
          processing_fee: orderProcessingFee,
          total_amount: firstPrice + orderProcessingFee,
          platform_commission: firstPrice * 0.03,
          organizer_earnings: firstPrice * 0.97,
          quantity: firstQty,
          attendees,
          buyer_phone: buyerPhone,
        }).eq('id', transaction.id);

        if (row0Err) {
          console.error('[WEBHOOK] ❌ Row 0 update failed:', row0Err.message);
          // Don't throw — log clearly so we can catch it in Render logs
        }

        splitRows.push({ ref: transaction.reference, qty: firstQty, tier_name: firstTypeName });

        for (let i = 1; i < cartItems.length; i++) {
          const item = cartItems[i];
          const typeId = item.id || item.ticket_type_id || null;
          // ✅ FIX: Use item.name directly
          const typeName = item.name || null;
          const itemQty = parseInt(item.quantity) || 1;
          const itemPrice = parseFloat(item.price || item.ticket_price || 0) * itemQty;

          const { error: insertErr } = await supabase.from('transactions').insert([{
            reference: `${transaction.reference}_${i}`,
            event_id: transaction.event_id,
            organizer_id: transaction.organizer_id,
            buyer_email: transaction.buyer_email,
            buyer_name: transaction.buyer_name,
            buyer_phone: buyerPhone,
            squadco_response: { ...(typeof transaction.squadco_response === 'object' ? transaction.squadco_response : {}), tier_id: typeId, tier_name: typeName },
            ticket_price: itemPrice,
            processing_fee: 0,
            total_amount: itemPrice,
            platform_commission: itemPrice * 0.03,
            squadco_fee: 0,
            organizer_earnings: itemPrice * 0.97,
            quantity: itemQty,
            attendees,
            status: 'success',
            verified_at: verifiedAt,
            ip_address: transaction.ip_address,
            user_agent: transaction.user_agent,
          }]);

          if (insertErr) console.error(`[WEBHOOK] Insert row ${i} failed:`, insertErr.message);
          else {
            splitRows.push({ ref: `${transaction.reference}_${i}`, qty: itemQty, tier_name: typeName });
            console.log(`[WEBHOOK] Row ${i} inserted for tier '${typeName}'`);
          }
        }

        // ✅ Verification log — check in Render logs after test payment
        console.log('[WEBHOOK] Split complete. Rows inserted:', JSON.stringify(splitRows));
      }

      // ── Update event tickets_sold ─────────────────────────────────────────
      if (!alreadyExpanded) {
        try {
          const totalQty = cartItems.length > 0
            ? cartItems.reduce((acc, item) => acc + (parseInt(item.quantity) || 1), 0)
            : 1;
          const { data: freshEvent } = await supabase.from('events').select('tickets_sold').eq('id', transaction.event_id).single();
          await supabase.from('events').update({ tickets_sold: (freshEvent?.tickets_sold || 0) + totalQty }).eq('id', transaction.event_id);
          console.log(`[WEBHOOK] tickets_sold +${totalQty}`);
        } catch (e) { console.error('[WEBHOOK] tickets_sold update error:', e.message); }
      }

      // ── Credit organizer wallet ───────────────────────────────────────────
      if (!alreadyExpanded) {
        const totalEarnings = cartItems.length > 0
          ? cartItems.reduce((s, item) => s + parseFloat(item.price || item.ticket_price || 0) * (parseInt(item.quantity) || 1) * 0.97, 0)
          : (transaction.organizer_earnings || 0);

        if (totalEarnings > 0) {
          const walletResult = await creditOrganizerWallet(transaction.organizer_id, totalEarnings);
          if (walletResult.success) console.log(`[WEBHOOK] Wallet credited ₦${totalEarnings}`);
          else console.error('[WEBHOOK] Wallet credit failed:', walletResult.error);
        }
      }

      // ── Send confirmation email ───────────────────────────────────────────
      if (!alreadyExpanded) {
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
          console.log('[WEBHOOK] ✅ Confirmation email sent to', transaction.buyer_email);
        } catch (emailErr) {
          console.error('[WEBHOOK] Email send failed (non-blocking):', emailErr.message);
        }
      }

      console.log('[WEBHOOK] ✅ Full processing complete for', normalizedRef);
    } catch (err) {
      console.error('[WEBHOOK] Async processing error:', err.message, err.stack);
      // Do not rethrow — 200 already sent, Squad must not retry
    }
  })();
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
