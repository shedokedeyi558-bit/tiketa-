-- Fix existing events with NULL end_date by setting it to the date column
-- This ensures all events have an end_date value for proper filtering
UPDATE events 
SET end_date = date 
WHERE end_date IS NULL;

-- Verify the update
SELECT COUNT(*) as events_with_null_end_date 
FROM events 
WHERE end_date IS NULL;
