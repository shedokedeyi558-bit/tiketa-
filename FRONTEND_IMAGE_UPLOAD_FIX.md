# Frontend Image Upload Fix - URGENT

**Issue**: Events are being created but `image_url` is NULL in the database.

**Root Cause**: Frontend is uploading images to Supabase Storage but NOT sending the resulting public URL to the backend API.

**Status**: ⚠️ REQUIRES FRONTEND FIX

**Date**: May 7, 2026

---

## 🔍 PROBLEM DIAGNOSIS

### What's Happening:
1. ✅ Frontend uploads image to Supabase Storage → SUCCESS
2. ✅ Frontend gets public URL from Supabase → SUCCESS
3. ❌ Frontend sends POST /api/v1/events WITHOUT `image_url` → **MISSING**
4. ❌ Backend receives request with no image URL → saves NULL to database

### Backend Debugging Logs Added:
The backend now logs the FULL request body to help diagnose:

```javascript
console.log('📋 FULL REQUEST BODY RECEIVED:', JSON.stringify(req.body, null, 2));
console.log('📋 IMAGE-RELATED FIELDS:', {
  image_url: req.body.image_url,
  image_base64: req.body.image_base64,
  imageUrl: req.body.imageUrl,
  flyer_url: req.body.flyer_url,
  // ... checking all possible field names
});
```

**Action Required**: Check the backend logs when creating an event to see what fields are actually being sent.

---

## ✅ CORRECT IMPLEMENTATION

### Option 1: Frontend Uploads to Supabase Storage (RECOMMENDED)

This is what the frontend is currently doing, but needs to be completed:

```javascript
// ✅ CORRECT: Upload to Supabase Storage, then send URL to backend

const createEvent = async (eventData, imageFile) => {
  try {
    let imageUrl = null;
    
    // Step 1: Upload image to Supabase Storage
    if (imageFile) {
      const fileName = `${Date.now()}-${imageFile.name}`;
      const filePath = `event-images/${userId}/${fileName}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('event-images')
        .upload(filePath, imageFile, {
          cacheControl: '3600',
          upsert: false
        });
      
      if (uploadError) {
        console.error('Image upload failed:', uploadError);
        // Continue without image - don't block event creation
      } else {
        // Step 2: Get public URL
        const { data: urlData } = supabase.storage
          .from('event-images')
          .getPublicUrl(filePath);
        
        imageUrl = urlData.publicUrl;
        console.log('✅ Image uploaded:', imageUrl);
      }
    }
    
    // Step 3: Send event data WITH image_url to backend
    const response = await fetch('https://tiketa-alpha.vercel.app/api/v1/events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        title: eventData.title,
        description: eventData.description,
        date: eventData.date,
        end_date: eventData.end_date,
        location: eventData.location,
        total_tickets: eventData.total_tickets,
        category: eventData.category,
        image_url: imageUrl  // ✅ CRITICAL: Include the uploaded image URL
      })
    });
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.message || 'Event creation failed');
    }
    
    console.log('✅ Event created:', result.data);
    return result;
    
  } catch (error) {
    console.error('❌ Error creating event:', error);
    throw error;
  }
};
```

### Option 2: Send Base64 to Backend (ALTERNATIVE)

Let the backend handle the upload:

```javascript
// ✅ ALTERNATIVE: Send base64 image, backend uploads to Supabase Storage

const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
};

const createEvent = async (eventData, imageFile) => {
  try {
    let image_base64 = null;
    
    // Convert image to base64
    if (imageFile) {
      image_base64 = await fileToBase64(imageFile);
      console.log('✅ Image converted to base64');
    }
    
    // Send event data with base64 image
    const response = await fetch('https://tiketa-alpha.vercel.app/api/v1/events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        title: eventData.title,
        description: eventData.description,
        date: eventData.date,
        end_date: eventData.end_date,
        location: eventData.location,
        total_tickets: eventData.total_tickets,
        category: eventData.category,
        image_base64: image_base64  // ✅ Backend will upload to Supabase Storage
      })
    });
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.message || 'Event creation failed');
    }
    
    console.log('✅ Event created:', result.data);
    console.log('✅ Image URL:', result.data.image_url);
    return result;
    
  } catch (error) {
    console.error('❌ Error creating event:', error);
    throw error;
  }
};
```

---

## ❌ INCORRECT IMPLEMENTATION (CURRENT)

### What's Currently Happening:

```javascript
// ❌ WRONG: Upload to Supabase Storage but DON'T send URL to backend

