# Organizer Delete Event Endpoint - Complete Reference

**Date**: May 7, 2026  
**Status**: ✅ **IMPLEMENTED AND DEPLOYED**  
**Endpoint**: `DELETE /api/v1/organizer/events/:id`

---

## 🎯 ENDPOINT OVERVIEW

Allows organizers to delete their own events, with validation to prevent deletion of events with ticket sales.

---

## 📋 REQUIREMENTS

✅ **Authentication**: Required (organizer must be logged in)
✅ **Authorization**: Only event owner can delete
✅ **Validation**: No tickets sold (no transactions exist)
✅ **Response**: 200 OK on success, 400/403 on error

---

## 📤 API SPECIFICATION

### Endpoint
```
DELETE /api/v1/organizer/events/:id
```

### Authentication
```
Authorization: Bearer ORGANIZER_TOKEN
Content-Type: application/json
```

### URL Parameters
```
:id - Event UUID (required)
```

### Request Example
```bash
curl -X DELETE https://tiketa-alpha.vercel.app/api/v1/organizer/events/evt-123 \
  -H "Authorization: Bearer ORGANIZER_TOKEN" \
  -H "Content-Type: application/json"
```

---

## ✅ VALIDATION CHECKS

The endpoint performs these checks in order:

### 1. Authentication
- ✅ User must be logged in
- ✅ Valid JWT token required
- **Error (401)**: "Unauthorized - You must be logged in to delete an event"

### 2. Event Exists
- ✅ Event must exist in database
- ✅ Event ID must be valid UUID
- **Error (404)**: "Event not found"

### 3. Ownership
- ✅ Event organizer_id must match user.id
- ✅ Only event owner can delete
- **Error (403)**: "You can only delete your own events"

### 4. No Ticket Sales
- ✅ Event tickets_sold must be 0
- ✅ No transactions must exist for event
- **Error (400)**: "Cannot delete event with existing ticket sales"

### 5. Delete
- ✅ If all checks pass, delete event
- **Success (200)**: "Event deleted successfully"

---

## 📤 RESPONSE FORMATS

### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Event deleted successfully"
}
```

### Error: Not Authenticated (401)

```json
{
  "success": false,
  "error": "Unauthorized",
  "message": "You must be logged in to delete an event"
}
```

### Error: Event Not Found (404)

```json
{
  "success": false,
  "error": "Event not found",
  "message": "Event does not exist"
}
```

### Error: Not Owner (403)

```json
{
  "success": false,
  "error": "Unauthorized",
  "message": "You can only delete your own events"
}
```

### Error: Has Ticket Sales (400)

```json
{
  "success": false,
  "error": "Cannot delete event with existing ticket sales",
  "message": "This event has 5 ticket(s) sold and cannot be deleted"
}
```

---

## 🧪 TESTING

### Test 1: Delete Event (Success)

**Setup:**
1. Create event as organizer
2. Ensure no tickets sold
3. Call DELETE endpoint

**Test Command:**
```bash
curl -X DELETE https://tiketa-alpha.vercel.app/api/v1/organizer/events/evt-123 \
  -H "Authorization: Bearer ORGANIZER_TOKEN" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Event deleted successfully"
}
```

### Test 2: Delete Event (With Ticket Sales)

**Setup:**
1. Create event as organizer
2. Sell some tickets
3. Call DELETE endpoint

**Test Command:**
```bash
curl -X DELETE https://tiketa-alpha.vercel.app/api/v1/organizer/events/evt-456 \
  -H "Authorization: Bearer ORGANIZER_TOKEN" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "success": false,
  "error": "Cannot delete event with existing ticket sales",
  "message": "This event has 5 ticket(s) sold and cannot be deleted"
}
```

### Test 3: Delete Event (Not Owner)

**Setup:**
1. Create event as User A
2. Try to delete as User B
3. Call DELETE endpoint

**Test Command:**
```bash
curl -X DELETE https://tiketa-alpha.vercel.app/api/v1/organizer/events/evt-789 \
  -H "Authorization: Bearer DIFFERENT_USER_TOKEN" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "success": false,
  "error": "Unauthorized",
  "message": "You can only delete your own events"
}
```

### Test 4: Delete Event (Not Authenticated)

**Setup:**
1. Call DELETE endpoint without token

**Test Command:**
```bash
curl -X DELETE https://tiketa-alpha.vercel.app/api/v1/organizer/events/evt-999 \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "success": false,
  "error": "Unauthorized",
  "message": "You must be logged in to delete an event"
}
```

---

## 💻 FRONTEND IMPLEMENTATION

### JavaScript/React Example

```javascript
const deleteEvent = async (eventId, token) => {
  try {
    const response = await fetch(
      `https://tiketa-alpha.vercel.app/api/v1/organizer/events/${eventId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || 'Failed to delete event');
    }

    console.log('✅ Event deleted:', data.message);
    return data;

  } catch (error) {
    console.error('❌ Error deleting event:', error);
    throw error;
  }
};

// Usage
try {
  await deleteEvent('evt-123', authToken);
  showSuccessToast('Event deleted successfully');
  // Redirect or refresh event list
} catch (error) {
  showErrorToast(error.message);
}
```

### React Hook Example

```javascript
const useDeleteEvent = () => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const deleteEvent = async (eventId) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `https://tiketa-alpha.vercel.app/api/v1/organizer/events/${eventId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to delete event');
      }

      return data;

    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { deleteEvent, loading, error };
};

// Usage in component
const MyComponent = () => {
  const { deleteEvent, loading, error } = useDeleteEvent();

  const handleDelete = async (eventId) => {
    if (!confirm('Are you sure you want to delete this event?')) {
      return;
    }

    try {
      await deleteEvent(eventId);
      showSuccessToast('Event deleted successfully');
      // Refresh event list
    } catch (err) {
      showErrorToast(err.message);
    }
  };

  return (
    <button onClick={() => handleDelete('evt-123')} disabled={loading}>
      {loading ? 'Deleting...' : 'Delete Event'}
    </button>
  );
};
```

---

## 🔐 SECURITY

### Authentication
- ✅ JWT token required
- ✅ Token verified by `verifyToken` middleware
- ✅ User ID extracted from token

### Authorization
- ✅ Event ownership verified
- ✅ Only owner can delete
- ✅ Prevents cross-user deletion

### Data Validation
- ✅ Event ID validated
- ✅ Transaction check prevents accidental deletion
- ✅ Comprehensive error messages

---

## 📊 IMPLEMENTATION DETAILS

### File: `controllers/eventController.js`

**Function**: `deleteOrganizerEvent(req, res)`

**Logic:**
```javascript
1. Extract event ID from URL params
2. Extract user ID from auth token
3. Validate event exists
4. Verify user is event owner
5. Check for existing transactions
6. If all checks pass, delete event
7. Return success response
```

### File: `routes/eventRoutes.js`

**Route:**
```javascript
router.delete('/organizer/:id', verifyToken, deleteOrganizerEvent);
```

**Middleware:**
- `verifyToken` - Ensures user is authenticated

---

## 📋 CONSOLE LOGGING

When deleting an event, the backend logs:

```
🗑️ Organizer attempting to delete event: { eventId: "evt-123", userId: "user-456" }
✅ Event found: Tech Conference
✅ Ownership verified
✅ No ticket sales found, proceeding with deletion
✅ No transactions found, safe to delete
✅ Event deleted successfully: evt-123
```

---

## ✅ VERIFICATION CHECKLIST

- [x] Endpoint created at DELETE /api/v1/organizer/events/:id
- [x] Authentication required (verifyToken middleware)
- [x] Event ownership verified
- [x] Ticket sales check implemented
- [x] Transaction check implemented
- [x] Error handling implemented
- [x] Success response implemented
- [x] Logging added
- [x] No TypeScript/linting errors
- [x] Deployed to production

---

## 📞 SUPPORT

**Full Documentation**: `EVENT_EXPIRY_AND_DELETE_IMPLEMENTATION.md`

**Quick Reference**: `EVENT_EXPIRY_QUICK_REFERENCE.md`

**Backend Code**:
- Controller: `controllers/eventController.js` → `deleteOrganizerEvent()`
- Routes: `routes/eventRoutes.js`
- Service: `services/eventExpiryService.js` → `deleteEventIfNoSales()`

---

**Status**: ✅ Implemented and deployed

**Last Updated**: May 7, 2026

