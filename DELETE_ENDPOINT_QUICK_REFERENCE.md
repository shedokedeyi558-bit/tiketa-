# DELETE Endpoint - Quick Reference Card

## 🎯 Endpoint

```
DELETE /api/v1/events/organizer/:id
```

## 📋 Requirements

| Requirement | Status |
|-------------|--------|
| Authentication | ✅ Required |
| Authorization | ✅ User must own event |
| Event must exist | ✅ Required |
| No ticket sales | ✅ Required |
| No transactions | ✅ Required |

## 🔑 Authentication

```
Authorization: Bearer YOUR_TOKEN
```

## 📝 Request Example

```bash
curl -X DELETE http://localhost:3000/api/v1/events/organizer/abc123 \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json"
```

## ✅ Success Response (200)

```json
{
  "success": true,
  "message": "Event deleted successfully"
}
```

## ❌ Error Responses

### 400 - Bad Request
```json
{
  "success": false,
  "error": "Cannot delete event with existing ticket sales",
  "message": "This event has X ticket(s) sold and cannot be deleted"
}
```

### 401 - Unauthorized
```json
{
  "success": false,
  "error": "Unauthorized",
  "message": "You must be logged in to delete an event"
}
```

### 403 - Forbidden
```json
{
  "success": false,
  "error": "Unauthorized",
  "message": "You can only delete your own events"
}
```

### 404 - Not Found
```json
{
  "success": false,
  "error": "Event not found",
  "message": "Event does not exist"
}
```

### 500 - Server Error
```json
{
  "success": false,
  "error": "Internal server error",
  "message": "Error message details"
}
```

## 🚀 Frontend Implementation

### React Hook
```javascript
const deleteEvent = async (eventId, token) => {
  const response = await fetch(
    `/api/v1/events/organizer/${eventId}`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }
  
  return response.json();
};
```

### Usage
```javascript
try {
  await deleteEvent(eventId, authToken);
  alert('Event deleted successfully');
  // Refresh event list
} catch (error) {
  alert(`Error: ${error.message}`);
}
```

## 📊 Validation Checks

The endpoint performs these checks in order:

1. ✅ Event ID is provided
2. ✅ User is authenticated
3. ✅ Event exists in database
4. ✅ User owns the event
5. ✅ No tickets have been sold
6. ✅ No transactions exist

**If any check fails, deletion is prevented.**

## 🔒 Security Features

- ✅ Authentication required
- ✅ Ownership verification
- ✅ Transaction safety check
- ✅ SQL injection prevention
- ✅ Comprehensive error handling

## 📍 Code Locations

| Component | File | Line |
|-----------|------|------|
| Route | `routes/eventRoutes.js` | 15 |
| Controller | `controllers/eventController.js` | 922 |
| Helper | `services/eventExpiryService.js` | 68 |

## 🧪 Testing Checklist

- [ ] Test with valid event ID → Should delete
- [ ] Test with invalid event ID → Should return 404
- [ ] Test without auth token → Should return 401
- [ ] Test with event owned by other user → Should return 403
- [ ] Test with event that has ticket sales → Should return 400
- [ ] Test with event that has transactions → Should return 400

## 📚 Related Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/v1/events/organizer` | List your events |
| GET | `/api/v1/events/:id` | Get event details |
| POST | `/api/v1/events` | Create event |
| DELETE | `/api/v1/events/organizer/:id` | **Delete event** |

## 💡 Tips

1. **Always check if event has sales before attempting delete**
   - Use `GET /api/v1/events/organizer` to see `tickets_sold`
   - Only delete if `tickets_sold === 0`

2. **Handle errors gracefully**
   - Show user-friendly error messages
   - Don't expose technical details

3. **Confirm before deleting**
   - Always ask user for confirmation
   - Show event title in confirmation dialog

4. **Refresh after deletion**
   - Reload event list after successful deletion
   - Update UI to reflect changes

## 🆘 Troubleshooting

| Problem | Solution |
|---------|----------|
| 401 Unauthorized | Check auth token is valid and included |
| 403 Forbidden | Verify you own the event |
| 400 Bad Request | Check event has no ticket sales |
| 404 Not Found | Verify event ID is correct |
| 500 Server Error | Check server logs for details |

## 📞 Support

For issues or questions:
1. Check `ENDPOINT_TESTING_GUIDE.md` for detailed examples
2. Check `DELETE_ENDPOINT_VERIFICATION_COMPLETE.md` for full documentation
3. Review error response for specific issue
4. Check server logs for debugging

---

**Status**: ✅ Ready for Production
**Last Updated**: May 8, 2026
