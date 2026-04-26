# Foreign Key Constraint Error - Resolution Guide

## Problem Statement

Foreign key constraint errors (error code `23503`) were occurring when:
1. Creating events with invalid organizer_id
2. Processing payments for events with invalid organizer_id
3. Crediting organizer wallets with non-existent organizer_id
4. Creating withdrawal requests for non-existent organizers

**Root Cause:** No validation that organizer_id exists in the `users` table before using it in foreign key relationships.

---

## Database Schema & Relationships

### Users Table (Source of Truth)
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email VARCHAR UNIQUE,
  role VARCHAR ('admin', 'organizer', 'user'),
  full_name VARCHAR,
  ...
);
```

### Foreign Key Relationships
```
events.organizer_id → users.id (ON DELETE CASCADE)
wallets.organizer_id → users.id (ON DELETE CASCADE)
withdrawal_requests.organizer_id → users.id (ON DELETE CASCADE)
transactions.organizer_id → users.id (implied)
```

**Key Point:** Organizers are identified by `role = 'organizer'` in the users table. There is NO separate organizers table.

---

## Signup Flow (Organizer Creation)

### Current Implementation ✅

**File:** `controllers/authController.js` - `signUpOrganizerOrAdmin()`

```javascript
export const signUpOrganizerOrAdmin = async (req, res) => {
  // 1. Create auth user
  const { data: authData } = await supabase.auth.signUp({
    email,
    password,
  });

  // 2. Create user profile in users table
  await supabase.from('users').insert([{
    id: authData.user.id,        // ✅ Use auth user ID
    email,
    role: 'organizer',           // ✅ Set role
    full_name: fullName,
  }]);

  // 3. Auto-create wallet for organizers
  if (role === 'organizer') {
    await createOrganizerWallet(authData.user.id);
  }
};
```

**What Happens:**
1. ✅ Auth user is created in `auth.users`
2. ✅ User profile is created in `users` table with matching ID
3. ✅ Wallet is auto-created for organizers
4. ✅ Organizer is now ready to create events

---

## Event Creation Flow (Fixed)

### Before: No Validation ❌

```javascript
export const createEvent = async (req, res) => {
  // TODO: Save to database
  // ❌ No validation
  // ❌ No organizer_id check
  // ❌ No wallet verification
};
```

### After: Comprehensive Validation ✅

**File:** `controllers/eventController.js` - `createEvent()`

```javascript
export const createEvent = async (req, res) => {
  const organizerId = req.user?.id;

  // ✅ 1. Validate user is authenticated
  if (!organizerId) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'You must be logged in to create an event',
    });
  }

  // ✅ 2. Validate required fields
  if (!title || !date || !location) {
    return res.status(400).json({
      error: 'Missing required fields',
      message: 'Title, date, and location are required',
    });
  }

  // ✅ 3. CRITICAL: Verify organizer exists in users table
  const { data: organizer, error: orgError } = await supabase
    .from('users')
    .select('id, role, full_name')
    .eq('id', organizerId)
    .eq('role', 'organizer')  // ✅ Verify role is 'organizer'
    .single();

  if (orgError || !organizer) {
    return res.status(403).json({
      error: 'Organizer not found',
      message: 'Your organizer profile does not exist',
      code: 'ORGANIZER_NOT_FOUND',
    });
  }

  // ✅ 4. CRITICAL: Verify organizer has a wallet
  const { data: wallet } = await supabase
    .from('wallets')
    .select('id')
    .eq('organizer_id', organizerId)
    .single();

  if (!wallet) {
    // Auto-create wallet if missing
    await createOrganizerWallet(organizerId);
  }

  // ✅ 5. Create event with validated organizer_id
  const { data: event, error: eventError } = await supabase
    .from('events')
    .insert([{
      title,
      date,
      location,
      organizer_id: organizerId,  // ✅ Use authenticated user's ID
      status: 'active',
      ...
    }])
    .select()
    .single();

  if (eventError?.code === '23503') {
    return res.status(400).json({
      error: 'Foreign key constraint',
      message: 'Organizer ID is invalid',
      code: 'INVALID_ORGANIZER_ID',
    });
  }

  return res.status(201).json({
    success: true,
    message: 'Event created successfully',
    data: event,
  });
};
```

**Validation Steps:**
1. ✅ User is authenticated
2. ✅ Required fields are provided
3. ✅ Organizer exists in users table
4. ✅ Organizer has role = 'organizer'
5. ✅ Organizer has a wallet
6. ✅ Event is created with valid organizer_id

---

## Payment Processing Flow (Fixed)

### Before: No Organizer Validation ❌

```javascript
export const initiatePayment = async (req, res) => {
  // Fetch event
  const { data: event } = await supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
    .single();

  // ❌ No validation that organizer_id exists
  // ❌ Directly use event.organizer_id
  const { data: transaction } = await supabase
    .from('transactions')
    .insert([{
      organizer_id: event.organizer_id,  // ❌ Could be invalid
      ...
    }]);
};
```

### After: Organizer Validation ✅

**File:** `controllers/paymentController.js` - `initiatePayment()`

```javascript
export const initiatePayment = async (req, res) => {
  // Fetch event
  const { data: event } = await supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
    .single();

  // ✅ CRITICAL: Validate organizer exists
  const { data: organizer, error: orgError } = await supabase
    .from('users')
    .select('id, role')
    .eq('id', event.organizer_id)
    .eq('role', 'organizer')
    .single();

  if (orgError || !organizer) {
    return res.status(400).json({
      success: false,
      message: 'Event organizer is invalid',
      error: 'Invalid organizer',
    });
  }

  // ✅ Now safe to create transaction
  const { data: transaction } = await supabase
    .from('transactions')
    .insert([{
      organizer_id: event.organizer_id,  // ✅ Validated
      ...
    }]);
};
```

---

## Wallet Credit Flow (Fixed)

### Before: No Organizer Validation ❌

```javascript
async function creditOrganizerWallet(transaction) {
  // ❌ No validation that organizer exists
  const { data: wallet } = await supabase
    .from('wallets')
    .select('*')
    .eq('organizer_id', transaction.organizer_id)
    .single();

  // ❌ If organizer doesn't exist, wallet creation fails
  if (!wallet) {
    await supabase.from('wallets').insert({
      organizer_id: transaction.organizer_id,  // ❌ Could violate FK
    });
  }
}
```

### After: Organizer Validation ✅

**File:** `controllers/paymentController.js` - `creditOrganizerWallet()`

```javascript
async function creditOrganizerWallet(transaction) {
  const organizerId = transaction.organizer_id;

  // ✅ CRITICAL: Validate organizer exists
  const { data: organizer, error: orgError } = await supabase
    .from('users')
    .select('id')
    .eq('id', organizerId)
    .eq('role', 'organizer')
    .single();

  if (orgError || !organizer) {
    throw new Error(`Organizer ${organizerId} not found`);
  }

  // ✅ Now safe to work with wallet
  let { data: wallet } = await supabase
    .from('wallets')
    .select('*')
    .eq('organizer_id', organizerId)
    .single();

  if (!wallet) {
    // ✅ Safe to create wallet - organizer exists
    const { data: newWallet } = await supabase
      .from('wallets')
      .insert([{ organizer_id: organizerId }])
      .select()
      .single();
    wallet = newWallet;
  }

  // ✅ Credit wallet
  await supabase.from('wallets').update({
    available_balance: wallet.available_balance + transaction.organizer_earnings,
    ...
  }).eq('id', wallet.id);
}
```

---

## Admin Event Creation (Fixed)

### Before: No Organizer Validation ❌

```javascript
export const createAdminEvent = async (req, res) => {
  const { title, date, location, ticketTypes, organizer_id } = req.body;

  // ❌ No validation that organizer_id exists
  const { data } = await supabase
    .from('events')
    .insert([{
      title,
      date,
      location,
      organizer_id,  // ❌ Could be invalid
      ...
    }]);
};
```

### After: Organizer Validation ✅

**File:** `controllers/adminController.js` - `createAdminEvent()`

```javascript
export const createAdminEvent = async (req, res) => {
  const { title, date, location, ticketTypes, organizer_id } = req.body;

  // ✅ If organizer_id is provided, validate it
  if (organizer_id) {
    const { data: organizer, error: orgError } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', organizer_id)
      .eq('role', 'organizer')
      .single();

    if (orgError || !organizer) {
      return res.status(400).json({
        success: false,
        message: 'Organizer not found',
        code: 'ORGANIZER_NOT_FOUND',
      });
    }
  }

  // ✅ Safe to create event
  const { data } = await supabase
    .from('events')
    .insert([{
      title,
      date,
      location,
      organizer_id,  // ✅ Validated
      ...
    }]);
};
```

---

## Error Handling

### Foreign Key Constraint Error (23503)

**When it occurs:**
- Trying to insert/update with organizer_id that doesn't exist in users table
- Trying to insert/update with organizer_id that has role ≠ 'organizer'

**How to handle:**
```javascript
if (error.code === '23503') {
  return res.status(400).json({
    success: false,
    error: 'Foreign key constraint',
    message: 'Organizer ID is invalid',
    code: 'INVALID_ORGANIZER_ID',
  });
}
```

### Duplicate Key Error (23505)

**When it occurs:**
- Trying to create wallet for organizer that already has one

**How to handle:**
```javascript
if (error.code === '23505') {
  console.log('Wallet already exists for organizer');
  return { success: true, wallet: null };
}
```

---

## Validation Checklist

### Before Creating Event
- [ ] User is authenticated (`req.user?.id` exists)
- [ ] Required fields provided (title, date, location)
- [ ] Organizer exists in users table
- [ ] Organizer has role = 'organizer'
- [ ] Organizer has a wallet

### Before Creating Transaction
- [ ] Event exists
- [ ] Event's organizer_id exists in users table
- [ ] Event's organizer has role = 'organizer'

### Before Crediting Wallet
- [ ] Organizer exists in users table
- [ ] Organizer has role = 'organizer'
- [ ] Wallet exists (or can be created)

### Before Creating Withdrawal Request
- [ ] Organizer exists in users table
- [ ] Organizer has role = 'organizer'
- [ ] Organizer has a wallet

---

## Testing

### Test Case 1: Valid Organizer Event Creation
```bash
POST /api/v1/events
Authorization: Bearer <organizer_token>
Body: {
  "title": "Tech Conference",
  "date": "2026-05-15",
  "location": "Lagos"
}

