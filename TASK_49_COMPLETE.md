# Task 49: Add ticket_types JSONB Support to Events Table

## Status: ✅ BACKEND COMPLETE - 🔴 PENDING SUPABASE MIGRATION

---

## Summary

Implemented complete ticket types support for events. Organizers can now create events with multiple ticket types (e.g., VIP, Regular) each with their own price. The system properly handles multi-day events and includes safety checks to prevent invalid event data.

---

## What Was Implemented

### 1. ✅ Event Creation Endpoint (`createEvent`)

**Location**: `controllers/eventController.js`

**Changes**:
- Extracts `ticket_types` from request body
- Validates end date/time is after start date/time
- Saves `ticket_types` array to database (defaults to empty array)

**Request Example**:
```json
{
  "title": "Tech Conference 2026",
  "description": "Annual tech conference",
  "date": "2026-06-15",
  "end_date": "2026-06-16",
  "start_time": "09:00:00",
  "end_time": "17:00:00",
  "location": "Lagos Convention Center",
  "total_tickets": 500,
  "category": "Technology",
  "image_url": "https://example.com/image.jpg",
  "ticket_types": [
    { "name": "VIP", "price": 5000 },
    { "name": "Regular", "price": 2000 },
    { "name": "Student", "price": 1000 }
  ]
}
```

**Database Insert**:
```javascript
{
  title,
  description: description || '',
  date,
  end_date: end_date || date,
  location,
  organizer_id: organizerId,
  total_tickets: total_tickets || 0,
  tickets_sold: 0,
  status: 'pending',
  category: category || 'General',
  image_url: finalImageUrl,
  ticket_types: ticket_types || [], // ✅ NEW
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}
```

### 2. ✅ Public Event Detail Endpoint (`getEventById`)

**Location**: `controllers/eventController.js`

**Changes**:
- Selects `ticket_types` from database
- Returns `ticket_types` in response
- Defaults to empty array if null

**Database Query**:
```javascript
const { data: event, error: eventError } = await supabase
  .from('events')
  .select('*, start_time, end_time, ticket_types') // ✅ NEW
  .eq('id', id)
  .single();
```

**Response Example**:
```json
{
  "success": true,
  "data": {
    "id": "event-uuid",
    "title": "Tech Conference 2026",
    "description": "Annual tech conference",
    "date": "2026-06-15",
    "end_date": "2026-06-16",
    "start_time": "09:00:00",
    "end_time": "17:00:00",
    "location": "Lagos Convention Center",
    "ticket_price": 2000,
    "ticket_types": [
      { "name": "VIP", "price": 5000 },
      { "name": "Regular", "price": 2000 },
      { "name": "Student", "price": 1000 }
    ],
    "total_tickets": 500,
    "tickets_sold": 45,
    "tickets_remaining": 455,
    "organizer_id": "organizer-uuid",
    "organizer_name": "John Doe",
    "image_url": "https://example.com/image.jpg",
    "status": "active",
    "created_at": "2026-05-19T10:00:00Z",
    "updated_at": "2026-05-19T10:00:00Z"
  }
}
```

### 3. ✅ Event Expiry Service Enhancement (`updateExpiredEvents`)

**Location**: `services/eventExpiryService.js`

**Changes**:
- Added safety check to skip invalid events
- Skips events where `end_time <= start_time`
- Properly handles multi-day events with `end_date`
- Includes `start_time` in select query

**Database Query**:
```javascript
const { data: activeEvents, error: fetchError } = await supabaseAdmin
  .from('events')
  .select('id, title, date, end_date, end_time, start_time, status') // ✅ NEW: start_time
  .eq('status', 'active');
```

**Safety Check Logic**:
```javascript
for (const event of activeEvents) {
  try {
    const expiryDateStr = event.end_date || event.date;
    if (!expiryDateStr) continue;
    
    const timeStr = event.end_time || '23:59:59';
    const fullDateTimeStr = `${expiryDateStr.split('T')[0]}T${timeStr}+01:00`;
    const eventEndDateTime = new Date(fullDateTimeStr);
    
    if (isNaN(eventEndDateTime.getTime())) continue;
    
    // ✅ NEW: Safety check - skip if end time is before start time
    if (event.start_time) {
      const startDateStr = event.date?.split('T')[0];
      const startFullStr = `${startDateStr}T${event.start_time}+01:00`;
      const eventStartDateTime = new Date(startFullStr);
      if (eventEndDateTime <= eventStartDateTime) continue; // skip invalid events
    }
    
    if (eventEndDateTime < nigeriaTime) {
      expiredEventIds.push(event.id);
    }
  } catch (e) {
    console.warn(`⚠️ Error parsing event ${event.id}:`, e.message);
  }
}
```

