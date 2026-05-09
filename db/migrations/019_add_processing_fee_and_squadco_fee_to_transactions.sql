-- Add processing_fee and squadco_fee columns to transactions table if they don't exist
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS processing_fee DECIMAL(12, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS squadco_fee DECIMAL(12, 2) DEFAULT 0.00;

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_transactions_processing_fee ON transactions(processing_fee) WHERE processing_fee > 0;
CREATE INDEX IF NOT EXISTS idx_transactions_squadco_fee ON transactions(squadco_fee) WHERE squadco_fee > 0;

-- Update existing transactions to calculate processing_fee and squadco_fee if they're NULL
-- processing_fee = ₦100 (flat fee)
-- squadco_fee = (total_amount * 1.2) / 100
UPDATE transactions
SET 
  processing_fee = CASE WHEN processing_fee IS NULL OR processing_fee = 0 THEN 100 ELSE processing_fee END,
  squadco_fee = CASE WHEN squadco_fee IS NULL OR squadco_fee = 0 THEN ROUND((total_amount * 1.2) / 100, 2) ELSE squadco_fee END
WHERE status = 'success' AND (processing_fee IS NULL OR processing_fee = 0 OR squadco_fee IS NULL OR squadco_fee = 0);
