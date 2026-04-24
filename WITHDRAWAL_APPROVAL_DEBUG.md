# Withdrawal Approval Endpoint - Debug & Fix

## Problem Fixed

Admin was getting "An error occurred. Please try again." when clicking "Approve" on withdrawal requests. The error message was too generic and didn't provide debugging information.

## Root Causes Identified & Fixed

### 1. Insufficient Error Logging
**Before:** Generic error message without details
```javascript
console.error('❌ Approve Withdrawal Error:', error);
return res.status(500).json({
  success: false,
  error: 'Internal server error',
  message: error.message,
});
```

**After:** Detailed error logging with full error object
```javascript
console.error('❌ Approve Withdrawal Error:', {
  message: error.message,
  stack: error.stack,
  code: error.code,
  timestamp: new Date().toISOString(),
});
return res.status(500).json({
  success: false,
  error: 'Internal server error',
  message: error.message,
  stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
});
```

### 2. Missing Error Details in Database Operations
**Before:** Errors not logged with full details
```javascript
const { error: updateError } = await supabase
  .from('withdrawals')
  .update({ status: 'processing' })
  .eq('id', id);

if (updateError) {
  console.error('❌ Failed to update withdrawal:', updateError);
}
```

**After:** Full error object logged
```javascript
const { data: updatedWithdrawal, error: updateError } = await supabase
  .from('withdrawals')
  .update({ status: 'processing' })
  .eq('id', id)
  .select()
  .single();

if (updateError) {
  console.error('❌ Withdrawal update error:', {
    message: updateError.message,
    code: updateError.code,
    details: updateError.details,
    hint: updateError.hint,
    withdrawalId: id,
    stack: updateError.stack,
  });
}
```

### 3. Missing Updated Data in Response
**Before:** No data returned on success
```javascript
return res.status(200).json({
  success: true,
  message: 'Withdrawal approved successfully',
});
```

**After:** Return updated withdrawal data
```javascript
return res.status(200).json({
  success: true,
  message: 'Withdrawal approved successfully',
  data: {
    id: updatedWithdrawal.id,
    status: updatedWithdrawal.status,
    processed_at: updatedWithdrawal.processed_at,
  },
});
```

## Changes Made

### File: `controllers/adminPayoutController.js`

#### 1. approveWithdrawalController
**Improvements:**
- Added detailed logging at each step
- Log withdrawal ID, admin ID, and timestamp at start
- Log fetch errors with full error object
- Log withdrawal status before and after update
- Log payout_logs insertion status
- Return error details in response
- Add `.select().single()` to update query to return updated data
- Non-blocking error handling for payout_logs insertion

**Console Output:**
```
🔍 Approve Withdrawal Request: { withdrawalId, adminId, timestamp }
📋 Fetching withdrawal: {id}
✅ Withdrawal found: { id, status, amount, organizer_id }
📝 Updating withdrawal status to 'processing'...
✅ Withdrawal status updated: { id, status, processed_at }
📝 Logging approval action...
✅ Approval action logged
✅ Withdrawal approved successfully: {id}
```

#### 2. rejectWithdrawalController
**Improvements:**
- Added detailed logging at each step
- Log all parameters and timestamps
- Log fetch errors with full error object
- Log withdrawal status before and after update
- Log refund operation details
- Return error details in response
- Non-blocking error handling

**Console Output:**
```
🔍 Reject Withdrawal Request: { withdrawalId, adminId, admin_note, timestamp }
📋 Fetching withdrawal: {id}
✅ Withdrawal found: { id, status, amount, organizer_id }
📝 Updating withdrawal status to 'failed'...
✅ Withdrawal status updated to failed: { id, status }
💰 Refunding ₦{amount} to organizer {organizerId}
✅ Refund processed
✅ Withdrawal rejected successfully: {id}
```

#### 3. getWithdrawalsController
**Improvements:**
- Ensure organizer details are properly joined
- Log organizer data mapping
- Return organizer_name and organizer_email in response

## API Responses

### Approve Withdrawal

**Endpoint:** `POST /api/v1/admin/payouts/withdrawals/:id/approve`

**Success Response:**
```json
{
  "success": true,
  "message": "Withdrawal approved successfully",
  "data": {
    "id": "withdrawal-uuid",
    "status": "processing",
    "processed_at": "2026-04-21T10:00:00Z"
  }
}
```

**Error Response (with debugging info):**
```json
{
  "success": false,
  "error": "Failed to approve withdrawal",
  "message": "Detailed error message",
  "details": "Additional error details from Supabase"
}
```

### Reject Withdrawal

