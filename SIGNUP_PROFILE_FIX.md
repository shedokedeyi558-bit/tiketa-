# Signup Profile Creation Fix

## ✅ Status: DEPLOYED

**Commit:** `1fc5346`
**Branch:** `main`

---

## The Problem

New organizer signups were not creating a row in the `users` table, causing foreign key errors when trying to create events.

**Error:** `insert or update on table "events" violates foreign key constraint "events_organizer_id_fkey"`

---

## The Root Cause

The Supabase trigger `handle_new_user` was supposed to automatically create a user record when someone signed up, but it wasn't working reliably. The signup was succeeding, but no user profile was being created in the database.

---

## The Fix

### What Changed

**File:** `controllers/authController.js`

#### Before ❌
```javascript
// Using regular supabase client (subject to RLS)
const { data: userProfile, error: profileError } = await supabase
  .from('users')
  .insert([{
    id: authData.user.id,
    email,
    role,
    full_name: fullName || '',
  }]);
```

#### After ✅
```javascript
// Using supabaseAdmin client with service role (bypasses RLS)
const { data: userProfile, error: profileError } = await supabaseAdmin
  .from('users')
  .upsert({
    id: authData.user.id,
    email,
    role,
    full_name: fullName || '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' })
  .select()
  .single();
```

### Key Changes

1. **Import supabaseAdmin client** with service role key
   ```javascript
   const supabaseAdmin = createClient(
     process.env.SUPABASE_URL,
     process.env.SUPABASE_SERVICE_ROLE_KEY
   );
   ```

2. **Use `.upsert()` instead of `.insert()`**
   - Upsert creates if doesn't exist, updates if it does
   - Handles conflicts gracefully
   - No need to check for duplicate key errors

3. **Use supabaseAdmin instead of supabase**
   - Bypasses Row Level Security (RLS)
   - Ensures the operation succeeds
   - Service role has full database access

---

## How It Works Now

### Signup Flow

```
1. User submits signup form
   ↓
2. Supabase Auth creates auth user
   ↓
3. Backend uses supabaseAdmin to upsert user profile
   ├─ If profile doesn't exist → CREATE
   └─ If profile exists → UPDATE
   ↓
4. If organizer role → Create wallet
   ↓
5. Signup complete
   ├─ User record exists in users table ✅
   ├─ Wallet exists (if organizer) ✅
   └─ User can create events ✅
```

### Event Creation Flow

```
1. User creates event
   ↓
2. Backend gets organizer_id from req.user.id
   ↓
3. Backend verifies user record exists
   ├─ If exists → Use it
   └─ If missing → Create it (backup)
   ↓
4. Backend verifies wallet exists
   ├─ If exists → Use it
   └─ If missing → Create it (backup)
   ↓
5. Event created with organizer_id ✅
```

---

## Why This Works

### Service Role Key
- Has full database access
- Bypasses Row Level Security (RLS)
- Can write to any table
- Perfect for backend operations

### Upsert Operation
- Creates record if it doesn't exist
- Updates record if it does exist
- No duplicate key errors
- Idempotent (safe to call multiple times)

### Backup Logic in Event Creation
- If user record is missing when creating event
- Backend automatically creates it
- Double safety net

---

## Testing

### Test Case 1: Organizer Signup ✅
```bash
POST /api/v1/auth/signup
{
  "email": "organizer@example.com",
  "password": "SecurePassword123!",
  "fullName": "John Organizer",
  "role": "organizer"
}
```

**Expected:**
- ✅ Auth user created
- ✅ User profile created in users table
- ✅ Wallet created
- ✅ Response: 201 Created

### Test Case 2: Event Creation After Signup ✅
```bash
# After signup and login
POST /api/v1/events
Authorization: Bearer <token>
{
  "title": "Wet pool",
  "description": "Fun water event",
  "date": "2026-05-15",
  "location": "Lagos",
  "total_tickets": 100
}
```

**Expected:**
- ✅ Event created successfully
- ✅ Response: 201 Created
- ❌ NO foreign key error

### Test Case 3: Verify User Record Exists
```sql
SELECT * FROM users WHERE email = 'organizer@example.com';
```

**Expected:**
- ✅ One row returned
- ✅ role = 'organizer'
- ✅ full_name = 'John Organizer'

### Test Case 4: Verify Wallet Exists
```sql
SELECT * FROM wallets WHERE organizer_id = '<user_id>';
```

**Expected:**
- ✅ One row returned
- ✅ available_balance = 0.00
- ✅ total_earned = 0.00

---

## Verification

### Check if fix is working

```bash
# 1. Signup as organizer
curl -X POST http://localhost:5001/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Password123!",
    "fullName": "Test User",
    "role": "organizer"
  }'

# 2. Check user record was created
SELECT * FROM users WHERE email = 'test@example.com';

# 3. Check wallet was created
SELECT * FROM wallets WHERE organizer_id = '<user_id>';

# 4. Login and create event
curl -X POST http://localhost:5001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Password123!"
  }'

# 5. Create event with token
curl -X POST http://localhost:5001/api/v1/events \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Event",
    "date": "2026-05-15",
    "location": "Lagos",
    "total_tickets": 100
  }'

# Should return 201 Created, NOT foreign key error
```

---

## Files Modified

1. ✅ `controllers/authController.js`
   - Import supabaseAdmin client
   - Use upsert() with service role
   - Guaranteed profile creation

---

## Summary

### What Was Fixed
✅ User profile now created on signup using service role
✅ Upsert ensures no duplicate key errors
✅ Bypasses RLS for reliable creation
✅ Backup logic in event creation as safety net

### Result
✅ Every organizer signup creates a user record
✅ Every organizer gets a wallet
✅ No more foreign key errors when creating events
✅ Event creation works immediately after signup

### Key Principle
**Use service role (supabaseAdmin) for backend operations that must succeed, bypass RLS when needed**

---

**Status:** ✅ **READY FOR PRODUCTION**
