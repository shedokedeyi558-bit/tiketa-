-- Create RPC function to safely credit organizer wallet
-- This function handles upsert to avoid race conditions
CREATE OR REPLACE FUNCTION credit_organizer_wallet(org_id UUID, amount DECIMAL)
RETURNS void AS $
BEGIN
  INSERT INTO wallets (organizer_id, available_balance, total_earned)
  VALUES (org_id, amount, amount)
  ON CONFLICT (organizer_id)
  DO UPDATE SET
    available_balance = wallets.available_balance + amount,
    total_earned = wallets.total_earned + amount,
    last_updated = NOW();
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION credit_organizer_wallet(UUID, DECIMAL) TO authenticated;
