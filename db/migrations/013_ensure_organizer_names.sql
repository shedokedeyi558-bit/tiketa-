-- Ensure organizers have names in the users table
-- This migration adds a check constraint to prevent null/empty names for organizers

-- Add check constraint to ensure organizers have non-empty names
ALTER TABLE users
ADD CONSTRAINT organizer_must_have_name 
CHECK (
  role != 'organizer' OR (full_name IS NOT NULL AND full_name != '')
);

-- Update any existing organizers with null or empty names to have a default name
UPDATE users
SET full_name = 'Organizer ' || SUBSTRING(id::text, 1, 8)
WHERE role = 'organizer' AND (full_name IS NULL OR full_name = '');

-- Create index on role for faster queries
CREATE INDEX IF NOT EXISTS idx_users_role_organizer ON users(role) WHERE role = 'organizer';

-- Log the update
DO $$
DECLARE
  updated_count INT;
BEGIN
  SELECT COUNT(*) INTO updated_count FROM users WHERE role = 'organizer';
  RAISE NOTICE 'Organizer constraint added. Total organizers: %', updated_count;
END $$;