### 4. ✅ Database Migration File

**Location**: `db/migrations/021_add_ticket_types_to_events.sql`

**SQL**:
```sql
ALTER TABLE events ADD COLUMN IF NOT EXISTS ticket_types JSONB DEFAULT '[]'::jsonb;
COMMENT ON COLUMN events.ticket_types IS 'Array of ticket types with structure: [{"name": "VIP", "price": 5000}, {"name": "Regular", "price": 2000}]';
```

---

## 🔴 PENDING: Run Migration in Supabase

### Instructions

1. **Open Supabase Dashboard**
   - Go to https://app.supabase.com
   - Select project: `eouaddaofaevwkqnsmdw`

2. **Navigate to SQL Editor**
   - Click **SQL Editor** in the left sidebar

3. **Run the Migration SQL**
   - Copy and paste the SQL from `db/migrations/021_add_ticket_types_to_events.sql`
   - Click **Run** button (or press Ctrl+Enter)

4. **Verify Column Creation**
   - Run this verification query:
   ```sql
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'events' AND column_name = 'ticket_types';
   ```
   - Expected result: `ticket_types | jsonb`

---

## Testing After Migration

### Test 1: Create Event with Ticket Types
```bash
curl -X POST http://localhost:5001/api/v1/events \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Event",
    "description": "Test event with ticket types",
    "date": "2026-06-15",
    "location": "Test Location",
    "total_tickets": 100,
    "ticket_types": [
      { "name": "VIP", "price": 5000 },
      { "name": "Regular", "price": 2000 }
    ]
  }'
```

### Test 2: Get Event Details
```bash
curl http://localhost:5001/api/v1/events/EVENT_ID
```

Should return `ticket_types` in response.

### Test 3: Verify Database
```sql
SELECT id, title, ticket_types 
FROM events 
WHERE ticket_types IS NOT NULL 
LIMIT 5;
```

---

## Files Modified

1. **controllers/eventController.js**
   - `createEvent()` function - Extract and save ticket_types
   - `getEventById()` function - Select and return ticket_types

2. **services/eventExpiryService.js**
   - `updateExpiredEvents()` function - Added safety check for invalid events

3. **db/migrations/021_add_ticket_types_to_events.sql**
   - New migration file

---

## Git Status

- ✅ All changes committed to main branch
- ✅ Latest commit: `4fce707` - "Add safety check to skip invalid events in expiry service"
- ✅ Branch is up to date with origin/main
- ✅ No uncommitted changes

---

## Frontend Integration

### For Event Creation Form

Send `ticket_types` array in the POST request body:

```javascript
const eventData = {
  title: "My Event",
  description: "Event description",
  date: "2026-06-15",
  location: "Event Location",
  total_tickets: 100,
  ticket_types: [
    { name: "VIP", price: 5000 },
    { name: "Regular", price: 2000 }
  ]
};

const response = await fetch('/api/v1/events', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(eventData)
});
```

### For Event Display

The `ticket_types` array is returned in the event detail response:

```javascript
const response = await fetch(`/api/v1/events/${eventId}`);
const { data: event } = await response.json();

// Access ticket types
event.ticket_types.forEach(type => {
  console.log(`${type.name}: ₦${type.price}`);
});
```

---

## Deployment Checklist

- [x] Backend code complete
- [x] Migration file created
- [x] All changes committed to main
- [ ] **PENDING**: Run migration in Supabase dashboard
- [ ] Test event creation with ticket_types
- [ ] Test event detail endpoint returns ticket_types
- [ ] Deploy to Vercel (automatic on main push)
- [ ] Test in production

---

## Rollback Plan

If needed, to remove the column:

```sql
ALTER TABLE events DROP COLUMN IF EXISTS ticket_types;
```

---

## Notes

- The `ticket_types` column defaults to empty array `[]` for existing events
- The column is optional - events can be created without ticket_types
- The safety check in expiry service prevents invalid events from being auto-expired
- All code is backward compatible - existing events continue to work normally
- No breaking changes to existing endpoints
