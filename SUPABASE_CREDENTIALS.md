# Supabase Credentials - Frontend Configuration

## 🔑 Your Supabase Project Credentials

### Supabase URL
```
https://eouaddaofaevwkqnsmdw.supabase.co
```

### Supabase Anon Key (Public - Safe for Frontend)
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvdWFkZGFvZmFldndrcW5zbWR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0ODEyODMsImV4cCI6MjA4OTA1NzI4M30.hMTuQp8jvzFfxF1PnJHMb0_UKWoJdEmOUwy9aH08Hdc
```

### Project ID
```
eouaddaofaevwkqnsmdw
```

---

## 📝 Frontend .env Configuration

Create `.env` file in your frontend project:

```env
VITE_SUPABASE_URL=https://eouaddaofaevwkqnsmdw.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvdWFkZGFvZmFldndrcW5zbWR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0ODEyODMsImV4cCI6MjA4OTA1NzI4M30.hMTuQp8jvzFfxF1PnJHMb0_UKWoJdEmOUwy9aH08Hdc
```

---

## 💻 Frontend Code Example

### React/Vite

```javascript
// supabaseClient.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

### Vue

```javascript
// supabase.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

### Next.js

```javascript
// lib/supabase.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

For Next.js, use `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://eouaddaofaevwkqnsmdw.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvdWFkZGFvZmFldndrcW5zbWR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0ODEyODMsImV4cCI6MjA4OTA1NzI4M30.hMTuQp8jvzFfxF1PnJHMb0_UKWoJdEmOUwy9aH08Hdc
```

---

## 🌐 Vercel Environment Variables

Add to Vercel project settings:

1. Go to: https://vercel.com/dashboard
2. Select your project
3. Settings → Environment Variables
4. Add:

| Key | Value |
|-----|-------|
| `VITE_SUPABASE_URL` | `https://eouaddaofaevwkqnsmdw.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvdWFkZGFvZmFldndrcW5zbWR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0ODEyODMsImV4cCI6MjA4OTA1NzI4M30.hMTuQp8jvzFfxF1PnJHMb0_UKWoJdEmOUwy9aH08Hdc` |

Then redeploy.

---

## ✅ Verify Configuration

Test in browser console:

```javascript
// Check if Supabase is configured
console.log(import.meta.env.VITE_SUPABASE_URL)
// Should output: https://eouaddaofaevwkqnsmdw.supabase.co

console.log(import.meta.env.VITE_SUPABASE_ANON_KEY)
// Should output: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 🧪 Test Login

After configuration:

1. Clear browser cache
2. Refresh page
3. Try login:
   - Email: `admin@ticketa.com`
   - Password: (your password)

Should work without `ERR_NAME_NOT_RESOLVED` error!

---

## 🔐 Security

✅ **Safe to expose in frontend:**
- Supabase URL
- Anon Key

❌ **NEVER expose in frontend:**
- Service Role Key
- JWT Secret
- API Keys

---

## 📞 Troubleshooting

### Still Getting ERR_NAME_NOT_RESOLVED?

1. Check `.env` file exists
2. Verify exact URL (no typos)
3. Restart dev server
4. Clear browser cache
5. Check browser console for actual URL being used

### Login Still Failing?

1. Verify Supabase URL is correct
2. Verify Anon Key is correct
3. Check Supabase project is active
4. Check user exists in Supabase
5. Check backend CORS allows frontend

---

## 📋 Quick Copy-Paste

### For Vite/React

```javascript
// supabaseClient.js
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  'https://eouaddaofaevwkqnsmdw.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvdWFkZGFvZmFldndrcW5zbWR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0ODEyODMsImV4cCI6MjA4OTA1NzI4M30.hMTuQp8jvzFfxF1PnJHMb0_UKWoJdEmOUwy9aH08Hdc'
)
```

### For .env

```env
VITE_SUPABASE_URL=https://eouaddaofaevwkqnsmdw.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvdWFkZGFvZmFldndrcW5zbWR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0ODEyODMsImV4cCI6MjA4OTA1NzI4M30.hMTuQp8jvzFfxF1PnJHMb0_UKWoJdEmOUwy9aH08Hdc
```

---

**Status:** Ready to configure
**Action:** Update frontend with these credentials
**Result:** Login will work ✅
