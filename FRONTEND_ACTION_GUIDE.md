# Frontend Action Guide - Fix Supabase Authentication

## 🎯 Current Issue

Frontend is showing error:
```
Failed to load resource: net::ERR_NAME_NOT_RESOLVED
your-project.supabase.co/auth/v1/token?grant_type=password
```

**Root Cause:** Frontend is using placeholder Supabase URL instead of actual credentials.

---

## ✅ What You Need to Do

### Step 1: Locate Supabase Configuration File

In your frontend repository, find the file that initializes Supabase. Common locations:
- `src/lib/supabaseClient.js`
- `src/utils/supabase.js`
- `src/config/supabase.js`
- `src/supabase.js`

Search for: `your-project.supabase.co` or `createClient`

### Step 2: Update Supabase Configuration

**Current (Wrong):**
```javascript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'your-project.supabase.co'  // ❌ PLACEHOLDER
const supabaseAnonKey = 'your-anon-key'  // ❌ PLACEHOLDER

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

**Updated (Correct):**
```javascript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://eouaddaofaevwkqnsmdw.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvdWFkZGFvZmFldndrcW5zbWR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0ODEyODMsImV4cCI6MjA4OTA1NzI4M30.hMTuQp8jvzFfxF1PnJHMb0_UKWoJdEmOUwy9aH08Hdc'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

### Step 3: (Recommended) Use Environment Variables

Create `.env.local` in your frontend root:

```env
VITE_SUPABASE_URL=https://eouaddaofaevwkqnsmdw.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvdWFkZGFvZmFldndrcW5zbWR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0ODEyODMsImV4cCI6MjA4OTA1NzI4M30.hMTuQp8jvzFfxF1PnJHMb0_UKWoJdEmOUwy9aH08Hdc
```

Then update your Supabase config file:

```javascript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

### Step 4: For Vercel Deployment

1. Go to your Vercel project: https://vercel.com/dashboard
2. Click on your project (tiketa-alpha)
3. Go to **Settings** → **Environment Variables**
4. Add these two variables:

| Key | Value |
|-----|-------|
| `VITE_SUPABASE_URL` | `https://eouaddaofaevwkqnsmdw.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvdWFkZGFvZmFldndrcW5zbWR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0ODEyODMsImV4cCI6MjA4OTA1NzI4M30.hMTuQp8jvzFfxF1PnJHMb0_UKWoJdEmOUwy9aH08Hdc` |

5. Click **Save**
6. Go to **Deployments** and click **Redeploy** on the latest deployment

### Step 5: Test Locally

1. Stop your frontend dev server (if running)
2. Update the Supabase config file with actual credentials
3. Create `.env.local` with the environment variables
4. Restart dev server: `npm run dev` or `yarn dev`
5. Clear browser cache (Ctrl+Shift+Delete or Cmd+Shift+Delete)
6. Refresh page
7. Try login with:
   - Email: `admin@ticketa.com`
   - Password: (your password)

---

## 🔐 Credentials Reference

| Item | Value |
|------|-------|
| **Supabase URL** | `https://eouaddaofaevwkqnsmdw.supabase.co` |
| **Anon Key** | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvdWFkZGFvZmFldndrcW5zbWR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0ODEyODMsImV4cCI6MjA4OTA1NzI4M30.hMTuQp8jvzFfxF1PnJHMb0_UKWoJdEmOUwy9aH08Hdc` |
| **Project ID** | `eouaddaofaevwkqnsmdw` |

---

## 🧪 Verification Checklist

- [ ] Found Supabase config file in frontend
- [ ] Updated URL from `your-project.supabase.co` to `https://eouaddaofaevwkqnsmdw.supabase.co`
- [ ] Updated Anon Key from placeholder to actual key
- [ ] Created `.env.local` with environment variables (optional but recommended)
- [ ] Restarted frontend dev server
- [ ] Cleared browser cache
- [ ] Tested login - no more `ERR_NAME_NOT_RESOLVED` error
- [ ] Added environment variables to Vercel
- [ ] Redeployed on Vercel
- [ ] Tested login on Vercel deployment

---

## 🚀 Backend Status

✅ **Backend is ready:**
- Deployed to: `https://tiketa-alpha.vercel.app/api/v1`
- CORS configured for frontend
- All environment variables set
- All endpoints working

**You only need to update the frontend!**

---

## 📞 Need Help?

If you still see errors after updating:

1. **Check browser console** for exact error message
2. **Verify credentials** are copied exactly (no extra spaces)
3. **Clear cache** completely (Ctrl+Shift+Delete)
4. **Check .env.local** is in frontend root directory
5. **Restart dev server** after creating .env.local
6. **Check Vercel environment variables** are set correctly

---

## 🔗 Backend API Endpoints

All endpoints are available at: `https://tiketa-alpha.vercel.app/api/v1`

See `FRONTEND_INTEGRATION_GUIDE.md` for complete endpoint documentation.

---

**Status:** Ready for frontend update
**Action Required:** Update frontend Supabase credentials
**Expected Result:** Login will work without errors ✅

