# Architecture Overview

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                          │
│                   http://localhost:5173                          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                    CORS Enabled Requests
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Vercel Edge Network                         │
│                  https://your-domain.vercel.app                  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                    Route to Serverless Function
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Vercel Serverless Function                     │
│                      (api/index.js)                              │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Express.js Server                                       │  │
│  │  ├─ CORS Middleware                                      │  │
│  │  ├─ JSON Parser                                          │  │
│  │  ├─ Morgan Logger                                        │  │
│  │  ├─ Rate Limiter                                         │  │
│  │  └─ Error Handler                                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  API Routes                                              │  │
│  │  ├─ /api/v1/auth       (Authentication)                 │  │
│  │  ├─ /api/v1/events     (Event Management)               │  │
│  │  ├─ /api/v1/tickets    (Ticket Management)              │  │
│  │  ├─ /api/v1/payments   (Payment Processing)             │  │
│  │  ├─ /api/v1/wallet     (Wallet Management)              │  │
│  │  ├─ /api/v1/withdrawals (Withdrawal Requests)           │  │
│  │  ├─ /api/v1/users      (User Management)                │  │
│  │  ├─ /api/v1/orders     (Order Management)               │  │
│  │  └─ /api/v1/admin      (Admin Dashboard)                │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                    ┌────────┴────────┬──────────────┐
                    │                 │              │
                    ▼                 ▼              ▼
        ┌──────────────────┐  ┌──────────────┐  ┌──────────────┐
        │   Supabase       │  │  Squadco     │  │  External    │
        │   Database       │  │  Payment     │  │  Services    │
        │                  │  │  Gateway     │  │              │
        │  ├─ Users        │  │              │  │  ├─ Email    │
        │  ├─ Events       │  │  ├─ Payments │  │  ├─ SMS      │
        │  ├─ Tickets      │  │  ├─ Refunds  │  │  └─ Webhooks │
        │  ├─ Orders       │  │  └─ Transfers│  │              │
        │  ├─ Wallets      │  │              │  │              │
        │  └─ Withdrawals  │  │              │  │              │
        └──────────────────┘  └──────────────┘  └──────────────┘
```

---

## Local Development Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Your Local Machine                            │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Frontend (React Dev Server)                             │  │
│  │  http://localhost:5173                                   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                             │                                    │
│                    CORS Enabled Requests                         │
│                             │                                    │
│  ┌──────────────────────────▼──────────────────────────────┐  │
│  │  Backend (Express.js)                                    │  │
│  │  http://localhost:5001                                   │  │
│  │                                                           │  │
│  │  npm run dev (with nodemon)                              │  │
│  │  ├─ Auto-reload on file changes                          │  │
│  │  ├─ Hot module replacement                               │  │
│  │  └─ Development logging                                  │  │
│  └──────────────────────────┬──────────────────────────────┘  │
│                             │                                    │
│                    ┌────────┴────────┬──────────────┐            │
│                    │                 │              │            │
│  ┌─────────────────▼──┐  ┌──────────▼────┐  ┌──────▼────────┐  │
│  │  Supabase Cloud    │  │  Squadco       │  │  Test Suite   │  │
│  │  (Remote)          │  │  Sandbox       │  │               │  │
│  │                    │  │  (Remote)      │  │  npm test     │  │
│  │  Development DB    │  │                │  │  npm run      │  │
│  │                    │  │  Sandbox Keys  │  │  test:endpoints
│  └────────────────────┘  └────────────────┘  └───────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Request Flow

### 1. Authentication Flow
```
Client Request
    │
    ▼
POST /api/v1/auth/login
    │
    ▼
authController.loginOrganizerOrAdmin()
    │
    ├─ Validate email/password
    ├─ Query Supabase
    ├─ Compare password hash
    │
    ▼
Generate JWT Token
    │
    ▼
Return token to client
    │
    ▼
Client stores token in localStorage
    │
    ▼
Include token in Authorization header for future requests
```

### 2. Protected Route Flow
```
Client Request with JWT Token
    │
    ▼
Express Middleware
    │
    ├─ Extract token from Authorization header
    ├─ Verify JWT signature
    ├─ Check token expiration
    │
    ▼
verifyToken Middleware
    │
    ├─ Valid? → Continue to route handler
    └─ Invalid? → Return 401 Unauthorized
    │
    ▼
Route Handler (Controller)
    │
    ├─ Access user info from req.user
    ├─ Process request
    │
    ▼
Return response
```

### 3. Payment Flow
```
Client initiates payment
    │
    ▼
POST /api/v1/payments
    │
    ▼
paymentController.initiatePayment()
    │
    ├─ Validate payment data
    ├─ Create payment record in Supabase
    │
    ▼
