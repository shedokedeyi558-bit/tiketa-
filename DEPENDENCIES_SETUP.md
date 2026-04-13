# Backend Dependencies Setup Guide

## 📋 All Required Packages

Your backend requires the following packages to run properly:

### Production Dependencies
```json
{
  "express": "^4.18.2",           // Web framework
  "cors": "^2.8.5",               // Cross-Origin Resource Sharing
  "dotenv": "^16.3.1",            // Environment variables
  "morgan": "^1.10.0",            // HTTP request logger
  "jsonwebtoken": "^9.1.2",       // JWT authentication
  "bcryptjs": "^2.4.3",           // Password hashing
  "@supabase/supabase-js": "^2.38.4",  // Supabase client
  "axios": "^1.6.2"               // HTTP client
}
```

### Development Dependencies
```json
{
  "nodemon": "^3.0.2"             // Auto-restart on file changes
}
```

---

## 🚀 Installation Instructions

### Option 1: Install All at Once (Recommended)
```bash
cd backend
npm install
```

This will install all dependencies listed in `package.json`.

### Option 2: Install Specific Packages
If you need to install individual packages:

```bash
cd backend

# Core packages
npm install express cors dotenv morgan

# Authentication
npm install jsonwebtoken bcryptjs

# Database & API
npm install @supabase/supabase-js axios

# Development
npm install --save-dev nodemon
```

### Option 3: Install Missing Packages Only
If you already have some packages installed:

```bash
cd backend
npm install @supabase/supabase-js axios
```

---

## ✅ Verify Installation

After installation, verify all packages are installed:

```bash
npm list
```

You should see output like:
```
tickethub-backend@1.0.0
├── axios@1.6.2
├── bcryptjs@2.4.3
├── cors@2.8.5
├── dotenv@16.3.1
├── express@4.18.2
├── jsonwebtoken@9.1.2
├── @supabase/supabase-js@2.38.4
├── morgan@1.10.0
└── nodemon@3.0.2 (dev)
```

---

## 🏃 Running the Server

### Development Mode (with auto-restart)
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

Both commands will start the server on port 5000 (or the port specified in `.env`).

---

## 🔧 Environment Variables

Create or update `backend/.env` with:

```env
PORT=5000
NODE_ENV=development
DATABASE_URL=mongodb://localhost:27017/tickethub
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRE=7d
CORS_ORIGIN=http://localhost:5173
API_VERSION=v1

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

---

## 📦 Package Descriptions

### express (^4.18.2)
Web framework for building REST APIs
- Used for: Creating routes, middleware, request handling

### cors (^2.8.5)
Enables Cross-Origin Resource Sharing
- Used for: Allowing frontend to communicate with backend

### dotenv (^16.3.1)
Loads environment variables from .env file
- Used for: Configuration management

### morgan (^1.10.0)
HTTP request logger middleware
- Used for: Logging API requests in development

### jsonwebtoken (^9.1.2)
JWT token creation and verification
- Used for: User authentication and authorization

### bcryptjs (^2.4.3)
Password hashing library
- Used for: Secure password storage

### @supabase/supabase-js (^2.38.4)
Supabase JavaScript client
- Used for: Database operations, authentication, RLS

### axios (^1.6.2)
HTTP client for making requests
- Used for: External API calls

### nodemon (^3.0.2) [DEV]
Auto-restarts server on file changes
- Used for: Development convenience

---

## 🐛 Troubleshooting

### Error: "Cannot find package 'morgan'"
**Solution**: Run `npm install` to install all dependencies

### Error: "Cannot find module '@supabase/supabase-js'"
**Solution**: Run `npm install @supabase/supabase-js`

### Error: "SUPABASE_URL is not defined"
**Solution**: Add Supabase credentials to `.env` file

### Error: "Port 5000 is already in use"
**Solution**: Change PORT in `.env` or kill the process using port 5000

### Error: "Module not found: ./routes/eventRoutes.js"
**Solution**: Ensure all route files exist in `backend/routes/` directory

---

## 📝 package.json Reference

Your `backend/package.json` should look like this:

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
    "bcryptjs": "^2.4.3",
    "@supabase/supabase-js": "^2.38.4",
    "axios": "^1.6.2"
  },
  "devDependencies": {
    "nodemon": "^3.0.2"
  }
}
```

---

## ✨ Quick Start

1. **Install dependencies**:
   ```bash
   cd backend
   npm install
   ```

2. **Configure environment**:
   ```bash
   # Edit .env with your Supabase credentials
   nano .env
   ```

3. **Start server**:
   ```bash
   npm start          # Production
   npm run dev        # Development
   ```

4. **Verify it's running**:
   ```bash
   curl http://localhost:5000/health
   ```

---

## 🔗 Useful Commands

```bash
# Install all dependencies
npm install

# Install specific package
npm install package-name

# Install dev dependency
npm install --save-dev package-name

# Update all packages
npm update

# Check for outdated packages
npm outdated

# List installed packages
npm list

# Remove package
npm uninstall package-name

# Clear npm cache
npm cache clean --force
```

---

## 📚 Additional Resources

- Express.js: https://expressjs.com
- Supabase: https://supabase.com/docs
- JWT: https://jwt.io
- Axios: https://axios-http.com
- Morgan: https://github.com/expressjs/morgan

---

## ✅ Verification Checklist

- [ ] All packages installed (`npm install`)
- [ ] `.env` file configured with Supabase credentials
- [ ] Server starts without errors (`npm start`)
- [ ] Health check endpoint responds (`curl http://localhost:5000/health`)
- [ ] All routes are accessible
- [ ] No module not found errors
- [ ] No missing package errors

---

**Status**: All dependencies configured and ready to use! ✅
