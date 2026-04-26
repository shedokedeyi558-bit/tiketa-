# Event Data Consistency Fix - Backend Implementation

## Problem Statement
Different pages were showing different event counts for the same organizer due to:
1. **Three different endpoints** with different filtering logic
2. **No unified source of truth** for event data
3. **Inconsistent date filtering** across endpoints
4. **No refetch mechanism** after mutations
5. **Stale data** from different endpoints shown simultaneously

## Root Cause Analysis

### Before: Three Conflicting Endpoints

| Endpoint | Filters | Returns | Issue |
|----------|---------|---------|-------|
| `GET /api/v1/events` | `status='active'` | All active events (past + future) | Includes past events |
| `GET /api/v1/events/organizer` | `status='active' AND date >= today` | Only upcoming events | Most restrictive |
| `GET /api/v1/admin/events` | None | ALL events | Shows everything |

**Example Scenario:**
- Total events: 50
- Active events: 40
- Organizer's active events: 30
- Organizer's **upcoming** active events: 15 ← Dashboard shows this
- Admin view: 50 ← Admin shows this
- Browse page: 40 ← Browse shows this

**Result:** Same organizer sees 15, 30, 40, or 50 events depending on which page they visit!

## Solution Implemented

### ✅ 1. Unified Organizer Events Endpoint

**Endpoint:** `GET /api/v1/events/organizer`

**Query Parameters (all optional):**
```
status: 'all' | 'active' | 'cancelled' | 'completed' (default: 'active')
dateFilter: 'all' | 'upcoming' | 'past' (default: 'upcoming')
sortBy: 'date' | 'title' (default: 'date')
sortOrder: 'asc' | 'desc' (default: 'asc')
```

**Examples:**

```bash
# Default: Upcoming active events (Dashboard)
GET /api/v1/events/organizer
→ Returns: Active events with date >= today

# All events (Create Event page)
GET /api/v1/events/organizer?status=all&dateFilter=all
→ Returns: All events (active, cancelled, completed, past, future)

# Past events
GET /api/v1/events/organizer?dateFilter=past
→ Returns: Active events with date < today

# Cancelled events
GET /api/v1/events/organizer?status=cancelled
→ Returns: Cancelled events with date >= today

# All events sorted by title
GET /api/v1/events/organizer?status=all&dateFilter=all&sortBy=title
→ Returns: All events sorted by title
```

**Response Format:**
```json
{
  "success": true,
  "message": "Events fetched successfully",
  "data": [
    {
      "id": "event-123",
      "title": "Tech Conference 2026",
      "date": "2026-05-15",
      "status": "active",
      "total_tickets": 100,
      "tickets_sold": 45,
      "tickets_remaining": 55,
      ...
    }
  ],
  "meta": {
    "count": 15,
    "filters": {
      "status": "active",
      "dateFilter": "upcoming",
      "sortBy": "date",
      "sortOrder": "asc"
    }
  }
}
```

### ✅ 2. Consistent Public Events Endpoint

**Endpoint:** `GET /api/v1/events`

**Query Parameters:**
```
dateFilter: 'all' | 'upcoming' | 'past' (default: 'all')
sortBy: 'date' | 'title' (default: 'date')
sortOrder: 'asc' | 'desc' (default: 'asc')
```

**Note:** Always returns only `status='active'` events (public browse)

**Examples:**
```bash
# All active events (Browse page)
GET /api/v1/events
→ Returns: All active events (past + future)

# Only upcoming active events
GET /api/v1/events?dateFilter=upcoming
→ Returns: Active events with date >= today

# Only past active events
GET /api/v1/events?dateFilter=past
→ Returns: Active events with date < today
```

### ✅ 3. Admin Events Endpoint (Unchanged)

**Endpoint:** `GET /api/v1/admin/events`

**Behavior:** Returns ALL events (no filters) - admin view only

---

## Frontend Implementation Guide

