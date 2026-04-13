# ES Modules Setup - Complete Guide

## What Was Fixed

### 1. package.json Configuration
Added `"type": "module"` to enable ES Modules:

```json
{
  "name": "tickethub-backend",
  "version": "1.0.0",
  "type": "module",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "morgan": "^1.10.0",
    "jsonwebtoken": "^9.1.2",
    "bcryptjs": "^2.4.3"
  },
  "devDependencies": {
    "nodemon": "^3.0.2"
  }
}
```

### 2. Import/Export Syntax
All files use ES Modules syntax:

**server.js:**
```javascript
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';
import eventRoutes from './routes/eventRoutes.js';
```

**routes/eventRoutes.js:**
```javascript
import express from 'express';
import { getAllEvents, getEventById } from '../controllers/eventController.js';

export default router;
```

**controllers/eventController.js:**
```javascript
export const getAllEvents = async (req, res) => {
  // ...
};
```

### 3. File Extensions
All imports include `.js` extension:
```javascript
// ✅ Correct
import routes from './routes/eventRoutes.js';

// ❌ Incorrect
import routes from './routes/eventRoutes';
```

## How to Run

### Installation
```bash
cd backend
npm install
```

### Start Server
```bash
# Production
npm start

# Development (with auto-reload)
npm run dev
```

### Verify It Works
```bash
curl http://localhost:5000/health
```

Expected output:
```json
{
  "status": "Server is running"
}
```

## Key Points

✅ **"type": "module"** in package.json enables ES Modules
✅ All imports must include `.js` extension
✅ Use `import`/`export` instead of `require`/`module.exports`
✅ Works with `node server.js` directly
✅ `npm start` runs the server
✅ `npm run dev` runs with nodemon for development

## File Structure Verified

```
backend/
├── server.js                    ✅ ES Modules
├── package.json                 ✅ "type": "module"
├── .env                         ✅ Configuration
├── controllers/
│   ├── eventController.js       ✅ ES Modules
│   ├── userController.js        ✅ ES Modules
│   ├── ticketController.js      ✅ ES Modules
│   └── orderController.js       ✅ ES Modules
├── routes/
│   ├── eventRoutes.js           ✅ ES Modules with .js imports
│   ├── userRoutes.js            ✅ ES Modules with .js imports
│   ├── ticketRoutes.js          ✅ ES Modules with .js imports
│   └── orderRoutes.js           ✅ ES Modules with .js imports
├── middlewares/
│   ├── authMiddleware.js        ✅ ES Modules
│   └── errorMiddleware.js       ✅ ES Modules
└── utils/
    ├── validators.js            ✅ ES Modules
    └── helpers.js               ✅ ES Modules
```

## Troubleshooting

### Issue: "Failed to load the ES module"
**Solution:** Ensure `"type": "module"` is in package.json

### Issue: "Cannot find module"
**Solution:** Add `.js` extension to all imports
```javascript
// Before (fails)
import routes from './routes/eventRoutes';

// After (works)
import routes from './routes/eventRoutes.js';
```

### Issue: "Port already in use"
**Solution:** Change PORT in .env or kill the process
```bash
# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# macOS/Linux
lsof -i :5000
kill -9 <PID>
```

## Commands Reference

```bash
# Install dependencies
npm install

# Start production server
npm start

# Start development server with auto-reload
npm run dev

# Test server health
curl http://localhost:5000/health

# View logs
npm run dev  # Shows logs in console
```

## API Endpoints

All endpoints are prefixed with `/api/v1`:

```
GET    /health                    - Health check
GET    /api/v1/events             - Get all events
GET    /api/v1/events/:id         - Get event by ID
POST   /api/v1/events             - Create event
PUT    /api/v1/events/:id         - Update event
DELETE /api/v1/events/:id         - Delete event

POST   /api/v1/users/register     - Register user
POST   /api/v1/users/login        - Login user
GET    /api/v1/users/profile      - Get profile
PUT    /api/v1/users/profile      - Update profile

GET    /api/v1/tickets            - Get all tickets
GET    /api/v1/tickets/user       - Get user tickets
GET    /api/v1/tickets/:id        - Get ticket by ID
POST   /api/v1/tickets/:id/transfer - Transfer ticket

POST   /api/v1/orders             - Create order
GET    /api/v1/orders             - Get all orders
GET    /api/v1/orders/user        - Get user orders
GET    /api/v1/orders/:id         - Get order by ID
DELETE /api/v1/orders/:id         - Cancel order
```

## Summary

✅ ES Modules fully configured
✅ All imports use `.js` extensions
✅ Server runs with `node server.js` or `npm start`
✅ Development mode with `npm run dev`
✅ All route/controller logic unchanged
✅ Ready for database integration
