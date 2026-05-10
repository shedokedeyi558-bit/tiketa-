-- Migration: Fix squadco_fee NULL values
-- Description: Calculate and update squadco_fee for existing transactions where it's NULL
-- Formula: squadco_fee = total_amount * 0.012 (1.2% of total amount)

-- Update all successful transactions with NULL squadco_fee
UPDATE transactions 
SET squadco_fee = total_amount * 0.012 
WHERE squadco_fee IS NULL 
  AND status = 'success';

-- Verify the update
SELECT 
  id,
  reference,
  total_amount,
  squadco_fee,
  status,
  created_at
FROM transactions 
WHERE status = 'success'
ORDER BY created_at DESC
LIMIT 10;
