-- Add end_date column to events table for multi-day event support
ALTER TABLE events
ADD COLUMN IF NOT EXISTS end_date TIMESTAMP WITHOUT TIME ZONE NULL;

-- For existing events, set end_date = date (same day event)
UPDATE events SET end_date = date WHERE end_date IS NULL;

-- Add comment explaining the column
COMMENT ON COLUMN events.end_date IS 'End date for multi-day events. If null or equal to date, it is a single-day event.';
