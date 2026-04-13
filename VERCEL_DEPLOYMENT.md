# Vercel Deployment Guide

## Prerequisites
- Vercel account (https://vercel.com)
- Git repository (GitHub, GitLab, or Bitbucket)
- Node.js 18+ installed locally

## Step 1: Prepare Your Project

The project is already configured for Vercel with:
- `vercel.json` - Vercel configuration
- `api/index.js` - Serverless function entry point
- Updated `package.json` with build scripts

## Step 2: Set Up Environment Variables

### Local Testing
Create a `.env.local` file for local testing:
```
PORT=5001
NODE_ENV=development
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRE=7d
CORS_ORIGIN=http://localhost:5173,http://localhost:5174
API_VERSION=v1

SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

SQUADCO_API_KEY=your_squadco_api_key
SQUADCO_PUBLIC_KEY=your_squadco_public_key
SQUADCO_API_URL=https://sandbox-api-d.squadco.com
```

### Vercel Environment Variables
1. Go to your Vercel project settings
2. Navigate to "Environment Variables"
3. Add the following variables:

**Production:**
```
NODE_ENV=production
JWT_SECRET=your_production_jwt_secret
CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com
API_VERSION=v1

SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

SQUADCO_API_KEY=your_production_squadco_api_key
SQUADCO_PUBLIC_KEY=your_production_squadco_public_key
SQUADCO_API_URL=https://api.squadco.com
```

**Preview/Staging:**
```
NODE_ENV=staging
CORS_ORIGIN=https://staging.yourdomain.com
(other variables same as production)
```

## Step 3: Deploy to Vercel

### Option A: Using Vercel CLI
```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy
vercel

# Deploy to production
vercel --prod
```

### Option B: Using Git Integration
1. Push your code to GitHub/GitLab/Bitbucket
2. Go to https://vercel.com/new
3. Import your repository
4. Select the project root
5. Add environment variables
6. Click "Deploy"

## Step 4: Verify Deployment

### Health Check
```bash
curl https://your-project.vercel.app/health
```

Expected response:
```json
{
  "status": "Server is running",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### API Endpoints
```bash
# Get all events
curl https://your-project.vercel.app/api/v1/events

# Health check
curl https://your-project.vercel.app/health
```

## Step 5: Run Tests

### Local Testing
```bash
# Install dependencies
npm install

# Run endpoint tests
npm run test:endpoints

# Run Jest tests
npm test

# Run tests in watch mode
npm run test:watch
```

### Testing Against Deployed API
```bash
TEST_URL=https://your-project.vercel.app npm run test:endpoints
```

## Troubleshooting

### 1. Environment Variables Not Loading
- Verify variables are set in Vercel project settings
- Check that variable names match exactly (case-sensitive)
- Redeploy after adding/changing variables

### 2. CORS Errors
- Update `CORS_ORIGIN` in environment variables
- Include your frontend domain
- Separate multiple domains with commas

### 3. Database Connection Issues
- Verify Supabase credentials are correct
- Check that Supabase project is active
- Ensure IP whitelist allows Vercel IPs (usually automatic)

### 4. Payment Gateway Issues
- Verify Squadco API keys are correct
- Check that you're using correct API URL (sandbox vs production)
- Ensure API keys have correct permissions

### 5. Function Timeout
- Default timeout is 30 seconds
- For longer operations, increase in `vercel.json`
- Consider using background jobs for heavy operations

## Monitoring

### Vercel Dashboard
- View logs: Project → Deployments → Select deployment → Logs
- Monitor performance: Project → Analytics
- Check errors: Project → Monitoring

### Health Monitoring
Set up a monitoring service to ping `/health` endpoint regularly:
```bash
# Example with curl
curl -f https://your-project.vercel.app/health || alert
```

## Rollback

If deployment has issues:
```bash
# View deployment history
vercel list

# Rollback to previous deployment
vercel rollback
```

## Production Checklist

- [ ] All environment variables set in Vercel
- [ ] CORS origins configured correctly
- [ ] Database credentials verified
- [ ] Payment gateway keys updated for production
- [ ] SSL certificate active (automatic with Vercel)
- [ ] Health check endpoint responding
- [ ] All API endpoints tested
- [ ] Error handling working correctly
- [ ] Logging configured
- [ ] Rate limiting enabled
- [ ] Security headers configured

## Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Node.js on Vercel](https://vercel.com/docs/functions/serverless-functions/node-js)
- [Environment Variables](https://vercel.com/docs/projects/environment-variables)
- [Deployment Monitoring](https://vercel.com/docs/monitoring)
