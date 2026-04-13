# TicketHub Backend API

A Node.js Express backend API for the TicketHub ticket marketplace application using ES Modules.

## 🚀 Quick Links
- 📖 [Quick Start Guide](QUICK_START.md)
- 📚 [API Documentation](API_ENDPOINTS.md)
- 🌐 [Vercel Deployment Guide](VERCEL_DEPLOYMENT.md)
- 🧪 [Testing Guide](#testing)

## Prerequisites

- Node.js v18+ (with ES Modules support)
- npm v9+
- Vercel account (for deployment)

## Installation

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

## Environment Setup

The `.env` file is already configured with default values:

```env
PORT=5000
NODE_ENV=development
DATABASE_URL=mongodb://localhost:27017/tickethub
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRE=7d
CORS_ORIGIN=http://localhost:5173
API_VERSION=v1
```

Update these values as needed for your environment.

## Running the Server

### Production Mode
```bash
npm start
```
or
```bash
node server.js
```

### Development Mode (with auto-reload)
```bash
npm run dev
```

The server will start on `http://localhost:5001` (or the port specified in `.env`)

## Testing

### Run All Tests
```bash
npm test
```

### Run Endpoint Tests
```bash
npm run test:endpoints
```

### Run Tests in Watch Mode
```bash
npm run test:watch
```

### Test Against Production
```bash
TEST_URL=https://your-project.vercel.app npm run test:endpoints
```

## API Endpoints

### Health Check
- `GET /health` - Check if server is running

### Events
- `GET /api/v1/events` - Get all events
- `GET /api/v1/events/:id` - Get event by ID
- `POST /api/v1/events` - Create event (protected)
- `PUT /api/v1/events/:id` - Update event (protected)
- `DELETE /api/v1/events/:id` - Delete event (protected)

### Users
- `POST /api/v1/users/register` - Register new user
- `POST /api/v1/users/login` - Login user
- `GET /api/v1/users/profile` - Get user profile (protected)
- `PUT /api/v1/users/profile` - Update user profile (protected)

### Tickets
- `GET /api/v1/tickets` - Get all tickets
- `GET /api/v1/tickets/user` - Get user tickets (protected)
- `GET /api/v1/tickets/:id` - Get ticket by ID
- `POST /api/v1/tickets/:id/transfer` - Transfer ticket (protected)

### Orders
- `POST /api/v1/orders` - Create order (protected)
- `GET /api/v1/orders` - Get all orders
- `GET /api/v1/orders/user` - Get user orders (protected)
- `GET /api/v1/orders/:id` - Get order by ID
- `DELETE /api/v1/orders/:id` - Cancel order (protected)

## Project Structure

```
backend/
├── controllers/          # Business logic
│   ├── eventController.js
│   ├── userController.js
│   ├── ticketController.js
│   └── orderController.js
├── routes/              # API routes
│   ├── eventRoutes.js
│   ├── userRoutes.js
│   ├── ticketRoutes.js
│   └── orderRoutes.js
├── middlewares/         # Express middlewares
│   ├── authMiddleware.js
│   └── errorMiddleware.js
├── utils/               # Utility functions
│   ├── validators.js
│   └── helpers.js
├── server.js            # Express server setup
├── package.json         # Dependencies and scripts
├── .env                 # Environment variables
└── README.md            # This file
```

## ES Modules Configuration

This project uses ES Modules (import/export) instead of CommonJS. The `package.json` includes:

```json
"type": "module"
```

This tells Node.js to treat `.js` files as ES Modules. All imports must include the `.js` file extension:

```javascript
// ✅ Correct
import express from 'express';
import routes from './routes/eventRoutes.js';

// ❌ Incorrect (will fail)
import routes from './routes/eventRoutes';
```

## Troubleshooting

### "Failed to load the ES module" Error
- Ensure `"type": "module"` is in `package.json`
- All imports must include `.js` extension
- Use `node server.js` or `npm start` to run

### Port Already in Use
- Change the `PORT` in `.env` file
- Or kill the process using the port:
  ```bash
  # On Windows
  netstat -ano | findstr :5000
  taskkill /PID <PID> /F
  
  # On macOS/Linux
  lsof -i :5000
  kill -9 <PID>
  ```

### Dependencies Not Installing
- Delete `node_modules` and `package-lock.json`
- Run `npm install` again

## Development

### Adding New Routes
1. Create controller in `controllers/`
2. Create route file in `routes/`
3. Import route in `server.js`
4. Add route to app: `app.use('/api/v1/path', routeImport)`

### Adding New Utilities
1. Create utility file in `utils/`
2. Export functions as named exports
3. Import in controllers/routes with `.js` extension

## Deployment

### Deploy to Vercel
```bash
npm install -g vercel
vercel --prod
```

See [VERCEL_DEPLOYMENT.md](VERCEL_DEPLOYMENT.md) for detailed instructions.

### Environment Variables for Production
Set these in Vercel project settings:
- `NODE_ENV=production`
- `JWT_SECRET=your_production_secret`
- `SUPABASE_URL=your_supabase_url`
- `SUPABASE_SERVICE_ROLE_KEY=your_key`
- `SQUADCO_API_KEY=your_production_key`
- `SQUADCO_PUBLIC_KEY=your_production_key`
- `CORS_ORIGIN=https://yourdomain.com`

## Project Features

✅ Event management and ticketing
✅ Payment processing (Squadco integration)
✅ Wallet and withdrawal management
✅ User authentication with JWT
✅ Admin dashboard
✅ Comprehensive API endpoints
✅ Production-ready Vercel deployment
✅ Full test coverage
✅ Rate limiting
✅ CORS protection

## Next Steps

- [ ] Deploy to Vercel
- [ ] Configure production environment variables
- [ ] Set up monitoring and logging
- [ ] Configure payment gateway for production
- [ ] Set up automated backups
- [ ] Add API rate limiting
- [ ] Implement caching strategy
- [ ] Set up CI/CD pipeline

## License

ISC
