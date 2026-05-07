# Event Media Debugging Guide

**Status**: ✅ DEBUGGING LOGGING DEPLOYED

**Commit**: `84de02b`

**Endpoint**: `GET /api/v1/events/:id`

---

## 🎯 WHAT WAS ADDED

Comprehensive logging to identify where event images/media are actually stored in the database.

---

## 📋 DEBUGGING LOGS

When you call the endpoint with an event that has an uploaded image/flyer, you'll see detailed logs:

### Log 1: Raw Event Row
```
📋 RAW EVENT ROW FROM DATABASE: {
  "id": "evt-123-abc",
  "title": "Ticketa Opening Party",
  "description": "Join us...",
  "date": "2026-05-15T19:00:00Z",
  "end_date": "2026-05-15T23:00:00Z",
  "location": "Lagos Convention Center",
  "organizer_id": "org-456",
  "total_tickets": 500,
  "tickets_sold": 45,
  "status": "active",
  "image_url": "https://cdn.example.com/poster.jpg",
  "flyer_url": "https://cdn.example.com/flyer.pdf",
  "category": "Concert",
  "created_at": "2026-04-20T10:30:00Z",
  "updated_at": "2026-05-01T15:45:00Z"
}
```

### Log 2: All Column Names
```
📋 EVENT COLUMNS: [
  "id",
  "title",
  "description",
  "date",
  "end_date",
  "location",
  "organizer_id",
  "total_tickets",
  "tickets_sold",
  "status",
  "image_url",
  "flyer_url",
  "category",
  "created_at",
  "updated_at"
]
```

### Log 3: Image/Media Columns
```
📋 IMAGE/MEDIA COLUMNS: {
  "image_url": "https://cdn.example.com/poster.jpg",
  "flyer_url": "https://cdn.example.com/flyer.pdf",
  "banner_url": null,
  "cover_image": null,
  "media_url": null,
  "image": null,
  "flyer": null,
  "banner": null
}
```

### Log 4: Separate Media Tables
```
🔍 Checking for separate event_media table...
✅ Found event_media table with data: {
  "id": "media-123",
  "event_id": "evt-123-abc",
  "url": "https://cdn.example.com/media.jpg",
  "type": "image",
  "created_at": "2026-04-20T10:30:00Z"
}
```

Or:

```
⚠️ event_media table not found or error: relation "event_media" does not exist
```

---

## 🔍 WHAT TO LOOK FOR

### Scenario 1: Image in events table
**Logs show:**
```
image_url: "https://cdn.example.com/poster.jpg"
flyer_url: "https://cdn.example.com/flyer.pdf"
```

**Action:** Use these columns directly ✅

### Scenario 2: Image in separate event_media table
**Logs show:**
```
⚠️ event_media table not found or error: relation "event_media" does not exist
```

Then:

```
✅ Found event_images table with data: {
  "id": "img-123",
  "event_id": "evt-123-abc",
  "url": "https://cdn.example.com/image.jpg",
  "type": "image"
}
```

**Action:** Query event_images table and use the URL ✅

### Scenario 3: Different column names
**Logs show:**
```
banner_url: "https://cdn.example.com/banner.jpg"
cover_image: "https://cdn.example.com/cover.jpg"
```

**Action:** Update code to use these column names ✅

### Scenario 4: No image stored
**Logs show:**
```
image_url: null
flyer_url: null
banner_url: null
cover_image: null
```

**Action:** Image not uploaded yet ✅

---

## 📊 DEBUGGING WORKFLOW

### Step 1: Call the endpoint
```bash
curl -X GET https://tiketa-alpha.vercel.app/api/v1/events/evt-123-abc
```

### Step 2: Check Vercel logs
Look for the logs starting with:
- `📋 RAW EVENT ROW FROM DATABASE:`
- `📋 EVENT COLUMNS:`
- `📋 IMAGE/MEDIA COLUMNS:`
- `🔍 Checking for separate event_media table...`
- `🔍 Checking for separate event_images table...`

### Step 3: Identify the image column
From the logs, determine:
- Is image in `image_url` column? ✅
- Is image in `flyer_url` column? ✅
- Is image in a separate table? ✅
- Is there no image? ✅

### Step 4: Update code accordingly
Once you know where the image is stored, update the `getEventById` function to:
1. Query the correct column or table
2. Return the image URL in the response
3. Remove the debugging logs

---

## 🔧 NEXT STEPS

Once you identify where images are stored:

### If in events table columns:
```javascript
// Update this line:
const media_url = event.flyer_url || event.image_url || event.banner_url || event.cover_image || null;
```

### If in separate table:
```javascript
// Add this query:
const { data: eventMedia } = await supabase
  .from('event_media')  // or event_images
  .select('url')
  .eq('event_id', id)
  .limit(1);

const media_url = eventMedia?.[0]?.url || null;
```

### Update response:
```javascript
return res.status(200).json({
  success: true,
  data: {
    ...eventData,
    image_url: media_url,  // ✅ Return the correct image
  }
});
```

---

## 📝 CONSOLE OUTPUT EXAMPLE

Full console output when calling endpoint:

```
📖 Fetching public event details for ID: evt-123-abc
✅ Event found: Ticketa Opening Party

📋 RAW EVENT ROW FROM DATABASE: {
  "id": "evt-123-abc",
  "title": "Ticketa Opening Party",
  "image_url": "https://cdn.example.com/poster.jpg",
  "flyer_url": "https://cdn.example.com/flyer.pdf",
  ...
}

📋 EVENT COLUMNS: ["id", "title", "image_url", "flyer_url", ...]

📋 IMAGE/MEDIA COLUMNS: {
  "image_url": "https://cdn.example.com/poster.jpg",
  "flyer_url": "https://cdn.example.com/flyer.pdf",
  "banner_url": null,
  "cover_image": null,
  ...
}

🔍 Checking for separate event_media table...
⚠️ event_media table not found or error: relation "event_media" does not exist

🔍 Checking for separate event_images table...
⚠️ event_images table not found or error: relation "event_images" does not exist

📸 Media URLs: {
  "flyer_url": "https://cdn.example.com/flyer.pdf",
  "image_url": "https://cdn.example.com/poster.jpg",
  "selected": "https://cdn.example.com/flyer.pdf"
}

✅ Public event details compiled: {
  "title": "Ticketa Opening Party",
  "status": "active",
  "total_tickets": 500,
  "tickets_sold": 45,
  "organizer": "John Organizer"
}
```

---

## 🚀 DEPLOYMENT

- **Committed**: `84de02b`
- **Pushed to GitHub**: ✅
- **Auto-deployed to Vercel**: ✅ (within 30-60 seconds)

---

## ✅ VERIFICATION CHECKLIST

- [x] Raw event row logged
- [x] All column names logged
- [x] Image/media columns checked
- [x] event_media table queried
- [x] event_images table queried
- [x] Media table data logged
- [x] Error handling for missing tables
- [x] Comprehensive logging added
- [x] Committed to GitHub
- [x] Deployed to Vercel

---

## 📞 NEXT STEPS

1. **Call the endpoint** with an event that has an uploaded image
2. **Check Vercel logs** for the debugging output
3. **Identify** where the image is actually stored
4. **Report back** with the logs
5. **Update code** based on findings

---

**Status**: ✅ DEBUGGING READY

**Last Updated**: May 5, 2026

