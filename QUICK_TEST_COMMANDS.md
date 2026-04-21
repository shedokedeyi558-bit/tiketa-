# Quick Test Commands - Event Stats Debugging

## Prerequisites
- Valid JWT token from login
- Event ID from organizer dashboard
- Backend deployed to Vercel

## Test 1: Get Organizer Events
```bash
curl -X GET https://tiketa-alpha.vercel.app/api/v1/events/organizer \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Events fetched successfully",
  "data": [
    {
      "id": "event-uuid",
      "title": "Event Title",
      "date": "2026-04-21T10:00:00Z",
      "tickets_sold": 0,
      "total_tickets": 100
    }
  ]
}
```

## Test 2: Get Event Performance Stats
```bash
curl -X GET https://tiketa-alpha.vercel.app/api/v1/events/{event-id}/stats \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

**Replace `{event-id}` with actual event ID from Test 1**

**Expected Response:**
```json
{
  "success": true,
  "message": "Event stats fetched successfully",
  "data": {
    "event": {
      "id": "event-uuid",
      "title": "Ticketa Opening Party",
      "date": "2026-04-21T10:00:00Z",
      "location": "Lagos, Nigeria",
      "tickets_sold": 3,
      "total_tickets": 500
    },
    "transactions": {
      "total": 3,
      "successful": 3,
      "pending": 0,
      "failed": 0
    },
    "revenue": {
      "total": 6300,
      "organizer_earnings": 6120,
      "platform_commission": 180
    },
    "tickets": {
      "count": 3,
      "total_quantity": 3
    },
    "debug": {
      "event_id_queried": "event-uuid",
      "transactions_raw": [...],
      "tickets_raw": [...]
    }
  }
}
```

## Test 3: Verify Tickets Sold Matches Transactions
After calling Test 2, verify:

```
event.tickets_sold === transactions.successful
```

**Example:**
- `event.tickets_sold` = 3
- `transactions.successful` = 3
- ✅ MATCH - Fix is working!

## Test 4: Verify Revenue Calculation
```
revenue.total = sum of all successful transaction amounts
revenue.organizer_earnings = revenue.total * 0.97 (97% to organizer)
revenue.platform_commission = revenue.total * 0.03 (3% to platform)
```

**Example:**
- 3 transactions × ₦2,100 = ₦6,300 total
- ₦6,300 × 0.97 = ₦6,120 organizer earnings ✅
- ₦6,300 × 0.03 = ₦180 platform commission ✅

## Test 5: Check Backend Logs
When you call the stats endpoint, check the backend console for:

```
📊 Fetching event stats for event_id: {id}
✅ Event found: {title}
📋 Event details: { id, title, tickets_sold, total_tickets }
🔍 Querying transactions for event_id: {id}
📊 All transactions for event: {count}
✅ Successful transactions: {count}
💰 Revenue breakdown: { totalRevenue, totalOrganizerEarnings, totalPlatformCommission }
✅ Event stats compiled: {...}
```

## Troubleshooting

### Issue: 401 Unauthorized
**Solution:** Ensure JWT token is valid and not expired
```bash
# Get new token
curl -X POST https://tiketa-alpha.vercel.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "organizer@example.com",
    "password": "password123"
  }'
```

### Issue: 404 Event Not Found
**Solution:** Verify event ID is correct
```bash
# Get correct event ID
curl -X GET https://tiketa-alpha.vercel.app/api/v1/events/organizer \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Issue: tickets_sold still 0
**Solution:** Check if payment was actually verified
1. Call stats endpoint
2. Check `transactions.successful` count
3. If 0, payment verification may have failed
4. Check backend logs for errors

### Issue: Revenue doesn't match
**Solution:** Verify commission calculation
- Platform commission should be 3% (not 5%)
- Organizer earnings should be 97%
- Check `.env` for `PLATFORM_COMMISSION_RATE`

## API Endpoint Reference

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/v1/events/organizer` | ✅ | Get organizer's events |
| GET | `/api/v1/events/:id/stats` | ✅ | Get event performance stats |
| GET | `/api/v1/events/:id` | ❌ | Get event details |
| POST | `/api/v1/auth/login` | ❌ | Login and get JWT token |

## Environment Variables
```
SQUADCO_API_KEY=sandbox_sk_... (for testing)
SQUADCO_API_URL=https://sandbox-api-d.squadco.com
PLATFORM_COMMISSION_RATE=0.03 (3%)
```

## Notes
- All timestamps are in ISO 8601 format (UTC)
- All amounts are in Nigerian Naira (₦)
- Organizer earnings = ticket_price - platform_commission
- Platform commission = ticket_price * 0.03

---

**Last Updated:** April 21, 2026
**Status:** ✅ Ready for Testing
