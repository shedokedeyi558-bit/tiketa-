-- RPC function to refund withdrawal (when rejected)
CREATE OR REPLACE FUNCTION reject_withdrawal_refund(org_id UUID, amount DECIMAL)
RETURNS void AS $
BEGIN
  UPDATE wallets
  SET
    available_balance = available_balance + amount,
    pending_balance = GREATEST(pending_balance - amount, 0),
    last_updated = NOW()
  WHERE organizer_id = org_id;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC function to complete withdrawal (when paid)
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION reject_withdrawal_refund(UUID, DECIMAL) TO authenticated;
GRANT EXECUTE ON FUNCTION complete_withdrawal(UUID, DECIMAL) TO authenticated;
