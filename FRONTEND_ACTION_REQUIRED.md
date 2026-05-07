# 🚨 FRONTEND ACTION REQUIRED - Image Upload Fix

**Priority**: Medium  
**Estimated Time**: 5-10 minutes  
**Difficulty**: Easy (one line fix)

---

## 🎯 THE PROBLEM

When organizers create events with images:
- ✅ Image uploads to Supabase Storage successfully
- ✅ Public URL is generated
- ❌ **URL is NOT sent to backend API**
- ❌ Database saves NULL for `image_url`
- ❌ Event pages show no image

---

## ✅ THE FIX

Add ONE line to your event creation API call:

```javascript
// In your event creation form/component:

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
    total_tickets: eventData.total_tickets,
    category: eventData.category,
    image_url: imageUrl  // ← ADD THIS LINE (use the URL from Supabase Storage)
  })
});
```

---

## 📍 WHERE TO MAKE THE CHANGE

### Step 1: Find Your Event Creation Component

Look for files like:
- `CreateEventPage.jsx`
- `CreateEventForm.jsx`
- `EventForm.jsx`
- `NewEvent.jsx`
- Or search for: `supabase.storage.from('event-images')`

### Step 2: Find the Image Upload Code

You should have something like:
```javascript
const { data, error } = await supabase.storage
  .from('event-images')
  .upload(filePath, imageFile);

const { data: urlData } = supabase.storage
  .from('event-images')
  .getPublicUrl(filePath);

const imageUrl = urlData.publicUrl;  // ← This URL needs to be sent to backend
```

### Step 3: Find the API Call

Look for:
```javascript
fetch('https://tiketa-alpha.vercel.app/api/v1/events', {
  method: 'POST',
  ...
})
```

### Step 4: Add `image_url` to Request Body

```javascript
body: JSON.stringify({
  ...eventData,
  image_url: imageUrl  // ← ADD THIS
})
```

---

## 🧪 HOW TO TEST

### Before the Fix:
```javascript
// Console log before fetch:
console.log('Request body:', requestBody);

// Output (WRONG):
{
  title: "Test Event",
  date: "2026-05-15",
  location: "Lagos"
  // ❌ No image_url field
}
```

### After the Fix:
```javascript
// Console log before fetch:
console.log('Request body:', requestBody);

// Output (CORRECT):
{
  title: "Test Event",
  date: "2026-05-15",
  location: "Lagos",
  image_url: "https://project.supabase.co/storage/v1/object/public/event-images/..."
  // ✅ image_url is included
}
```

### Verify in Database:
```sql
-- Run this in Supabase SQL Editor:
SELECT id, title, image_url 
FROM events 
ORDER BY created_at DESC 
LIMIT 5;

-- Should show URLs, not NULL
```

---

## 📋 COMPLETE EXAMPLE

Here's a complete working example:

```javascript
const createEvent = async (eventData, imageFile) => {
  try {
    let imageUrl = null;
    
    // Step 1: Upload image to Supabase Storage (if provided)
    if (imageFile) {
      const fileName = `${Date.now()}-${imageFile.name}`;
      const filePath = `event-images/${userId}/${fileName}`;
      
      const { data, error: uploadError } = await supabase.storage
        .from('event-images')
        .upload(filePath, imageFile, {
          cacheControl: '3600',
          upsert: false
        });
      
      if (uploadError) {
        console.error('Image upload failed:', uploadError);
        // Continue without image - don't block event creation
      } else {
        // Get public URL
        const { data: urlData } = supabase.storage
          .from('event-images')
          .getPublicUrl(filePath);
        
        imageUrl = urlData.publicUrl;
        console.log('✅ Image uploaded:', imageUrl);
      }
    }
    
    // Step 2: Create event with image URL
    const requestBody = {
      title: eventData.title,
      description: eventData.description,
      date: eventData.date,
      end_date: eventData.end_date,
      location: eventData.location,
      total_tickets: eventData.total_tickets,
      category: eventData.category,
      image_url: imageUrl  // ✅ Include the image URL
    };
    
    console.log('📋 Sending to backend:', requestBody);
    
    const response = await fetch('https://tiketa-alpha.vercel.app/api/v1/events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(requestBody)
    });
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.message || 'Event creation failed');
    }
    
    console.log('✅ Event created:', result.data);
    console.log('✅ Image URL saved:', result.data.image_url);
    
    return result;
    
  } catch (error) {
    console.error('❌ Error creating event:', error);
    throw error;
  }
};
```

---

## ⚠️ COMMON MISTAKES

### Mistake 1: Wrong Field Name
```javascript
// ❌ WRONG
image_url: imageUrl     // Correct
imageUrl: imageUrl      // Wrong (camelCase)
flyer_url: imageUrl     // Wrong (old field name)
image: imageUrl         // Wrong
```

### Mistake 2: Sending File Object
```javascript
// ❌ WRONG
image: imageFile        // Can't stringify File object

// ✅ CORRECT
image_url: imageUrl     // Send URL string
```

### Mistake 3: Not Waiting for Upload
```javascript
// ❌ WRONG
let imageUrl;
supabase.storage.upload(...).then(result => {
  imageUrl = result.publicUrl;
});
fetch(...);  // imageUrl is still undefined!

// ✅ CORRECT
const result = await supabase.storage.upload(...);
const imageUrl = result.publicUrl;
fetch(...);  // imageUrl is defined
```

---

## 🎯 CHECKLIST

- [ ] Found event creation component
- [ ] Located image upload code
- [ ] Captured public URL after upload
- [ ] Added `image_url` to request body
- [ ] Tested: Created event with image
- [ ] Verified: Console shows `image_url` in request
- [ ] Verified: Backend logs show `image_url` received
- [ ] Verified: Database shows non-NULL `image_url`
- [ ] Verified: Event page displays the image

---

## 📞 NEED HELP?

**Full Documentation:**
- Comprehensive guide: `FRONTEND_IMAGE_UPLOAD_FIX.md`
- Investigation report: `IMAGE_UPLOAD_INVESTIGATION_SUMMARY.md`
- Quick reference: `IMAGE_UPLOAD_STATUS.md`

**Backend Status:**
- ✅ Backend is ready and waiting
- ✅ Debugging logs added
- ✅ Database column exists
- ✅ Supabase Storage configured

**API Endpoint:**
```
POST https://tiketa-alpha.vercel.app/api/v1/events
```

**Required Field:**
```
image_url: string (optional) - Public URL from Supabase Storage
```

---

## 🚀 AFTER THE FIX

Once fixed, the flow will be:
1. ✅ User selects image
2. ✅ Frontend uploads to Supabase Storage
3. ✅ Frontend gets public URL
4. ✅ Frontend sends URL to backend
5. ✅ Backend saves URL to database
6. ✅ Event displays with image
7. ✅ Admin sees image when reviewing event

---

**Status**: ⚠️ Waiting for frontend fix  
**Priority**: Medium  
**Estimated Time**: 5-10 minutes  
**Difficulty**: Easy (one line)

**Last Updated**: May 7, 2026

