# CORS Configuration - Deployment Steps

## ✅ What's Ready

Your backend now has **proper CORS configuration** to allow the Vercel frontend to communicate with the API.

---

## 🚀 Deploy Now

### Step 1: Verify Configuration

```bash
# Check .env has the frontend URL
cat .env | grep CORS_ORIGIN
```

**Expected output:**
```
CORS_ORIGIN=http://localhost:5173,http://localhost:5174,https://tiketa-alpha.vercel.app
```

### Step 2: Commit Changes

```bash
git add .
git commit -m "Add CORS configuration for Vercel frontend"
git push origin main
```

### Step 3: Deploy to Vercel

**Option A: Auto-deploy (if connected to GitHub)**
- Push to main branch
- Vercel automatically deploys

**Option B: Manual deploy**
```bash
vercel --prod
```

### Step 4: Verify Deployment

```bash
# Check logs
vercel logs

# Look for:
# 🔐 CORS Configuration (Vercel):
#    Allowed Origins: [...]
```

---

## 🧪 Test CORS

### Test 1: Health Check
```bash
curl https://tiketa-alpha.vercel.app/health
```

**Expected:**
```json
{
  "status": "Server is running",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "environment": "production"
}
```

### Test 2: Get Events
```bash
curl https://tiketa-alpha.vercel.app/api/v1/events
```

### Test 3: CORS Headers
```bash
curl -i -H "Origin: https://tiketa-alpha.vercel.app" \
  https://tiketa-alpha.vercel.app/api/v1/events
```

**Look for:**
```
Access-Control-Allow-Origin: https://tiketa-alpha.vercel.app
Access-Control-Allow-Credentials: true
```

---

## 🎯 What's Configured

### ✅ Allowed Origins
- `http://localhost:5173` - Local dev
- `http://localhost:5174` - Local dev
- `https://tiketa-alpha.vercel.app` - Production

### ✅ Allowed Methods
- GET, POST, PUT, DELETE, PATCH, OPTIONS

### ✅ Allowed Headers
- Content-Type
- Authorization
- X-Requested-With

### ✅ Credentials
- Enabled (for authentication)

---

## 📋 Files Changed

1. **server.js**
   - Enhanced CORS middleware
   - Detailed logging
   - Origin validation

2. **api/index.js**
   - Same CORS configuration
   - For Vercel serverless

3. **.env**
   - Added frontend URL to CORS_ORIGIN

4. **.env.example**
   - Updated template

---

## ✨ Features

✅ **Secure** - No wildcard origins
✅ **Flexible** - Easy to add URLs
✅ **Debuggable** - Detailed logging
✅ **Production-ready** - Proper configuration

---

## 🔍 Debugging

### If CORS Still Fails:

1. **Check Vercel logs:**
   ```bash
   vercel logs --follow
   ```

2. **Look for:**
   ```
   🔍 CORS: Incoming origin: https://tiketa-alpha.vercel.app
   ✅ CORS: Origin allowed: https://tiketa-alpha.vercel.app
   ```

3. **Check browser console:**
   - Look for CORS error messages
   - Check Network tab for response headers

4. **Verify frontend URL:**
   - Exact match required
   - Check for https vs http
   - Check for www prefix

---

## 📞 Next Steps

1. ✅ Deploy to Vercel
2. ✅ Test CORS with cURL
3. ✅ Test from frontend
4. ✅ Check Vercel logs
5. ✅ Verify API calls work

---

## 🎉 Result

After deployment:
- ✅ Frontend can call backend APIs
- ✅ No more CORS errors
- ✅ Authentication works
- ✅ Payments work
- ✅ All endpoints accessible

---

**Ready to deploy? Run:**
```bash
git push origin main
# or
vercel --prod
```

---

**Last Updated:** April 13, 2026
**Status:** ✅ Ready for Deployment
