# Frontend Integration Guide - Ticketa API

## Base URL
```
https://tiketa-alpha.vercel.app/api/v1
```

## Quick Reference

| Feature | Endpoint | Method | Auth Required |
|---------|----------|--------|---------------|
| Health Check | `/health` | GET | No |
| Sign Up | `/auth/signup` | POST | No |
| Login | `/auth/login` | POST | No |
| Get Events | `/events` | GET | No |
| Get Event Details | `/events/:id` | GET | No |
| Create Event | `/events` | POST | Yes |
| Initiate Payment | `/payments/initiate` | POST | No |
| Verify Payment | `/payments/verify` | POST | No |
| Get Payment Status | `/payments/:reference` | GET | No |
| Get Wallet Balance | `/wallet/balance` | GET | Yes |
| Get Wallet History | `/wallet/history` | GET | Yes |
| Request Withdrawal | `/wallet/withdraw` | POST | Yes |

---

## Authentication

### JWT Token Management

All protected endpoints require a JWT token in the Authorization header:

```javascript
headers: {
  'Authorization': 'Bearer YOUR_JWT_TOKEN',
  'Content-Type': 'application/json'
}
```

### Store Token Locally

```javascript
// After login, store the token
localStorage.setItem('authToken', response.data.session.access_token);
localStorage.setItem('user', JSON.stringify(response.data.user));
localStorage.setItem('role', response.data.role);

// Retrieve token for requests
const token = localStorage.getItem('authToken');
```

---

## Endpoints Documentation

### 1. HEALTH CHECK

**Endpoint:** `GET /health`

**Description:** Check if API is running

**Request:**
```bash
curl https://tiketa-alpha.vercel.app/health
```

**Response (200):**
```json
{
  "status": "Server is running",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "environment": "production"
}
```

---

### 2. AUTHENTICATION

#### 2.1 Sign Up

**Endpoint:** `POST /auth/signup`

**Description:** Create new organizer or admin account

**Request Body:**
```json
{
  "email": "organizer@example.com",
  "password": "SecurePassword123!",
  "fullName": "John Organizer",
  "role": "organizer"
}
```

**Request Example (JavaScript):**
```javascript
const signup = async (email, password, fullName, role) => {
  const response = await fetch('https://tiketa-alpha.vercel.app/api/v1/auth/signup', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email,
      password,
      fullName,
      role
    })
  });
  return response.json();
};
```

**Response (200):**
```json
{
  "success": true,
  "message": "Signup successful",
  "user": {
    "id": "user-uuid",
    "email": "organizer@example.com",
    "user_metadata": {
      "full_name": "John Organizer"
    }
  }
}
```

**Error Response (400):**
```json
{
  "error": "User already exists"
}
```

---

#### 2.2 Login

**Endpoint:** `POST /auth/login`

**Description:** Authenticate user and get JWT token

**Request Body:**
```json
{
  "email": "organizer@example.com",
  "password": "SecurePassword123!"
}
```

**Request Example (JavaScript):**
```javascript
const login = async (email, password) => {
  const response = await fetch('https://tiketa-alpha.vercel.app/api/v1/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password })
  });
  const data = await response.json();
  
  if (data.success) {
    localStorage.setItem('authToken', data.session.access_token);
    localStorage.setItem('user', JSON.stringify(data.user));
    localStorage.setItem('role', data.role);
  }
  
  return data;
};
```

**Response (200):**
```json
{
  "success": true,
  "user": {
    "id": "user-uuid",
    "email": "organizer@example.com",
    "user_metadata": {
      "full_name": "John Organizer"
    }
  },
  "role": "organizer",
  "session": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "bearer",
    "expires_in": 3600,
    "refresh_token": "..."
  }
}
```

**Error Response (400):**
```json
{
  "error": "Invalid credentials"
}
```

---

### 3. EVENTS

#### 3.1 Get All Events

**Endpoint:** `GET /events`

**Description:** Get all public events (no auth required)

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `search` (optional): Search by title