### ✅ Single Source of Truth Pattern

**DO THIS:**
```javascript
// ✅ CORRECT: Use unified endpoint with appropriate filters
const fetchOrganizerEvents = async (filters = {}) => {
  const params = new URLSearchParams({
    status: filters.status || 'active',
    dateFilter: filters.dateFilter || 'upcoming',
    sortBy: filters.sortBy || 'date',
    sortOrder: filters.sortOrder || 'asc',
  });
  
  const response = await fetch(`/api/v1/events/organizer?${params}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.json();
};

// Dashboard: Upcoming active events
const dashboardEvents = await fetchOrganizerEvents({
  status: 'active',
  dateFilter: 'upcoming'
});

// Create Event page: All events
const allEvents = await fetchOrganizerEvents({
  status: 'all',
  dateFilter: 'all'
});

// Past events
const pastEvents = await fetchOrganizerEvents({
  dateFilter: 'past'
});
```

**DON'T DO THIS:**
```javascript
// ❌ WRONG: Different endpoints for different pages
const dashboardEvents = await fetch('/api/v1/events/organizer');
const createPageEvents = await fetch('/api/v1/events'); // Different endpoint!
const adminEvents = await fetch('/api/v1/admin/events'); // Different endpoint!
```

### ✅ Centralized State Management

**Use React Context or Redux:**

```javascript
// EventContext.js
import React, { createContext, useState, useCallback } from 'react';

export const EventContext = createContext();

