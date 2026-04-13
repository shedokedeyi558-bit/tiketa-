# API Examples - Multiple Languages

## Base URL
```
https://tiketa-alpha.vercel.app/api/v1
```

---

## JavaScript / React Examples

### 1. Login & Get Token

```javascript
// login.js
export const login = async (email, password) => {
  try {
    const response = await fetch('https://tiketa-alpha.vercel.app/api/v1/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (data.success) {
      // Store token
      localStorage.setItem('authToken', data.session.access_token);
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('role', data.role);
      return data;
    } else {
      throw new Error(data.error || 'Login failed');
    }
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};
```

### 2. Get Events

```javascript
// events.js
export const getEvents = async (page = 1, limit = 10) => {
  try {
    const response = await fetch(
      `https://tiketa-alpha.vercel.app/api/v1/events?page=${page}&limit=${limit}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching events:', error);
    return [];
  }
};
```

### 3. Create Event (Protected)

```javascript
// createEvent.js
export const createEvent = async (eventData) => {
  const token = localStorage.getItem('authToken');

  if (!token) {
    throw new Error('Not authenticated');
  }

  try {
    const response = await fetch('https://tiketa-alpha.vercel.app/api/v1/events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(eventData)
    });

    const data = await response.json();

    if (data.success) {
      return data.data;
    } else {
      throw new Error(data.error || 'Failed to create event');
    }
  } catch (error) {
    console.error('Error creating event:', error);
    throw error;
  }
};
```

### 4. Initiate Payment

```javascript
// payment.js
export const initiatePayment = async (paymentData) => {
  try {
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
      // Store reference for verification
      sessionStorage.setItem('paymentReference', data.data.reference);
      
      // Redirect to checkout
      window.location.href = data.data.checkoutUrl;
      return data;
    } else {
      throw new Error(data.error || 'Payment initiation failed');
    }
  } catch (error) {
    console.error('Payment error:', error);
    throw error;
  }
};
```

### 5. Verify Payment

```javascript
// verifyPayment.js
export const verifyPayment = async (reference) => {
  try {
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

    const data = await response.json();

    if (data.success) {
      return {
        success: true,
        transaction: data.transaction,
        ticket: data.ticket
      };
    } else {
      return {
        success: false,
        error: data.error || 'Verification failed'
      };
    }
  } catch (error) {
    console.error('Verification error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};
```

### 6. Get Wallet Balance (Protected)

```javascript
// wallet.js
export const getWalletBalance = async () => {
  const token = localStorage.getItem('authToken');

  if (!token) {
    throw new Error('Not authenticated');
  }

  try {
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

    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error fetching wallet:', error);
    throw error;
  }
};
```

### 7. React Hook for API Calls

```javascript
// useApi.js
import { useState, useCallback } from 'react';

export const useApi = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const call = useCallback(async (url, options = {}) => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('authToken');
      
      const headers = {
        'Content-Type': 'application/json',
        ...options.headers
      };

      if (token && !options.skipAuth) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(url, {
        ...options,
        headers
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'API Error');
      }

      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { call, loading, error };
};

// Usage in component
function MyComponent() {
  const { call, loading, error } = useApi();

  const handleLogin = async (email, password) => {
    try {
      const data = await call('https://tiketa-alpha.vercel.app/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
        skipAuth: true
      });
      localStorage.setItem('authToken', data.session.access_token);
    } catch (err) {
      console.error('Login failed:', err);
    }
  };

  return (
    <div>
      {loading && <p>Loading...</p>}
      {error && <p>Error: {error}</p>}
      <button onClick={() => handleLogin('test@example.com', 'password')}>
        Login
      </button>
    </div>
  );
}
```

---

## Python Examples

### 1. Login & Get Token

```python
# auth.py
import requests
import json

BASE_URL = 'https://tiketa-alpha.vercel.app/api/v1'

def login(email, password):
    url = f'{BASE_URL}/auth/login'
    payload = {
        'email': email,
        'password': password
    }
    
    response = requests.post(url, json=payload)
    data = response.json()
    
    if data.get('success'):
        token = data['session']['access_token']
        return token
    else:
        raise Exception(data.get('error', 'Login failed'))

# Usage
token = login('organizer@example.com', 'password123')
print(f'Token: {token}')
```

### 2. Get Events

```python
# events.py
import requests

BASE_URL = 'https://tiketa-alpha.vercel.app/api/v1'

def get_events(page=1, limit=10):
    url = f'{BASE_URL}/events'
    params = {'page': page, 'limit': limit}
    
    response = requests.get(url, params=params)
    data = response.json()
    
    return data.get('data', [])

# Usage
events = get_events()
for event in events:
    print(f"Event: {event['title']} - {event['date']}")
```

### 3. Create Event (Protected)

```python
# create_event.py
import requests

BASE_URL = 'https://tiketa-alpha.vercel.app/api/v1'

def create_event(token, event_data):
    url = f'{BASE_URL}/events'
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    response = requests.post(url, json=event_data, headers=headers)
    data = response.json()
    
    if data.get('success'):
        return data['data']
    else:
        raise Exception(data.get('error', 'Failed to create event'))

# Usage
token = login('organizer@example.com', 'password123')
event_data = {
    'title': 'Concert 2024',
    'description': 'Amazing concert',
    'date': '2024-06-15T19:00:00Z',
    'location': 'Main Hall',
    'capacity': 1000
}
event = create_event(token, event_data)
print(f"Event created: {event['id']}")
```

### 4. Initiate Payment

```python
# payment.py
import requests

BASE_URL = 'https://tiketa-alpha.vercel.app/api/v1'

def initiate_payment(payment_data):
    url = f'{BASE_URL}/payments/initiate'
    
    response = requests.post(url, json=payment_data)
    data = response.json()
    
    if data.get('success'):
        return data['data']
    else:
        raise Exception(data.get('error', 'Payment initiation failed'))

# Usage
payment_data = {
    'eventId': 'event-uuid',
    'cartItems': [
        {'ticketType': 'standard', 'price': 5000, 'quantity': 2}
    ],
    'attendees': [
        {'name': 'John Doe', 'email': 'john@example.com'}
    ],
    'buyerEmail': 'buyer@example.com',
    'buyerName': 'Buyer Name'
}
payment = initiate_payment(payment_data)
print(f"Checkout URL: {payment['checkoutUrl']}")
print(f"Reference: {payment['reference']}")
```

### 5. Verify Payment

```python
# verify_payment.py
import requests

BASE_URL = 'https://tiketa-alpha.vercel.app/api/v1'

def verify_payment(reference):
    url = f'{BASE_URL}/payments/verify'
    payload = {'reference': reference}
    
    response = requests.post(url, json=payload)
    data = response.json()
    
    if data.get('success'):
        return {
            'success': True,
            'transaction': data['transaction'],
            'ticket': data['ticket']
        }
    else:
        return {
            'success': False,
            'error': data.get('error', 'Verification failed')
        }

# Usage
result = verify_payment('TXN_1704067200000_a1b2c3d4-e5f6-7890-abcd-ef1234567890')
if result['success']:
    print(f"Payment verified!")
    print(f"Ticket: {result['ticket']['ticket_number']}")
else:
    print(f"Verification failed: {result['error']}")
```

---

## cURL Examples

### 1. Login

```bash
curl -X POST https://tiketa-alpha.vercel.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "organizer@example.com",
    "password": "password123"
  }'
```

### 2. Get Events

```bash
curl https://tiketa-alpha.vercel.app/api/v1/events
```

### 3. Create Event (Protected)

```bash
curl -X POST https://tiketa-alpha.vercel.app/api/v1/events \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "title": "Concert 2024",
    "description": "Amazing concert",
    "date": "2024-06-15T19:00:00Z",
    "location": "Main Hall",
    "capacity": 1000
  }'