**Request Example (JavaScript):**
```javascript
const getEvents = async (page = 1, limit = 10) => {
  const response = await fetch(
    `https://tiketa-alpha.vercel.app/api/v1/events?page=${page}&limit=${limit}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );
  return response.json();
};
```

**Response (200):**
```json
{
  "success": true,
  "message": "Events fetched successfully",
  "data": [
    {
      "id": "event-uuid",
      "title": "Concert 2024",
      "description": "Amazing concert event",
      "date": "2024-06-15T19:00:00Z",
      "location": "Main Hall",
      "capacity": 1000,
      "organizer_id": "org-uuid",
      "status": "active",
      "tickets_sold": 250,
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

---

#### 3.2 Get Event Details

**Endpoint:** `GET /events/:id`

**Description:** Get specific event details

**Request Example (JavaScript):**
```javascript
const getEventById = async (eventId) => {
  const response = await fetch(
    `https://tiketa-alpha.vercel.app/api/v1/events/${eventId}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );
  return response.json();
};
```

**Response (200):**
```json
{
  "success": true,
  "message": "Event fetched successfully",
  "data": {
    "id": "event-uuid",
    "title": "Concert 2024",
    "description": "Amazing concert event",
    "date": "2024-06-15T19:00:00Z",
    "location": "Main Hall",
    "capacity": 1000,
    "organizer_id": "org-uuid",
    "status": "active",
    "tickets_sold": 250,
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

---

#### 3.3 Create Event (Protected)

**Endpoint:** `POST /events`

**Description:** Create new event (requires authentication)

**Request Body:**
```json
{
  "title": "Concert 2024",
  "description": "Amazing concert event",
  "date": "2024-06-15T19:00:00Z",
  "location": "Main Hall",
  "capacity": 1000
}
```

**Request Example (JavaScript):**
```javascript
const createEvent = async (eventData, token) => {
  const response = await fetch('https://tiketa-alpha.vercel.app/api/v1/events', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(eventData)
  });
  return response.json();
};
```

**Response (201):**
```json
{
  "success": true,
  "message": "Event created successfully",
  "data": {
    "id": "event-uuid",
    "title": "Concert 2024",
    "description": "Amazing concert event",
    "date": "2024-06-15T19:00:00Z",
    "location": "Main Hall",
    "capacity": 1000,
    "organizer_id": "org-uuid",
    "status": "active",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

---

#### 3.4 Get Organizer Events (Protected)

**Endpoint:** `GET /events/organizer`

**Description:** Get all events for logged-in organizer

**Request Example (JavaScript):**
```javascript
const getOrganizerEvents = async (token) => {
  const response = await fetch(
    'https://tiketa-alpha.vercel.app/api/v1/events/organizer',
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }
  );
  return response.json();
};
```

**Response (200):**
```json
{
  "success": true,
  "message": "Events fetched successfully",
  "data": [
    {
      "id": "event-uuid",
      "title": "My Concert",
      "description": "My event",
      "date": "2024-06-15T19:00:00Z",
      "location": "Main Hall",
      "capacity": 1000,
      "organizer_id": "org-uuid",
      "status": "active",
      "tickets_sold": 250,
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

---

### 4. PAYMENTS

#### 4.1 Initiate Payment

**Endpoint:** `POST /payments/initiate`

**Description:** Start payment process and get checkout URL

**Request Body:**
```json
{
  "eventId": "event-uuid",
  "cartItems": [
    {
      "ticketType": "standard",
      "price": 5000,
      "quantity": 2
    }
  ],
  "attendees": [
    {
      "name": "John Doe",
      "email": "john@example.com"
    },
    {
      "name": "Jane Doe",
      "email": "jane@example.com"
    }
  ],
  "buyerEmail": "buyer@example.com",
  "buyerName": "Buyer Name"
}
```

**Request Example (JavaScript):**
```javascript
const initiatePayment = async (paymentData) => {
  const response = await fetch(
    'https://tiketa-alpha.vercel.app/api/v1/payments/initiate',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(paymentData)
    }
  );
  const data = await response.json();
  
  if (data.success) {
    // Redirect to checkout URL
    window.location.href = data.data.checkoutUrl;
  }
  
  return data;
};
```

**Response (200):**
```json
{
  "success": true,
  "message": "Payment initialized",
  "data": {
    "reference": "TXN_1704067200000_a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "checkoutUrl": "https://checkout.squadco.com/...",
    "amount": 10100
  }
}
```

**Important Notes:**
- `reference` is unique for each transaction
- `checkoutUrl` redirects to Squadco payment page
- `amount` includes processing fee (₦100)
- Store `reference` for payment verification

---

#### 4.2 Verify Payment

**Endpoint:** `POST /payments/verify`

**Description:** Verify payment after user returns from checkout

**Request Body:**
```json
{
  "reference": "TXN_1704067200000_a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**Request Example (JavaScript):**
```javascript
const verifyPayment = async (reference) => {
  const response = await fetch(
    'https://tiketa-alpha.vercel.app/api/v1/payments/verify',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ reference })
    }
  );
  return response.json();
};

// Call after user returns from payment
const handlePaymentCallback = async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const reference = urlParams.get('reference');
  
  if (reference) {
    const result = await verifyPayment(reference);
    
    if (result.success) {
      console.log('Payment verified!');
      console.log('Tickets:', result.ticket);
      // Show success message and tickets
    } else {
      console.log('Payment verification failed');
      // Show error message
    }
  }
};
```

**Response (200) - Success:**
```json
{
  "success": true,
  "message": "Payment verified and processed",
  "transaction": {
    "id": "tx-uuid",
    "reference": "TXN_1704067200000_a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "event_id": "event-uuid",
    "organizer_id": "org-uuid",
    "buyer_email": "buyer@example.com",
    "buyer_name": "Buyer Name",
    "ticket_price": 10000,
    "processing_fee": 100,
    "total_amount": 10100,
    "platform_commission": 300,
    "organizer_earnings": 9700,
    "status": "success",
    "verified_at": "2024-01-01T00:00:00Z"
  },
  "ticket": {
    "id": "ticket-uuid",
    "event_id": "event-uuid",
    "transaction_id": "tx-uuid",
    "buyer_email": "buyer@example.com",
    "buyer_name": "Buyer Name",
    "ticket_number": "TKT-2024-001",
    "qr_code": "data:image/png;base64,...",
    "status": "valid"
  }
}
```

**Response (400) - Failed:**
```json
{
  "success": false,
  "error": "Payment verification failed",
  "message": "Payment status: pending"
}
```

---

#### 4.3 Get Payment Status

**Endpoint:** `GET /payments/:reference`

**Description:** Check payment status anytime

**Request Example (JavaScript):**
```javascript
const getPaymentStatus = async (reference) => {
  const response = await fetch(
    `https://tiketa-alpha.vercel.app/api/v1/payments/${reference}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );
  return response.json();
};
```

**Response (200):**
```json
{
  "success": true,
  "transaction": {
    "id": "tx-uuid",
    "reference": "TXN_1704067200000_a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "status": "success",
    "total_amount": 10100,
    "verified_at": "2024-01-01T00:00:00Z"
  },
  "ticket": {
    "id": "ticket-uuid",
    "ticket_number": "TKT-2024-001",
    "qr_code": "data:image/png;base64,...",
    "status": "valid"
  }
}
```

---

### 5. WALLET (Protected)

#### 5.1 Get Wallet Balance

**Endpoint:** `GET /wallet/balance`

**Description:** Get organizer wallet balance

**Request Example (JavaScript):**
```javascript
const getWalletBalance = async (token) => {
  const response = await fetch(
    'https://tiketa-alpha.vercel.app/api/v1/wallet/balance',
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }
  );
  return response.json();
};
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "wallet-uuid",
    "organizer_id": "org-uuid",
    "available_balance": 50000,
    "total_earned": 100000,
    "total_withdrawn": 50000,
    "currency": "NGN",
    "last_updated": "2024-01-01T00:00:00Z"
  }
}
```

---

#### 5.2 Get Wallet History

**Endpoint:** `GET /wallet/history`

**Description:** Get wallet transaction history

**Query Parameters:**
- `page` (optional): Page number
- `limit` (optional): Items per page

**Request Example (JavaScript):**
```javascript
const getWalletHistory = async (token, page = 1, limit = 10) => {
  const response = await fetch(
    `https://tiketa-alpha.vercel.app/api/v1/wallet/history?page=${page}&limit=${limit}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }
  );
  return response.json();
};
```

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "tx-uuid",
      "wallet_id": "wallet-uuid",
      "type": "credit",
      "amount": 9700,
      "description": "Payment for event: Concert 2024",
      "balance_after": 50000,
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

---

#### 5.3 Request Withdrawal

**Endpoint:** `POST /wallet/withdraw`

**Description:** Request withdrawal from wallet

**Request Body:**
```json
{
  "amount": 10000,
  "bankCode": "001",
  "accountNumber": "1234567890",
  "accountName": "John Organizer"
}
```

**Request Example (JavaScript):**
```javascript
const requestWithdrawal = async (withdrawalData, token) => {
  const response = await fetch(
    'https://tiketa-alpha.vercel.app/api/v1/wallet/withdraw',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(withdrawalData)
    }
  );
  return response.json();
};
```

**Response (201):**
```json
{
  "success": true,
  "message": "Withdrawal request created",
  "data": {
    "id": "withdrawal-uuid",
    "organizer_id": "org-uuid",
    "amount": 10000,
    "status": "pending",
    "bank_code": "001",
    "account_number": "1234567890",
    "account_name": "John Organizer",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

---

## Error Handling

### Common Error Responses

**400 Bad Request:**
```json
{
  "success": false,
  "error": "Invalid request parameters",
  "message": "Missing required fields"
}
```

**401 Unauthorized:**
```json
{
  "success": false,
  "error": "Unauthorized",
  "message": "Authentication required"
}
```

**403 Forbidden:**
```json
{
  "success": false,
  "error": "Forbidden",
  "message": "Insufficient permissions"
}
```

**404 Not Found:**
```json
{
  "success": false,
  "error": "Not found",
  "message": "Resource not found"
}
```

**500 Internal Server Error:**
```json
{
  "success": false,
  "error": "Internal server error",
  "message": "An unexpected error occurred"
}
```

---

## Rate Limiting

API endpoints are rate-limited to prevent abuse:

- **Default endpoints:** 100 requests per 15 minutes per IP
- **Auth endpoints:** 5 requests per 15 minutes per IP
- **Payment endpoints:** 10 requests per 15 minutes per IP

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1234567890
```

---

## Payment Flow Diagram

```
1. User selects tickets
   ↓
2. Frontend calls POST /payments/initiate
   ↓
3. Backend generates reference & creates transaction
   ↓
4. Backend initiates Squadco payment
   ↓
5. Frontend redirects to Squadco checkout URL
   ↓
6. User completes payment on Squadco
   ↓
7. Squadco redirects back to frontend with reference
   ↓
8. Frontend calls POST /payments/verify with reference
   ↓
9. Backend verifies with Squadco API
   ↓
10. Backend credits organizer wallet
   ↓
11. Backend generates tickets
   ↓
12. Frontend displays tickets to user
```

---

## Complete Payment Example

```javascript
// Step 1: Prepare payment data
const paymentData = {
  eventId: 'event-123',
  cartItems: [
    { ticketType: 'standard', price: 5000, quantity: 2 }
  ],
  attendees: [
    { name: 'John Doe', email: 'john@example.com' },
    { name: 'Jane Doe', email: 'jane@example.com' }
  ],
  buyerEmail: 'buyer@example.com',
  buyerName: 'Buyer Name'
};

// Step 2: Initiate payment
const initiatePayment = async () => {
  try {
    const response = await fetch(
      'https://tiketa-alpha.vercel.app/api/v1/payments/initiate',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentData)
      }
    );
    
    const data = await response.json();
    
    if (data.success) {
      // Store reference for later verification
      sessionStorage.setItem('paymentReference', data.data.reference);
      
      // Redirect to checkout
      window.location.href = data.data.checkoutUrl;
    } else {
      console.error('Payment initiation failed:', data.error);
    }
  } catch (error) {
    console.error('Error:', error);
  }
};

// Step 3: Handle payment callback
const handlePaymentCallback = async () => {
  const reference = sessionStorage.getItem('paymentReference');
  
  if (!reference) {
    console.error('No payment reference found');
    return;
  }
  
  try {
    const response = await fetch(
      'https://tiketa-alpha.vercel.app/api/v1/payments/verify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference })
      }
    );
    
    const data = await response.json();
    
    if (data.success) {
      console.log('Payment successful!');
      console.log('Ticket:', data.ticket);
      
      // Display ticket to user
      displayTicket(data.ticket);
      
      // Clear stored reference
      sessionStorage.removeItem('paymentReference');
    } else {
      console.error('Payment verification failed:', data.error);
    }
  } catch (error) {
    console.error('Error:', error);
  }
};

// Call on page load if returning from payment
window.addEventListener('load', () => {
  if (window.location.pathname === '/payment-confirmation') {
    handlePaymentCallback();
  }
});
```

---

## Best Practices

1. **Always verify payments on backend** - Never trust frontend success messages
2. **Store payment reference** - Keep reference for tracking and support
3. **Handle errors gracefully** - Show user-friendly error messages
4. **Implement retry logic** - Network issues can occur
5. **Validate input data** - Check email format, amounts, etc.
6. **Use HTTPS only** - Never send sensitive data over HTTP
7. **Implement loading states** - Show users that requests are processing
8. **Cache tokens securely** - Use localStorage or sessionStorage
9. **Implement logout** - Clear tokens when user logs out
10. **Monitor API usage** - Track rate limits and adjust accordingly

---

## Support

For issues or questions:
- Check error messages carefully
- Review this guide for endpoint details
- Test with provided examples
- Contact support with reference numbers

Good luck with your integration! 🚀
