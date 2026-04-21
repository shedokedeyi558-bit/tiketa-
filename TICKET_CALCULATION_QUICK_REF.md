# Ticket Calculation - Quick Reference

## The Fix in 30 Seconds

**Problem:** Tickets Remaining was showing negative values (-1)

**Solution:** 
```javascript
tickets_remaining = Math.max(0, total_tickets - tickets_sold)
```

**Special Case:** If `total_tickets = 0` or `null`, show "Unlimited"

---

## API Endpoints

### GET /api/v1/events/:id
Get single event details with ticket calculation

```bash
curl https://tiketa-alpha.vercel.app/api/v1/events/{event-id}
```

**Response:**
```json
{
  "total_tickets": 500,
  "tickets_sold": 1,
  "tickets_remaining": 499
}
```

### GET /api/v1/events/organizer
Get organizer's events with ticket calculation

```bash
curl https://tiketa-alpha.vercel.app/api/v1/events/organizer \
  -H "Authorization: Bearer TOKEN"
```

### GET /api/v1/events
Get all public events with ticket calculation

```bash
curl https://tiketa-alpha.vercel.app/api/v1/events
```

---

## Response Values

| Field | Type | Example | Notes |
|-------|------|---------|-------|
| total_tickets | number or string | 500 or "Unlimited" | String when unlimited |
| tickets_sold | number | 1 | Always a number |
| tickets_remaining | number or string | 499 or "Unlimited" | String when unlimited |

---

## Calculation Logic

```
IF total_tickets = 0 OR total_tickets = null:
  total_tickets = "Unlimited"
  tickets_remaining = "Unlimited"
ELSE:
  tickets_remaining = MAX(0, total_tickets - tickets_sold)
```

---

## Test Cases

### Normal Event
```
total_tickets: 500
tickets_sold: 1
tickets_remaining: 499 ✅
```

### Unlimited Event
```
total_tickets: "Unlimited"
tickets_sold: 5
tickets_remaining: "Unlimited" ✅
```

### Sold Out
```
total_tickets: 100
tickets_sold: 100
tickets_remaining: 0 ✅
```

### Oversold (edge case)
```
total_tickets: 100
tickets_sold: 150
tickets_remaining: 0 ✅ (not -50)
```

---

## Frontend Integration

```javascript
// Display tickets
const event = response.data;

if (event.total_tickets === 'Unlimited') {
  console.log('Unlimited tickets available');
} else {
  console.log(`${event.tickets_remaining} tickets remaining`);
}
```

---

## Console Logs

When calling endpoints, you'll see:

```
📖 Fetching event details for ID: {id}
✅ Event found: Event Title
🎫 Ticket calculation: { total: 500, sold: 1, remaining: 499 }
✅ Event details compiled: {...}
```

---

## Files Changed

- `controllers/eventController.js` - All 3 event endpoints updated

---

## Deployment

✅ Committed to GitHub
✅ Auto-deployed to Vercel
✅ Ready for testing

---

## Verification

```bash
# Test endpoint
curl https://tiketa-alpha.vercel.app/api/v1/events/{event-id}

# Check:
# 1. tickets_remaining >= 0 (never negative)
# 2. tickets_remaining = total_tickets - tickets_sold
# 3. "Unlimited" for unlimited events
```

---

**Last Updated:** April 21, 2026
**Status:** ✅ Ready
