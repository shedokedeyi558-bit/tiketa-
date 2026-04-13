# Testing Guide

## Overview

This project includes comprehensive testing for all API endpoints. Tests can be run locally or against production deployments.

## Test Files

- `tests/runTests.js` - Simple endpoint test runner (no dependencies)
- `tests/endpoints.test.js` - Jest test suite with supertest
- `jest.config.js` - Jest configuration

## Running Tests

### 1. Install Dependencies
```bash
npm install
```

### 2. Run All Tests
```bash
npm test
```

### 3. Run Endpoint Tests Only
```bash
npm run test:endpoints
```

### 4. Run Tests in Watch Mode
```bash
npm run test:watch
```

### 5. Test Against Production
```bash
TEST_URL=https://your-project.vercel.app npm run test:endpoints
```

---

## Test Coverage

### Health Check
- ✅ GET /health - Server status

### Authentication
- ✅ POST /auth/signup - Create new account
- ✅ POST /auth/login - User login

### Events
- ✅ GET /events - List all events
- ✅ GET /events/:id - Get event details
- ✅ POST /events - Create event
- ✅ PUT /events/:id - Update event
- ✅ DELETE /events/:id - Delete event

### Tickets
- ✅ GET /tickets - List tickets
- ✅ POST /tickets - Create ticket
- ✅ GET /tickets/validate - Validate ticket

### Payments
- ✅ POST /payments - Initiate payment
- ✅ GET /payments/:reference - Get payment status
- ✅ POST /payments/squad - Process Squadco payment

### Wallet
- ✅ GET /wallet - Get wallet balance
- ✅ POST /wallet/credit - Credit wallet
- ✅ GET /wallet/transactions - Get transactions

### Withdrawals
- ✅ POST /withdrawals - Create withdrawal
- ✅ GET /withdrawals - List withdrawals
- ✅ GET /withdrawals/:id - Get withdrawal details

### Users
- ✅ GET /users - List users
- ✅ GET /users/:id - Get user details
- ✅ PUT /users/:id - Update user

### Orders
- ✅ GET /orders - List orders
- ✅ POST /orders - Create order
- ✅ GET /orders/:id - Get order details

### Admin
- ✅ GET /admin/dashboard - Dashboard data
- ✅ GET /admin/users - List all users
- ✅ GET /admin/events - List all events

### Error Handling
- ✅ 404 Not Found
- ✅ 400 Bad Request
- ✅ 401 Unauthorized
- ✅ 403 Forbidden
- ✅ 500 Server Error

---

## Manual Testing

### Using cURL

**Health Check:**
```bash
curl http://localhost:5001/health
```

**Get All Events:**
```bash
curl http://localhost:5001/api/v1/events
```

**Create Event (with auth):**
```bash
curl -X POST http://localhost:5001/api/v1/events \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My Event",
    "date": "2024-06-15T19:00:00Z",
    "location": "Main Hall",
    "capacity": 100
  }'
```

**Login:**
```bash
curl -X POST http://localhost:5001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "organizer@example.com",
    "password": "password123"
  }'
```

### Using Postman

1. Import `tests/postman-collection.json` into Postman
2. Set variables:
   - `base_url`: http://localhost:5001
   - `api_version`: v1
   - `token`: (get from login response)
3. Run requests

### Using Insomnia

1. Import `tests/postman-collection.json` into Insomnia
2. Set environment variables
3. Run requests

---

## Test Scenarios

### Scenario 1: Complete User Flow

```bash
# 1. Sign up
curl -X POST http://localhost:5001/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!",
    "name": "Test User",
    "role": "organizer"
  }'

# 2. Login (get token)
curl -X POST http://localhost:5001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!"
  }'

# 3. Create event (use token from login)
curl -X POST http://localhost:5001/api/v1/events \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My Event",
    "date": "2024-06-15T19:00:00Z",
    "location": "Main Hall",
    "capacity": 100
  }'

# 4. Get wallet balance
curl http://localhost:5001/api/v1/wallet \
  -H "Authorization: Bearer <token>"

# 5. Create withdrawal
curl -X POST http://localhost:5001/api/v1/withdrawals \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 5000,
    "bankCode": "001",
    "accountNumber": "1234567890"
  }'
```

