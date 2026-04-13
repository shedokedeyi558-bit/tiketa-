import axios from 'axios';
import crypto from 'crypto';

const SQUADCO_API_KEY = process.env.SQUADCO_API_KEY;
const SQUADCO_PUBLIC_KEY = process.env.SQUADCO_PUBLIC_KEY;
const MOCK_MODE = process.env.MOCK_PAYMENT === 'true'; // Enable mock mode for testing

// Correct Squadco API URLs
const SQUADCO_API_URL = process.env.NODE_ENV === 'production' 
  ? 'https://api.squadco.com' 
  : 'https://sandbox-api.squadco.com';

/**
 * Verify payment with Squadco API
 * CRITICAL: This is the source of truth for payment verification
 */
export const verifySquadcoPayment = async (reference) => {
  try {
    if (!SQUADCO_API_KEY) {
      throw new Error('SQUADCO_API_KEY not configured');
    }

    console.log('📤 Squadco Verify Request:', {
      url: `${SQUADCO_API_URL}/transaction/verify/${reference}`,
      reference,
      apiKeyPrefix: SQUADCO_API_KEY.substring(0, 10) + '...',
    });

    // Query Squadco API for transaction status
    const response = await axios.get(
      `${SQUADCO_API_URL}/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${SQUADCO_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000, // 10 second timeout
      }
    );

    console.log('✅ Squadco Verify Response:', {
      status: response.status,
      paymentStatus: response.data?.status,
      hasAmount: !!response.data?.amount,
    });

    const rootData = response.data;

    // Validate response structure
    if (!rootData || !rootData.data) {
      console.error('❌ Invalid Squadco response structure:', rootData);
      return {
        success: false,
        error: 'Invalid Squadco response',
        response: rootData,
      };
    }
    
    const data = rootData.data;

    // CRITICAL: Use correct field name for transaction status
    const status = data.transaction_status || data.status;

    // Check if payment was successful
    if (status !== 'success') {
      console.warn('⚠️ Payment not successful:', status);
      return {
        success: false,
        error: `Payment status: ${status}`,
        response: data,
      };
    }

    // Validate required fields
    if (!data.amount || !data.reference) {
      console.error('❌ Missing required fields in Squadco response:', { amount: data.amount, reference: data.reference });
      return {
        success: false,
        error: 'Missing required fields in Squadco response',
        response: rootData,
      };
    }

    return {
      success: true,
      reference: data.reference,
      amount: data.amount / 100, // Convert from kobo to Naira if needed
      status,
      response: data,
    };
  } catch (error) {
    console.error('❌ Squadco verification error:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      code: error.code,
    });
    return {
      success: false,
      error: error.message || 'Verification failed',
      response: null,
    };
  }
};

/**
 * Initiate payment with Squadco
 * Returns payment URL for frontend redirect
 * 
 * CORRECT IMPLEMENTATION:
 * - Endpoint: POST https://sandbox-api-d.squadco.com/transaction/initiate
 * - Field names: transaction_ref (NOT reference), callback_url (NOT CallBack_URL)
 * - initiate_type: "inline" for embedded checkout
 */
export const initiateSquadcoPayment = async (paymentData) => {
  try {
    if (!SQUADCO_API_KEY && !MOCK_MODE) {
      throw new Error('SQUADCO_API_KEY not configured');
    }

    console.log('🔑 KEY LENGTH:', SQUADCO_API_KEY?.length || 'MOCK MODE');
    console.log('🔑 KEY START:', SQUADCO_API_KEY?.substring(0, 10) || 'MOCK MODE');
    console.log('🌐 API BASE URL:', SQUADCO_API_URL);
    console.log('📍 NODE_ENV:', process.env.NODE_ENV);
    console.log('🎭 MOCK MODE:', MOCK_MODE);

    const {
      reference,
      amount,
      email,
      fullName,
      eventTitle,
      callbackUrl,
    } = paymentData;

    // Validate inputs
    if (!reference || !amount || !email || !fullName) {
      throw new Error('Missing required payment data');
    }

    // MOCK MODE: Return fake checkout URL for testing
    if (MOCK_MODE) {
      console.log('🎭 MOCK MODE ENABLED - Returning fake checkout URL');
      const mockCheckoutUrl = `https://checkout.squadco.com/mock?reference=${reference}&amount=${amount}`;
      console.log('✅ MOCK CHECKOUT URL:', mockCheckoutUrl);
      return {
        success: true,
        checkoutUrl: mockCheckoutUrl,
        reference: reference,
      };
    }

    // 🔑 CRITICAL FIX: Use the passed reference, don't generate a new one!
    // This ensures the reference matches what's stored in the database
    const transactionRef = reference;

    // Create payment request with CORRECT field names
    // CRITICAL: Squadco expects amount in Naira (NGN), NOT kobo
    const requestPayload = {
      amount: amount, // ✅ Amount in Naira (e.g., 5100 for ₦5,100)
      email,
      currency: 'NGN',
      initiate_type: 'inline', // ✅ Correct field name for inline checkout
      transaction_ref: transactionRef, // ✅ CORRECT field name (NOT reference)
      callback_url: callbackUrl, // ✅ CORRECT field name (NOT CallBack_URL)
    };

    console.log('📤 Squadco Request:', {
      url: `${SQUADCO_API_URL}/transaction/initiate`,
      method: 'POST',
      amountInNaira: requestPayload.amount,
      email,
      transactionRef: transactionRef,
      passedReference: reference,
      apiKeyPrefix: SQUADCO_API_KEY.substring(0, 10) + '...',
    });
    
    console.log('🔑 REFERENCE CONSISTENCY CHECK:', {
      passedReference: reference,
      usedReference: transactionRef,
      match: reference === transactionRef ? '✅ MATCH' : '❌ MISMATCH',
    });
    
    console.log('💰 Amount being sent to Squadco:', {
      amount: requestPayload.amount,
      currency: 'NGN',
      description: `Sending ₦${requestPayload.amount.toLocaleString()} to Squadco`,
    });
    
    const response = await axios.post(
      `${SQUADCO_API_URL}/transaction/initiate`,
      requestPayload,
      {
        headers: {
          Authorization: `Bearer ${SQUADCO_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000, // 10 second timeout
      }
    );

    console.log('✅ Squadco Response Status:', response.status);
    console.log('📋 SQUADCO RAW RESPONSE:', JSON.stringify(response.data, null, 2));

    const data = response.data;

    // Validate response structure
    if (!data) {
      console.error('❌ No response data from Squadco');
      throw new Error('Squadco returned empty response');
    }

    if (!data.success) {
      console.error('❌ Squadco success flag is false:', data);
      throw new Error(`Squadco error: ${data.message || 'Unknown error'}`);
    }

    if (!data.data) {
      console.error('❌ No data object in Squadco response:', data);
      throw new Error('Squadco response missing data object');
    }

    const checkoutUrl = data.data.checkout_url;
    const responseReference = data.data.transaction_ref || transactionRef;

    // 🔑 CRITICAL: Validate response reference matches what we sent
    console.log('🔑 REFERENCE VALIDATION:', {
      sentReference: transactionRef,
      responseReference: responseReference,
      match: transactionRef === responseReference ? '✅ MATCH' : '⚠️ DIFFERENT',
    });

    if (!checkoutUrl) {
      console.error('❌ No checkout_url in Squadco response:', data.data);
      throw new Error('Squadco did not return checkout URL');
    }

    console.log('✅ EXTRACTED CHECKOUT URL:', checkoutUrl);
    console.log('✅ EXTRACTED TRANSACTION REF:', responseReference);
    console.log('✅ URL VALIDATION:', {
      isHttps: checkoutUrl.startsWith('https://'),
      isSquadco: checkoutUrl.includes('squadco.com'),
      length: checkoutUrl.length,
    });

    return {
      success: true,
      checkoutUrl: checkoutUrl,
      reference: responseReference,
    };
  } catch (error) {
    console.error('❌ Squadco initiation error:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      code: error.code,
    });
    
    return {
      success: false,
      error: error.message || 'Failed to initiate payment',
    };
  }
};

/**
 * Verify Squadco webhook signature
 * Ensure callback is from Squadco
 */
export const verifySquadcoSignature = (payload, signature) => {
  try {
    if (!SQUADCO_PUBLIC_KEY) {
      console.warn('SQUADCO_PUBLIC_KEY not configured');
      return false;
    }

    // Squadco uses HMAC-SHA256 for signatures
    const hash = crypto
      .createHmac('sha256', SQUADCO_PUBLIC_KEY)
      .update(JSON.stringify(payload))
      .digest('hex');

    return hash === signature;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
};

/**
 * Handle Squadco webhook callback
 */
export const handleSquadcoCallback = async (payload) => {
  try {
    const { reference, status, amount } = payload;

    if (!reference || !status) {
      throw new Error('Invalid callback payload');
    }

    return {
      success: true,
      reference,
      status,
      amount,
    };
  } catch (error) {
    console.error('Callback handling error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};
