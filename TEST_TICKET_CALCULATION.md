# Quick Test Guide - Ticket Calculation Fix

## Test Commands

### Test 1: Get Single Event Details
```bash
curl -X GET https://tiketa-alpha.vercel.app/api/v1/events/{event-id}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Event fetched successfully",
  "data": {
    "id": "event-uuid",
    "title": "Event Title",
    "total_tickets": 500,
    "tickets_sold": 1,
    "tickets_remaining": 499
  }
}
```

**Verify:**
- ✅ `tickets_remaining` = `total_tickets` - `tickets_sold`
- ✅ `tickets_remaining` is never negative
- ✅ All values are numbers (not strings)

---

### Test 2: Get Organizer Events
```bash
curl -X GET https://tiketa-alpha.vercel.app/api/v1/events/organizer \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Events fetched successfully",
  "data": [
    {
      "id": "event-uuid-1",
      "title": "Event 1",
      "total_tickets": 100,
      "tickets_sold": 25,
      "tickets_remaining": 75
    },
    {
      "id": "event-uuid-2",
      "title": "Event 2",
      "total_tickets": "Unlimited",
      "tickets_sold": 10,
      "tickets_remaining": "Unlimited"
    }
  ]
}
```

**Verify:**
- ✅ Each event has `tickets_remaining` field
- ✅ Limited events show numbers
- ✅ Unlimited events show "Unlimited" string
- ✅ No negative values

---

### Test 3: Get All Public Events
```bash
curl -X GET https://tiketa-alpha.vercel.app/api/v1/events
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Events fetched successfully",
  "data": [
    {
      "id": "event-uuid",
      "title": "Public Event",
      "total_tickets": 200,
      "tickets_sold": 50,
      "tickets_remaining": 150
    }
  ]
}
```

**Verify:**
- ✅ All events have ticket calculations
- ✅ No negative remaining values
- ✅ Proper calculation: remaining = total - sold

---

## Edge Case Tests

### Test 4: Unlimited Event (total_tickets = 0)
```bash
# Create event with total_tickets = 0
curl -X POST https://tiketa-alpha.vercel.app/api/v1/events \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Unlimited Event",
    "total_tickets": 0,
    "date": "2026-05-01T10:00:00Z"
  }'

# Then fetch it
curl -X GET https://tiketa-alpha.vercel.app/api/v1/events/{event-id}
```

**Expected:**
```json
{
  "data": {
    "total_tickets": "Unlimited",
    "tickets_sold": 0,
    "tickets_remaining": "Unlimited"
  }
}
```

**Verify:**
- ✅ `total_tickets` is string "Unlimited"
- ✅ `tickets_remaining` is string "Unlimited"
- ✅ `tickets_sold` is still a number

---

### Test 5: Oversold Event (tickets_sold > total_tickets)
If somehow `tickets_sold` exceeds `total_tickets`:

```bash
curl -X GET https://tiketa-alpha.vercel.app/api/v1/events/{event-id}
```

**Expected:**
```json
{
  "data": {
    "total_tickets": 100,
    "tickets_sold": 150,
    "tickets_remaining": 0
  }
}
```

**Verify:**
- ✅ `tickets_remaining` is 0 (not -50)
- ✅ Uses `Math.max(0, ...)` to clamp

---

### Test 6: Sold Out Event
```bash
curl -X GET https://tiketa-alpha.vercel.app/api/v1/events/{event-id}
```

**Expected (when tickets_sold = total_tickets):**
```json
{
  "data": {
    "total_tickets": 100,
    "tickets_sold": 100,
    "tickets_remaining": 0
  }
}
```

**Verify:**
- ✅ `tickets_remaining` is exactly 0
- ✅ Not negative

---

## Verification Checklist

### For Each Test:
- [ ] Response has `success: true`
- [ ] Response has `tickets_remaining` field
- [ ] `tickets_remaining` is never negative
- [ ] Calculation is correct: `remaining = MAX(0, total - sold)`
- [ ] "Unlimited" events show string values
- [ ] Limited events show numeric values

### Overall:
- [ ] All three endpoints return proper calculations
- [ ] No errors in response
- [ ] Backend logs show ticket calculations
- [ ] Frontend displays values correctly

---

## Backend Console Logs

When running tests, check backend logs for:

```
📖 Fetching event details for ID: {id}
✅ Event found: Event Title
🎫 Ticket calculation: { total: 500, sold: 1, remaining: 499 }
✅ Event details compiled: { title, total_tickets, tickets_sold, tickets_remaining }
```

Or for unlimited:
```
🎫 Event has unlimited tickets
```

---

## Common Issues & Solutions

### Issue: tickets_remaining is negative
**Solution:** Ensure backend is updated with latest code
```bash
git pull origin main
npm install
# Restart server
```

### Issue: total_tickets shows 0 instead of "Unlimited"
**Solution:** Check if total_tickets is actually 0 in database
```sql
SELECT id, title, total_tickets FROM events WHERE id = '{event-id}';
```

### Issue: 401 Unauthorized on organizer endpoint
**Solution:** Ensure JWT token is valid
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

---

## API Response Format

### Success Response
```json
{
  "success": true,
  "message": "Event fetched successfully",
  "data": {
    "id": "uuid",
    "title": "string",
    "total_tickets": "number or 'Unlimited'",
    "tickets_sold": "number",
    "tickets_remaining": "number or 'Unlimited'"
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message",
  "message": "Detailed error message"
}
```

---

## Frontend Integration Example

```javascript
// Handle both number and string values
function formatTickets(event) {
  const { total_tickets, tickets_sold, tickets_remaining } = event;
  
  if (total_tickets === 'Unlimited') {
    return {
      total: 'Unlimited',
      sold: tickets_sold,
      remaining: 'Unlimited'
    };
  }
  
  return {
    total: total_tickets,
    sold: tickets_sold,
    remaining: tickets_remaining
  };
}

// Usage
const formatted = formatTickets(event);
console.log(`Total: ${formatted.total}`);
console.log(`Sold: ${formatted.sold}`);
console.log(`Remaining: ${formatted.remaining}`);
```

---

**Last Updated:** April 21, 2026
**Status:** ✅ Ready for Testing
