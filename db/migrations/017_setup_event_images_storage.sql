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