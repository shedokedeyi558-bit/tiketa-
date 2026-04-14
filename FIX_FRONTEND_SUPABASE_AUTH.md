# Fix Frontend Supabase Authentication Error

## 🔴 Error You're Seeing

```
Failed to load resource: net::ERR_NAME_NOT_RESOLVED
your-project.supabase.co/auth/v1/token?grant_type=password

TypeError: Failed to fetch
```

---

## 🎯 Root Cause

Your frontend is using **placeholder Supabase credentials** instead of your **actual credentials**.

**Placeholder (Wrong):**
```
your-project.supabase.co
your-anon-key
```

**Actual (Correct):**
```
https://eouaddaofaevwkqnsmdw.supabase.co
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvdWFkZGFvZmFldndrcW5zbWR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0ODEyODMsImV4cCI6MjA4OTA1NzI4M30.hMTuQp8jvzFfxF1PnJHMb0_UKWoJdEmOUwy9aH08Hdc
```

---

## ✅ How to Fix

### Step 1: Find Supabase Configuration File

Search your frontend project for:
- `supabaseClient.js`
- `supabase.js`
- `lib/supabase.js`
- `utils/supabase.js`

Or search for: `your-project.supabase.co`

### Step 2: Update the File

**Before (Wrong):**
```javascript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'your-project.supabase.co'
const supabaseAnonKey = 'your-anon-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

**After (Correct):**
```javascript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://eouaddaofaevwkqnsmdw.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvdWFkZGFvZmFldndrcW5zbWR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0ODEyODMsImV4cCI6MjA4OTA1NzI4M30.hMTuQp8jvzFfxF1PnJHMb0_UKWoJdEmOUwy9aH08Hdc'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

### Step 3: Use Environment Variables (Recommended)

Create `.env` file in frontend root:

```env
VITE_SUPABASE_URL=https://eouaddaofaevwkqnsmdw.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvdWFkZGFvZmFldndrcW5zbWR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0ODEyODMsImV4cCI6MjA4OTA1NzI4M30.hMTuQp8jvzFfxF1PnJHMb0_UKWoJdEmOUwy9aH08Hdc
```

Update code:

```javascript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

### Step 4: Restart Dev Server

```bash
# Stop current server (Ctrl+C)
# Then restart
npm run dev
```

### Step 5: Clear Browser Cache

1. Open DevTools (F12)
2. Right-click refresh button
3. Select "Empty cache and hard refresh"

### Step 6: Test Login

Try logging in with:
- Email: `admin@ticketa.com`
- Password: (your password)

Should work now! ✅

---

## 🌐 For Vercel Deployment

### Add Environment Variables to Vercel

1. Go to: https://vercel.com/dashboard
2. Select your project
3. Settings → Environment Variables
4. Add these variables:

| Key | Value |
|-----|-------|
| `VITE_SUPABASE_URL` | `https://eouaddaofaevwkqnsmdw.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvdWFkZGFvZmFldndrcW5zbWR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0ODEyODMsImV4cCI6MjA4OTA1NzI4M30.hMTuQp8jvzFfxF1PnJHMb0_UKWoJdEmOUwy9aH08Hdc` |

5. Click "Save"
6. Redeploy

---

## 📋 Your Credentials

### Supabase URL
```
https://eouaddaofaevwkqnsmdw.supabase.co
```

### Supabase Anon Key
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvdWFkZGFvZmFldndrcW5zbWR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0ODEyODMsImV4cCI6MjA4OTA1NzI4M30.hMTuQp8jvzFfxF1PnJHMb0_UKWoJdEmOUwy9aH08Hdc
```

### Project ID
```
eouaddaofaevwkqnsmdw
```

---

## 🔍 Verify Configuration

### In Browser Console

```javascript
// Check if environment variables are loaded
console.log(import.meta.env.VITE_SUPABASE_URL)
// Should output: https://eouaddaofaevwkqnsmdw.supabase.co

console.log(import.meta.env.VITE_SUPABASE_ANON_KEY)
// Should output: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Check Supabase Connection

```javascript
// In browser console
import { supabase } from './supabaseClient.js'
console.log(supabase.supabaseUrl)
// Should show: https://eouaddaofaevwkqnsmdw.supabase.co
```

---

## 🧪 Test Steps

1. **Update credentials** in frontend
2. **Create .env** file
3. **Restart dev server**
4. **Clear browser cache**
5. **Open DevTools** (F12)
6. **Go to Console tab**
7. **Try login**
8. **Check for errors**

---

## ✨ Expected Result

After fix:
- ✅ No `ERR_NAME_NOT_RESOLVED` error
- ✅ No `Failed to fetch` error
- ✅ Login works
- ✅ User authenticated
- ✅ Dashboard loads

---

## 🐛 Still Having Issues?

### Check 1: Verify URL Format
```
❌ Wrong: your-project.supabase.co
✅ Correct: https://eouaddaofaevwkqnsmdw.supabase.co
```

### Check 2: Verify .env File
```
❌ Wrong: SUPABASE_URL=...
✅ Correct: VITE_SUPABASE_URL=...
```

### Check 3: Restart Dev Server
```bash
# Stop (Ctrl+C)
# Restart
npm run dev
```

### Check 4: Clear Cache
- DevTools → Application → Clear Storage
- Or: Ctrl+Shift+Delete

### Check 5: Check Browser Console
- F12 → Console tab
- Look for any errors
- Check if env variables loaded

---

## 📞 Quick Reference

**File to Update:**
- Find: `supabaseClient.js` or similar

**What to Replace:**
- `your-project.supabase.co` → `https://eouaddaofaevwkqnsmdw.supabase.co`
- `your-anon-key` → `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

**Environment Variable Names:**
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

**Test Command:**
```bash
npm run dev
```

---

## 🎉 Success Indicators

✅ No console errors
✅ Login page loads
✅ Can enter credentials
✅ Login button works
✅ Dashboard appears
✅ No auth errors

---

**Status:** Ready to implement
**Time to fix:** 5 minutes
**Difficulty:** Easy
**Result:** Full authentication working ✅
