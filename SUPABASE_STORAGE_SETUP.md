# Supabase Storage Setup for Event Images

**Status**: ⚠️ REQUIRES MANUAL SETUP

**Migration File**: `db/migrations/017_setup_event_images_storage.sql`

**Date**: May 5, 2026

---

## 🎯 WHAT NEEDS TO BE DONE

Run the SQL migration in Supabase to create the `event-images` storage bucket with proper access policies.

---

## 📋 SETUP STEPS

### Step 1: Access Supabase Dashboard
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: `eouaddaofaevwkqnsmdw`
3. Navigate to **SQL Editor**

### Step 2: Run the Migration
Copy and paste this SQL into the SQL Editor:

```sql
-- ✅ Setup event-images storage bucket with public access policies
-- This migration creates the storage bucket and sets up proper access policies

-- Create the event-images bucket (public for direct URL access)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('event-images', 'event-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Policy 1: Public can view event images (for displaying on frontend)
CREATE POLICY IF NOT EXISTS "Public can view event images" ON storage.objects
FOR SELECT USING (bucket_id = 'event-images');

-- Policy 2: Authenticated users can upload event images (for event creation)
CREATE POLICY IF NOT EXISTS "Authenticated users can upload event images" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'event-images' AND auth.role() = 'authenticated');

-- Policy 3: Users can update their own event images (organizer can replace image)
CREATE POLICY IF NOT EXISTS "Users can update own event images" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'event-images' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy 4: Users can delete their own event images (organizer can remove image)
CREATE POLICY IF NOT EXISTS "Users can delete own event images" ON storage.objects
FOR DELETE USING (
  bucket_id = 'event-images' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy 5: Service role can manage all event images (backend operations)
CREATE POLICY IF NOT EXISTS "Service role manages all event images" ON storage.objects
FOR ALL USING (auth.role() = 'service_role');

-- Verify the bucket was created
SELECT 
  id, 
  name, 
  public,
  created_at
FROM storage.buckets 
WHERE id = 'event-images';

-- List all policies for the storage.objects table related to event-images
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'objects' 
AND schemaname = 'storage'
AND policyname LIKE '%event%';
```

### Step 3: Execute the SQL
1. Click **Run** button
2. Verify no errors in the output
3. Check that the bucket was created successfully

### Step 4: Verify Setup
Navigate to **Storage** in the Supabase dashboard and confirm:
- ✅ `event-images` bucket exists
- ✅ Bucket is marked as **Public**
- ✅ Policies are applied

---

## 🔍 VERIFICATION QUERIES

### Check Bucket Exists
```sql
SELECT id, name, public, created_at
FROM storage.buckets 
WHERE id = 'event-images';
```

**Expected Result:**
```
id           | name         | public | created_at
event-images | event-images | true   | 2026-05-05 ...
```

### Check Policies Applied
```sql
SELECT policyname, cmd
FROM pg_policies 
WHERE tablename = 'objects' 
AND schemaname = 'storage'
AND policyname LIKE '%event%';
```

**Expected Result:**
```
policyname                              | cmd
Public can view event images            | SELECT
Authenticated users can upload...       | INSERT
Users can update own event images       | UPDATE
Users can delete own event images       | DELETE
Service role manages all event images   | ALL
```

---

## 📊 POLICY BREAKDOWN

### 1. Public View Policy
```sql
CREATE POLICY "Public can view event images" ON storage.objects
FOR SELECT USING (bucket_id = 'event-images');
```
**Purpose**: Allows anyone to view event images (for public event pages)

### 2. Authenticated Upload Policy
```sql
CREATE POLICY "Authenticated users can upload event images" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'event-images' AND auth.role() = 'authenticated');
```
**Purpose**: Allows logged-in users to upload images when creating events

### 3. Owner Update Policy
```sql
CREATE POLICY "Users can update own event images" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'event-images' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);
```
**Purpose**: Allows organizers to update their own event images

