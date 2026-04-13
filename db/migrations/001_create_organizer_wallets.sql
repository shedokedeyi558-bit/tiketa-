-- Create organizer_wallets table
CREATE TABLE IF NOT EXISTS organizer_wallets (
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
CREATE INDEX IF NOT EXISTS idx_organizer_wallets_organizer_id ON organizer_wallets(organizer_id);

-- Enable RLS
ALTER TABLE organizer_wallets ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Organizer can only see their own wallet
CREATE POLICY "Organizer sees own wallet" ON organizer_wallets
  FOR SELECT USING (auth.uid() = organizer_id);

-- RLS Policy: Service role (backend) can update wallets
CREATE POLICY "Service role manages wallets" ON organizer_wallets
  FOR ALL USING (auth.role() = 'service_role');
