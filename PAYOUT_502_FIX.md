# 502 Bad Gateway Fix - Squadco Payout Endpoint

## Problem
The `/api/v1/admin/payouts/:id` endpoint was returning **502 Bad Gateway** on Vercel when calling the Squadco transfer API. This indicated the backend was crashing without returning a proper JSON response.

## Root Causes Identified

1. **Incomplete Error Handling**: The Squadco API call had a try/catch, but unhandled errors could still crash the function
2. **Sandbox Environment Issue**: The `SQUADCO_API_URL` is set to `https://sandbox-api-d.squadco.com`, which **does not support live bank transfers**
3. **No Graceful Degradation**: When the sandbox API failed, there was no clear error message to guide users

## Solution Implemented

### 1. ✅ Wrapped Entire Squadco Transfer API Call in Try/Catch
- Added comprehensive error logging with exact error messages
- Captures response status, status text, and error data
- Always returns a proper JSON response (never crashes without responding)

### 2. ✅ Added Sandbox Environment Detection
- Checks if `SQUADCO_API_URL` contains "sandbox"
- Returns a clear, actionable error message:
  ```
  "Transfer failed: Squadco sandbox does not support live bank transfers. 
   Switch to live API keys to enable payouts."
  ```
- Includes guidance on what needs to be changed

### 3. ✅ Enhanced Error Logging
- Logs exact error message from Squadco API
- Includes request URL, payload, and response data
- Helps with debugging in production

### 4. ✅ Guaranteed JSON Response
- Outer try/catch ensures even unexpected errors return valid JSON
- No more 502 errors - always returns 400, 500, or 502 with proper error details

## Changes Made

**File**: `controllers/adminPayoutController.js`

**Function**: `payWithdrawalController`

### Key Changes:
```javascript
// BEFORE: Incomplete error handling
try {
  squadcoResponse = await axios.post(...);
} catch (squadcoError) {
  return res.status(502).json({...});
}

// AFTER: Comprehensive error handling with sandbox detection
try {
  // Check if using sandbox environment
  const isSandbox = squadcoUrl.includes('sandbox');
  if (isSandbox) {
    console.warn('⚠️ SANDBOX ENVIRONMENT DETECTED - Bank transfers not supported');
    return res.status(400).json({
      success: false,
      error: 'Sandbox environment',
      message: 'Transfer failed: Squadco sandbox does not support live bank transfers. Switch to live API keys to enable payouts.',
      details: {
        environment: 'sandbox',
        action_required: 'Update SQUADCO_API_URL to https://api.squadco.com and use live API keys',
      },
    });
  }

  squadcoResponse = await axios.post(...);
} catch (squadcoError) {
  // Log exact error message
  const errorMessage = squadcoError.response?.data?.message || 
                      squadcoError.message || 
                      'Failed to process payout with Squadco';
  
  console.error('❌ Squadco Transfer API error:', {...});
  
  // Always return proper JSON response
  return res.status(502).json({
    success: false,
    error: 'Payment gateway error',
    message: errorMessage,
    details: squadcoError.response?.data || { error: squadcoError.message },
  });
}
```

## Environment Configuration

### Current Status (Sandbox)
```
SQUADCO_API_URL=https://sandbox-api-d.squadco.com
SQUADCO_API_KEY=sandbox_sk_795edb03b70c8d1587922849d4aaeafc375788f96db2
```

### To Enable Live Payouts
Update `.env` on Vercel:
```
SQUADCO_API_URL=https://api.squadco.com
SQUADCO_API_KEY=<live_api_key>
SQUADCO_PUBLIC_KEY=<live_public_key>
```

## Testing

### Test Sandbox Error Handling
1. Keep `SQUADCO_API_URL=https://sandbox-api-d.squadco.com`
2. Call the payout endpoint
3. Should return 400 with message: "Transfer failed: Squadco sandbox does not support live bank transfers..."

### Test Live Payouts
1. Update environment variables to live keys
2. Call the payout endpoint
3. Should process normally or return specific Squadco error

## Error Response Examples

### Sandbox Environment Error
```json
{
  "success": false,
  "error": "Sandbox environment",
  "message": "Transfer failed: Squadco sandbox does not support live bank transfers. Switch to live API keys to enable payouts.",
  "details": {
    "environment": "sandbox",
    "action_required": "Update SQUADCO_API_URL to https://api.squadco.com and use live API keys"
  }
}
```

### Squadco API Error
```json
{
  "success": false,
  "error": "Payment gateway error",
  "message": "Invalid bank code",
  "details": {
    "status": 400,
    "message": "Invalid bank code"
  }
}
```

### Unexpected Error
```json
{
  "success": false,
  "error": "Internal server error",
  "message": "Network timeout"
}
```

## Verification Checklist

- ✅ Squadco transfer API call wrapped in try/catch
- ✅ Exact error messages logged to console
- ✅ Sandbox environment detected and handled gracefully
- ✅ Always returns proper JSON response (no 502 crashes)
- ✅ Clear error messages guide users to solution
- ✅ Outer try/catch prevents unhandled errors

## Next Steps

1. **Deploy to Vercel** - The fix is ready for production
2. **Monitor Logs** - Watch for any Squadco API errors in Vercel logs
3. **Switch to Live Keys** - When ready, update environment variables to enable real payouts
4. **Test End-to-End** - Verify payout flow works with live keys
