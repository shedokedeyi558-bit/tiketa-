# Frontend Quick Reference Card

## API Base URL
```
https://tiketa-alpha.vercel.app/api/v1
```

## Authentication Header
```javascript
headers: {
  'Authorization': 'Bearer YOUR_JWT_TOKEN',
  'Content-Type': 'application/json'
}
```

---

## Essential Endpoints

### Auth
```
POST   /auth/signup          - Create account
POST   /auth/login           - Login & get token
```

### Events
```
GET    /events               - List all events
GET    /events/:id           - Get event details
GET    /events/organizer     - Get my events (protected)
POST   /events               - Create event (protected)
```

### Payments
```
POST   /payments/initiate    - Start payment
POST   /payments/verify      - Verify payment
GET    /payments/:reference  - Check payment status
```

### Wallet (Protected)
```
GET    /wallet/balance       - Get balance
GET    /wallet/history       - Get transactions
POST   /wallet/withdraw      - Request withdrawal
```

---

## Quick Code Snippets

### Login & Store Token
```javascript
const login = async (email, password) => {
  const res = await fetch('https://tiketa-alpha.vercel.app/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  localStorage.setItem('token', data.session.access_token);
  return data;
};
```

### Make Protected Request
```javascript
const getBalance = async () => {
  const token = localStorage.getItem('token');
  const res = await fetch('https://tiketa-alpha.vercel.app/api/v1/wallet/balance', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return res.json();
};
```

### Initiate Payment
```javascript
const pay = async (eventId, cartItems, attendees, buyerEmail, buyerName) => {
  const res = await fetch('https://tiketa-alpha.vercel.app/api/v1/payments/initiate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventId, cartItems, attendees, buyerEmail, buyerName })
  });
  const data = await res.json();
  window.location.href = data.data.checkoutUrl;
};
```

### Verify Payment
```javascript
const verifyPayment = async (reference) => {
  const res = await fetch('https://tiketa-alpha.vercel.app/api/v1/payments/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reference })
  });
  return res.json();
};
```

---

## Response Format

### Success
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { /* response data */ }
}
```

### Error
```json
{
  "success": false,
  "error": "Error code",
  "message": "Human readable message"
}
```

---

## Common Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 500 | Server Error |

---

## Payment Reference Format
```
TXN_[TIMESTAMP]_[UUID]
Example: TXN_1704067200000_a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

---

## Data Models

### User
```javascript
{
  id: "uuid",
  email: "user@example.com",
  role: "organizer" | "admin",
  user_metadata: { full_name: "Name" }
}
```

### Event
```javascript
{
  id: "uuid",
  title: "Event Title",
  description: "Description",
  date: "2024-06-15T19:00:00Z",
  location: "Location",
  capacity: 1000,
  organizer_id: "uuid",
  status: "active",
  tickets_sold: 250
}
```

### Transaction
```javascript
{
  id: "uuid",
  reference: "TXN_...",
  event_id: "uuid",
  organizer_id: "uuid",
  buyer_email: "buyer@example.com",
  buyer_name: "Name",
  ticket_price: 10000,
  processing_fee: 100,
  total_amount: 10100,
  platform_commission: 300,
  organizer_earnings: 9700,
  status: "success" | "pending" | "failed"
}
```

### Ticket
```javascript
{
  id: "uuid",
  event_id: "uuid",
  transaction_id: "uuid",
  buyer_email: "buyer@example.com",
  buyer_name: "Name",
  ticket_number: "TKT-2024-001",
  qr_code: "data:image/png;base64,...",
  status: "valid" | "used" | "cancelled"
}
```

### Wallet
```javascript
{
  id: "uuid",
  organizer_id: "uuid",
  available_balance: 50000,
  total_earned: 100000,
  total_withdrawn: 50000,
  currency: "NGN"
}
```

---

## Error Handling Template

```javascript
const handleApiCall = async (url, options = {}) => {
  try {
    const response = await fetch(url, options);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'API Error');
    }
    
    return data;
  } catch (error) {
    console.error('API Error:', error);
    // Show user-friendly error message
    return { success: false, error: error.message };
  }
};
```

---

## Rate Limits

- Default: 100 req/15min per IP
- Auth: 5 req/15min per IP
- Payments: 10 req/15min per IP

Check headers:
```
X-RateLimit-Limit
X-RateLimit-Remaining
X-RateLimit-Reset
```

---

## Testing Endpoints

### Health Check
```bash
curl https://tiketa-alpha.vercel.app/health
```

### Get Events
```bash
curl https://tiketa-alpha.vercel.app/api/v1/events
```

### Login
```bash
curl -X POST https://tiketa-alpha.vercel.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

---

## Important Notes

1. **Always verify payments on backend** - Never trust frontend
2. **Store reference after payment initiation** - For tracking
3. **Handle network errors** - Implement retry logic
4. **Validate input** - Check email, amounts, etc.
5. **Use HTTPS only** - Never send data over HTTP
6. **Clear tokens on logout** - Remove from localStorage
7. **Implement loading states** - Show users requests are processing
8. **Monitor rate limits** - Adjust requests if needed

---

## Support Resources

- Full Guide: `FRONTEND_INTEGRATION_GUIDE.md`
- API Docs: `API_ENDPOINTS.md`
- Deployment: `VERCEL_DEPLOYMENT.md`
- Testing: `TESTING_GUIDE.md`

---

**Last Updated:** April 13, 2026
**API Version:** v1
**Status:** ✅ Production Ready
