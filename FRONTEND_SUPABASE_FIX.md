# Fix Frontend Supabase Configuration

## 🔴 Problem

Frontend is getting error:
```
Failed to load resource: net::ERR_NAME_NOT_RESOLVED
your-project.supabase.co/auth/v1/token?grant_type=password
```

**Cause:** Frontend is using placeholder Supabase URL instead of actual URL.

---

## ✅ Solution

### Your Actual Supabase Credentials

**Supabase URL:**
```
https://eouaddaofaevwkqnsmdw.supabase.co
```

**Supabase Anon Key:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvdWFkZGFvZmFldndrcW5zbWR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0ODEyODMsImV4cCI6MjA4OTA1NzI4M30.hMTuQp8jvzFfxF1PnJHMb0_UKWoJdEmOUwy9aH08Hdc
```

---

## 🔧 Fix Steps

### Step 1: Find Supabase Configuration in Frontend

Look for a file that initializes Supabase (usually `supabaseClient.js` or `supabase.js`):

```javascript
// supabaseClient.js or similar
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'your-project.supabase.co'  // ❌ WRONG
const supabaseAnonKey = 'your-anon-key'  // ❌ WRONG

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

### Step 2: Update with Correct Credentials

Replace with actual credentials:

```javascript
// supabaseClient.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://eouaddaofaevwkqnsmdw.supabase.co'  // ✅ CORRECT
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvdWFkZGFvZmFldndrcW5zbWR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0ODEyODMsImV4cCI6MjA4OTA1NzI4M30.hMTuQp8jvzFfxF1PnJHMb0_UKWoJdEmOUwy9aH08Hdc'  // ✅ CORRECT

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

### Step 3: Use Environment Variables (Recommended)

Create `.env` in frontend:

```env
VITE_SUPABASE_URL=https://eouaddaofaevwkqnsmdw.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvdWFkZGFvZmFldndrcW5zbWR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0ODEyODMsImV4cCI6MjA4OTA1NzI4M30.hMTuQp8jvzFfxF1PnJHMb0_UKWoJdEmOUwy9aH08Hdc
```

Then use in code:

```javascript
// supabaseClient.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

### Step 4: For Vercel Deployment

Add environment variables in Vercel:

1. Go to Vercel project settings
2. Click "Environment Variables"
3. Add:
   - `VITE_SUPABASE_URL` = `https://eouaddaofaevwkqnsmdw.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvdWFkZGFvZmFldndrcW5zbWR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0ODEyODMsImV4cCI6MjA4OTA1NzI4M30.hMTuQp8jvzFfxF1PnJHMb0_UKWoJdEmOUwy9aH08Hdc`
4. Redeploy

---

## 🔍 Find Supabase Configuration in Your Frontend

### Common File Names
- `supabaseClient.js`
- `supabase.js`
- `lib/supabase.js`
- `utils/supabase.js`
- `config/supabase.js`

### Search for
```
your-project.supabase.co
```

or

```
createClient
```

---

## ✅ Verify Fix

After updating, test:

```javascript
// In browser console
import { supabase } from './supabaseClient.js'
console.log(supabase.supabaseUrl)
// Should show: https://eouaddaofaevwkqnsmdw.supabase.co
```

---

## 🧪 Test Login

1. Clear browser cache
2. Refresh page
3. Try login with:
   - Email: `admin@ticketa.com`
   - Password: (your password)

Should work without errors!

---

## 📋 Credentials Summary

| Item | Value |
|------|-------|
| **Supabase URL** | `https://eouaddaofaevwkqnsmdw.supabase.co` |
| **Anon Key** | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvdWFkZGFvZmFldndrcW5zbWR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0ODEyODMsImV4cCI6MjA4OTA1NzI4M30.hMTuQp8jvzFfxF1PnJHMb0_UKWoJdEmOUwy9aH08Hdc` |
| **Project ID** | `eouaddaofaevwkqnsmdw` |

---

## 🚀 After Fix

1. Update frontend Supabase config
2. Commit changes
3. Push to GitHub
4. Vercel auto-deploys
5. Test login
6. Should work! ✅

---

## 💡 Why This Happened

The frontend was initialized with placeholder values:
- `your-project.supabase.co` (placeholder)
- `your-anon-key` (placeholder)

These need to be replaced with actual values from your Supabase project.

---

## 🔐 Security Note

These are **public credentials** (anon key), so it's safe to use in frontend environment variables. The service role key should NEVER be exposed in frontend.

---

**Status:** Ready to fix
**Action:** Update frontend Supabase configuration
**Result:** Login will work ✅
