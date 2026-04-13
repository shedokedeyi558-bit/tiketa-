-- Create payout_logs table for audit trail
CREATE TABLE IF NOT EXISTS payout_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  withdrawal_request_id UUID NOT NULL REFERENCES withdrawal_requests(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES auth.users(id),
  action VARCHAR(20) NOT NULL CHECK (action IN ('approved', 'rejected', 'paid', 'reversed')),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_payout_logs_withdrawal_request_id ON payout_logs(withdrawal_request_id);
CREATE INDEX IF NOT EXISTS idx_payout_logs_admin_id ON payout_logs(admin_id);

-- Enable RLS
ALTER TABLE payout_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Admin only (handled via service role in backend)
CREATE POLICY "Service role manages payout logs" ON payout_logs
  FOR ALL USING (auth.role() = 'service_role');
