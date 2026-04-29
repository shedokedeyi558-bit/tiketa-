# Database Fix: Historical Transaction Data

## Issue
The `platform_commission` in the transactions table was calculated incorrectly for existing transactions:
- **WRONG**: `platform_commission = total_amount * 0.03` (includes ₦100 processing fee)
- **CORRECT**: `platform_commission = ticket_price * 0.03` (ticket price only)

This also affected `organizer_earnings` which depends on the commission.

## Fix
Run this SQL query directly on the Supabase database to fix all existing successful transactions:

```sql
UPDATE transactions
SET
  platform_commission = ticket_price * 0.03,
  organizer_earnings = ticket_price - (ticket_price * 0.03)
WHERE status = 'success';
```

## Steps to Apply

### Via Supabase Dashboard:
1. Go to https://app.supabase.com
2. Select your project
3. Go to **SQL Editor**
4. Click **New Query**
5. Paste the SQL query above
6. Click **Run**
7. Verify the results show how many rows were updated

### Via Supabase CLI:
```bash
supabase db push
```

## Verification

After running the fix, verify the data:

```sql
-- Check a few transactions to verify the fix
SELECT 
  id,
  ticket_price,
  processing_fee,
  total_amount,
  platform_commission,
  organizer_earnings,
  (ticket_price * 0.03) as expected_commission,
  (ticket_price - (ticket_price * 0.03)) as expected_earnings
FROM transactions
WHERE status = 'success'
LIMIT 10;
```

The `platform_commission` should equal `expected_commission` and `organizer_earnings` should equal `expected_earnings`.

## Impact

- **Revenue Analytics**: Will now show correct totals
- **Organizer Payouts**: Will show correct earnings
- **Admin Dashboard**: Commission calculations will be accurate
- **Historical Data**: All past transactions will be corrected

## Notes

- This only affects transactions with `status = 'success'`
- Pending, failed, and rejected transactions are not affected
- The fix is reversible if needed (keep a backup)
- New transactions created after the code fix will have correct calculations automatically