Call Squadco API
    │
    ├─ Send payment request
    ├─ Get payment URL
    │
    ▼
Return payment URL to client
    │
    ▼
Client redirects to Squadco payment page
    │
    ▼
User completes payment
    │
    ▼
Squadco webhook callback
    │
    ▼
POST /api/v1/payments/webhook
    │
    ├─ Verify webhook signature
    ├─ Update payment status in Supabase
    ├─ Credit user wallet
    │
    ▼
Payment complete
```

---

## Database Schema Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Supabase PostgreSQL                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │    users     │  │    events    │  │   tickets    │      │
│  ├──────────────┤  ├──────────────┤  ├──────────────┤      │
│  │ id (PK)      │  │ id (PK)      │  │ id (PK)      │      │
│  │ email        │  │ title        │  │ eventId (FK) │      │
│  │ password     │  │ description  │  │ type         │      │
│  │ name         │  │ date         │  │ price        │      │
│  │ role         │  │ location     │  │ quantity     │      │
│  │ createdAt    │  │ capacity     │  │ sold         │      │
│  └──────────────┘  │ organizerId  │  │ createdAt    │      │
│                    │ createdAt    │  └──────────────┘      │
│                    └──────────────┘                         │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   orders     │  │   payments   │  │   wallets    │      │
│  ├──────────────┤  ├──────────────┤  ├──────────────┤      │
│  │ id (PK)      │  │ id (PK)      │  │ id (PK)      │      │
│  │ userId (FK)  │  │ reference    │  │ userId (FK)  │      │
│  │ eventId (FK) │  │ amount       │  │ balance      │      │
│  │ ticketId (FK)│  │ status       │  │ totalEarnings│      │
│  │ quantity     │  │ paidAt       │  │ totalWithdrawn
│  │ totalAmount  │  │ createdAt    │  │ createdAt    │      │
│  │ status       │  └──────────────┘  └──────────────┘      │
│  │ createdAt    │                                           │
│  └──────────────┘                                           │
│                                                              │
│  ┌──────────────────────┐  ┌──────────────────────┐        │
│  │   withdrawals        │  │   transactions       │        │
│  ├──────────────────────┤  ├──────────────────────┤        │
│  │ id (PK)              │  │ id (PK)              │        │
│  │ userId (FK)          │  │ walletId (FK)        │        │
│  │ amount               │  │ amount               │        │
│  │ status               │  │ type (credit/debit)  │        │
│  │ bankCode             │  │ description          │        │
│  │ accountNumber        │  │ balance              │        │
│  │ accountName          │  │ createdAt            │        │
│  │ createdAt            │  └──────────────────────┘        │
│  └──────────────────────┘                                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## API Endpoint Structure

```
/api/v1/
├── /auth
│   ├── POST /signup
│   └── POST /login
│
├── /events
│   ├── GET /
│   ├── GET /:id
│   ├── POST /
│   ├── PUT /:id
│   └── DELETE /:id
│
├── /tickets
│   ├── GET /
│   ├── POST /
│   └── GET /validate
│
├── /payments
│   ├── POST /
│   ├── GET /:reference
│   └── POST /squad
│
├── /wallet
│   ├── GET /
│   ├── POST /credit
│   └── GET /transactions
│
├── /withdrawals
│   ├── POST /
│   ├── GET /
│   └── GET /:id
│
├── /users
│   ├── GET /
│   ├── GET /:id
│   └── PUT /:id
│
├── /orders
│   ├── GET /
│   ├── POST /
│   └── GET /:id
│
└── /admin
    ├── GET /dashboard
    ├── GET /users
    ├── GET /events
    └── POST /payouts
```

---

## Middleware Stack

```
Request
  │
  ▼
┌─────────────────────────────────────────┐
│ CORS Middleware                         │
│ - Allow cross-origin requests           │
│ - Set allowed origins                   │
│ - Handle preflight requests             │
└─────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────┐
│ Body Parser Middleware                  │
│ - Parse JSON requests                   │
│ - Parse URL-encoded requests            │
│ - Set size limits                       │
└─────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────┐
│ Morgan Logger Middleware                │
│ - Log all requests                      │
│ - Track request duration                │
│ - Monitor API usage                     │
└─────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────┐
│ Rate Limiter Middleware                 │
│ - Limit requests per IP                 │
│ - Prevent abuse                         │
│ - Return 429 if exceeded                │
└─────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────┐
│ Authentication Middleware (if needed)   │
│ - Verify JWT token                      │
│ - Extract user info                     │
│ - Return 401 if invalid                 │
└─────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────┐
│ Route Handler                           │
│ - Process request                       │
│ - Call controller                       │
│ - Return response                       │
└─────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────┐
│ Error Handler Middleware                │
│ - Catch errors                          │
│ - Format error response                 │
│ - Log errors                            │
│ - Return error to client                │
└─────────────────────────────────────────┘
  │
  ▼
