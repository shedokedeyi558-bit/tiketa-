import axios from 'axios';

const BASE_URL = process.env.TEST_URL || 'http://localhost:5001';
const API_VERSION = process.env.API_VERSION || 'v1';
const API_BASE = `${BASE_URL}/api/${API_VERSION}`;

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

let passedTests = 0;
let failedTests = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`${colors.green}✓${colors.reset} ${name}`);
    passedTests++;
  } catch (error) {
    console.log(`${colors.red}✗${colors.reset} ${name}`);
    console.log(`  ${colors.red}Error: ${error.message}${colors.reset}`);
    failedTests++;
  }
}

async function runTests() {
  console.log(`${colors.cyan}🧪 Starting API Endpoint Tests${colors.reset}`);
  console.log(`${colors.blue}Base URL: ${API_BASE}${colors.reset}\n`);

  // Health Check
  console.log(`${colors.yellow}Testing Health Check...${colors.reset}`);
  await test('GET /health', async () => {
    const response = await axios.get(`${BASE_URL}/health`);
    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
    if (!response.data.status) throw new Error('Missing status field');
  });

  // Auth Endpoints
  console.log(`\n${colors.yellow}Testing Auth Endpoints...${colors.reset}`);
  await test('POST /auth/signup', async () => {
    try {
      await axios.post(`${API_BASE}/auth/signup`, {
        email: `test-${Date.now()}@example.com`,
        password: 'TestPassword123!',
        name: 'Test Organizer',
        role: 'organizer'
      });
    } catch (error) {
      if (![200, 201, 400, 409].includes(error.response?.status)) throw error;
    }
  });

  await test('POST /auth/login', async () => {
    try {
      await axios.post(`${API_BASE}/auth/login`, {
        email: 'test@example.com',
        password: 'password123'
      });
    } catch (error) {
      if (![200, 401, 404].includes(error.response?.status)) throw error;
    }
  });

  // Event Endpoints
  console.log(`\n${colors.yellow}Testing Event Endpoints...${colors.reset}`);
  await test('GET /events', async () => {
    const response = await axios.get(`${API_BASE}/events`);
    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
  });

  await test('GET /events/:id', async () => {
    try {
      await axios.get(`${API_BASE}/events/1`);
    } catch (error) {
      if (![200, 404].includes(error.response?.status)) throw error;
    }
  });

  await test('POST /events', async () => {
    try {
      await axios.post(`${API_BASE}/events`, {
        title: 'Test Event',
        description: 'Test Description',
        date: new Date().toISOString(),
        location: 'Test Location',
        capacity: 100
      });
    } catch (error) {
      if (![200, 201, 400, 401].includes(error.response?.status)) throw error;
    }
  });

  // Ticket Endpoints
  console.log(`\n${colors.yellow}Testing Ticket Endpoints...${colors.reset}`);
  await test('GET /tickets', async () => {
    try {
      await axios.get(`${API_BASE}/tickets`);
    } catch (error) {
      if (![200, 401].includes(error.response?.status)) throw error;
    }
  });

  await test('POST /tickets', async () => {
    try {
      await axios.post(`${API_BASE}/tickets`, {
        eventId: 1,
        type: 'standard',
        price: 5000,
        quantity: 100
      });
    } catch (error) {
      if (![200, 201, 400, 401].includes(error.response?.status)) throw error;
    }
  });

  // Payment Endpoints
  console.log(`\n${colors.yellow}Testing Payment Endpoints...${colors.reset}`);
  await test('POST /payments', async () => {
    try {
      await axios.post(`${API_BASE}/payments`, {
        amount: 5000,
        email: 'test@example.com',
        reference: `test-${Date.now()}`
      });
    } catch (error) {
      if (![200, 201, 400, 401].includes(error.response?.status)) throw error;
    }
  });

  await test('GET /payments/:reference', async () => {
    try {
      await axios.get(`${API_BASE}/payments/test-ref`);
    } catch (error) {
      if (![200, 404].includes(error.response?.status)) throw error;
    }
  });

  // Wallet Endpoints
  console.log(`\n${colors.yellow}Testing Wallet Endpoints...${colors.reset}`);
  await test('GET /wallet', async () => {
    try {
      await axios.get(`${API_BASE}/wallet`);
    } catch (error) {
      if (![200, 401].includes(error.response?.status)) throw error;
    }
  });

  await test('POST /wallet/credit', async () => {
    try {
      await axios.post(`${API_BASE}/wallet/credit`, {
        amount: 1000
      });
    } catch (error) {
      if (![200, 201, 400, 401].includes(error.response?.status)) throw error;
    }
  });

  // Withdrawal Endpoints
  console.log(`\n${colors.yellow}Testing Withdrawal Endpoints...${colors.reset}`);
  await test('POST /withdrawals', async () => {
    try {
      await axios.post(`${API_BASE}/withdrawals`, {
        amount: 1000,
        bankCode: '001',
        accountNumber: '1234567890'
      });
    } catch (error) {
      if (![200, 201, 400, 401].includes(error.response?.status)) throw error;
    }
  });

  await test('GET /withdrawals', async () => {
    try {
      await axios.get(`${API_BASE}/withdrawals`);
    } catch (error) {
      if (![200, 401].includes(error.response?.status)) throw error;
    }
  });

  // User Endpoints
  console.log(`\n${colors.yellow}Testing User Endpoints...${colors.reset}`);
  await test('GET /users', async () => {
    try {
      await axios.get(`${API_BASE}/users`);
    } catch (error) {
      if (![200, 401].includes(error.response?.status)) throw error;
    }
  });

  // Order Endpoints
  console.log(`\n${colors.yellow}Testing Order Endpoints...${colors.reset}`);
  await test('GET /orders', async () => {
    try {
      await axios.get(`${API_BASE}/orders`);
    } catch (error) {
      if (![200, 401].includes(error.response?.status)) throw error;
    }
  });

  await test('POST /orders', async () => {
    try {
      await axios.post(`${API_BASE}/orders`, {
        eventId: 1,
        ticketId: 1,
        quantity: 2
      });
    } catch (error) {
      if (![200, 201, 400, 401].includes(error.response?.status)) throw error;
    }
  });

  // Admin Endpoints
  console.log(`\n${colors.yellow}Testing Admin Endpoints...${colors.reset}`);
  await test('GET /admin/dashboard', async () => {
    try {
      await axios.get(`${API_BASE}/admin/dashboard`);
    } catch (error) {
      if (![200, 401, 403].includes(error.response?.status)) throw error;
    }
  });

  // Error Handling
  console.log(`\n${colors.yellow}Testing Error Handling...${colors.reset}`);
  await test('GET /nonexistent returns 404', async () => {
    try {
      await axios.get(`${API_BASE}/nonexistent`);
      throw new Error('Should have returned 404');
    } catch (error) {
      if (error.response?.status !== 404) throw error;
    }
  });

  // Summary
  console.log(`\n${colors.cyan}${'='.repeat(50)}${colors.reset}`);
  console.log(`${colors.green}Passed: ${passedTests}${colors.reset}`);
  console.log(`${colors.red}Failed: ${failedTests}${colors.reset}`);
  console.log(`${colors.cyan}${'='.repeat(50)}${colors.reset}`);

  process.exit(failedTests > 0 ? 1 : 0);
}

runTests().catch(error => {
  console.error(`${colors.red}Test suite error: ${error.message}${colors.reset}`);
  process.exit(1);
});
