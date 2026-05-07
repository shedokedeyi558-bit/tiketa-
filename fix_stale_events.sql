-- Fix stale events that should have been expired
-- This updates events with status='active' but with dates in the past to 'ended'

UPDATE events
SET status = 'ended', updated_at = NOW()
WHERE status = 'active' 
  AND date < CURRENT_DATE
  AND date IS NOT NULL;

-- Show how many events were updated
SELECT COUNT(*) as events_updated 
FROM events 
WHERE status = 'ended' 
  AND date < CURRENT_DATE;
