# Sales Feed Endpoint Documentation

## Overview

The Sales Feed endpoint provides comprehensive transaction data with calculated platform profit for each transaction and summary statistics.

---

## Endpoint Details

### URL
```
GET /api/v1/admin/sales-feed
```

### Authentication
- ✅ Required: Admin authentication via `adminAuth` middleware
- Must be logged in as admin user

### Response Format
```json
{
  "success": true,
  "message": "Sales feed fetched successfully",
  "data": [
    {
      "id": "transaction-uuid",
      "reference": "REF-123456",
      "event_id": "event-uuid",
      "organizer_id": "organizer-uuid",
      "buyer_name": "John Doe",
      "buyer_email": "john@example.com",
      "ticket_price": 1000,
      "processing_fee": 100,
      "total_amount": 1100,
      "platform_commission": 30,
      "squadco_fee": 13.20,
      "platform_profit": 116.80,
      "organizer_earnings": 970,
      "status": "success",
      "created_at": "2026-05-08T10:30:00Z"
    }
  ],
  "summary": {
    "total_transactions": 10,
    "total_revenue": 10000,
    "total_processing_fees": 1000,
    "total_platform_commission": 300,
    "total_squadco_fees": 132,
    "total_platform_profit": 1168,
    "total_organizer_earnings": 9700
  }
}
```

---

## Field Descriptions

### Per-Transaction Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique transaction identifier |
| `reference` | String | Payment reference code |
| `event_id` | UUID | Associated event ID |
| `organizer_id` | UUID | Event organizer ID |
| `buyer_name` | String | Ticket buyer name |
| `buyer_email` | String | Ticket buyer email |
| `ticket_price` | Number | Base ticket price (₦) |
| `processing_fee` | Number | Platform processing fee (₦100 flat) |
| `total_amount` | Number | Total paid by buyer (ticket_price + processing_fee) |
| `platform_commission` | Number | Platform commission (3% of ticket_price) |
| `squadco_fee` | Number | Squadco payment gateway fee (1.2% of total_amount) |
| `platform_profit` | Number | **Platform actual profit per transaction** |
| `organizer_earnings` | Number | Amount paid to organizer (ticket_price - platform_commission) |
| `status` | String | Transaction status (always "success" for this endpoint) |
| `created_at` | ISO String | Transaction timestamp |

### Summary Statistics

| Field | Description |
|-------|-------------|
| `total_transactions` | Count of successful transactions |
| `total_revenue` | Sum of all ticket_price values |
| `total_processing_fees` | Sum of all processing_fee values |
| `total_platform_commission` | Sum of all platform_commission values |
| `total_squadco_fees` | Sum of all squadco_fee values |
| `total_platform_profit` | **Total platform profit across all transactions** |
| `total_organizer_earnings` | Sum of all organizer_earnings values |

---

## Calculation Formulas

### Per Transaction

```
squadco_fee = (total_amount * 1.2) / 100

platform_profit = processing_fee + platform_commission - squadco_fee
```

### Example Calculation
```
Ticket Price: ₦1,000
Processing Fee: ₦100
Total Amount: ₦1,100

Platform Commission = 1,000 × 3% = ₦30
Squadco Fee = 1,100 × 1.2% = ₦13.20
Platform Profit = 100 + 30 - 13.20 = ₦116.80
Organizer Earnings = 1,000 - 30 = ₦970
```

### Summary Totals

```
total_platform_profit = SUM(processing_fee) + SUM(platform_commission) - SUM(squadco_fee)
```

---

## Usage Examples

### cURL Request
```bash
curl -X GET https://tiketa-alpha.vercel.app/api/v1/admin/sales-feed \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json"
```

### JavaScript/Fetch
```javascript
const response = await fetch('/api/v1/admin/sales-feed', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  }
});

const data = await response.json();
console.log(data.data); // Array of transactions
console.log(data.summary); // Summary statistics
```

