-- Create wallets table (unified wallet management)
-- This table is used by the payment controller and other services
CREATE TABLE IF NOT EXISTS wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  available_balance DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  pending_balance DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  total_earned DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  total_withdrawn DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_wallets_organizer_id ON wallets(organizer_id);

-- Enable RLS
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Organizer can only see their own wallet
CREATE POLICY "Organizer sees own wallet" ON wallets
  FOR SELECT USING (auth.uid() = organizer_id);

-- RLS Policy: Service role (backend) can update wallets
CREATE POLICY "Service role manages wallets" ON wallets
  FOR ALL USING (auth.role() = 'service_role');

-- Migrate data from organizer_wallets to wallets if organizer_wallets exists
-- This is a safe operation that only runs if both tables exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organizer_wallets') THEN
    INSERT INTO wallets (id, organizer_id, available_balance, pending_balance, total_earned, total_withdrawn, created_at, updated_at)
    SELECT id, organizer_id, available_balance, pending_balance, total_earned, total_withdrawn, created_at, updated_at
    FROM organizer_wallets
    ON CONFLICT (organizer_id) DO UPDATE SET
      available_balance = EXCLUDED.available_balance,
      pending_balance = EXCLUDED.pending_balance,
      total_earned = EXCLUDED.total_earned,
      total_withdrawn = EXCLUDED.total_withdrawn,
      updated_at = NOW();
  END IF;
END $$;