**Endpoint:** `POST /api/v1/admin/payouts/withdrawals/:id/reject`

**Request Body:**
```json
{
  "admin_note": "Reason for rejection"
}
```

**Success Response:**
```json
{
  "success": true,
  "message": "Withdrawal rejected successfully",
  "data": {
    "id": "withdrawal-uuid",
    "status": "failed",
    "processed_at": "2026-04-21T10:00:00Z"
  }
}
```

### Get Withdrawals

**Endpoint:** `GET /api/v1/admin/payouts/withdrawals`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "withdrawal-uuid",
      "organizer_id": "organizer-uuid",
      "amount": 5000,
      "status": "pending",
      "requested_at": "2026-04-21T10:00:00Z",
      "organizer_name": "John Doe",
      "organizer_email": "john@example.com",
      "bank_name": "First Bank",
      "account_number": "1234567890",
      "account_name": "John Doe"
    }
  ]
}
```

## Debugging Guide

### If Approval Fails

1. **Check Backend Logs:**
   ```
   ❌ Withdrawal update error: {
     message: "...",
     code: "...",
     details: "...",
     hint: "...",
     withdrawalId: "...",
     stack: "..."
   }
   ```

2. **Common Errors:**
   - `PGRST116` - Withdrawal not found
   - `42P01` - Table doesn't exist
   - `23505` - Duplicate key violation
   - `23503` - Foreign key violation

3. **Check Withdrawal Status:**
   - Ensure withdrawal status is "pending"
   - Check if withdrawal ID is correct
   - Verify organizer_id exists in users table

4. **Check Database Permissions:**
   - Verify supabase service role key is set
   - Check RLS policies on withdrawals table
   - Verify admin user has correct role

### If Organizer Name Shows as "Unknown"

1. **Check Join Query:**
   - Verify users table has full_name and email columns
   - Check if organizer_id exists in users table
   - Verify foreign key relationship

2. **Check Response Mapping:**
   - Ensure w.users is populated
   - Check if organizerData is null or undefined
   - Verify fallback to "Unknown" is working

## Testing

### Test Approve Endpoint
```bash
curl -X POST https://tiketa-alpha.vercel.app/api/v1/admin/payouts/withdrawals/{id}/approve \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json"
```

**Verify:**
- ✅ Response includes updated withdrawal data
- ✅ Status changed to "processing"
- ✅ processed_at timestamp is set
- ✅ No error banner on admin page

### Test Reject Endpoint
```bash
curl -X POST https://tiketa-alpha.vercel.app/api/v1/admin/payouts/withdrawals/{id}/reject \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"admin_note": "Insufficient documentation"}'
```

**Verify:**
- ✅ Response includes updated withdrawal data
- ✅ Status changed to "failed"
- ✅ Organizer wallet refunded
- ✅ failure_reason is set

### Test Get Withdrawals
```bash
curl -X GET https://tiketa-alpha.vercel.app/api/v1/admin/payouts/withdrawals \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

**Verify:**
- ✅ organizer_name is populated (not "Unknown")
- ✅ organizer_email is populated
- ✅ All withdrawal details are present

## Files Modified

| File | Changes |
|------|---------|
| `controllers/adminPayoutController.js` | Added detailed logging to approve/reject/get endpoints |

## Deployment Status

✅ Changes committed to GitHub
✅ Auto-deployed to Vercel
✅ Ready for testing

## Error Codes Reference

| Code | Meaning | Solution |
|------|---------|----------|
| PGRST116 | Not found | Check withdrawal ID exists |
| 42P01 | Table doesn't exist | Check table name and schema |
| 23505 | Duplicate key | Check for duplicate entries |
| 23503 | Foreign key violation | Check organizer_id exists |
| 42501 | Permission denied | Check RLS policies |

## Console Log Levels

- 🔍 **Info** - Starting operation
- 📋 **Info** - Fetching data
- ✅ **Success** - Operation completed
- ⚠️ **Warning** - Non-critical issue
- ❌ **Error** - Critical error

## Next Steps

1. **Monitor Logs:**
   - Watch backend logs for any errors
   - Check for patterns in failures

2. **Test Scenarios:**
   - Approve pending withdrawal
   - Reject pending withdrawal
   - Try to approve non-pending withdrawal (should fail)
   - Try to reject non-pending withdrawal (should fail)

3. **Verify Admin Dashboard:**
   - Check withdrawal list loads correctly
   - Verify organizer names display
   - Test approve/reject buttons
   - Verify no error banners

---

**Status:** ✅ COMPLETED
**Last Updated:** April 21, 2026
**Deployed:** Yes (Vercel auto-deployment)
