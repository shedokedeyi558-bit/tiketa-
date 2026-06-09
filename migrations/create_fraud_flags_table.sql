-- Migration: Create fraud_flags table for non-blocking fraud detection
-- Run this in Supabase SQL editor

CREATE TABLE IF NOT EXISTS fraud_flags (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_reference TEXT NOT NULL,
  buyer_email           TEXT,
  event_id              UUID,
  amount                NUMERIC,
  flag_reason           TEXT,
  flagged_at            TIMESTAMPTZ DEFAULT now(),
  reviewed              BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_fraud_flags_reviewed    ON fraud_flags(reviewed);
CREATE INDEX IF NOT EXISTS idx_fraud_flags_buyer_email ON fraud_flags(buyer_email);
CREATE INDEX IF NOT EXISTS idx_fraud_flags_flagged_at  ON fraud_flags(flagged_at DESC);

COMMENT ON TABLE fraud_flags IS 'Non-blocking fraud detection flags for admin review';