Response
```

---

## Deployment Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│                    Development                              │
│                                                              │
│  1. Write code locally                                      │
│  2. Run tests: npm run test:endpoints                       │
│  3. Commit changes: git commit                              │
│  4. Push to GitHub: git push                                │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    GitHub Repository                        │
│                                                              │
│  - Stores code                                              │
│  - Tracks changes                                           │
│  - Manages versions                                         │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    Vercel Dashboard                         │
│                                                              │
│  1. Detect push to main branch                              │
│  2. Trigger build process                                   │
│  3. Install dependencies                                    │
│  4. Run build script                                        │
│  5. Deploy to serverless functions                          │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    Production (Vercel)                      │
│                                                              │
│  - Live API endpoints                                       │
│  - Automatic SSL/TLS                                        │
│  - Global CDN                                               │
│  - Auto-scaling                                             │
│  - Monitoring & logs                                        │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    Monitoring                               │
│                                                              │
│  - Error tracking                                           │
│  - Performance metrics                                      │
│  - Uptime monitoring                                        │
│  - Alert notifications                                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Security Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Security Layers                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Layer 1: HTTPS/TLS                                         │
│  ├─ Automatic SSL certificate (Vercel)                      │
│  ├─ Encrypted data in transit                               │
│  └─ Prevents man-in-the-middle attacks                      │
│                                                              │
│  Layer 2: CORS                                              │
│  ├─ Whitelist allowed origins                               │
│  ├─ Prevent unauthorized cross-origin requests              │
│  └─ Configurable per environment                            │
│                                                              │
│  Layer 3: Authentication                                    │
│  ├─ JWT tokens                                              │
│  ├─ Token expiration                                        │
│  ├─ Refresh token mechanism                                 │
│  └─ Secure password hashing (bcryptjs)                      │
│                                                              │
│  Layer 4: Authorization                                     │
│  ├─ Role-based access control (RBAC)                        │
│  ├─ Admin vs Organizer vs User roles                        │
│  ├─ Protected routes                                        │
│  └─ Resource ownership validation                           │
│                                                              │
│  Layer 5: Rate Limiting                                     │
│  ├─ Limit requests per IP                                   │
│  ├─ Prevent brute force attacks                             │
│  ├─ Prevent DDoS attacks                                    │
│  └─ Configurable thresholds                                 │
│                                                              │
│  Layer 6: Input Validation                                  │
│  ├─ Validate request data                                   │
│  ├─ Prevent SQL injection                                   │
│  ├─ Prevent XSS attacks                                     │
│  └─ Type checking                                           │
│                                                              │
│  Layer 7: Environment Variables                             │
│  ├─ Secrets not in code                                     │
│  ├─ Separate dev/prod configs                               │
│  ├─ Vercel environment management                           │
│  └─ No hardcoded credentials                                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Scalability Considerations

```
Current Architecture (Single Vercel Function)
├─ Handles ~1000 concurrent requests
├─ Auto-scales with traffic
├─ Database connection pooling
└─ Suitable for MVP/small-scale

Future Scaling Options
├─ Multiple Vercel functions
├─ Database read replicas
├─ Redis caching layer
├─ CDN for static assets
├─ Message queue (Bull/RabbitMQ)
├─ Microservices architecture
└─ Kubernetes deployment
```

---

## Monitoring & Observability

```
┌─────────────────────────────────────────────────────────────┐
│                    Monitoring Stack                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Logs                                                        │
│  ├─ Vercel logs                                             │
│  ├─ Application logs (Morgan)                               │
│  ├─ Error logs                                              │
│  └─ Access logs                                             │
│                                                              │
│  Metrics                                                     │
│  ├─ Request count                                           │
│  ├─ Response time                                           │
│  ├─ Error rate                                              │
│  ├─ Database query time                                     │
│  └─ Memory usage                                            │
│                                                              │
│  Alerts                                                      │
│  ├─ High error rate                                         │
│  ├─ Slow response time                                      │
│  ├─ Database connection issues                              │
│  ├─ Payment gateway failures                                │
│  └─ Uptime monitoring                                       │
│                                                              │
│  Dashboards                                                  │
│  ├─ Vercel Analytics                                        │
│  ├─ Custom monitoring dashboard                             │
│  ├─ Error tracking (Sentry)                                 │
│  └─ Performance monitoring (New Relic)                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

This architecture provides a scalable, secure, and maintainable foundation for the Ticketa platform.
