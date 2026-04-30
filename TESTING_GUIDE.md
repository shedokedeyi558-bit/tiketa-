# Testing Guide - Revenue & Transaction System

## 🧪 QUICK TESTING CHECKLIST

### 1. Dashboard Stats Endpoint
**Endpoint**: `GET /api/v1/admin/stats`

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "totalEvents": 15,
    "totalOrders": 50,
    "totalRevenue": 10600,
    "successfulPayments": 5,
    "pendingPayments": 0,
    "platformCommission": 315,
    "activeEvents": 8,
    "organizers": 3,
    "pendingWithdrawals": 0
  }
}
```

**Test Cases**:
- ✅ All values are numbers (never null/undefined)
- ✅ Pending payments shows 0 (not "—")
- ✅ Active events only counts future dates
- ✅ Total revenue = sum of total_amount from successful transactions

---

### 2. Revenue Analytics Endpoint
**Endpoint**: `GET /api/v1/admin/revenue`

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "summary": {
      "total_ticket_revenue": 10500,
      "total_processing_fees": 100,
      "total_amount_collected": 10600,
      "total_squadco_charges": 127.2,
      "total_platform_commission": 315,
      "total_organizer_earnings": 10185,
      "total_platform_net_profit": 287.8,
      "total_transactions": 5
    },
    "monthlyData": [...],
    "revenueByEvent": [...],
    "revenueByOrganizer": [...]
  }
}
```

**Test Cases**:
- ✅ Total ticket revenue = sum of ticket_price
- ✅ Total processing fees = sum of processing_fee (₦100 × count)
- ✅ Total amount collected = sum of total_amount
- ✅ Total squadco charges = 1.2% of total_amount_collected
- ✅ Total platform commission = sum of platform_commission
- ✅ Total organizer earnings = sum of organizer_earnings
- ✅ Total platform net profit = processing_fees - squadco_charges + platform_commission

**Verification Formula**:
```
For 5 transactions of ₦2,000 each:
- Total Ticket Revenue: ₦10,000
- Total Processing Fees: ₦500 (₦100 × 5)
- Total Amount Collected: ₦10,500
- Total Squadco Charges: ₦126 (₦10,500 × 1.2%)
- Total Platform Commission: ₦300 (₦10,000 × 3%)
- Total Organizer Earnings: ₦9,700 (₦10,000 - ₦300)
- Total Platform Net Profit: ₦674 (₦500 - ₦126 + ₦300)
```

---

### 3. Transaction Diagnostics Endpoint
**Endpoint**: `GET /api/v1/admin/diagnostics/transactions`

**Expected Response**:
```json
{
  "success": true,
  "diagnostics": {
    "total_transactions": 50,
    "successful_count": 5,
    "successful_data": [
      {
        "id": "tx-123",
        "ticket_price": 2000,
        "processing_fee": 100,
        "total_amount": 2100,
        "platform_commission": 60,
        "organizer_earnings": 1940,
        "status": "success"
      }
    ],
    "pending_count": 2,
    "failed_count": 0,
    "errors": {
      "all": null,
      "success": null,
      "pending": null,
      "failed": null
    }
  }
}
```

**Test Cases**:
- ✅ Shows count of transactions by status
- ✅ Returns actual transaction data for successful transactions
- ✅ Platform commission = ticket_price × 0.03
- ✅ Organizer earnings = ticket_price - platform_commission

---

### 4. Event Approval System
**Endpoints**:
- `GET /api/v1/admin/events/pending` - Get pending events
- `POST /api/v1/admin/events/:id/approve` - Approve event
- `POST /api/v1/admin/events/:id/reject` - Reject event

**Test Workflow**:
1. Create event as organizer → status='pending'
2. Call `GET /api/v1/admin/events/pending` → should see the event
3. Call `POST /api/v1/admin/events/:id/approve` → status='active'
4. Call `GET /api/v1/events` → should see the event (if future date)
5. Verify email sent to organizer

**Test Cases**:
- ✅ New events have status='pending'
- ✅ Pending events don't appear on public listing
- ✅ Approved events appear on public listing (if future date)
- ✅ Rejected events don't appear on public listing
- ✅ Email notifications sent on approval/rejection

---

### 5. Admin Organizers Endpoint
**Endpoint**: `GET /api/v1/admin/organizers`

**Expected Response**:
```json
{
  "success": true,
  "message": "Organizers fetched successfully",
  "data": [
    {
      "id": "org-123",
      "full_name": "John Organizer",
      "email": "john@example.com",
      "date_joined": "2024-01-15T10:00:00Z",
      "available_balance": 5000,
      "total_earned": 10000,
      "total_tickets_sold": 50,
      "total_events_created": 5,
      "last_activity_date": "2024-04-28T15:30:00Z",
      "status": "active"
    }
  ]
}
```

**Test Cases**:
- ✅ Shows all organizers
- ✅ Available balance from wallets table
- ✅ Total earned from wallets table
- ✅ Total tickets sold = count of transactions with status='success'
- ✅ Total events created = count of events
- ✅ Last activity date = most recent transaction or event
- ✅ Status = 'active' if activity in last 30 days, else 'inactive'

---

### 6. Public Events Endpoint
**Endpoint**: `GET /api/v1/events`

**Expected Response**:
```json
{
  "success": true,
  "message": "Events fetched successfully",
  "data": [
    {
      "id": "event-123",
      "title": "Concert 2024",
      "date": "2024-05-15",
      "location": "Stadium",
      "status": "active",
      "tickets_sold": 50,
      "total_tickets": 100,
      "tickets_remaining": 50
    }
  ],
  "meta": {
    "count": 1,
    "filters": {
      "status": "active",
      "dateFilter": "upcoming",
      "sortBy": "date",
      "sortOrder": "asc"
    }
  }
}
```