### React Component Example
```javascript
import { useState, useEffect } from 'react';

export function SalesFeed({ adminToken }) {
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSalesFeed = async () => {
      try {
        const response = await fetch('/api/v1/admin/sales-feed', {
          headers: {
            'Authorization': `Bearer ${adminToken}`
          }
        });
        
        const data = await response.json();
        setTransactions(data.data);
        setSummary(data.summary);
      } catch (error) {
        console.error('Error fetching sales feed:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSalesFeed();
  }, [adminToken]);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {/* Summary Stats */}
      <div className="summary-cards">
        <Card title="Total Revenue" value={`₦${summary.total_revenue}`} />
        <Card title="Platform Commission" value={`₦${summary.total_platform_commission}`} />
        <Card title="Squadco Fees" value={`₦${summary.total_squadco_fees}`} />
        <Card title="Platform Profit" value={`₦${summary.total_platform_profit}`} />
      </div>

      {/* Transactions Table */}
      <table>
        <thead>
          <tr>
            <th>Reference</th>
            <th>Buyer</th>
            <th>Ticket Price</th>
            <th>Processing Fee</th>
            <th>Platform Commission</th>
            <th>Squadco Fee</th>
            <th>Platform Profit</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map(tx => (
            <tr key={tx.id}>
              <td>{tx.reference}</td>
              <td>{tx.buyer_name}</td>
              <td>₦{tx.ticket_price}</td>
              <td>₦{tx.processing_fee}</td>
              <td>₦{tx.platform_commission}</td>
              <td>₦{tx.squadco_fee}</td>
              <td className="highlight">₦{tx.platform_profit}</td>
              <td>{new Date(tx.created_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

---

## Frontend Integration

### Sales Feed Page Structure

```
┌─────────────────────────────────────────────────────┐
│                  SALES FEED PAGE                    │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Summary Stats (from summary object):              │
│  ┌──────────┬──────────┬──────────┬──────────┐    │
│  │ Revenue  │ Comm.    │ Squadco  │ Profit   │    │
│  │ ₦10,000  │ ₦300     │ ₦132     │ ₦1,168   │    │
│  └──────────┴──────────┴──────────┴──────────┘    │
│                                                     │
│  Transactions Table (from data array):             │
│  ┌─────────────────────────────────────────────┐  │
│  │ Ref │ Buyer │ Price │ Fee │ Comm │ Squadco │  │
│  │     │       │       │     │      │ Profit  │  │
│  ├─────────────────────────────────────────────┤  │
│  │ ... │ ...   │ ...   │ ... │ ...  │ ...     │  │
│  └─────────────────────────────────────────────┘  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Summary Stats Cards
Display these values from the `summary` object:
- **Total Revenue**: `summary.total_revenue`
- **Platform Commission**: `summary.total_platform_commission`
- **Squadco Fees**: `summary.total_squadco_fees`
- **Platform Net Profit**: `summary.total_platform_profit`

### Transactions Table Columns
Display these columns from each item in the `data` array:
1. Reference: `reference`
2. Buyer Name: `buyer_name`
3. Ticket Price: `ticket_price`
4. Processing Fee: `processing_fee`
5. Platform Commission: `platform_commission`
6. Squadco Fee: `squadco_fee`
7. **Platform Profit**: `platform_profit` (highlight this column)
8. Date: `created_at`

---

## Error Handling

### 401 Unauthorized
```json
{
  "success": false,
  "message": "Unauthorized"
}
```
**Cause**: Not authenticated or not an admin

### 500 Server Error
```json
{
  "success": false,
  "message": "Internal server error",
  "error": "Error details..."
}
```
**Cause**: Database query failed

---

## Performance Considerations

- ✅ Fetches only successful transactions
- ✅ Calculates platform profit on-the-fly (no DB storage needed)
- ✅ Includes summary statistics in single response
- ✅ Ordered by most recent first (`created_at DESC`)

---

## Data Consistency

### Verification Formula
```
total_platform_profit = SUM(platform_profit) for all transactions
                      = SUM(processing_fee + platform_commission - squadco_fee)
                      = SUM(processing_fee) + SUM(platform_commission) - SUM(squadco_fee)
```

This should match:
- Dashboard `platformNetProfit`
- Revenue page `totalPlatformNetProfit`

---

## Related Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /api/v1/admin/stats` | Dashboard statistics |
| `GET /api/v1/admin/revenue` | Revenue analytics |
| `GET /api/v1/admin/orders` | Orders (different from transactions) |

---

## Deployment Status

- ✅ Endpoint created and tested
- ✅ Calculations verified
- ✅ Pushed to main branch
- ✅ Ready for frontend integration

---

**Endpoint**: `GET /api/v1/admin/sales-feed`  
**Status**: ✅ READY FOR PRODUCTION  
**Last Updated**: May 8, 2026