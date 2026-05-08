# DELETE Endpoint Flow Diagram

## Request Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLIENT REQUEST                               │
│  DELETE /api/v1/events/organizer/:id                            │
│  Authorization: Bearer {token}                                  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    API MIDDLEWARE                               │
│  1. CORS Check                                                  │
│  2. Body Parser                                                 │
│  3. Morgan Logging                                              │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ROUTE HANDLER                                │
│  routes/eventRoutes.js (line 15)                                │
│  router.delete('/organizer/:id', verifyToken, ...)             │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AUTH MIDDLEWARE                              │
│  verifyToken()                                                  │
│  ✅ Verify JWT token                                            │
│  ✅ Extract user ID                                             │
│  ✅ Attach to req.user                                          │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CONTROLLER                                   │
│  controllers/eventController.js (line 922)                      │
│  deleteOrganizerEvent(req, res)                                 │
│                                                                 │
│  1. Extract event ID from params                               │
│  2. Extract user ID from req.user                              │
│  3. Validate inputs                                            │
│  4. Call helper service                                        │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    HELPER SERVICE                               │
│  services/eventExpiryService.js (line 68)                       │
│  deleteEventIfNoSales(eventId, userId)                          │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ VALIDATION CHECKS (in order):                           │   │
│  │                                                         │   │
│  │ 1. Fetch event from database                           │   │
│  │    ✅ Event exists?                                    │   │
│  │    ❌ Return 404 if not found                          │   │
│  │                                                         │   │
│  │ 2. Verify ownership                                    │   │
│  │    ✅ event.organizer_id === userId?                  │   │
│  │    ❌ Return 403 if not owner                          │   │
│  │                                                         │   │
│  │ 3. Check ticket sales                                  │   │
│  │    ✅ event.tickets_sold === 0?                        │   │
│  │    ❌ Return 400 if tickets sold                       │   │
│  │                                                         │   │
│  │ 4. Check transactions                                  │   │
│  │    ✅ No transactions exist?                           │   │
│  │    ❌ Return 400 if transactions exist                 │   │
│  │                                                         │   │
│  │ 5. Delete event                                        │   │
│  │    ✅ DELETE FROM events WHERE id = ?                 │   │
│  │    ✅ Return success response                          │   │
│  └─────────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DATABASE                                     │
│  Supabase PostgreSQL                                            │
│                                                                 │
│  Query 1: SELECT event WHERE id = ?                            │
│  Query 2: SELECT transactions WHERE event_id = ? LIMIT 1       │
│  Query 3: DELETE FROM events WHERE id = ?                      │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    RESPONSE                                     │
│                                                                 │
│  SUCCESS (200):                                                 │
│  {                                                              │
│    "success": true,                                             │
│    "message": "Event deleted successfully"                      │
│  }                                                              │
│                                                                 │
│  ERROR (400/401/403/404/500):                                   │
│  {                                                              │
│    "success": false,                                            │
│    "error": "Error type",                                       │
│    "message": "Detailed error message"                          │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Validation Decision Tree

```
                    ┌─────────────────────┐
                    │  DELETE Request     │
                    │  /organizer/:id     │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ Event ID provided?  │
                    └──────────┬──────────┘
                               │
                    ┌──────────┴──────────┐
                    │                     │
                   NO                    YES
                    │                     │
                    ▼                     ▼
            ┌──────────────┐    ┌─────────────────────┐
            │ 400 Error    │    │ User authenticated? │
            │ Missing ID   │    └──────────┬──────────┘
            └──────────────┘               │
                                ┌──────────┴──────────┐
                                │                     │
                               NO                    YES
                                │                     │
                                ▼                     ▼
                        ┌──────────────┐    ┌─────────────────────┐
                        │ 401 Error    │    │ Event exists?       │
                        │ Unauthorized │    └──────────┬──────────┘
                        └──────────────┘               │
                                        ┌──────────────┴──────────┐
                                        │                         │
                                       NO                        YES
                                        │                         │
                                        ▼                         ▼
                                ┌──────────────┐    ┌─────────────────────┐
                                │ 404 Error    │    │ User owns event?    │
                                │ Not found    │    └──────────┬──────────┘
                                └──────────────┘               │
                                            ┌──────────────────┴──────────┐
                                            │                             │
                                           NO                            YES
                                            │                             │
                                            ▼                             ▼
                                    ┌──────────────┐    ┌─────────────────────┐
                                    │ 403 Error    │    │ No tickets sold?    │
                                    │ Forbidden    │    └──────────┬──────────┘
                                    └──────────────┘               │
                                                    ┌──────────────┴──────────┐
                                                    │                         │
                                                   NO                        YES
                                                    │                         │
                                                    ▼                         ▼
                                            ┌──────────────┐    ┌─────────────────────┐
                                            │ 400 Error    │    │ No transactions?    │
                                            │ Has sales    │    └──────────┬──────────┘
                                            └──────────────┘               │
                                                            ┌──────────────┴──────────┐
                                                            │                         │
                                                           NO                        YES
                                                            │                         │
                                                            ▼                         ▼
                                                    ┌──────────────┐    ┌─────────────────────┐
                                                    │ 400 Error    │    │ DELETE event        │
                                                    │ Has trans    │    │ from database       │
                                                    └──────────────┘    └──────────┬──────────┘
                                                                                   │
                                                                                   ▼
                                                                        ┌─────────────────────┐
                                                                        │ 200 Success         │
                                                                        │ Event deleted       │
                                                                        └─────────────────────┘
```

---

## Database Query Flow

```
┌──────────────────────────────────────────────────────────────┐
│                    QUERY 1: FETCH EVENT                      │
│                                                              │
│  SELECT id, title, organizer_id, tickets_sold               │
│  FROM events                                                │
│  WHERE id = $1                                              │
│                                                              │
│  Purpose: Verify event exists and get ownership info        │
│  Result: Event object or NULL                              │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│                    QUERY 2: CHECK TRANSACTIONS               │
│                                                              │
│  SELECT id                                                  │
│  FROM transactions                                          │
│  WHERE event_id = $1                                        │
│  LIMIT 1                                                    │
│                                                              │
│  Purpose: Verify no transactions exist                      │
│  Result: Empty array or array with 1 transaction            │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│                    QUERY 3: DELETE EVENT                     │
│                                                              │
│  DELETE FROM events                                         │
│  WHERE id = $1                                              │
│                                                              │
│  Purpose: Remove event from database                        │
│  Result: Success or error                                   │
└──────────────────────────────────────────────────────────────┘
```

---

## Error Response Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    ERROR HANDLING                           │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 400 Bad Request                                             │
├─────────────────────────────────────────────────────────────┤
│ Scenarios:                                                  │
│ • Event ID missing                                          │
│ • Event has ticket sales                                    │
│ • Event has transactions                                    │
│                                                             │
│ Response:                                                   │
│ {                                                           │
│   "success": false,                                         │
│   "error": "Cannot delete event with existing ticket sales",│
│   "message": "This event has X ticket(s) sold..."          │
│ }                                                           │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 401 Unauthorized                                            │
├─────────────────────────────────────────────────────────────┤
│ Scenario: User not authenticated                            │
│                                                             │
│ Response:                                                   │
│ {                                                           │
│   "success": false,                                         │
│   "error": "Unauthorized",                                  │
│   "message": "You must be logged in to delete an event"    │
│ }                                                           │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 403 Forbidden                                               │
├─────────────────────────────────────────────────────────────┤
│ Scenario: User doesn't own the event                        │
│                                                             │
│ Response:                                                   │
│ {                                                           │
│   "success": false,                                         │
│   "error": "Unauthorized",                                  │
│   "message": "You can only delete your own events"         │
│ }                                                           │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 404 Not Found                                               │
├─────────────────────────────────────────────────────────────┤
│ Scenario: Event doesn't exist                               │
│                                                             │
│ Response:                                                   │
│ {                                                           │
│   "success": false,                                         │
│   "error": "Event not found",                               │
│   "message": "Event does not exist"                         │
│ }                                                           │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 500 Server Error                                            │
├─────────────────────────────────────────────────────────────┤
│ Scenario: Unexpected server error                           │
│                                                             │
│ Response:                                                   │
│ {                                                           │
│   "success": false,                                         │
│   "error": "Internal server error",                         │
│   "message": "Error details..."                             │
│ }                                                           │
└─────────────────────────────────────────────────────────────┘
```

---

## Component Interaction Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND                                 │
│  React Component / JavaScript                               │
│  Sends DELETE request with auth token                       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ HTTP DELETE
                     │ /api/v1/events/organizer/:id
                     │ Authorization: Bearer {token}
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    EXPRESS SERVER                           │
│  api/index.js                                               │
│  Routes requests to appropriate handlers                    │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    EVENT ROUTES                             │
│  routes/eventRoutes.js                                      │
│  Matches route and applies middleware                       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    AUTH MIDDLEWARE                          │
│  middlewares/authMiddleware.js                              │
│  Verifies JWT token and extracts user info                  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    EVENT CONTROLLER                         │
│  controllers/eventController.js                             │
│  deleteOrganizerEvent()                                     │
│  Validates input and calls service                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    EVENT SERVICE                            │
│  services/eventExpiryService.js                             │
│  deleteEventIfNoSales()                                     │
│  Performs validation and deletion                           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    SUPABASE CLIENT                          │
│  utils/supabaseClient.js                                    │
│  Executes database queries                                  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    POSTGRESQL DATABASE                      │
│  Supabase PostgreSQL                                        │
│  Stores and retrieves data                                  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ Response
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    RESPONSE CHAIN                           │
│  Service → Controller → Routes → Express → Frontend         │
│  JSON response with success/error status                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Security Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    SECURITY LAYERS                          │
└─────────────────────────────────────────────────────────────┘

Layer 1: CORS
├─ Validates origin
├─ Allows only whitelisted domains
└─ Prevents cross-origin attacks

Layer 2: AUTHENTICATION
├─ Verifies JWT token
├─ Extracts user identity
└─ Prevents unauthorized access

Layer 3: AUTHORIZATION
├─ Verifies event ownership
├─ Checks organizer_id === user.id
└─ Prevents unauthorized deletion

Layer 4: BUSINESS LOGIC
├─ Checks no tickets sold
├─ Verifies no transactions exist
└─ Prevents data loss

Layer 5: DATABASE
├─ Parameterized queries
├─ Prevents SQL injection
└─ Ensures data integrity
```

---

**Last Updated**: May 8, 2026
