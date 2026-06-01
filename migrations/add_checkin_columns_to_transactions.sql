-- Migration: Add check-in columns to transactions table
-- Run this in Supabase SQL editor before deploying

ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS checked_in_by TEXT DEFAULT NULL;

-- Index for fast check-in lookups by reference
CREATE INDEX IF NOT EXISTS idx_transactions_reference ON transactions(reference);

COMMENT ON COLUMN transactions.checked_in_at IS 'Timestamp when this ticket was checked in at the event';
COMMENT ON COLUMN transactions.checked_in_by IS 'Organizer ID who performed the check-in';
