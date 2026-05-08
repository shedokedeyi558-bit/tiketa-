# Event Expiry & Delete - Quick Reference

**Status**: ✅ **COMPLETE AND DEPLOYED**  
**Commit**: `0ec6300`

---

## 🎯 FEATURES

### 1. Auto-Expire Events
- ✅ Checks events where date + start_time has passed
- ✅ Automatically updates status to 'ended'
- ✅ Runs on every GET /api/v1/events request
- ✅ Runs on every GET /api/v1/admin/events request
- ✅ Uses Nigeria timezone (UTC+1)

### 2. Delete Event Endpoint
- ✅ DELETE /api/v1/organizer/events/:id
- ✅ Only event owner can delete
- ✅ Only if no tickets sold
- ✅ Prevents deletion if transactions exist

---

## 📤 API ENDPOINTS

### GET /api/v1/events
**Auto-Expiry**: ✅ Runs before returning results

```bash
curl https://tiketa-alpha.vercel.app/api/v1/events
```

### GET /api/v1/admin/events
**Auto-Expiry**: ✅ Runs before returning results

```bash
curl -X GET https://tiketa-alpha.vercel.app/api/v1/admin/events \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### DELETE /api/v1/organizer/events/:id
**Delete event (organizer only)**

```bash
curl -X DELETE https://tiketa-alpha.vercel.app/api/v1/organizer/events/evt-123 \
  -H "Authorization: Bearer ORGANIZER_TOKEN"
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Event deleted successfully"
}
```

**Response (Has Sales):**
```json
{
  "success": false,
  "error": "Cannot delete event with existing ticket sales",
  "message": "This event has 5 ticket(s) sold and cannot be deleted"
}
```

---

## ⏰ EXPIRY LOGIC

**Condition:**
```
event.date + event.start_time < current Nigeria time (UTC+1)
AND event.status = 'active'
```

**Action:**
```
Update event.status = 'ended'
```

**Example:**
```
Event: Tech Conference
Date: 2026-05-15
Start Time: 19:00:00
Event DateTime: 2026-05-15T19:00:00

Current Nigeria Time: 2026-05-16T10:30:00

Result: EXPIRED → Status updated to 'ended'
```

---

## 🗑️ DELETE LOGIC

**Conditions:**
1. ✅ Event exists
2. ✅ User is event owner (organizer_id = user.id)
3. ✅ No tickets sold (tickets_sold = 0)
4. ✅ No transactions exist for event

**If all conditions met**: Event is deleted

**If any condition fails**: Return error with reason

---

## 📁 FILES

**Created:**
- ✅ `services/eventExpiryService.js`
- ✅ `EVENT_EXPIRY_AND_DELETE_IMPLEMENTATION.md`

**Modified:**
- ✅ `controllers/eventController.js`
- ✅ `controllers/adminController.js`
- ✅ `routes/eventRoutes.js`

---

## 🧪 TESTING

### Test Auto-Expire
```bash
# Create event with past date
curl -X POST https://tiketa-alpha.vercel.app/api/v1/events \
  -H "Authorization: Bearer TOKEN" \
  -d '{"title":"Past Event","date":"2026-05-01","start_time":"10:00:00","location":"Lagos"}'

# Fetch events (triggers expiry check)
curl https://tiketa-alpha.vercel.app/api/v1/events

# Check logs for expiry results
```

### Test Delete (No Sales)
```bash
curl -X DELETE https://tiketa-alpha.vercel.app/api/v1/organizer/events/evt-123 \
  -H "Authorization: Bearer ORGANIZER_TOKEN"

# Expected: 200 OK, event deleted
```

### Test Delete (With Sales)
```bash
curl -X DELETE https://tiketa-alpha.vercel.app/api/v1/organizer/events/evt-456 \
  -H "Authorization: Bearer ORGANIZER_TOKEN"

# Expected: 400 Bad Request, "Cannot delete event with existing ticket sales"
```

---

## 📊 CONSOLE LOGS

**Expiry Check:**
```
⏰ Checking for expired events...
🕐 Current Nigeria time: 2026-05-16T11:30:00.000Z
📅 Found 10 active events
⏳ Event expired: Tech Conference (evt-123)
🔍 Found 3 expired events
✅ Updated 3 events to 'ended' status
```

**Delete Event:**
```
🗑️ Attempting to delete event: { eventId: "evt-123", userId: "user-456" }
✅ Event found: Tech Conference
✅ Ownership verified
✅ No ticket sales found
✅ No transactions found
✅ Event deleted successfully
```

---

## ✅ VERIFICATION

- [x] Event expiry service created
- [x] Auto-expire logic implemented
- [x] Expiry check integrated into GET endpoints
- [x] Delete endpoint created
- [x] Ownership validation
- [x] Sales validation
- [x] Transaction check
- [x] Error handling
- [x] Logging
- [x] No errors
- [x] Committed to GitHub
- [x] Deployed to Vercel

---

**Status**: ✅ Complete and deployed

**Last Updated**: May 7, 2026

