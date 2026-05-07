# Admin Events Endpoint Fix - Complete

## Summary
Fixed the `getAdminEvents` function to use the correct `profiles` table, calculate revenue from `ticket_price`, and count actual tickets sold from transactions.

## Problems Fixed

### Problem 1: Wrong Table Join
**Issue**: Function was joining with `users:organizer_id` but the table is `profiles`
**Impact**: Organizer information was not being fetched correctly

### Problem 2: Wrong Revenue Calculation
**Issue**: Revenue was calculated from `total_amount` (which includes processing fees)
**Impact**: Event revenue was inflated by ₦100 per ticket

### Problem 3: Incorrect Tickets Sold Count
**Issue**: Using `event.tickets_sold` from events table instead of counting actual transactions
**Impact**: Ticket counts were inaccurate or missing

## Changes Made

### Replacement 1: Fix Table Join
**Before:**
```javascript
.select('*, users:organizer_id(full_name, email)')
```

**After:**
```javascript
.select('*, profiles:organizer_id(full_name, email)')
```

### Replacement 2: Fix Organizer Name Reading
**Before:**
```javascript
organizer_name: event.users?.full_name || 'Unknown',
organizer_email: event.users?.email || '',
```

**After:**
```javascript
organizer_name: event.profiles?.full_name || event.profiles?.email?.split('@')[0] || 'Unknown',
organizer_email: event.profiles?.email || '',
```

### Replacement 3: Add ticket_price to Select Query
**Before:**
```javascript
.select('event_id, total_amount, organizer_earnings')
```

**After:**
```javascript
.select('event_id, ticket_price, total_amount, organizer_earnings')
```

### Replacement 4 & 5: Fix Transaction Map Building
**Before:**
```javascript
const txMap = {};
(transactions || []).forEach(tx => {
  if (!txMap[tx.event_id]) {
    txMap[tx.event_id] = { revenue: 0, organizer_earnings: 0 };
  }
  txMap[tx.event_id].revenue += Number(tx.total_amount || 0);
  txMap[tx.event_id].organizer_earnings += Number(tx.organizer_earnings || 0);
});
```

**After:**
```javascript
const txMap = {};
(transactions || []).forEach(tx => {
  if (!txMap[tx.event_id]) {
    txMap[tx.event_id] = { revenue: 0, organizer_earnings: 0, tickets_sold: 0 };
  }
  txMap[tx.event_id].revenue += Number(tx.ticket_price || 0);
  txMap[tx.event_id].organizer_earnings += Number(tx.organizer_earnings || 0);
  txMap[tx.event_id].tickets_sold += 1;
});
```

### Replacement 6: Use Actual Tickets Sold Count
**Before:**
```javascript
tickets_sold: event.tickets_sold || 0,
```

**After:**
```javascript
tickets_sold: txMap[event.id]?.tickets_sold || 0,
```

## What This Fixes

✅ Organizer information now fetches correctly from `profiles` table
✅ Event revenue is now calculated from `ticket_price` (not inflated by processing fees)
✅ Tickets sold count is now accurate (counted from actual transactions)
✅ Organizer name falls back to email prefix if full_name is missing
✅ All admin event listings now show correct financial data

## Files Modified
- `controllers/adminController.js` - getAdminEvents function

## Git Commit
```
Commit: a5870da
Message: fix: getAdminEvents use profiles table, ticket_price for revenue, real tickets sold count
Branch: main ✅ Pushed
```

## Data Accuracy Improvements

### Before Fix:
- Organizer info: ❌ Not fetching (wrong table)
- Revenue: ❌ Inflated by ₦100 per ticket
- Tickets Sold: ❌ Inaccurate or missing

### After Fix:
- Organizer info: ✅ Correct from profiles table
- Revenue: ✅ Accurate (ticket_price only)
- Tickets Sold: ✅ Counted from actual transactions

## Example Data Flow

**Transaction:**
- ticket_price: ₦10,000
- processing_fee: ₦100
- total_amount: ₦10,100

**Admin Events Response (Before):**
- revenue: ₦10,100 ❌ (includes processing fee)
- tickets_sold: 0 or missing ❌

**Admin Events Response (After):**
- revenue: ₦10,000 ✅ (ticket price only)
- tickets_sold: 1 ✅ (counted from transaction)