const createEvent = async (eventData, imageFile) => {
  // Step 1: Upload image to Supabase Storage
  if (imageFile) {
    const { data, error } = await supabase.storage
      .from('event-images')
      .upload(filePath, imageFile);
    
    if (!error) {
      const { data: urlData } = supabase.storage
        .from('event-images')
        .getPublicUrl(filePath);
      
      const imageUrl = urlData.publicUrl;
      console.log('Image uploaded:', imageUrl);
      
      // ❌ PROBLEM: imageUrl is NOT sent to backend!
    }
  }
  
  // Step 2: Send event data WITHOUT image_url
  const response = await fetch('https://tiketa-alpha.vercel.app/api/v1/events', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      title: eventData.title,
      description: eventData.description,
      date: eventData.date,
      location: eventData.location,
      // ❌ MISSING: image_url field!
    })
  });
  
  // Result: Event created with image_url = NULL in database
};
```

---

## 🔧 HOW TO FIX

### Step 1: Find the Event Creation Form

Look for files like:
- `CreateEventPage.jsx`
- `CreateEventForm.jsx`
- `EventForm.jsx`
- `NewEvent.jsx`
- Or any component that handles event creation

### Step 2: Find the Image Upload Code

Look for:
```javascript
supabase.storage.from('event-images').upload(...)
```

### Step 3: Capture the Public URL

After upload, get the public URL:
```javascript
const { data: urlData } = supabase.storage
  .from('event-images')
  .getPublicUrl(filePath);

const imageUrl = urlData.publicUrl;
```

### Step 4: Include URL in API Request

Add `image_url` to the request body:
```javascript
body: JSON.stringify({
  ...eventData,
  image_url: imageUrl  // ✅ ADD THIS LINE
})
```

---

## 🧪 TESTING

### Test 1: Check Request Body

Add console.log before sending request:
```javascript
const requestBody = {
  title: eventData.title,
  description: eventData.description,
  date: eventData.date,
  location: eventData.location,
  image_url: imageUrl
};

console.log('📋 Sending to backend:', requestBody);

const response = await fetch(url, {
  method: 'POST',
  headers: headers,
  body: JSON.stringify(requestBody)
});
```

**Expected Output:**
```
📋 Sending to backend: {
  title: "Test Event",
  description: "Test description",
  date: "2026-05-15T19:00:00Z",
  location: "Lagos",
  image_url: "https://project.supabase.co/storage/v1/object/public/event-images/..."
}
```

### Test 2: Check Backend Logs

After creating an event, check the backend logs (Vercel logs or local console):

**Expected Output:**
```
📋 FULL REQUEST BODY RECEIVED: {
  "title": "Test Event",
  "description": "Test description",
  "date": "2026-05-15T19:00:00Z",
  "location": "Lagos",
  "image_url": "https://project.supabase.co/storage/v1/object/public/event-images/..."
}
📋 IMAGE-RELATED FIELDS: {
  image_url: "https://project.supabase.co/storage/v1/object/public/event-images/...",
  image_base64: undefined,
  imageUrl: undefined,
  flyer_url: undefined
}
📝 IMAGE_URL VALUE BEING SAVED: https://project.supabase.co/storage/v1/object/public/event-images/...
✅ Event created successfully: {
  id: "evt-123",
  title: "Test Event",
  image_url: "https://project.supabase.co/storage/v1/object/public/event-images/..."
}
```

### Test 3: Verify in Database

Query the events table:
```sql
SELECT id, title, image_url FROM events ORDER BY created_at DESC LIMIT 5;
```

**Expected Result:**
```
id          | title       | image_url
------------|-------------|--------------------------------------------------
evt-123     | Test Event  | https://project.supabase.co/storage/v1/object/...
```

---

## 📋 BACKEND API REFERENCE

### Endpoint: `POST /api/v1/events`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN
```