export const EventProvider = ({ children }) => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ✅ Single fetch function
  const fetchEvents = useCallback(async (filters = {}) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        status: filters.status || 'active',
        dateFilter: filters.dateFilter || 'upcoming',
        sortBy: filters.sortBy || 'date',
        sortOrder: filters.sortOrder || 'asc',
      });

      const response = await fetch(`/api/v1/events/organizer?${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      if (!response.ok) throw new Error('Failed to fetch events');
      
      const data = await response.json();
      setEvents(data.data);
      return data.data;
    } catch (err) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // ✅ Refetch after mutations
  const createEvent = useCallback(async (eventData) => {
    const response = await fetch('/api/v1/events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(eventData)
    });

    if (!response.ok) throw new Error('Failed to create event');
    
    const result = await response.json();
    
    // ✅ CRITICAL: Refetch after mutation
    await fetchEvents({ status: 'all', dateFilter: 'all' });
    
    return result.data;
  }, [fetchEvents]);

  // ✅ Refetch after mutations
  const updateEvent = useCallback(async (eventId, eventData) => {
    const response = await fetch(`/api/v1/events/${eventId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(eventData)
    });

    if (!response.ok) throw new Error('Failed to update event');
    
    const result = await response.json();
    
    // ✅ CRITICAL: Refetch after mutation
    await fetchEvents({ status: 'all', dateFilter: 'all' });
    
    return result.data;
  }, [fetchEvents]);

  // ✅ Refetch after mutations
  const deleteEvent = useCallback(async (eventId) => {
    const response = await fetch(`/api/v1/events/${eventId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });

    if (!response.ok) throw new Error('Failed to delete event');
    
    // ✅ CRITICAL: Refetch after mutation
    await fetchEvents({ status: 'all', dateFilter: 'all' });
  }, [fetchEvents]);

  return (
    <EventContext.Provider value={{
      events,
      loading,
      error,
      fetchEvents,
      createEvent,
      updateEvent,
      deleteEvent,
    }}>
      {children}
    </EventContext.Provider>
  );
};
```

### ✅ Component Usage

**Dashboard Component:**
```javascript
import { useContext, useEffect } from 'react';
import { EventContext } from './EventContext';

export const Dashboard = () => {
  const { events, loading, fetchEvents } = useContext(EventContext);

  useEffect(() => {
    // ✅ Fetch upcoming active events
    fetchEvents({
      status: 'active',
      dateFilter: 'upcoming'
    });
  }, [fetchEvents]);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h1>My Events ({events.length})</h1>
      {events.map(event => (
        <div key={event.id}>
          <h2>{event.title}</h2>
          <p>Date: {event.date}</p>
          <p>Tickets: {event.tickets_remaining} remaining</p>
        </div>
      ))}
    </div>
  );
};
```

**Create Event Component:**
```javascript
import { useContext } from 'react';
import { EventContext } from './EventContext';

export const CreateEvent = () => {
  const { createEvent } = useContext(EventContext);

  const handleSubmit = async (formData) => {
    try {
      await createEvent(formData);
      // ✅ Events automatically refetched and UI updates
      alert('Event created successfully!');
    } catch (error) {
      alert('Failed to create event: ' + error.message);
    }
  };

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      handleSubmit(new FormData(e.target));
    }}>
      {/* Form fields */}
    </form>
  );
};
```

---

## Key Changes Summary

### Backend Changes
✅ **Unified `/api/v1/events/organizer` endpoint** with flexible query parameters
✅ **Consistent filtering logic** across all endpoints
✅ **Metadata in responses** showing applied filters
✅ **Proper date filtering** (YYYY-MM-DD format)
✅ **Consistent ticket calculation** across all endpoints

### Frontend Requirements
✅ **Use single endpoint** for all organizer event queries
✅ **Centralize state management** (Context or Redux)
✅ **Refetch after mutations** (create, update, delete)
✅ **Remove duplicate fetch logic** across pages
✅ **Pass appropriate filters** based on page context

---

## Testing Checklist

### Backend Testing
- [ ] `GET /api/v1/events/organizer` returns upcoming active events
- [ ] `GET /api/v1/events/organizer?status=all` returns all events
- [ ] `GET /api/v1/events/organizer?dateFilter=all` returns all dates
- [ ] `GET /api/v1/events/organizer?dateFilter=past` returns past events
- [ ] `GET /api/v1/events` returns all active events (public)
- [ ] `GET /api/v1/events?dateFilter=upcoming` returns upcoming active events
- [ ] Sorting works correctly (date, title, asc, desc)
- [ ] Ticket calculations are consistent

### Frontend Testing
- [ ] Dashboard shows correct event count
- [ ] Create Event page shows all events
- [ ] After creating event, all pages show updated count
- [ ] After updating event, all pages show updated data
- [ ] After deleting event, all pages show updated count
- [ ] No stale data shown across pages
- [ ] Filtering works correctly on all pages

---

## Migration Guide

### For Existing Frontend Code

**Before:**
```javascript
// Different endpoints for different pages
const dashboardEvents = await fetch('/api/v1/events/organizer');
const browseEvents = await fetch('/api/v1/events');
const allOrganizerEvents = await fetch('/api/v1/events/organizer?status=all'); // Doesn't exist yet
```

**After:**
```javascript
// Single endpoint with filters
const dashboardEvents = await fetch('/api/v1/events/organizer?status=active&dateFilter=upcoming');
const browseEvents = await fetch('/api/v1/events?dateFilter=all');
const allOrganizerEvents = await fetch('/api/v1/events/organizer?status=all&dateFilter=all');
```

---

## Performance Considerations

1. **Caching:** Implement client-side caching with React Query or SWR
2. **Pagination:** Consider adding limit/offset for large event lists
3. **Refetch Strategy:** Use stale-while-revalidate pattern
4. **Debouncing:** Debounce filter changes to reduce API calls

---

## Future Enhancements

1. Add pagination support (limit, offset)
2. Add search by title
3. Add category filtering
4. Add location filtering
5. Add price range filtering
6. Add event status badges
7. Implement real-time updates with WebSockets
8. Add event analytics dashboard

---

## Support

For questions or issues with the event data consistency fix, refer to:
- Backend: `controllers/eventController.js`
- Routes: `routes/eventRoutes.js`
- Documentation: This file