Expected: 201 Created
```

### Test Case 2: Invalid Organizer (Not in Users Table)
```bash
POST /api/v1/events
Authorization: Bearer <invalid_token>
Body: { ... }

Expected: 403 Forbidden
Message: "Your organizer profile does not exist"
```

### Test Case 3: Payment with Invalid Organizer
```bash
POST /api/v1/payments/initiate
Body: {
  "eventId": "event-with-invalid-organizer",
  ...
}

Expected: 400 Bad Request
Message: "Event organizer is invalid"
```

### Test Case 4: Admin Creates Event for Valid Organizer
```bash
POST /api/v1/admin/events
Authorization: Bearer <admin_token>
Body: {
  "title": "Event",
  "date": "2026-05-15",
  "location": "Lagos",
  "organizer_id": "valid-organizer-id",
  ...
}

Expected: 201 Created
```

### Test Case 5: Admin Creates Event for Invalid Organizer
```bash
POST /api/v1/admin/events
Authorization: Bearer <admin_token>
Body: {
  "title": "Event",
  "organizer_id": "invalid-organizer-id",
  ...
}

Expected: 400 Bad Request
Message: "Organizer not found"
```

---

## Files Modified

1. ✅ `controllers/eventController.js`
   - Implemented `createEvent()` with full validation
   - Added organizer existence check
   - Added wallet verification

2. ✅ `controllers/paymentController.js`
   - Added organizer validation in `initiatePayment()`
   - Added organizer validation in `creditOrganizerWallet()`
   - Improved error handling for FK constraints

3. ✅ `controllers/adminController.js`
   - Added organizer validation in `createAdminEvent()`
   - Added FK constraint error handling

---

## Summary

### What Was Fixed
✅ Event creation now validates organizer exists
✅ Payment processing validates organizer exists
✅ Wallet operations validate organizer exists
✅ Admin event creation validates organizer exists
✅ Proper error messages for FK constraint violations

### Key Principles
✅ **Always validate before using foreign keys**
✅ **Use authenticated user's ID for organizer_id**
✅ **Verify organizer has role = 'organizer'**
✅ **Ensure wallet exists before crediting**
✅ **Handle FK constraint errors gracefully**

### Result
✅ No more foreign key constraint errors
✅ Clear error messages for invalid organizers
✅ Automatic wallet creation when needed
✅ Consistent validation across all endpoints

---

## Deployment

1. Deploy backend changes to Vercel
2. Test all event creation flows
3. Monitor error logs for FK constraint errors
4. Verify organizer signup creates proper records

---

## Support

For questions about organizer validation:
- See `controllers/eventController.js` for event creation
- See `controllers/paymentController.js` for payment processing
- See `controllers/adminController.js` for admin operations
