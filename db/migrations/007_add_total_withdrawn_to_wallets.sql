-- Add total_withdrawn column to wallets table
-- This tracks the total amount withdrawn by each organizer

ALTER TABLE wallets
ADD COLUMN IF NOT EXISTS total_withdrawn NUMERIC(15,2) DEFAULT 0;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_wallets_total_withdrawn ON wallets(total_withdrawn);

-- Update RPC function to use total_withdrawn
CREATE OR REPLACE FUNCTION complete_withdrawal(org_id UUID, amount DECIMAL)
RETURNS void AS $
BEGIN
  UPDATE wallets
  SET
    pending_balance = GREATEST(pending_balance - amount, 0),
    total_withdrawn = total_withdrawn + amount,
    last_updated = NOW()
  WHERE organizer_id = org_id;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION complete_withdrawal(UUID, DECIMAL) TO authenticated;