### 4. Owner Delete Policy
```sql
CREATE POLICY "Users can delete own event images" ON storage.objects
FOR DELETE USING (
  bucket_id = 'event-images' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);
```
**Purpose**: Allows organizers to delete their own event images

### 5. Service Role Policy
```sql
CREATE POLICY "Service role manages all event images" ON storage.objects
FOR ALL USING (auth.role() = 'service_role');
```
**Purpose**: Allows backend (service role) to manage all images

---

## 🗂️ FILE STRUCTURE

After setup, images will be stored as:
```
event-images/
├── {organizer-id-1}/
│   ├── event-title-1234567890-abc123.jpg
│   ├── another-event-1234567891-def456.png
│   └── third-event-1234567892-ghi789.webp
├── {organizer-id-2}/
│   ├── concert-2024-1234567893-jkl012.jpg
│   └── festival-2024-1234567894-mno345.png
└── {organizer-id-3}/
    └── workshop-2024-1234567895-pqr678.jpg
```

**Path Format**: `event-images/{organizer-id}/{event-title}-{timestamp}-{random}.{ext}`

---

## 🔗 PUBLIC URL FORMAT

After upload, images will be accessible at:
```
https://eouaddaofaevwkqnsmdw.supabase.co/storage/v1/object/public/event-images/{organizer-id}/{filename}
```

**Example:**
```
https://eouaddaofaevwkqnsmdw.supabase.co/storage/v1/object/public/event-images/org-123/concert-2024-1234567890-abc123.jpg
```

---

## 🧪 TESTING AFTER SETUP

### Test 1: Upload via Backend
```bash
curl -X POST https://tiketa-alpha.vercel.app/api/v1/events \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "title": "Test Event",
    "date": "2026-05-15T19:00:00Z",
    "location": "Lagos",
    "image_base64": "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
  }'
```

**Expected**: Event created with `image_url` populated

### Test 2: Access Image URL
```bash
curl -I https://eouaddaofaevwkqnsmdw.supabase.co/storage/v1/object/public/event-images/org-123/test-event-1234567890-abc123.jpg
```

**Expected**: `200 OK` response with image headers

### Test 3: Verify in Database
```sql
SELECT id, title, image_url 
FROM events 
WHERE image_url IS NOT NULL 
LIMIT 5;
```

**Expected**: Events with populated `image_url` fields

---

## ⚠️ TROUBLESHOOTING

### Bucket Not Found Error
**Symptom**: `bucket "event-images" does not exist`
**Solution**: Run the migration SQL to create the bucket

### Access Denied Error
**Symptom**: `new row violates row-level security policy`
**Solution**: Verify policies are applied correctly

### Image Not Accessible
**Symptom**: 403 Forbidden when accessing image URL
**Solution**: Ensure bucket is public and view policy exists

### Upload Fails
**Symptom**: Upload returns error in backend logs
**Solution**: Check service role key has storage permissions

---

## 📋 CHECKLIST

Before testing image upload:
- [ ] Run migration SQL in Supabase
- [ ] Verify `event-images` bucket exists
- [ ] Confirm bucket is marked as **Public**
- [ ] Check all 5 policies are applied
- [ ] Test image upload via API
- [ ] Verify image URL is accessible
- [ ] Check database has `image_url` populated

---

## 🚀 NEXT STEPS

After running the migration:
1. ✅ Test image upload via API
2. ✅ Verify images are accessible via public URLs
3. ✅ Update frontend to send `image_base64`
4. ✅ Test end-to-end event creation with images
5. ✅ Monitor storage usage and costs

---

## 📞 SUPPORT

If you encounter issues:
1. Check Supabase dashboard for error messages
2. Verify service role key permissions
3. Check backend logs for upload errors
4. Test with small image files first
5. Ensure bucket policies are correctly applied

---

**Status**: ⚠️ AWAITING SUPABASE SETUP

**Migration File**: `db/migrations/017_setup_event_images_storage.sql`

**Last Updated**: May 5, 2026
