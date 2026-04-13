-- Add organizer_earnings column to transactions table if it doesn't exist
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS organizer_earnings DECIMAL(12, 2) NOT NULL DEFAULT 0.00;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_transactions_organizer_earnings ON transactions(organizer_earnings) WHERE organizer_earnings > 0;