**Test Cases**:
- ✅ Only shows events with status='active'
- ✅ Only shows events with future dates (by default)
- ✅ Allows filtering by date range
- ✅ Proper ticket calculation (unlimited vs limited)

---

### 7. Organizer Events Endpoint
**Endpoint**: `GET /api/v1/events/organizer`

**Expected Response**:
```json
{
  "success": true,
  "message": "Events fetched successfully",
  "data": [
    {
      "id": "event-123",
      "title": "Concert 2024",
      "date": "2024-05-15",
      "location": "Stadium",
      "status": "pending",
      "tickets_sold": 0,
      "total_tickets": 100,
      "tickets_remaining": 100
    }
  ],
  "meta": {
    "count": 1,
    "filters": {
      "status": "active",
      "dateFilter": "upcoming",
      "sortBy": "date",
      "sortOrder": "asc"
    }
  }
}
```

**Test Cases**:
- ✅ Shows all organizer's events (all statuses)
- ✅ Includes pending events
- ✅ Includes active events
- ✅ Includes rejected events
- ✅ Allows filtering by status
- ✅ Allows filtering by date range

---

### 8. Event Stats Endpoint
**Endpoint**: `GET /api/v1/events/:id/stats`

**Expected Response**:
```json
{
  "success": true,
  "message": "Event stats fetched successfully",
  "data": {
    "event": {
      "id": "event-123",
      "title": "Concert 2024",
      "date": "2024-05-15",
      "location": "Stadium",
      "tickets_sold": 5,
      "total_tickets": 100
    },
    "transactions": {
      "total": 5,
      "successful": 5,
      "pending": 0,
      "failed": 0
    },
    "revenue": {
      "gross_revenue": 10000,
      "platform_fee": 300,
      "net_earnings": 9700,
      "organizer_earnings": 9700
    },
    "tickets": {
      "count": 5,
      "total_quantity": 5
    }
  }
}
```

**Test Cases**:
- ✅ Gross revenue = sum of ticket_price (NOT total_amount)
- ✅ Platform fee = sum of platform_commission (3% of ticket_price)
- ✅ Net earnings = gross_revenue - platform_fee
- ✅ Organizer earnings matches net earnings

---

## 🔍 MANUAL TESTING STEPS

### Step 1: Create a Test Transaction
1. Go to frontend and create a test event
2. Buy a ticket for ₦2,000
3. Complete payment with Squadco
4. Verify transaction is created with status='success'

### Step 2: Check Dashboard Stats
1. Go to admin dashboard
2. Check stats card shows:
   - Total Revenue: ₦2,100 (ticket_price + processing_fee)
   - Platform Commission: ₦60 (3% of ₦2,000)
   - Pending Payments: 0

### Step 3: Check Revenue Analytics
1. Go to admin revenue page
2. Verify shows:
   - Total Ticket Revenue: ₦2,000
   - Total Processing Fees: ₦100
   - Total Amount Collected: ₦2,100
   - Total Squadco Charges: ₦25.20 (1.2% of ₦2,100)
   - Total Platform Commission: ₦60 (3% of ₦2,000)
   - Total Organizer Earnings: ₦1,940 (₦2,000 - ₦60)
   - Total Platform Net Profit: ₦134.80 (₦100 - ₦25.20 + ₦60)

### Step 4: Check Transaction Diagnostics
1. Call `GET /api/v1/admin/diagnostics/transactions`
2. Verify shows:
   - successful_count: 1
   - successful_data contains the transaction with correct values

### Step 5: Check Organizer Stats
1. Call `GET /api/v1/admin/organizers`
2. Verify organizer shows:
   - total_tickets_sold: 1
   - total_earned: ₦1,940 (organizer_earnings)
   - available_balance: ₦1,940

### Step 6: Check Event Stats
1. Call `GET /api/v1/events/:id/stats`
2. Verify shows:
   - gross_revenue: ₦2,000
   - platform_fee: ₦60
   - net_earnings: ₦1,940

---

## 🐛 DEBUGGING TIPS

### If Revenue Shows ₦0:
1. Check if there are any transactions with status='success'
2. Run: `GET /api/v1/admin/diagnostics/transactions`
3. If successful_count is 0, no transactions exist yet
4. If successful_count > 0 but revenue is ₦0, check console logs

### If Platform Commission is Wrong:
1. Check transaction in database:
   ```sql
   SELECT ticket_price, platform_commission, organizer_earnings
   FROM transactions
   WHERE id = 'tx-123';
   ```
2. Verify: platform_commission = ticket_price × 0.03
3. If wrong, run: `node fixHistoricalTransactions.js`

### If Organizer Earnings is Wrong:
1. Check transaction in database
2. Verify: organizer_earnings = ticket_price - platform_commission
3. If wrong, run: `node fixHistoricalTransactions.js`

### To View Detailed Logs:
1. Visit admin dashboard revenue page
2. Check Vercel backend logs
3. Look for "🔥🔥🔥 REVENUE ANALYTICS ENDPOINT CALLED 🔥🔥🔥"
4. Review transaction data and calculations

---

## ✅ FINAL VERIFICATION

Before considering the implementation complete:

- [ ] Dashboard stats shows correct values
- [ ] Revenue analytics shows correct calculations
- [ ] Transaction diagnostics shows transaction data
- [ ] Event approval system works (pending → active)
- [ ] Admin organizers endpoint shows correct stats
- [ ] Public events only shows active + future
- [ ] Organizer events shows all statuses
- [ ] Event stats calculations are correct
- [ ] All numeric values are numbers (not null)
- [ ] Console logs show detailed information
- [ ] No errors in Vercel logs

