# Frontend Integration - Complete Guide

Welcome! This directory contains everything you need to integrate with the Ticketa API.

## 🚀 API Endpoint
```
https://tiketa-alpha.vercel.app/api/v1
```

---

## 📚 Documentation Files

### 1. **FRONTEND_QUICK_REFERENCE.md** ⭐ START HERE
Quick lookup card with:
- All endpoints at a glance
- Essential code snippets
- Data models
- Common status codes
- Rate limits

**Best for:** Quick lookups while coding

---

### 2. **FRONTEND_INTEGRATION_GUIDE.md** 📖 COMPREHENSIVE
Complete guide with:
- Detailed endpoint documentation
- Full request/response examples
- Authentication setup
- Payment flow explanation
- Error handling
- Best practices

**Best for:** Understanding the full API

---

### 3. **API_EXAMPLES.md** 💻 CODE SAMPLES
Working code examples in:
- JavaScript / React
- Python
- TypeScript
- cURL
- Testing patterns

**Best for:** Copy-paste ready code

---

## 🎯 Quick Start

### 1. Get Your Token
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

### 2. Make Protected Requests
```javascript
const getBalance = async () => {
  const token = localStorage.getItem('token');
  const res = await fetch('https://tiketa-alpha.vercel.app/api/v1/wallet/balance', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return res.json();
};
```

### 3. Process Payments
```javascript
// Initiate payment
const payment = await initiatePayment({
  eventId: 'event-123',
  cartItems: [{ ticketType: 'standard', price: 5000, quantity: 2 }],
  attendees: [{ name: 'John', email: 'john@example.com' }],
  buyerEmail: 'buyer@example.com',
  buyerName: 'Buyer'
});

// Redirect to checkout
window.location.href = payment.data.checkoutUrl;

// Verify after payment
const result = await verifyPayment(payment.data.reference);
```

---

## 📋 All Endpoints

### Authentication
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

## 🔐 Authentication

### Store Token
```javascript
localStorage.setItem('authToken', response.session.access_token);
```

### Use Token in Requests
```javascript
headers: {
  'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
  'Content-Type': 'application/json'
}
```

### Clear Token on Logout
```javascript
localStorage.removeItem('authToken');
```

---

## 💳 Payment Flow

```
1. User selects tickets
   ↓
2. Call POST /payments/initiate
   ↓
3. Get checkoutUrl & reference
   ↓
4. Redirect to Squadco checkout
   ↓
5. User completes payment
   ↓
6. Squadco redirects back
   ↓
7. Call POST /payments/verify
   ↓
8. Get ticket & transaction details
```

---

## 📊 Response Format

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

## 🛠️ Common Tasks

### Login User
See: `FRONTEND_INTEGRATION_GUIDE.md` → Section 2.2

### Get Events
See: `FRONTEND_INTEGRATION_GUIDE.md` → Section 3.1

### Create Event
See: `FRONTEND_INTEGRATION_GUIDE.md` → Section 3.3

### Process Payment
See: `FRONTEND_INTEGRATION_GUIDE.md` → Section 4

### Get Wallet Balance
See: `FRONTEND_INTEGRATION_GUIDE.md` → Section 5.1

### Request Withdrawal
See: `FRONTEND_INTEGRATION_GUIDE.md` → Section 5.3

---

## 💡 Code Examples

### JavaScript
```javascript
// See API_EXAMPLES.md → JavaScript / React Examples
```

### Python
```python
# See API_EXAMPLES.md → Python Examples
```

### TypeScript
```typescript
// See API_EXAMPLES.md → TypeScript Examples
```

### cURL
```bash
# See API_EXAMPLES.md → cURL Examples
```

---

## ⚠️ Important Notes

1. **Always verify payments on backend** - Never trust frontend success messages
2. **Store payment reference** - Keep it for tracking and support
3. **Handle errors gracefully** - Show user-friendly messages
4. **Implement retry logic** - Network issues can occur
5. **Validate input data** - Check email format, amounts, etc.
6. **Use HTTPS only** - Never send sensitive data over HTTP
7. **Implement loading states** - Show users requests are processing
8. **Cache tokens securely** - Use localStorage or sessionStorage
9. **Implement logout** - Clear tokens when user logs out
10. **Monitor API usage** - Track rate limits and adjust accordingly

