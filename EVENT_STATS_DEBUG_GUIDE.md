# Event Performance Stats Debugging Guide

## Overview
A new endpoint has been added to debug event performance stats and identify why `tickets_sold` might show 0 even when successful transactions exist.

## New Endpoint

### GET /api/v1/events/:id/stats
**Authentication:** Required (Bearer token)

**Purpose:** Fetch detailed performance stats for a specific event with full debugging information

**Response Format:**
```json
{
  "success": true,
  "message": "Event stats fetched successfully",
  "data": {
    "event": {
      "id": "event-uuid",
      "title": "Event Title",
      "date": "2026-04-21T10:00:00Z",
      "location": "Event Location",
      "tickets_sold": 0,
      "total_tickets": 100
    },
    "transactions": {
      "total": 5,
      "successful": 3,
      "pending": 1,
      "failed": 1
    },
    "revenue": {
      "total": 6300,
      "organizer_earnings": 6120,
      "platform_commission": 180
    },
    "tickets": {
      "count": 3,
      "total_quantity": 5
    },
    "debug": {
      "event_id_queried": "event-uuid",
      "transactions_raw": [...],
      "tickets_raw": [...]
    }
  }
}
```

## Testing Steps

### Step 1: Get Your Event ID
First, find the event you want to debug. You can get this from:
- The event creation response
- The organizer events endpoint: `GET /api/v1/events/organizer`

### Step 2: Call the Stats Endpoint
```bash
curl -X GET https://tiketa-alpha.vercel.app/api/v1/events/{event-id}/stats \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

### Step 3: Analyze the Response

#### Check 1: Event Data
```
event.tickets_sold vs transactions.successful
```
- If `tickets_sold` is 0 but `transactions.successful` > 0, there's a mismatch
- This indicates the `tickets_sold` field is not being updated when transactions succeed

#### Check 2: Transaction Status
```
transactions.successful should match the number of completed payments
```
- Count successful transactions
- Verify each has `status: 'success'`

#### Check 3: Revenue Calculation
```
revenue.total = sum of all successful transaction amounts
revenue.organizer_earnings = sum of organizer_earnings from successful transactions
revenue.platform_commission = total - organizer_earnings
```

#### Check 4: Ticket Quantity
```
tickets.total_quantity = sum of all ticket quantities
```
- This should match or relate to `transactions.successful`

## Example: Debugging "Ticketa Opening Party"

### Request:
```bash
curl -X GET https://tiketa-alpha.vercel.app/api/v1/events/OPENING_PARTY_ID/stats \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Expected Response (if bug exists):
```json
{
  "data": {
    "event": {
      "tickets_sold": 0,
      "total_tickets": 500
    },
    "transactions": {
      "successful": 3
    },
    "revenue": {
      "total": 6300,
      "organizer_earnings": 6120
    }
  }
}
```

**Issue:** `tickets_sold` is 0 but there are 3 successful transactions!

## Root Cause Analysis

### Possible Causes:

1. **`tickets_sold` not updated on transaction success**
   - The payment controller doesn't update `events.tickets_sold` when a transaction succeeds
   - Solution: Add UPDATE query in payment success handler

2. **Tickets table not linked to transactions**
   - Tickets are created but not linked to the transaction
   - Solution: Ensure `transaction_id` is set in tickets table

3. **Status field mismatch**
   - Transactions might have different status values (e.g., 'completed' vs 'success')
   - Solution: Verify all successful transactions use `status = 'success'`

4. **Event ID mismatch**
   - Transactions might be linked to wrong event_id
   - Solution: Check `debug.transactions_raw` to verify event_id values

## Console Logs

When you call this endpoint, check the backend console for detailed logs:

```
📊 Fetching event stats for event_id: {id}
✅ Event found: {title}
📋 Event details: { id, title, tickets_sold, total_tickets }
🔍 Querying transactions for event_id: {id}
📊 All transactions for event: {count}
📋 Transaction details:
  [0] ID: {id}, Status: success, Amount: 2100, Organizer Earnings: 2040
  [1] ID: {id}, Status: success, Amount: 2100, Organizer Earnings: 2040
  [2] ID: {id}, Status: success, Amount: 2100, Organizer Earnings: 2040
✅ Successful transactions: 3
💰 Revenue breakdown: { totalRevenue, totalOrganizerEarnings, totalPlatformCommission }
🎫 Tickets for event: {count}
✅ Event stats compiled: {stats}
```

## Next Steps

### If tickets_sold is 0 but transactions exist:

1. **Check the payment controller** - Does it update `events.tickets_sold`?
2. **Add UPDATE query** - When transaction succeeds, increment `tickets_sold`
3. **Verify transaction status** - Ensure all successful payments have `status = 'success'`
4. **Test the fix** - Call the stats endpoint again to verify

### SQL Query to Check Current State:
```sql
SELECT 
  e.id,
  e.title,
  e.tickets_sold,
  COUNT(t.id) as successful_transactions,
  SUM(CASE WHEN t.status = 'success' THEN 1 ELSE 0 END) as success_count
FROM events e
LEFT JOIN transactions t ON e.id = t.event_id
WHERE e.title = 'Ticketa Opening Party'
GROUP BY e.id, e.title, e.tickets_sold;
```

## API Endpoint Summary

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/v1/events/:id/stats` | ✅ Required | Get event performance stats with debugging |
| GET | `/api/v1/events/organizer` | ✅ Required | Get organizer's events |
| GET | `/api/v1/events/:id` | ❌ Public | Get event details |
| POST | `/api/v1/events` | ✅ Required | Create new event |

---

**Last Updated:** April 21, 2026
**Status:** ✅ Ready for Testing
