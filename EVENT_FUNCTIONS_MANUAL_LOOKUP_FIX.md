# Event Functions Manual Organizer Lookup Fix - Complete

## Summary
Fixed all event-related functions to use manual organizer lookups instead of broken foreign table joins. Added new `getAdminEventById` endpoint for retrieving single event details.

## Problems Fixed

### Problem 1: Broken Foreign Table Joins
**Issue**: Three functions were using `users:organizer_id(full_name, email)` join which doesn't work
- getPendingEvents (line 132)
- approveEvent (line 184)
- rejectEvent (line 250)

**Impact**: Organizer names and emails were not being fetched, showing as "Unknown" or empty

### Problem 2: Missing Single Event Detail Endpoint
**Issue**: No GET /admin/events/:id endpoint to retrieve single event details
**Impact**: Admin dashboard couldn't fetch individual event details

## Solutions Implemented

### Fix 1: getPendingEvents Function

#### Before:
```javascript
const { data: events, error: eventsError } = await supabase
  .from('events')
  .select('*, users:organizer_id(full_name, email)')
  .eq('status', 'pending')
  .order('created_at', { ascending: false });

// ... later ...
organizer_name: event.users?.full_name || 'Unknown',
organizer_email: event.users?.email || '',
```

#### After:
```javascript
const { data: events, error: eventsError } = await supabase
  .from('events')
  .select('*')
  .eq('status', 'pending')
  .order('created_at', { ascending: false });

// ✅ Manual organizer lookup for pending events
const pendingOrgIds = [...new Set((events || []).map(e => e.organizer_id).filter(Boolean))];
let pendingOrgMap = {};
if (pendingOrgIds.length > 0) {
  const { data: orgs } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .in('id', pendingOrgIds);
  (orgs || []).forEach(o => {
    pendingOrgMap[o.id] = o;
  });
}

// ... later ...
organizer_name: pendingOrgMap[event.organizer_id]?.full_name || pendingOrgMap[event.organizer_id]?.email?.split('@')[0] || 'Unknown',
organizer_email: pendingOrgMap[event.organizer_id]?.email || '',
```

### Fix 2: approveEvent Function

#### Before:
```javascript
const { data: event, error: fetchError } = await supabase
  .from('events')
  .select('*, users:organizer_id(full_name, email)')
  .eq('id', id)
  .single();

// ... later ...
await sendEventApprovedEmail(
  event.users?.email || '',
  event.users?.full_name || 'Organizer',
  event.title
);
```

#### After:
```javascript
const { data: event, error: fetchError } = await supabase
  .from('events')
  .select('*')
  .eq('id', id)
  .single();

// ✅ Fetch organizer details manually
const { data: approveOrg } = await supabase
  .from('profiles')
  .select('full_name, email')
  .eq('id', event.organizer_id)
  .single();

// ... later ...
await sendEventApprovedEmail(
  approveOrg?.email || '',
  approveOrg?.full_name || 'Organizer',
  event.title
);
```

### Fix 3: rejectEvent Function

#### Before:
```javascript
const { data: event, error: fetchError } = await supabase
  .from('events')
  .select('*, users:organizer_id(full_name, email)')
  .eq('id', id)
  .single();

// ... later ...
await sendEventRejectedEmail(
  event.users?.email || '',
  event.users?.full_name || 'Organizer',
  event.title,
  rejection_reason || 'No reason provided'
);
```

#### After:
```javascript
const { data: event, error: fetchError } = await supabase
  .from('events')
  .select('*')
  .eq('id', id)
  .single();

// ✅ Fetch organizer details manually
const { data: rejectOrg } = await supabase
  .from('profiles')
  .select('full_name, email')
  .eq('id', event.organizer_id)
  .single();

// ... later ...
await sendEventRejectedEmail(
  rejectOrg?.email || '',
  rejectOrg?.full_name || 'Organizer',
  event.title,
  rejection_reason || 'No reason provided'
);
```

### Fix 4: New getAdminEventById Function

