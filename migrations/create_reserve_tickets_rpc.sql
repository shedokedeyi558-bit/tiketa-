-- Migration: Atomic ticket availability check using row-level lock
-- Run this in Supabase SQL editor BEFORE deploying the backend changes.
--
-- NOTE on data model:
--   - ticket_types table stores capacity (quantity column) with a text 'id' that may
--     be a frontend-generated string (e.g. "1780299070611-uck9go"), not a UUID.
--   - Transactions store the tier_id inside squadco_response JSONB as a text string.
--   - We lock the ticket_types row by text id to serialize concurrent reservations.

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
  v_available INTEGER;
BEGIN
  -- Lock the ticket_types row for this tier to prevent concurrent reads
  -- Using text cast so it works whether id is UUID or a string
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

  -- Count confirmed sold tickets for this tier from squadco_response JSONB
  SELECT COALESCE(SUM((quantity)::INTEGER), 0) INTO v_sold
  FROM transactions
  WHERE event_id::TEXT = p_event_id
    AND status = 'success'
    AND (squadco_response->>'tier_id') = p_tier_id;

  v_available := v_capacity - v_sold;

  IF p_quantity > v_available THEN
    RETURN jsonb_build_object(
      'success',   false,
      'available', v_available,
      'message',   format('Only %s ticket(s) available for this tier', v_available)
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'available', v_available);
END;
$$;

-- Grant execute to authenticated and anon roles
GRANT EXECUTE ON FUNCTION reserve_tickets(TEXT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION reserve_tickets(TEXT, TEXT, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION reserve_tickets(TEXT, TEXT, INTEGER) TO service_role;
