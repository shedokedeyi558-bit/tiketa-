# Endpoint Testing Guide

## DELETE /api/v1/events/organizer/:id

### Quick Test

#### 1. Get Your Auth Token
First, sign in to get your authentication token:
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "organizer@example.com",
    "password": "your_password"
  }'
```

Response will include:
```json
{
  "success": true,
  "data": {
    "session": {
      "access_token": "YOUR_TOKEN_HERE"
    }
  }
}
```

#### 2. Get Your Event ID
List your events:
```bash
curl -X GET http://localhost:3000/api/v1/events/organizer \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

Response will include event IDs:
```json
{
  "success": true,
  "data": [
    {
      "id": "EVENT_ID_HERE",
      "title": "My Event",
      "status": "pending"
    }
  ]
}
```

#### 3. Delete the Event
```bash
curl -X DELETE http://localhost:3000/api/v1/events/organizer/EVENT_ID_HERE \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json"
```

Success response:
```json
{
  "success": true,
  "message": "Event deleted successfully"
}
```

---

## Frontend Implementation

### React Example

```javascript
import { useState } from 'react';

export function DeleteEventButton({ eventId, token }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this event?')) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
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

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to delete event');
      }

      // Success - redirect or refresh
      alert('Event deleted successfully');
      window.location.reload();
    } catch (err) {
      setError(err.message);
      console.error('Delete error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button 
      onClick={handleDelete} 
      disabled={loading}
      className="btn btn-danger"
    >
      {loading ? 'Deleting...' : 'Delete Event'}
    </button>
  );
}
```

### Using Axios

```javascript
import axios from 'axios';

async function deleteEvent(eventId, token) {
  try {
    const response = await axios.delete(
      `/api/v1/events/organizer/${eventId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    console.log('Event deleted:', response.data);
    return response.data;
  } catch (error) {
    console.error('Delete failed:', error.response?.data || error.message);
    throw error;
  }
}
```

---

## Error Handling

### Handle Different Error Cases

```javascript
async function deleteEventWithErrorHandling(eventId, token) {
  try {
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

    const data = await response.json();

    if (!response.ok) {
      // Handle specific error cases
      switch (response.status) {
        case 400:
          console.error('Bad request:', data.message);
          // Event has ticket sales or invalid ID
          break;
        case 401:
          console.error('Unauthorized:', data.message);
          // User not authenticated
          break;
        case 403:
          console.error('Forbidden:', data.message);
          // User doesn't own the event
          break;
        case 404:
          console.error('Not found:', data.message);
          // Event doesn't exist
          break;
        case 500:
          console.error('Server error:', data.message);
          // Internal server error
          break;
        default:
          console.error('Unknown error:', data.message);
      }
      throw new Error(data.message);
    }

    return data;
  } catch (error) {
    console.error('Delete failed:', error);
    throw error;
  }
}
```

---

## Postman Collection

### Import into Postman

1. Create new request
2. Set method to `DELETE`
3. Set URL to `{{base_url}}/api/v1/events/organizer/{{event_id}}`
4. Go to Headers tab
5. Add header:
   - Key: `Authorization`
   - Value: `Bearer {{token}}`
6. Click Send

### Environment Variables (Postman)
```json
{
  "base_url": "http://localhost:3000",
  "token": "YOUR_AUTH_TOKEN",
  "event_id": "YOUR_EVENT_ID"
}
```

---

## Common Issues

### Issue: 401 Unauthorized
**Cause**: Missing or invalid authentication token
**Solution**: 
1. Make sure you're logged in
2. Include the `Authorization: Bearer TOKEN` header
3. Check token hasn't expired

### Issue: 403 Forbidden
**Cause**: You don't own the event
**Solution**: 
1. Make sure you're deleting your own event
2. Check the event's `organizer_id` matches your user ID

### Issue: 400 Bad Request - "Cannot delete event with existing ticket sales"
**Cause**: Event has ticket sales
**Solution**: 
1. You can only delete events with no ticket sales
2. If event has sales, you cannot delete it
3. Consider cancelling the event instead

### Issue: 404 Not Found
**Cause**: Event doesn't exist
**Solution**: 
1. Check the event ID is correct
2. Make sure the event hasn't already been deleted
3. Verify the event belongs to you

---

## Success Indicators

✅ Event deleted successfully when:
- Status code is 200
- Response contains `"success": true`
- Response message is "Event deleted successfully"
- Event no longer appears in `GET /api/v1/events/organizer`

---

## Related Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/v1/events/organizer` | List your events |
| GET | `/api/v1/events/:id` | Get event details |
| POST | `/api/v1/events` | Create new event |
| DELETE | `/api/v1/events/organizer/:id` | Delete your event |
| GET | `/api/v1/events/:id/stats` | Get event statistics |

---

**Last Updated**: May 8, 2026
