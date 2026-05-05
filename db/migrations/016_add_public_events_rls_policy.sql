-- ✅ Add RLS policy to allow public SELECT on active events
-- This ensures that even if RLS is enabled on events table, public users can view active events

-- First, check if RLS is already enabled on events table
-- If not, enable it
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Create policy for public SELECT on active events
-- This allows unauthenticated users to view active events
CREATE POLICY IF NOT EXISTS "Public can view active events" ON events
  FOR SELECT
  USING (status = 'active');

-- Create policy for service role to manage all events
-- This allows the backend (service role) to access all events regardless of status
CREATE POLICY IF NOT EXISTS "Service role manages all events" ON events
  FOR ALL
  USING (auth.role() = 'service_role');

-- Create policy for organizers to see their own events (all statuses)
-- This allows organizers to view their pending, rejected, and other events
CREATE POLICY IF NOT EXISTS "Organizers see own events" ON events
  FOR SELECT
  USING (auth.uid() = organizer_id);

-- Create policy for organizers to create events
CREATE POLICY IF NOT EXISTS "Organizers can create events" ON events
  FOR INSERT
  WITH CHECK (auth.uid() = organizer_id);

-- Create policy for organizers to update their own events
CREATE POLICY IF NOT EXISTS "Organizers can update own events" ON events
  FOR UPDATE
  USING (auth.uid() = organizer_id);

-- Create policy for organizers to delete their own events
CREATE POLICY IF NOT EXISTS "Organizers can delete own events" ON events
  FOR DELETE
  USING (auth.uid() = organizer_id);

-- Create policy for admins to see all events
CREATE POLICY IF NOT EXISTS "Admins see all events" ON events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Create policy for admins to manage all events
CREATE POLICY IF NOT EXISTS "Admins manage all events" ON events
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );
