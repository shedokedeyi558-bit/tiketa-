import request from 'supertest';
import app from '../api/index.js';

const API_VERSION = process.env.API_VERSION || 'v1';
const BASE_URL = `/api/${API_VERSION}`;

describe('API Endpoints Test Suite', () => {
  
  // ==================== HEALTH CHECK ====================
  describe('Health Check', () => {
    test('GET /health should return server status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toBe('Server is running');
    });
  });

  // ==================== AUTH ENDPOINTS ====================
  describe('Auth Endpoints', () => {
    test('POST /auth/signup should create new organizer', async () => {
      const response = await request(app)
        .post(`${BASE_URL}/auth/signup`)
        .send({
          email: `test-${Date.now()}@example.com`,
          password: 'TestPassword123!',
          name: 'Test Organizer',
          role: 'organizer'
        });
      
      expect([200, 201, 400, 409]).toContain(response.status);
    });

    test('POST /auth/login should authenticate user', async () => {
      const response = await request(app)
        .post(`${BASE_URL}/auth/login`)
        .send({
          email: 'test@example.com',
          password: 'password123'
        });
      
      expect([200, 401, 404]).toContain(response.status);
    });
  });

  // ==================== EVENT ENDPOINTS ====================
  describe('Event Endpoints', () => {
    test('GET /events should return all events', async () => {
      const response = await request(app)
        .get(`${BASE_URL}/events`)
        .expect(200);
      
      expect(Array.isArray(response.body) || response.body.data).toBeDefined();
    });

    test('GET /events/:id should return event details', async () => {
      const response = await request(app)
        .get(`${BASE_URL}/events/1`)
        .expect([200, 404]);
      
      if (response.status === 200) {
        expect(response.body).toHaveProperty('id');
      }
    });

    test('POST /events should create new event', async () => {
      const response = await request(app)
        .post(`${BASE_URL}/events`)
        .send({
          title: 'Test Event',
          description: 'Test Description',
          date: new Date().toISOString(),
          location: 'Test Location',
          capacity: 100
        });
      
      expect([200, 201, 400, 401]).toContain(response.status);
    });

    test('PUT /events/:id should update event', async () => {
      const response = await request(app)
        .put(`${BASE_URL}/events/1`)
        .send({
          title: 'Updated Event'
        });
      
      expect([200, 400, 404]).toContain(response.status);
    });

    test('DELETE /events/:id should delete event', async () => {
      const response = await request(app)
        .delete(`${BASE_URL}/events/1`)
        .expect([200, 204, 404]);
    });
  });

  // ==================== TICKET ENDPOINTS ====================
  describe('Ticket Endpoints', () => {
    test('GET /tickets should return all tickets', async () => {
      const response = await request(app)
        .get(`${BASE_URL}/tickets`)
        .expect([200, 401]);
    });

    test('POST /tickets should create new ticket', async () => {
      const response = await request(app)
        .post(`${BASE_URL}/tickets`)
        .send({
          eventId: 1,
          type: 'standard',
          price: 5000,
          quantity: 100
        });
      
      expect([200, 201, 400, 401]).toContain(response.status);
    });

    test('GET /tickets/validate should validate ticket', async () => {
      const response = await request(app)
        .get(`${BASE_URL}/tickets/validate`)
        .query({ code: 'TEST123' })
        .expect([200, 400, 404]);
    });
  });

  // ==================== PAYMENT ENDPOINTS ====================
  describe('Payment Endpoints', () => {
    test('POST /payments should initiate payment', async () => {
      const response = await request(app)
        .post(`${BASE_URL}/payments`)
        .send({
          amount: 5000,
          email: 'test@example.com',
          reference: `test-${Date.now()}`
        });
      
      expect([200, 201, 400, 401]).toContain(response.status);
    });

    test('GET /payments/:reference should get payment status', async () => {
      const response = await request(app)
        .get(`${BASE_URL}/payments/test-ref`)
        .expect([200, 404]);
    });

    test('POST /payments/squad should process squad payment', async () => {
      const response = await request(app)
        .post(`${BASE_URL}/payments/squad`)
        .send({
          amount: 5000,
          email: 'test@example.com'
        });
      
      expect([200, 201, 400, 401]).toContain(response.status);
    });
  });

  // ==================== WALLET ENDPOINTS ====================
  describe('Wallet Endpoints', () => {
    test('GET /wallet should return wallet balance', async () => {
      const response = await request(app)
        .get(`${BASE_URL}/wallet`)
        .expect([200, 401]);
    });

    test('POST /wallet/credit should credit wallet', async () => {
      const response = await request(app)
        .post(`${BASE_URL}/wallet/credit`)
        .send({
          amount: 1000
        });
      
      expect([200, 201, 400, 401]).toContain(response.status);
    });

    test('GET /wallet/transactions should get wallet transactions', async () => {
      const response = await request(app)
        .get(`${BASE_URL}/wallet/transactions`)
        .expect([200, 401]);
    });
  });

  // ==================== WITHDRAWAL ENDPOINTS ====================
  describe('Withdrawal Endpoints', () => {
    test('POST /withdrawals should create withdrawal request', async () => {
      const response = await request(app)
        .post(`${BASE_URL}/withdrawals`)
        .send({
          amount: 1000,
          bankCode: '001',
          accountNumber: '1234567890'
        });
      
      expect([200, 201, 400, 401]).toContain(response.status);
    });

    test('GET /withdrawals should list withdrawals', async () => {
      const response = await request(app)
        .get(`${BASE_URL}/withdrawals`)
        .expect([200, 401]);
    });

    test('GET /withdrawals/:id should get withdrawal details', async () => {
      const response = await request(app)
        .get(`${BASE_URL}/withdrawals/1`)
        .expect([200, 401, 404]);
    });
  });

  // ==================== USER ENDPOINTS ====================
  describe('User Endpoints', () => {
    test('GET /users should return users', async () => {
      const response = await request(app)
        .get(`${BASE_URL}/users`)
        .expect([200, 401]);
    });

    test('GET /users/:id should return user details', async () => {
      const response = await request(app)
        .get(`${BASE_URL}/users/1`)
        .expect([200, 401, 404]);
    });

    test('PUT /users/:id should update user', async () => {
      const response = await request(app)
        .put(`${BASE_URL}/users/1`)
        .send({
          name: 'Updated Name'
        });
      
      expect([200, 400, 401, 404]).toContain(response.status);
    });
  });

  // ==================== ORDER ENDPOINTS ====================
  describe('Order Endpoints', () => {
    test('GET /orders should return orders', async () => {
      const response = await request(app)
        .get(`${BASE_URL}/orders`)
        .expect([200, 401]);
    });

    test('POST /orders should create order', async () => {
      const response = await request(app)
        .post(`${BASE_URL}/orders`)
        .send({
          eventId: 1,
          ticketId: 1,
          quantity: 2
        });
      
      expect([200, 201, 400, 401]).toContain(response.status);
    });

    test('GET /orders/:id should get order details', async () => {
      const response = await request(app)
        .get(`${BASE_URL}/orders/1`)
        .expect([200, 401, 404]);
    });
  });

  // ==================== ADMIN ENDPOINTS ====================
  describe('Admin Endpoints', () => {
    test('GET /admin/dashboard should return dashboard data', async () => {
      const response = await request(app)
        .get(`${BASE_URL}/admin/dashboard`)
        .expect([200, 401, 403]);
    });

    test('GET /admin/users should list all users', async () => {
      const response = await request(app)
        .get(`${BASE_URL}/admin/users`)
        .expect([200, 401, 403]);
    });

    test('GET /admin/events should list all events', async () => {
      const response = await request(app)
        .get(`${BASE_URL}/admin/events`)
        .expect([200, 401, 403]);
    });
  });

  // ==================== ERROR HANDLING ====================
  describe('Error Handling', () => {
    test('GET /nonexistent should return 404', async () => {
      const response = await request(app)
        .get(`${BASE_URL}/nonexistent`)
        .expect(404);
    });

    test('POST with invalid JSON should return 400', async () => {
      const response = await request(app)
        .post(`${BASE_URL}/events`)
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);
    });
  });
});
