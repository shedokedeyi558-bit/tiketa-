-- Migration: Atomic ticket availability check using row-level lock
-- Run this in Supabase SQL editor BEFORE deploying the backend changes.
--
-- v2 changes vs v1:
--   - Also counts recent PENDING transactions (created within last 15 min) as
--     "held" seats. This prevents two concurrent buyers from both passing the
--     availability check for the last ticket.
--   - Stale pending rows (>15 min) are cleaned up by the server-side job in
--     services/pendingTransactionCleanup.js and do NOT count as held.

CREATE OR REPLACE FUNCTION reserve_tickets(
  p_event_id TEXT,
  p_tier_id  TEXT,       -- frontend string ID, matches ticket_types.id cast to text
  p_quantity INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_capacity  INTEGER;
  v_sold      INTEGER;
  v_held      INTEGER;  -- pending transactions within last 15 min (in-checkout holds)
  v_available INTEGER;
BEGIN
  -- Lock the ticket_types row for this tier to prevent concurrent reads
  SELECT quantity INTO v_capacity
  FROM ticket_types
  WHERE id::TEXT = p_tier_id
    AND event_id::TEXT = p_event_id
  FOR UPDATE;

  IF v_capacity IS NULL THEN
    -- Tier not found in ticket_types table — skip capacity check (JSONB-only tier)
    RETURN jsonb_build_object('success', true, 'available', NULL, 'note', 'tier not in ticket_types table');
  END IF;

  -- 0 means unlimited for this tier
  IF v_capacity = 0 THEN
    RETURN jsonb_build_object('success', true, 'available', NULL);
  END IF;

  -- Count confirmed sold tickets for this tier
  SELECT COALESCE(SUM((quantity)::INTEGER), 0) INTO v_sold
  FROM transactions
  WHERE event_id::TEXT = p_event_id
    AND status = 'success'
    AND (squadco_response->>'tier_id') = p_tier_id;

  -- Count in-flight pending transactions in the last 15 minutes as held seats.
  -- This prevents oversell when two buyers simultaneously checkout the last ticket.
  -- Stale pending rows (>15 min) are expired by the backend cleanup job and don't count.
  SELECT COALESCE(SUM((quantity)::INTEGER), 0) INTO v_held
  FROM transactions
  WHERE event_id::TEXT = p_event_id
    AND status = 'pending'
    AND (squadco_response->>'tier_id') = p_tier_id
    AND created_at > NOW() - INTERVAL '15 minutes';

  v_available := v_capacity - v_sold - v_held;

  IF p_quantity > v_available THEN
    RETURN jsonb_build_object(
      'success',   false,
      'available', GREATEST(v_available, 0),
      'message',   format('Only %s ticket(s) available for this tier', GREATEST(v_available, 0))
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'available', v_available);
END;
$$;

-- Grant execute to authenticated and anon roles
GRANT EXECUTE ON FUNCTION reserve_tickets(TEXT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION reserve_tickets(TEXT, TEXT, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION reserve_tickets(TEXT, TEXT, INTEGER) TO service_role;