### Scenario 2: Payment Flow

```bash
# 1. Create payment
curl -X POST http://localhost:5001/api/v1/payments \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 5000,
    "email": "customer@example.com",
    "reference": "test-payment-001"
  }'

# 2. Check payment status
curl http://localhost:5001/api/v1/payments/test-payment-001
```

### Scenario 3: Ticket Management

```bash
# 1. Create event (requires auth)
# ... (see Scenario 1)

# 2. Create ticket for event
curl -X POST http://localhost:5001/api/v1/tickets \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "event-id",
    "type": "standard",
    "price": 5000,
    "quantity": 100
  }'

# 3. Validate ticket
curl "http://localhost:5001/api/v1/tickets/validate?code=TICKET123"
```

---

## Continuous Integration

### GitHub Actions Example

Create `.github/workflows/test.yml`:

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
      
      - name: Run tests
        run: npm test
      
      - name: Run endpoint tests
        run: npm run test:endpoints
```

---

## Performance Testing

### Load Testing with Apache Bench

```bash
# Install Apache Bench (if not installed)
# macOS: brew install httpd
# Ubuntu: sudo apt-get install apache2-utils

# Test health endpoint
ab -n 1000 -c 10 http://localhost:5001/health

# Test events endpoint
ab -n 1000 -c 10 http://localhost:5001/api/v1/events
```

### Load Testing with wrk

```bash
# Install wrk
# macOS: brew install wrk
# Ubuntu: sudo apt-get install wrk

# Test health endpoint
wrk -t4 -c100 -d30s http://localhost:5001/health

# Test events endpoint
wrk -t4 -c100 -d30s http://localhost:5001/api/v1/events
```

---

## Debugging Tests

### Enable Verbose Output

```bash
# Run tests with verbose output
npm test -- --verbose

# Run endpoint tests with debug info
DEBUG=* npm run test:endpoints
```

### Check Test Output

```bash
# Run specific test file
npm test -- tests/endpoints.test.js

# Run tests matching pattern
npm test -- --testNamePattern="Auth"
```

### Common Issues

**Tests timing out:**
- Increase timeout: `jest.setTimeout(10000)`
- Check if server is running
- Verify database connection

**Tests failing with 401:**
- Verify authentication token
- Check JWT secret
- Verify token expiration

**Tests failing with CORS error:**
- Check CORS_ORIGIN in .env
- Verify allowed origins
- Check request headers

---

## Test Best Practices

### 1. Test Organization
- Group related tests
- Use descriptive test names
- Keep tests focused and small

### 2. Test Data
- Use unique identifiers (timestamps, UUIDs)
- Clean up test data after tests
- Don't rely on test order

### 3. Assertions
- Test both success and failure cases
- Verify response status codes
- Check response data structure

### 4. Mocking
- Mock external services
- Mock database calls
- Mock payment gateway

### 5. Coverage
- Aim for >80% coverage
- Test error paths
- Test edge cases

---

## Monitoring Test Results

### Local Development
```bash
# Watch mode - reruns tests on file changes
npm run test:watch

# Coverage report
npm test -- --coverage
```

### CI/CD Pipeline
- Tests run on every push
- Tests run on pull requests
- Failures block merges
- Coverage reports generated

### Production Monitoring
```bash
# Test production endpoint
TEST_URL=https://your-domain.vercel.app npm run test:endpoints

# Set up scheduled tests
# Use cron job or CI/CD scheduler
```

---

## Troubleshooting

### Tests Won't Run
```bash
# Clear cache
npm test -- --clearCache

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Check Node version
node --version  # Should be 18+
```

### Tests Timing Out
```bash
# Increase timeout
jest.setTimeout(30000)

# Check if server is running
npm run dev

# Check database connection
```

### CORS Errors in Tests
```bash
# Update CORS_ORIGIN in .env
CORS_ORIGIN=http://localhost:5001,http://localhost:5173

# Restart server
npm run dev
```

### Database Connection Errors
```bash
# Verify Supabase credentials
cat .env | grep SUPABASE

# Test connection
node checkDB.js
```

---

## Resources

- [Jest Documentation](https://jestjs.io/)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Testing Best Practices](https://testingjavascript.com/)
- [API Testing Guide](https://www.postman.com/api-testing/)
