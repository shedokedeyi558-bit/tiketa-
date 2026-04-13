-- Create withdrawal_requests table
CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(12, 2) NOT NULL,
  bank_name VARCHAR(100) NOT NULL,
  account_number VARCHAR(20) NOT NULL,
  account_name VARCHAR(150) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
  admin_note TEXT,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  squadco_transfer_reference VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_organizer_id ON withdrawal_requests(organizer_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON withdrawal_requests(status);

-- Enable RLS
ALTER TABLE withdrawal_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Organizer can see their own withdrawal requests
CREATE POLICY "Organizer sees own withdrawals" ON withdrawal_requests
  FOR SELECT USING (auth.uid() = organizer_id);

-- RLS Policy: Organizer can create their own withdrawal requests
CREATE POLICY "Organizer creates own withdrawals" ON withdrawal_requests
  FOR INSERT WITH CHECK (auth.uid() = organizer_id);

-- RLS Policy: Service role (backend) can manage all withdrawal requests
CREATE POLICY "Service role manages withdrawals" ON withdrawal_requests
  FOR ALL USING (auth.role() = 'service_role');