#### Added:
```javascript
export const getAdminEventById = async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch event details
    const { data: event, error } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    // Fetch organizer details
    const { data: org } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', event.organizer_id)
      .single();

    // Fetch transaction data for revenue and tickets sold
    const { data: txData } = await supabase
      .from('transactions')
      .select('ticket_price, organizer_earnings')
      .eq('event_id', id)
      .eq('status', 'success');

    const tickets_sold = (txData || []).length;
    const revenue = (txData || []).reduce((sum, t) => sum + Number(t.ticket_price || 0), 0);

    return res.status(200).json({
      success: true,
      data: {
        ...event,
        organizer_name: org?.full_name || org?.email?.split('@')[0] || 'Unknown',
        organizer_email: org?.email || '',
        tickets_sold,
        revenue,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
```

### Fix 5: New Route in adminRoutes.js

#### Added:
```javascript
// Import getAdminEventById
import {
  // ... other imports ...
  getAdminEventById,
} from '../controllers/adminController.js';

// Add route BEFORE PUT route
router.get('/events/:id', getAdminEventById); // ✅ Get single event details
```

## API Endpoints

### New Endpoint
- **GET** `/api/v1/admin/events/:id` - Get single event details
  - Returns: Event data with organizer info, tickets sold, and revenue

### Updated Endpoints
- **GET** `/api/v1/admin/events/pending` - Get pending events (now with correct organizer data)
- **POST** `/api/v1/admin/events/:id/approve` - Approve event (now with correct organizer email)
- **POST** `/api/v1/admin/events/:id/reject` - Reject event (now with correct organizer email)

## Response Example

### GET /api/v1/admin/events/:id
```json
{
  "success": true,
  "data": {
    "id": "evt-123",
    "title": "Concert",
    "organizer_id": "org-456",
    "organizer_name": "John Doe",
    "organizer_email": "john@example.com",
    "date": "2026-06-15",
    "location": "Madison Square Garden",
    "status": "active",
    "tickets_sold": 150,
    "revenue": 1500000,
    "total_tickets": 500,
    "category": "Music",
    "image_url": "https://...",
    "created_at": "2026-05-01T10:00:00Z"
  }
}
```

## Files Modified
- `controllers/adminController.js`
  - Fixed getPendingEvents function
  - Fixed approveEvent function
  - Fixed rejectEvent function
  - Added getAdminEventById function
- `routes/adminRoutes.js`
  - Added import for getAdminEventById
  - Added GET /events/:id route

## Git Commit
```
Commit: 725ccc9
Message: fix: replace broken foreign joins with manual organizer lookups in event functions
Branch: main ✅ Pushed
```

## Verification Checklist
✅ getPendingEvents uses manual organizer lookup
✅ approveEvent uses manual organizer lookup
✅ rejectEvent uses manual organizer lookup
✅ New getAdminEventById function added
✅ New route GET /admin/events/:id added
✅ All functions use profiles table for organizer data
✅ Consistent manual lookup pattern across all functions
✅ Changes committed and pushed to main

## Benefits

### Before:
- ❌ Organizer data not fetching (broken foreign join)
- ❌ Organizer names showing as "Unknown"
- ❌ Email notifications failing (no organizer email)
- ❌ No single event detail endpoint

### After:
- ✅ Organizer data fetches correctly (manual lookup)
- ✅ Organizer names and emails populated accurately
- ✅ Email notifications working correctly
- ✅ New single event detail endpoint available
- ✅ Consistent pattern across all event functions
- ✅ Reliable fallback chain: full_name → email prefix → 'Unknown'

## Data Flow

### getPendingEvents:
1. Fetch all pending events
2. Extract unique organizer IDs
3. Batch fetch organizer data from profiles
4. Build organizer map for O(1) lookups
5. Enrich events with organizer data

### approveEvent:
1. Fetch event by ID
2. Fetch organizer details
3. Update event status to 'active'
4. Send approval email with organizer data

### rejectEvent:
1. Fetch event by ID
2. Fetch organizer details
3. Update event status to 'rejected'
4. Send rejection email with organizer data

### getAdminEventById:
1. Fetch event by ID
2. Fetch organizer details
3. Fetch transaction data for revenue calculation
4. Return enriched event data with organizer and revenue info