```

### 4. Initiate Payment

```bash
curl -X POST https://tiketa-alpha.vercel.app/api/v1/payments/initiate \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "event-uuid",
    "cartItems": [
      {"ticketType": "standard", "price": 5000, "quantity": 2}
    ],
    "attendees": [
      {"name": "John Doe", "email": "john@example.com"}
    ],
    "buyerEmail": "buyer@example.com",
    "buyerName": "Buyer Name"
  }'
```

### 5. Verify Payment

```bash
curl -X POST https://tiketa-alpha.vercel.app/api/v1/payments/verify \
  -H "Content-Type: application/json" \
  -d '{
    "reference": "TXN_1704067200000_a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  }'
```

### 6. Get Wallet Balance (Protected)

```bash
curl https://tiketa-alpha.vercel.app/api/v1/wallet/balance \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## TypeScript Examples

### 1. API Service

```typescript
// api.service.ts
interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

interface LoginResponse {
  user: any;
  role: string;
  session: {
    access_token: string;
    token_type: string;
    expires_in: number;
  };
}

class ApiService {
  private baseUrl = 'https://tiketa-alpha.vercel.app/api/v1';
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('authToken');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (this.token && !options.headers?.['skipAuth']) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'API Error');
    }

    return data;
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await this.request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    if (response.data?.session.access_token) {
      this.token = response.data.session.access_token;
      localStorage.setItem('authToken', this.token);
    }

    return response.data!;
  }

  async getEvents(page: number = 1, limit: number = 10) {
    return this.request('/events', {
      method: 'GET'
    });
  }

  async createEvent(eventData: any) {
    return this.request('/events', {
      method: 'POST',
      body: JSON.stringify(eventData)
    });
  }

  async initiatePayment(paymentData: any) {
    return this.request('/payments/initiate', {
      method: 'POST',
      body: JSON.stringify(paymentData)
    });
  }

  async verifyPayment(reference: string) {
    return this.request('/payments/verify', {
      method: 'POST',
      body: JSON.stringify({ reference })
    });
  }

  async getWalletBalance() {
    return this.request('/wallet/balance', {
      method: 'GET'
    });
  }
}

export default new ApiService();
```

