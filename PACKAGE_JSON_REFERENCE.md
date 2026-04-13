# Corrected package.json Reference

## Complete package.json

```json
{
  "name": "tickethub-backend",
  "version": "1.0.0",
  "description": "TicketHub Backend API",
  "type": "module",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": [
    "ticketing",
    "events",
    "api"
  ],
  "author": "",
  "license": "ISC",
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

## Key Configuration Points

### 1. "type": "module"
```json
"type": "module"
```
**Purpose:** Tells Node.js to treat `.js` files as ES Modules
**Required:** YES - Without this, `import`/`export` will fail

### 2. Scripts
```json
"scripts": {
  "start": "node server.js",
  "dev": "nodemon server.js",
  "test": "echo \"Error: no test specified\" && exit 1"
}
```

**start:** Production server
```bash
npm start
```

**dev:** Development server with auto-reload
```bash
npm run dev
```

### 3. Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| express | ^4.18.2 | Web framework |
| cors | ^2.8.5 | Cross-origin requests |
| dotenv | ^16.3.1 | Environment variables |
| morgan | ^1.10.0 | HTTP request logging |
| jsonwebtoken | ^9.1.2 | JWT authentication |
| bcryptjs | ^2.4.3 | Password hashing |

### 4. Dev Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| nodemon | ^3.0.2 | Auto-reload on file changes |

## Installation Steps

### 1. Create backend/package.json
Copy the complete package.json above into `backend/package.json`

### 2. Install Dependencies
```bash
cd backend
npm install
```

### 3. Verify Installation
```bash
npm start
```

Expected output:
```
Server running on port 5000
Environment: development
```

## Running Commands

### Production
```bash
npm start
```
or
```bash
node server.js
```

### Development
```bash
npm run dev
```

### Test
```bash
npm test
```

## What This Fixes

✅ **ES Modules Support**
- `"type": "module"` enables import/export syntax
- All `.js` files are treated as ES Modules

✅ **Run Commands**
- `npm start` works correctly
- `node server.js` works correctly
- `npm run dev` enables auto-reload

✅ **Dependencies**
- All required packages included
- Versions are stable and compatible
- nodemon for development

## Verification Checklist

- [ ] `"type": "module"` is in package.json
- [ ] All imports include `.js` extension
- [ ] `npm install` completes without errors
- [ ] `npm start` runs the server
- [ ] `npm run dev` runs with auto-reload
- [ ] `curl http://localhost:5000/health` returns status

## Common Issues & Solutions

### Issue: "Cannot find module"
```
Error: Cannot find module './routes/eventRoutes'
```
**Solution:** Add `.js` extension
```javascript
// Wrong
import routes from './routes/eventRoutes';

// Correct
import routes from './routes/eventRoutes.js';
```

### Issue: "Failed to load the ES module"
```
Warning: Failed to load the ES module
```
**Solution:** Ensure `"type": "module"` is in package.json

### Issue: "nodemon not found"
```
Error: nodemon: command not found
```
**Solution:** Install dev dependencies
```bash
npm install --save-dev nodemon
```

## Next Steps

1. ✅ Copy package.json to backend/
2. ✅ Run `npm install`
3. ✅ Run `npm start` or `npm run dev`
4. ✅ Test with `curl http://localhost:5000/health`
5. ⏳ Connect to MongoDB
6. ⏳ Implement authentication
7. ⏳ Add database models

## Support

For more information:
- See `README.md` for API documentation
- See `SETUP.md` for quick start guide
- See `ES_MODULES_SETUP.md` for detailed ES Modules info
