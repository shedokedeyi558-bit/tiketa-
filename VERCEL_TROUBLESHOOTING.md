# Vercel Deployment Troubleshooting

## Error: 500 INTERNAL_SERVER_ERROR - FUNCTION_INVOCATION_FAILED

### What Happened
The serverless function crashed during invocation. This is typically caused by:
1. Missing environment variables
2. Import/module errors
3. Unhandled exceptions
4. Missing dependencies

### Solutions Applied

#### 1. Fixed api/index.js
- Improved error handling
- Added proper middleware configuration
- Added root endpoint `/`
- Better error logging

#### 2. Updated vercel.json
- Added Node.js runtime specification
- Configured proper function settings
- Set memory and timeout limits

#### 3. Environment Variables
Ensure ALL these are set in Vercel project settings:
```
NODE_ENV=production
JWT_SECRET=your_secret
SUPABASE_URL=your_url
SUPABASE_ANON_KEY=your_key
SUPABASE_SERVICE_ROLE_KEY=your_key
SQUADCO_API_KEY=your_key
SQUADCO_PUBLIC_KEY=your_key
SQUADCO_API_URL=https://api.squadco.com
CORS_ORIGIN=https://yourdomain.com
API_VERSION=v1
```

### How to Fix

#### Step 1: Check Vercel Logs
```bash
vercel logs
```

Look for:
- Import errors
- Missing modules
- Environment variable errors
- Unhandled exceptions

#### Step 2: Verify Environment Variables
```bash
vercel env list
```

Ensure all required variables are set.

#### Step 3: Redeploy
```bash
vercel --prod
```

#### Step 4: Test Health Endpoint
```bash
curl https://your-domain.vercel.app/health
```

### Common Issues & Fixes

#### Issue: "Cannot find module"
**Cause:** Missing dependency or incorrect import path
**Fix:**
```bash
npm install
npm run build
vercel --prod
```

#### Issue: "SUPABASE_URL is not defined"
**Cause:** Environment variable not set in Vercel
**Fix:**
1. Go to Vercel project settings
2. Add environment variable: `SUPABASE_URL`
3. Redeploy: `vercel --prod`

#### Issue: "CORS policy violation"
**Cause:** Frontend domain not in CORS_ORIGIN
**Fix:**
1. Update CORS_ORIGIN in Vercel settings
2. Include your frontend domain
3. Redeploy

#### Issue: "Cannot POST /api/v1/auth/login"
**Cause:** Routes not properly imported or configured
**Fix:**
1. Check all route files exist
2. Verify imports in api/index.js
3. Check route paths match

### Debugging Steps

#### 1. Test Locally First
```bash
npm run dev
npm run test:endpoints
```

#### 2. Check Build Output
```bash
vercel build
```

#### 3. View Detailed Logs
```bash
vercel logs --follow
```

#### 4. Test Individual Endpoints
```bash
# Health check
curl https://your-domain.vercel.app/health

# Root endpoint
curl https://your-domain.vercel.app/

# Debug endpoint (dev only)
curl https://your-domain.vercel.app/debug/env
```

### Vercel.json Configuration

The updated `vercel.json` includes:
```json
{
  "version": 2,
  "buildCommand": "npm run build",
  "functions": {
    "api/index.js": {
      "memory": 1024,
      "maxDuration": 30,
      "runtime": "nodejs18.x"
    }
  },
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/api/index.js"
    },
    {
      "src": "/health",
      "dest": "/api/index.js"
    },
    {
      "src": "/(.*)",
      "dest": "/api/index.js"
    }
  ]
}
```

### API Index.js Updates

Key improvements:
- Better CORS configuration
- Proper middleware ordering
- Root endpoint added
- Enhanced error handling
- Better logging
- Increased payload limits

### Next Steps

1. **Verify all environment variables are set**
   ```bash
   vercel env list
   ```

2. **Redeploy**
   ```bash
   vercel --prod
   ```

3. **Test endpoints**
   ```bash
   curl https://your-domain.vercel.app/health
   npm run test:endpoints
   ```

4. **Check logs if still failing**
   ```bash
   vercel logs
   ```

### Still Having Issues?

1. Check Vercel logs: `vercel logs`
2. Verify all dependencies: `npm install`
3. Test locally: `npm run dev`
4. Check environment variables: `vercel env list`
5. Review error messages carefully
6. Try rollback: `vercel rollback`

### Support

- [Vercel Documentation](https://vercel.com/docs)
- [Node.js on Vercel](https://vercel.com/docs/functions/serverless-functions/node-js)
- [Vercel Support](https://vercel.com/support)