### 2. Usage in Component

```typescript
// EventList.tsx
import React, { useEffect, useState } from 'react';
import apiService from './api.service';

interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  location: string;
  capacity: number;
}

export const EventList: React.FC = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const response = await apiService.getEvents();
        setEvents(response.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch events');
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      {events.map(event => (
        <div key={event.id}>
          <h3>{event.title}</h3>
          <p>{event.description}</p>
          <p>Date: {new Date(event.date).toLocaleDateString()}</p>
          <p>Location: {event.location}</p>
        </div>
      ))}
    </div>
  );
};
```

---

## Common Patterns

### Error Handling

```javascript
const handleApiError = (error) => {
  if (error.response?.status === 401) {
    // Unauthorized - redirect to login
    localStorage.removeItem('authToken');
    window.location.href = '/login';
  } else if (error.response?.status === 403) {
    // Forbidden - show permission error
    console.error('Permission denied');
  } else if (error.response?.status === 404) {
    // Not found
    console.error('Resource not found');
  } else {
    // Other errors
    console.error('Error:', error.message);
  }
};
```

### Retry Logic

```javascript
const retryRequest = async (fn, maxRetries = 3, delay = 1000) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
    }
  }
};

// Usage
const data = await retryRequest(() => 
  fetch('https://tiketa-alpha.vercel.app/api/v1/events')
);
```

### Request Timeout

```javascript
const fetchWithTimeout = (url, options = {}, timeout = 5000) => {
  return Promise.race([
    fetch(url, options),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), timeout)
    )
  ]);
};
```

---

## Testing

### Jest Test Example

```javascript
// api.test.js
import apiService from './api.service';

describe('API Service', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('should login successfully', async () => {
    const result = await apiService.login('test@example.com', 'password123');
    expect(result.success).toBe(true);
    expect(result.session.access_token).toBeDefined();
  });

  test('should get events', async () => {
    const result = await apiService.getEvents();
    expect(result.success).toBe(true);
    expect(Array.isArray(result.data)).toBe(true);
  });

  test('should handle errors', async () => {
    await expect(
      apiService.login('invalid@example.com', 'wrongpassword')
    ).rejects.toThrow();
  });
});
```

---

## Best Practices

1. **Always handle errors** - Use try-catch or .catch()
2. **Store tokens securely** - Use localStorage or sessionStorage
3. **Implement retry logic** - Network issues can occur
4. **Validate input** - Check data before sending
5. **Use loading states** - Show users requests are processing
6. **Implement timeouts** - Prevent hanging requests
7. **Log errors** - For debugging and monitoring
8. **Use environment variables** - For API URLs
9. **Implement rate limiting** - Respect API limits
10. **Test thoroughly** - Unit and integration tests

---

**Last Updated:** April 13, 2026
**API Version:** v1
**Status:** ✅ Production Ready
