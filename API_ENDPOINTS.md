# API Endpoints Documentation

## Base URL
```
http://localhost:5001/api/v1
```

## Authentication
Most endpoints require JWT token in the `Authorization` header:
```
Authorization: Bearer <token>
```

---

## Health Check

### GET /health
Check if server is running.

**Response:**
```json
{
  "status": "Server is running",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

## Auth Endpoints

### POST /auth/signup
Create a new organizer or admin account.

**Request Body:**
```json
{
  "email": "organizer@example.com",
  "password": "SecurePassword123!",
  "name": "Event Organizer",
  "role": "organizer"
}
```

**Response (201):**
```json
{
  "id": "user-id",
  "email": "organizer@example.com",
  "name": "Event Organizer",
  "role": "organizer",
  "token": "jwt-token"
}
```

### POST /auth/login
Authenticate user and get JWT token.

**Request Body:**
```json
{
  "email": "organizer@example.com",
  "password": "SecurePassword123!"
}
```

**Response (200):**
```json
{
  "id": "user-id",
  "email": "organizer@example.com",
  "name": "Event Organizer",
  "role": "organizer",
  "token": "jwt-token"
}
```

---

## Event Endpoints

### GET /events
Get all events (public).

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `search` (optional): Search by title

**Response (200):**
```json
{
  "data": [
    {
      "id": "event-id",
      "title": "Concert 2024",
      "description": "Amazing concert",
      "date": "2024-06-15T19:00:00Z",
      "location": "Main Hall",
      "capacity": 1000,
      "organizerId": "org-id",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 50,
  "page": 1,
  "limit": 10
}
```

### GET /events/:id
Get event details.

**Response (200):**
```json
{
  "id": "event-id",
  "title": "Concert 2024",
  "description": "Amazing concert",
  "date": "2024-06-15T19:00:00Z",
  "location": "Main Hall",
  "capacity": 1000,
  "organizerId": "org-id",
  "tickets": [],
  "createdAt": "2024-01-01T00:00:00Z"
}
```

### POST /events
Create new event (requires auth).

**Request Body:**
```json
{
  "title": "Concert 2024",
  "description": "Amazing concert",
  "date": "2024-06-15T19:00:00Z",
  "endDate": "2024-06-15T23:00:00Z",
  "location": "Main Hall",
  "capacity": 1000
}
```

**Response (201):**
```json
{
  "id": "event-id",
  "title": "Concert 2024",
  "description": "Amazing concert",
  "date": "2024-06-15T19:00:00Z",
  "location": "Main Hall",
  "capacity": 1000,
  "organizerId": "org-id"
}
```

### PUT /events/:id
Update event (requires auth).

**Request Body:**
```json
{
  "title": "Updated Concert 2024",
  "capacity": 1500
}
```

**Response (200):**
```json
{
  "id": "event-id",
  "title": "Updated Concert 2024",
  "capacity": 1500
}
```

### DELETE /events/:id
Delete event (requires auth).

**Response (204):** No content

---

## Ticket Endpoints

### GET /tickets
Get all tickets (requires auth).

**Query Parameters:**
- `eventId` (optional): Filter by event
- `page` (optional): Page number

**Response (200):**
```json
{
  "data": [
    {
      "id": "ticket-id",
      "eventId": "event-id",
      "type": "standard",
      "price": 5000,
      "quantity": 100,
      "sold": 45,
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### POST /tickets
Create new ticket (requires auth).

**Request Body:**
```json
{
  "eventId": "event-id",
  "type": "standard",
  "price": 5000,
  "quantity": 100
}
```

**Response (201):**
```json
{
  "id": "ticket-id",
  "eventId": "event-id",
  "type": "standard",
  "price": 5000,
  "quantity": 100
}
```

### GET /tickets/validate
Validate ticket code.

**Query Parameters:**
- `code` (required): Ticket code to validate

**Response (200):**
```json
{
  "valid": true,
  "ticketId": "ticket-id",
  "eventId": "event-id",
  "used": false
}
```

---

## Payment Endpoints

### POST /payments
Initiate payment.

**Request Body:**
```json
{
  "amount": 5000,
  "email": "customer@example.com",
  "reference": "unique-reference",
  "description": "Ticket purchase"
}
```

**Response (201):**
```json
{
  "id": "payment-id",
  "reference": "unique-reference",
  "amount": 5000,
  "status": "pending",
  "paymentUrl": "https://payment-gateway.com/pay/..."
}
```

### GET /payments/:reference
Get payment status.

**Response (200):**
```json
{
  "id": "payment-id",
  "reference": "unique-reference",
  "amount": 5000,
  "status": "completed",
  "paidAt": "2024-01-01T00:00:00Z"
}
```

### POST /payments/squad
Process Squadco payment.

**Request Body:**
```json
{
  "amount": 5000,
  "email": "customer@example.com",
  "phone": "08012345678",
  "reference": "unique-reference"
}
```

**Response (201):**
```json
{
  "status": "success",
  "reference": "unique-reference",
  "amount": 5000,
  "paymentUrl": "https://squadco-payment-url"
}
```

---

## Wallet Endpoints

### GET /wallet
Get wallet balance (requires auth).

**Response (200):**
```json
{
  "id": "wallet-id",
  "userId": "user-id",
  "balance": 50000,
  "totalEarnings": 100000,
  "totalWithdrawn": 50000,
  "currency": "NGN"
}
```

### POST /wallet/credit
Credit wallet (requires auth).

**Request Body:**
```json
{
  "amount": 10000,
  "description": "Event earnings"
}
```

**Response (201):**
```json
{
  "id": "transaction-id",
  "walletId": "wallet-id",
  "amount": 10000,
  "type": "credit",
  "balance": 60000
}
```

### GET /wallet/transactions
Get wallet transactions (requires auth).

**Query Parameters:**
- `page` (optional): Page number
- `limit` (optional): Items per page

**Response (200):**
```json
{
  "data": [
    {
      "id": "transaction-id",
      "amount": 10000,
      "type": "credit",
      "description": "Event earnings",
      "balance": 60000,
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

---

## Withdrawal Endpoints

### POST /withdrawals
Create withdrawal request (requires auth).

**Request Body:**
```json
{
  "amount": 10000,
  "bankCode": "001",
  "accountNumber": "1234567890",
  "accountName": "John Doe"
}
```

**Response (201):**
```json
{
  "id": "withdrawal-id",
  "userId": "user-id",
  "amount": 10000,
  "status": "pending",
  "bankCode": "001",
  "accountNumber": "1234567890",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

### GET /withdrawals
Get withdrawal requests (requires auth).

**Query Parameters:**
- `status` (optional): Filter by status (pending, completed, failed)
- `page` (optional): Page number

**Response (200):**
```json
{
  "data": [
    {
      "id": "withdrawal-id",
      "amount": 10000,
      "status": "pending",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### GET /withdrawals/:id
Get withdrawal details (requires auth).

**Response (200):**
```json
{
  "id": "withdrawal-id",
  "userId": "user-id",
  "amount": 10000,
  "status": "pending",
  "bankCode": "001",
  "accountNumber": "1234567890",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

---

## User Endpoints

### GET /users
Get all users (requires auth).

**Response (200):**
```json
{
  "data": [
    {
      "id": "user-id",
      "email": "user@example.com",
      "name": "User Name",
      "role": "organizer",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### GET /users/:id
Get user details (requires auth).

**Response (200):**
```json
{
  "id": "user-id",
  "email": "user@example.com",
  "name": "User Name",
  "role": "organizer",
  "wallet": { ... },
  "events": [ ... ]
}
```

### PUT /users/:id
Update user profile (requires auth).

**Request Body:**
```json
{
  "name": "Updated Name",
  "phone": "08012345678"
}
```

**Response (200):**
```json
{
  "id": "user-id",
  "name": "Updated Name",
  "phone": "08012345678"
}
```

---

## Order Endpoints

### GET /orders
Get all orders (requires auth).

**Query Parameters:**
- `eventId` (optional): Filter by event
- `status` (optional): Filter by status

**Response (200):**
```json
{
  "data": [
    {
      "id": "order-id",
      "eventId": "event-id",
      "userId": "user-id",
      "tickets": [ ... ],
      "totalAmount": 10000,
      "status": "completed",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### POST /orders
Create new order (requires auth).

**Request Body:**
```json
{
  "eventId": "event-id",
  "ticketId": "ticket-id",
  "quantity": 2,
  "email": "customer@example.com"
}
```

**Response (201):**
```json
{
  "id": "order-id",
  "eventId": "event-id",
  "ticketId": "ticket-id",
  "quantity": 2,
  "totalAmount": 10000,
  "status": "pending"
}
```

### GET /orders/:id
Get order details (requires auth).

**Response (200):**
```json
{
  "id": "order-id",
  "eventId": "event-id",
  "userId": "user-id",
  "tickets": [ ... ],
  "totalAmount": 10000,
  "status": "completed"
}
```

---

## Admin Endpoints

### GET /admin/dashboard
Get admin dashboard data (requires admin role).

**Response (200):**
```json
{
  "totalUsers": 150,
  "totalEvents": 25,
  "totalRevenue": 500000,
  "totalOrders": 1200,
  "recentActivity": [ ... ]
}
```

### GET /admin/users
Get all users (requires admin role).

**Query Parameters:**
- `role` (optional): Filter by role
- `page` (optional): Page number

**Response (200):**
```json
{
  "data": [ ... ],
  "total": 150
}
```

### GET /admin/events
Get all events (requires admin role).

**Response (200):**
```json
{
  "data": [ ... ],
  "total": 25
}
```

### POST /admin/payouts
Process payouts (requires admin role).

**Request Body:**
```json
{
  "withdrawalIds": ["withdrawal-id-1", "withdrawal-id-2"]
}
```

**Response (200):**
```json
{
  "processed": 2,
  "failed": 0,
  "totalAmount": 20000
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "message": "Invalid request parameters",
  "status": 400
}
```

### 401 Unauthorized
```json
{
  "message": "Authentication required",
  "status": 401
}
```

### 403 Forbidden
```json
{
  "message": "Insufficient permissions",
  "status": 403
}
```

### 404 Not Found
```json
{
  "message": "Resource not found",
  "status": 404
}
```

### 500 Internal Server Error
```json
{
  "message": "Internal server error",
  "status": 500
}
```

---

## Rate Limiting

API endpoints are rate-limited to prevent abuse:
- **Default**: 100 requests per 15 minutes per IP
- **Auth endpoints**: 5 requests per 15 minutes per IP

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1234567890
```

---

## Testing Endpoints

### Using cURL
```bash
# Health check
curl http://localhost:5001/health

# Get all events
curl http://localhost:5001/api/v1/events

# Create event (with auth)
curl -X POST http://localhost:5001/api/v1/events \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Event","date":"2024-06-15T19:00:00Z","location":"Hall","capacity":100}'
```

### Using Postman
1. Import the API collection
2. Set base URL: `http://localhost:5001`
3. Add auth token to Authorization header
4. Test endpoints

### Using npm test
```bash
npm run test:endpoints
```
