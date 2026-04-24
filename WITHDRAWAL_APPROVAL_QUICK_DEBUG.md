# Withdrawal Approval - Quick Debug Guide

## The Problem
Admin gets "An error occurred. Please try again." when clicking Approve on withdrawal requests.

## What Was Fixed

### 1. Added Detailed Error Logging
**Before:** Generic error message
**After:** Full error object with message, code, details, hint, and stack trace

### 2. Added Step-by-Step Logging
Each operation now logs:
- ✅ Withdrawal fetched
- ✅ Status validated
- ✅ Database updated
- ✅ Action logged

### 3. Return Error Details in Response
**Before:** No error details returned
**After:** Error details included in response for debugging

### 4. Fixed Organizer Name Display
**Before:** "Unknown" organizer names
**After:** Proper join with users table to fetch organizer details

## Console Logs

When approving a withdrawal:
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

## API Responses

### Success
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

### Error (with debugging info)
```json
{
  "success": false,
  "error": "Failed to approve withdrawal",
  "message": "Detailed error message",
  "details": "Additional error details"
}
```

## Testing

### Test Approve
```bash
curl -X POST https://tiketa-alpha.vercel.app/api/v1/admin/payouts/withdrawals/{id}/approve \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### Test Reject
```bash
curl -X POST https://tiketa-alpha.vercel.app/api/v1/admin/payouts/withdrawals/{id}/reject \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"admin_note": "Reason"}'
```

### Test Get Withdrawals
```bash
curl -X GET https://tiketa-alpha.vercel.app/api/v1/admin/payouts/withdrawals \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

## Verify

- ✅ Approve button works without error
- ✅ Withdrawal status changes to "processing"
- ✅ Organizer names display correctly (not "Unknown")
- ✅ No error banner on admin page
- ✅ Backend logs show detailed information

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| "Withdrawal not found" | Wrong ID | Check withdrawal ID |
| "Invalid status" | Not pending | Check withdrawal status |
| "Permission denied" | RLS policy | Check admin role |
| "Unknown" organizer | Join failed | Check users table |

## Files Changed

- `controllers/adminPayoutController.js` - Added detailed logging

## Status

✅ Fixed
✅ Deployed
✅ Ready for testing

---

**Last Updated:** April 21, 2026
