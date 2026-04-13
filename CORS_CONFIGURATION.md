# CORS Configuration Guide

## ✅ What Was Configured

Your backend now has **proper CORS configuration** to allow requests from the deployed frontend on Vercel.

### Files Updated:
1. **server.js** - Local development server
2. **api/index.js** - Vercel serverless function
3. **.env** - Environment variables with frontend URL
4. **.env.example** - Template for reference

---

## 🔐 CORS Settings

### Allowed Origins
```
http://localhost:5173      # Local development (React)
http://localhost:5174      # Local development (alternative)
https://tiketa-alpha.vercel.app  # Production frontend
```

### Allowed Methods
```
GET, POST, PUT, DELETE, PATCH, OPTIONS
```

### Allowed Headers
```
Content-Type
Authorization
X-Requested-With
```

### Credentials
```
✅ Enabled (credentials: true)
```

### Max Age
```
86400 seconds (24 hours)
```

---

## 📋 Configuration Details

### CORS Middleware Features:

1. **Origin Validation**
   - Exact match for specified origins
   - Wildcard matching for localhost
   - Rejects unknown origins

2. **Detailed Logging**
   - Logs incoming origin
   - Shows if origin is allowed/rejected
   - Helps with debugging

3. **Security**
   - No wildcard `*` in production
   - Credentials enabled for authentication
   - Proper header validation

4. **Error Handling**
   - Graceful rejection of invalid origins
   - Clear error messages
   - Logged for monitoring

---

## 🚀 Deployment Steps

### Step 1: Verify Environment Variables

Check that `.env` has the correct frontend URL:

```bash
cat .env | grep CORS_ORIGIN
```

Should show:
```
CORS_ORIGIN=http://localhost:5173,http://localhost:5174,https://tiketa-alpha.vercel.app
```

### Step 2: Commit Changes

```bash
git add .
git commit -m "Add proper CORS configuration for Vercel frontend"
git push origin main
```

### Step 3: Deploy to Vercel

```bash
vercel --prod
```

Or push to GitHub and Vercel will auto-deploy.

### Step 4: Verify Deployment

Check Vercel logs:
```bash
vercel logs
```

Look for:
```
🔐 CORS Configuration (Vercel):
   Allowed Origins: [...]
```

---

## 🧪 Testing CORS

### Test from Frontend

```javascript
// This should now work without CORS errors
const response = await fetch('https://tiketa-alpha.vercel.app/api/v1/events', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  }
});
```

### Test with cURL

```bash
# Test from localhost
curl -H "Origin: http://localhost:5173" \
  https://tiketa-alpha.vercel.app/api/v1/events

# Test from production
curl -H "Origin: https://tiketa-alpha.vercel.app" \
  https://tiketa-alpha.vercel.app/api/v1/events
```

### Check CORS Headers

```bash
curl -i -H "Origin: https://tiketa-alpha.vercel.app" \
  https://tiketa-alpha.vercel.app/api/v1/events
```

Look for:
```
Access-Control-Allow-Origin: https://tiketa-alpha.vercel.app
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS
```

---

## 🔍 Debugging CORS Issues

### Check Vercel Logs

```bash
vercel logs --follow
```

Look for:
```
🔍 CORS: Incoming origin: https://tiketa-alpha.vercel.app
✅ CORS: Origin allowed: https://tiketa-alpha.vercel.app
```

### Common Issues

**Issue: "CORS policy violation"**
- Check if frontend URL is in CORS_ORIGIN
- Verify exact URL match (https vs http, www, etc.)
- Check Vercel logs for incoming origin

**Issue: "Failed to fetch"**
- Check browser console for CORS error
- Verify backend is running
- Check network tab for response headers

**Issue: Preflight request fails**
- Ensure OPTIONS method is allowed
- Check allowed headers match request headers
- Verify credentials setting

---

## 📝 Environment Variables

### Local Development (.env)
```
CORS_ORIGIN=http://localhost:5173,http://localhost:5174,https://tiketa-alpha.vercel.app
```

### Production (Vercel Settings)
```
CORS_ORIGIN=https://tiketa-alpha.vercel.app,https://www.tiketa-alpha.vercel.app
```

### Adding New Frontend URLs

If you add a new frontend URL:

1. Update `.env` locally:
```
CORS_ORIGIN=http://localhost:5173,http://localhost:5174,https://tiketa-alpha.vercel.app,https://new-frontend.vercel.app
```

2. Update Vercel environment variables:
   - Go to Vercel project settings
   - Update CORS_ORIGIN variable
   - Redeploy

3. Commit and push:
```bash
git add .env
git commit -m "Add new frontend URL to CORS"
git push origin main
```

---

## ✨ Features

### ✅ Secure
- No wildcard origins in production
- Credentials properly configured
- Origin validation on every request

### ✅ Flexible
- Easy to add new frontend URLs
- Supports multiple environments
- Localhost development support

### ✅ Debuggable
- Detailed logging of CORS decisions
- Clear error messages
- Easy to troubleshoot

### ✅ Performant
- 24-hour max age for preflight
- Efficient origin matching
- Minimal overhead

---

## 🎯 What Works Now

✅ Frontend can call backend APIs
✅ Authentication tokens work
✅ Payment processing works
✅ Wallet operations work
✅ Admin dashboard works
✅ No more CORS errors

---

## 📞 Support

### If CORS Still Fails:

1. **Check logs:**
   ```bash
   vercel logs
   ```

2. **Verify frontend URL:**
   - Check exact URL in browser
   - Compare with CORS_ORIGIN in .env

3. **Check network tab:**
   - Look for Access-Control-Allow-Origin header
   - Check response status

4. **Test with cURL:**
   ```bash
   curl -H "Origin: https://tiketa-alpha.vercel.app" \
     https://tiketa-alpha.vercel.app/api/v1/events
   ```

---

## 📚 Related Documentation

- **FRONTEND_INTEGRATION_GUIDE.md** - How to use the API
- **VERCEL_DEPLOYMENT.md** - Deployment guide
- **API_ENDPOINTS.md** - API reference

---

**Last Updated:** April 13, 2026
**Status:** ✅ CORS Configured & Ready
**Frontend URL:** https://tiketa-alpha.vercel.app
