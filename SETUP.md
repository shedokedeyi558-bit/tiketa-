# Backend Setup Instructions

## Quick Start

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Verify .env File
The `.env` file is already created with default values. Update if needed:
```env
PORT=5000
NODE_ENV=development
DATABASE_URL=mongodb://localhost:27017/tickethub
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRE=7d
CORS_ORIGIN=http://localhost:5173
API_VERSION=v1
```

### 3. Run the Server

**Production:**
```bash
npm start
```

**Development (with auto-reload):**
```bash
npm run dev
```

### 4. Test the Server
Open your browser or use curl:
```bash
curl http://localhost:5000/health
```

Expected response:
```json
{
  "status": "Server is running"
}
```

## What's Configured

✅ **ES Modules Support**
- `"type": "module"` in package.json
- All imports use `.js` extensions
- Works with `node server.js` and `npm start`

✅ **Development Tools**
- `nodemon` for auto-reload on file changes
- `npm run dev` for development

✅ **Dependencies Installed**
- express - Web framework
- cors - Cross-origin requests
- dotenv - Environment variables
- morgan - HTTP logging
- jsonwebtoken - JWT authentication
- bcryptjs - Password hashing

✅ **Project Structure**
- controllers/ - Business logic
- routes/ - API endpoints
- middlewares/ - Express middlewares
- utils/ - Helper functions
- server.js - Main server file

## Common Commands

```bash
# Install dependencies
npm install

# Start production server
npm start

# Start development server with auto-reload
npm run dev

# Test if server is running
curl http://localhost:5000/health
```

## Troubleshooting

### Error: "Cannot find module"
- Make sure all imports include `.js` extension
- Example: `import routes from './routes/eventRoutes.js'`

### Error: "Port already in use"
- Change PORT in .env file
- Or kill the process using the port

### Error: "Failed to load the ES module"
- Verify `"type": "module"` is in package.json
- Restart the server

## Next Steps

1. Connect to MongoDB database
2. Implement authentication
3. Add input validation
4. Create database models
5. Add error handling
6. Set up logging
7. Add API documentation

## API Base URL

```
http://localhost:5000/api/v1
```

All endpoints are prefixed with this URL.

Example:
```
GET http://localhost:5000/api/v1/events
POST http://localhost:5000/api/v1/users/register
```
