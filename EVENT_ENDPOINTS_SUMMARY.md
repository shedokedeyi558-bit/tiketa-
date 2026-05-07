# Event Endpoints - Current Implementation Summary

**Status**: ✅ VERIFIED

**Date**: May 5, 2026

---

## 📋 PUBLIC EVENT ENDPOINTS

### 1. List All Events
**Endpoint**: `GET /api/v1/events`

**Authentication**: ❌ NOT REQUIRED

**Query Parameters**:
- `dateFilter`: 'all' | 'upcoming' | 'past' (default: 'upcoming')
- `sortBy`: 'date' | 'title' (default: 'date')
- `sortOrder`: 'asc' | 'desc' (default: 'asc')

**Filters**:
- ✅ Only returns `status = 'active'` events
- ✅ Default: upcoming events only (date >= today)
- ✅ Can filter by past events or all events

**Response Fields**:
```javascript
{
  id,
  title,
  description,
  date,
  end_date,
  location,
  organizer_id,
  status,
  total_tickets,
  tickets_sold,
  tickets_remaining,  // ✅ Calculated
  category,
  image_url,          // ✅ Event flyer/poster
  created_at,
  updated_at
}
```

**Note**: Does NOT extract time from date (returns full timestamp)

---

### 2. Get Event Details
**Endpoint**: `GET /api/v1/events/:id`

**Authentication**: ❌ NOT REQUIRED

**Filters**:
- ✅ Returns event regardless of status (active, pending, ended)
- ❌ Hides cancelled and rejected events (404 error)

**Response Fields**:
```javascript
{
  id,
  title,
  category,
  description,
  date,
  end_date,
  time,               // ✅ Extracted and formatted (e.g., "07:00 PM")
  location,
  ticket_price,
  total_tickets,
  tickets_sold,
  tickets_remaining,  // ✅ Calculated
  organizer_id,
  organizer_name,     // ✅ Fetched from profiles table
  image_url,          // ✅ Event flyer/poster
  status,
  created_at,
  updated_at
}
```

**Time Extraction Logic**:
```javascript
// Check if date contains time information
const hasTimeInfo = event.date.includes('T') || event.date.includes(':');

if (hasTimeInfo) {
  // Extract time: "07:00 PM"
  time = dateObj.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true 
  });
} else {
  // Date-only string - time is null
  time = null;
}
```

---

## 📋 ADMIN EVENT ENDPOINTS

### 1. List All Events (Admin)
**Endpoint**: `GET /api/v1/admin/events`

**Authentication**: ✅ REQUIRED (Admin only)

**Response Fields**:
- All event fields
- Organizer details (name, email)
- Revenue calculations
- Transaction counts

---

### 2. Get Event Details (Admin)
**Endpoint**: `GET /api/v1/admin/events/:id`

**Authentication**: ✅ REQUIRED (Admin only)

**Response Fields**:
```javascript
{
  event_id,
  title,
  description,
  date,
  end_date,
  time,               // ✅ Extracted and formatted
  location,
  category,
  ticket_price,
  total_tickets,
  tickets_sold,
  tickets_remaining,
  total_revenue,      // ✅ Calculated
  organizer_earnings, // ✅ Calculated
  platform_commission,// ✅ Calculated
  organizer_id,
  organizer_name,
  organizer_email,
  organizer_phone,
  status,
  rejection_reason,   // ✅ If rejected
  image_url,          // ✅ Event flyer/poster
  created_at,
  updated_at
}
```

---

## 🔍 IMAGE_URL FIELD

### Storage
- **Column**: `image_url` in events table
- **Type**: VARCHAR (URL string)
- **Nullable**: Yes (can be null if no image uploaded)

### Usage
- **Public endpoint**: Returns `image_url` for event poster/flyer
- **Admin endpoint**: Returns `image_url` for review before approval
- **List endpoint**: Returns `image_url` for each event