---

## 🚨 Error Handling

### Common Errors

| Status | Meaning | Solution |
|--------|---------|----------|
| 400 | Bad Request | Check request format & required fields |
| 401 | Unauthorized | Login and get valid token |
| 403 | Forbidden | Check user permissions |
| 404 | Not Found | Verify resource ID exists |
| 500 | Server Error | Retry or contact support |

### Error Handling Template
```javascript
try {
  const response = await fetch(url, options);
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.message || 'API Error');
  }
  
  return data;
} catch (error) {
  console.error('Error:', error);
  // Show user-friendly error message
}
```

---

## 📈 Rate Limiting

- **Default:** 100 requests per 15 minutes per IP
- **Auth:** 5 requests per 15 minutes per IP
- **Payments:** 10 requests per 15 minutes per IP

Check headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1234567890
```

---

## 🧪 Testing

### Test Health Endpoint
```bash
curl https://tiketa-alpha.vercel.app/health
```

### Test Events Endpoint
```bash
curl https://tiketa-alpha.vercel.app/api/v1/events
```

### Test Login
```bash
curl -X POST https://tiketa-alpha.vercel.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

---

## 📞 Support

### Documentation
- **Quick Reference:** `FRONTEND_QUICK_REFERENCE.md`
- **Full Guide:** `FRONTEND_INTEGRATION_GUIDE.md`
- **Code Examples:** `API_EXAMPLES.md`

### Troubleshooting
1. Check error message carefully
2. Review relevant documentation section
3. Check code examples for similar use case
4. Verify API endpoint is correct
5. Check authentication token is valid

### Contact
For issues or questions:
- Review documentation thoroughly
- Check code examples
- Test with provided examples
- Contact support with reference numbers

---

## 🎓 Learning Path

### Beginner
1. Read `FRONTEND_QUICK_REFERENCE.md`
2. Try basic endpoints (GET /events)
3. Implement login flow
4. Test with cURL examples

### Intermediate
1. Read `FRONTEND_INTEGRATION_GUIDE.md`
2. Implement payment flow
3. Handle errors properly
4. Add loading states

### Advanced
1. Study `API_EXAMPLES.md`
2. Implement retry logic
3. Add request timeouts
4. Implement caching
5. Add comprehensive error handling

---

## ✅ Checklist

Before going live:
- [ ] All endpoints tested
- [ ] Authentication working
- [ ] Payment flow tested
- [ ] Error handling implemented
- [ ] Loading states added
- [ ] Rate limiting handled
- [ ] Tokens stored securely
- [ ] Logout implemented
- [ ] Input validation added
- [ ] HTTPS enforced

---

## 📝 File Structure

```
FRONTEND_README.md                    ← You are here
├── FRONTEND_QUICK_REFERENCE.md       ← Quick lookup
├── FRONTEND_INTEGRATION_GUIDE.md     ← Full documentation
└── API_EXAMPLES.md                   ← Code examples
```

---

## 🚀 Next Steps

1. **Read** `FRONTEND_QUICK_REFERENCE.md` (5 min)
2. **Review** `FRONTEND_INTEGRATION_GUIDE.md` (15 min)
3. **Copy** code from `API_EXAMPLES.md` (5 min)
4. **Test** endpoints with cURL (5 min)
5. **Implement** in your frontend (ongoing)

---

## 💬 Questions?

Refer to the comprehensive documentation:
- **Quick answers:** `FRONTEND_QUICK_REFERENCE.md`
- **Detailed info:** `FRONTEND_INTEGRATION_GUIDE.md`
- **Code samples:** `API_EXAMPLES.md`

---

**Last Updated:** April 13, 2026
**API Version:** v1
**Status:** ✅ Production Ready

Happy coding! 🎉