**Request Body:**
```json
{
  "title": "Event Title",
  "description": "Event description",
  "date": "2026-05-15T19:00:00Z",
  "end_date": "2026-05-16T19:00:00Z",
  "location": "Event location",
  "total_tickets": 500,
  "category": "Technology",
  "image_url": "https://project.supabase.co/storage/v1/object/public/event-images/..."
}
```

**OR with base64:**
```json
{
  "title": "Event Title",
  "description": "Event description",
  "date": "2026-05-15T19:00:00Z",
  "location": "Event location",
  "image_base64": "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Your event has been submitted for review. It will go live once approved by our team.",
  "data": {
    "id": "evt-123",
    "title": "Event Title",
    "date": "2026-05-15T19:00:00Z",
    "location": "Event location",
    "organizer_id": "org-456",
    "status": "pending",
    "total_tickets": 500,
    "tickets_remaining": 500,
    "image_url": "https://project.supabase.co/storage/v1/object/public/event-images/..."
  }
}
```

---

## 🚨 COMMON MISTAKES

### Mistake 1: Wrong Field Name
```javascript
// ❌ WRONG
body: JSON.stringify({
  ...eventData,
  imageUrl: url  // Wrong field name
})

// ✅ CORRECT
body: JSON.stringify({
  ...eventData,
  image_url: url  // Correct field name (snake_case)
})
```

### Mistake 2: Not Waiting for Upload
```javascript
// ❌ WRONG
let imageUrl;
supabase.storage.upload(...).then(result => {
  imageUrl = result.publicUrl;
});
// imageUrl is still undefined here!
fetch(url, { body: JSON.stringify({ image_url: imageUrl }) });

// ✅ CORRECT
const uploadResult = await supabase.storage.upload(...);
const imageUrl = uploadResult.publicUrl;
fetch(url, { body: JSON.stringify({ image_url: imageUrl }) });
```

### Mistake 3: Sending File Object
```javascript
// ❌ WRONG
body: JSON.stringify({
  ...eventData,
  image: imageFile  // Can't stringify File object
})

// ✅ CORRECT
body: JSON.stringify({
  ...eventData,
  image_url: imageUrl  // Send URL string
})
```

---

## 📞 SUPPORT

### Check Backend Logs

1. Go to Vercel Dashboard
2. Select the project
3. Go to "Logs" tab
4. Create an event
5. Look for the debug logs showing request body

### Verify Supabase Storage

1. Go to Supabase Dashboard
2. Navigate to Storage
3. Check `event-images` bucket
4. Verify files are being uploaded
5. Click a file and copy the public URL
6. Verify the URL is accessible in browser

### Test with cURL

Test the backend directly:
```bash
curl -X POST https://tiketa-alpha.vercel.app/api/v1/events \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "title": "Test Event",
    "date": "2026-05-15T19:00:00Z",
    "location": "Lagos",
    "image_url": "https://project.supabase.co/storage/v1/object/public/event-images/test.jpg"
  }'
```

---

## ✅ CHECKLIST

Before marking as fixed:
- [ ] Frontend uploads image to Supabase Storage
- [ ] Frontend gets public URL from Supabase
- [ ] Frontend includes `image_url` in POST request body
- [ ] Backend logs show `image_url` in request body
- [ ] Backend saves `image_url` to database
- [ ] Database query shows non-NULL `image_url`
- [ ] Event detail page displays the image
- [ ] Admin panel shows the image

---

## 🎯 SUMMARY

**The Fix (One Line):**
```javascript
// Add this to your POST request body:
image_url: imageUrl  // ← ADD THIS LINE
```

**Complete Flow:**
1. User selects image file
2. Frontend uploads to Supabase Storage
3. Frontend gets public URL
4. Frontend sends POST /api/v1/events with `image_url` field ← **THIS IS MISSING**
5. Backend saves `image_url` to database
6. Event displays with image

**Status**: ⚠️ Waiting for frontend fix

**Last Updated**: May 7, 2026