### Example Values
```
"image_url": "https://cdn.example.com/event-poster.jpg"
"image_url": "https://cdn.example.com/event-flyer.pdf"
"image_url": null  // No image uploaded
```

---

## ⏰ TIME FIELD

### Extraction Logic
- **Source**: `date` field (ISO timestamp or date-only string)
- **Format**: 12-hour time (e.g., "07:00 PM", "11:15 AM")
- **Availability**: Only if date contains time information

### Date Format Detection
```javascript
// Full timestamp - has time
"2026-05-15T19:00:00Z"  → time: "07:00 PM"

// Date-only - no time
"2026-05-15"            → time: null
```

### Endpoints with Time Extraction
- ✅ `GET /api/v1/events/:id` (public detail)
- ✅ `GET /api/v1/admin/events/:id` (admin detail)
- ❌ `GET /api/v1/events` (list - returns full timestamp)
- ❌ `GET /api/v1/events/organizer` (organizer list - returns full timestamp)

---

## 📊 RESPONSE EXAMPLES

### Public List Response
```json
{
  "success": true,
  "data": [
    {
      "id": "evt-123",
      "title": "Ticketa Opening Party",
      "date": "2026-05-15T19:00:00Z",
      "location": "Lagos Convention Center",
      "ticket_price": 2100,
      "total_tickets": 500,
      "tickets_sold": 45,
      "tickets_remaining": 455,
      "image_url": "https://cdn.example.com/poster.jpg",
      "status": "active"
    }
  ]
}
```

### Public Detail Response
```json
{
  "success": true,
  "data": {
    "id": "evt-123",
    "title": "Ticketa Opening Party",
    "date": "2026-05-15T19:00:00Z",
    "time": "07:00 PM",
    "location": "Lagos Convention Center",
    "ticket_price": 2100,
    "total_tickets": 500,
    "tickets_sold": 45,
    "tickets_remaining": 455,
    "organizer_name": "John Organizer",
    "image_url": "https://cdn.example.com/poster.jpg",
    "status": "active"
  }
}
```

### Admin Detail Response
```json
{
  "success": true,
  "data": {
    "event_id": "evt-123",
    "title": "Ticketa Opening Party",
    "date": "2026-05-15T19:00:00Z",
    "time": "07:00 PM",
    "location": "Lagos Convention Center",
    "ticket_price": 2100,
    "total_tickets": 500,
    "tickets_sold": 45,
    "tickets_remaining": 455,
    "total_revenue": 94500,
    "organizer_earnings": 91665,
    "platform_commission": 2835,
    "organizer_name": "John Organizer",
    "organizer_email": "john@example.com",
    "image_url": "https://cdn.example.com/poster.jpg",
    "status": "active",
    "rejection_reason": null
  }
}
```

---

## ✅ VERIFICATION CHECKLIST

- [x] `image_url` field included in all endpoints
- [x] `time` extracted in detail endpoints
- [x] `time` formatted as 12-hour (e.g., "07:00 PM")
- [x] `time` returns null for date-only strings
- [x] Public endpoints don't require auth
- [x] Admin endpoints require auth
- [x] Status filtering working (hide cancelled/rejected)
- [x] Organizer name fetched and included
- [x] Revenue calculations correct
- [x] All fields properly documented

---

## 🔗 ENDPOINT SUMMARY TABLE

| Endpoint | Method | Auth | Returns | Time | Image |
|----------|--------|------|---------|------|-------|
| `/events` | GET | ❌ | List | ❌ | ✅ |
| `/events/:id` | GET | ❌ | Detail | ✅ | ✅ |
| `/events/organizer` | GET | ✅ | List | ❌ | ✅ |
| `/admin/events` | GET | ✅ | List | ❌ | ✅ |
| `/admin/events/:id` | GET | ✅ | Detail | ✅ | ✅ |

---

**Status**: ✅ PRODUCTION READY

**Last Updated**: May 5, 2026

