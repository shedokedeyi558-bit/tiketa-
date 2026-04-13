# Quick Start Guide

## Local Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Environment Variables
Copy `.env` file and update with your credentials:
```bash
cp .env .env.local
```

Edit `.env.local` with your:
- Supabase credentials
- Squadco API keys
- JWT secret
- CORS origins

### 3. Start Development Server
```bash
npm run dev
```

Server runs on `http://localhost:5001`

### 4. Test Endpoints
```bash
# In another terminal
npm run test:endpoints
```

---

## Vercel Deployment

### 1. Push to Git
```bash
git add .
git commit -m "Prepare for Vercel deployment"
git push origin main
```

### 2. Deploy to Vercel
```bash
npm install -g vercel
vercel --prod
```

Or use Vercel dashboard:
1. Go to https://vercel.com/new
2. Import your repository
3. Add environment variables
4. Deploy

### 3. Verify Deployment
```bash
curl https://your-project.vercel.app/health
```

---

## Testing

### Run All Tests
```bash
npm test
```

### Run Endpoint Tests
```bash
npm run test:endpoints
```

### Test Against Production
```bash
TEST_URL=https://your-project.vercel.app npm run test:endpoints
```

### Watch Mode
```bash
npm run test:watch
```

---

## API Documentation

See `API_ENDPOINTS.md` for complete endpoint documentation.

### Quick Examples

**Get all events:**
```bash
curl http://localhost:5001/api/v1/events
```

**Create event (requires auth):**
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

---

## Project Structure

```
├── api/
│   └── index.js              # Vercel serverless entry point
├── controllers/              # Business logic
├── routes/                   # API routes
├── middlewares/              # Express middlewares
├── services/                 # External service integrations
├── utils/                    # Helper functions
├── tests/                    # Test files
├── db/migrations/            # Database migrations
├── server.js                 # Local development server
├── vercel.json              # Vercel configuration
├── jest.config.js           # Jest configuration
├── package.json             # Dependencies
└── .env                     # Environment variables
```

---

## Troubleshooting

### Port Already in Use
```bash
# Change port in .env
PORT=5002
```

### Environment Variables Not Loading
```bash
# Verify .env file exists and has correct format
cat .env

# For Vercel, check project settings
vercel env list
```

### Database Connection Error
```bash
# Verify Supabase credentials
# Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env
```

### CORS Errors
```bash
# Update CORS_ORIGIN in .env
CORS_ORIGIN=http://localhost:5173,http://localhost:5174
```

### Tests Failing
```bash
# Make sure server is running
npm run dev

# In another terminal
npm run test:endpoints

# Check test output for specific errors
```

---

## Next Steps

1. **Configure Database**: Set up Supabase tables and migrations
2. **Add Authentication**: Implement JWT token validation
3. **Set Up Payment Gateway**: Configure Squadco integration
4. **Deploy to Vercel**: Follow VERCEL_DEPLOYMENT.md
5. **Monitor Production**: Set up error tracking and logging
6. **Add More Tests**: Expand test coverage

---

## Useful Commands

```bash
# Development
npm run dev              # Start dev server with hot reload
npm run build           # Build for production
npm start               # Start production server

# Testing
npm test                # Run all tests
npm run test:endpoints  # Run endpoint tests
npm run test:watch      # Run tests in watch mode

# Deployment
vercel                  # Deploy to staging
vercel --prod          # Deploy to production
vercel list            # View deployment history
vercel rollback        # Rollback to previous deployment
```

---

## Support

For issues or questions:
1. Check API_ENDPOINTS.md for endpoint documentation
2. Review VERCEL_DEPLOYMENT.md for deployment help
3. Check error logs: `npm run dev` output
4. Review test output: `npm run test:endpoints`
