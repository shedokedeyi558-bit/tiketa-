# Platform Settings Implementation - Complete Guide

**Date**: May 7, 2026  
**Status**: ✅ **BACKEND COMPLETE - FRONTEND IMPLEMENTATION GUIDE**

---

## 🎯 OVERVIEW

The platform settings feature allows admins to manage global platform configuration:
- Platform Name
- Support Email
- Platform Fee (%)
- Minimum Withdrawal Amount (₦)

---

## ✅ BACKEND IMPLEMENTATION

### 1. Database Migration

**File**: `db/migrations/018_create_platform_settings_table.sql`

**Creates:**
- `platform_settings` table with singleton pattern (id = 1)
- RLS policies for public read, admin update
- Default values for all fields

**Schema:**
```sql
CREATE TABLE platform_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  platform_name TEXT DEFAULT 'Ticketa',
  support_email TEXT DEFAULT 'support@ticketa.com',
  platform_fee NUMERIC DEFAULT 3,
  minimum_withdrawal NUMERIC DEFAULT 10000,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2. Backend Controller

**File**: `controllers/platformSettingsController.js`

**Functions:**

#### `getPlatformSettings(req, res)`
- **Endpoint**: `GET /api/v1/admin/settings`
- **Auth**: Not required (public read)
- **Returns**: Current platform settings
- **Error Handling**: Returns defaults if table doesn't exist

#### `updatePlatformSettings(req, res)`
- **Endpoint**: `PUT /api/v1/admin/settings`
- **Auth**: Admin only (via adminAuth middleware)
- **Validates**: Email format, numeric values, positive numbers
- **Uses**: Service role key to bypass RLS
- **Returns**: Updated settings

### 3. Routes

**File**: `routes/adminRoutes.js`

**Added Routes:**
```javascript
router.get('/settings', getPlatformSettings);      // Public read
router.put('/settings', updatePlatformSettings);   // Admin only
```

---

## 📤 API ENDPOINTS

### GET /api/v1/admin/settings

**Description**: Fetch current platform settings

**Authentication**: Not required (public read)

**Request:**
```bash
curl -X GET https://tiketa-alpha.vercel.app/api/v1/admin/settings
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "platform_name": "Ticketa",
    "support_email": "support@ticketa.com",
    "platform_fee": 3,
    "minimum_withdrawal": 10000,
    "updated_at": "2026-05-07T14:30:00Z"
  }
}
```

**Response (500 Error):**
```json
{
  "success": false,
  "message": "Failed to fetch settings",
  "error": "..."
}
```

---

### PUT /api/v1/admin/settings

**Description**: Update platform settings (admin only)

**Authentication**: Required (Bearer token with admin role)

**Headers:**
```
Authorization: Bearer ADMIN_TOKEN
Content-Type: application/json
```

**Request Body:**
```json
{
  "platform_name": "Ticketa",
  "support_email": "support@ticketa.com",
  "platform_fee": 3,
  "minimum_withdrawal": 10000
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Settings updated successfully",
  "data": {
    "id": 1,
    "platform_name": "Ticketa",
    "support_email": "support@ticketa.com",
    "platform_fee": 3,
    "minimum_withdrawal": 10000,
    "updated_at": "2026-05-07T14:35:00Z"
  }
}
```

**Response (400 Bad Request):**
```json
{
  "success": false,
  "message": "Missing required fields: platform_name, support_email, platform_fee, minimum_withdrawal"
}
```

**Response (400 Invalid Email):**
```json
{
  "success": false,
  "message": "Invalid email format"
}
```

**Response (401 Unauthorized):**
```json
{
  "success": false,
  "message": "Unauthorized - Admin access required"
}
```

---

## 🎨 FRONTEND IMPLEMENTATION

### Step 1: Create Settings Page Component

**File**: `pages/AdminSettingsPage.jsx` (or similar)

```javascript
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext'; // Your auth context

const AdminSettingsPage = () => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  
  const [settings, setSettings] = useState({
    platform_name: '',
    support_email: '',
    platform_fee: '',
    minimum_withdrawal: '',
  });

  // ✅ Step 1: Fetch settings on page load
  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(
        'https://tiketa-alpha.vercel.app/api/v1/admin/settings',
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch settings');
      }

      // ✅ Populate form fields with fetched data
      setSettings({
        platform_name: data.data.platform_name || '',
        support_email: data.data.support_email || '',
        platform_fee: data.data.platform_fee || '',
        minimum_withdrawal: data.data.minimum_withdrawal || '',
      });

      console.log('✅ Settings loaded:', data.data);
    } catch (err) {
      console.error('❌ Error fetching settings:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Step 2: Handle form input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // ✅ Step 3: Handle save button click
  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      // Validate fields
      if (!settings.platform_name || !settings.support_email || 
          settings.platform_fee === '' || settings.minimum_withdrawal === '') {
        throw new Error('All fields are required');
      }

      // Validate email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(settings.support_email)) {
        throw new Error('Invalid email format');
      }

      // Validate numbers
      if (isNaN(settings.platform_fee) || isNaN(settings.minimum_withdrawal)) {
        throw new Error('Platform fee and minimum withdrawal must be numbers');
      }

      if (Number(settings.platform_fee) < 0 || Number(settings.minimum_withdrawal) < 0) {
        throw new Error('Values must be positive');
      }

      // ✅ Call PUT endpoint
      const response = await fetch(
        'https://tiketa-alpha.vercel.app/api/v1/admin/settings',
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            platform_name: settings.platform_name,
            support_email: settings.support_email,
            platform_fee: Number(settings.platform_fee),
            minimum_withdrawal: Number(settings.minimum_withdrawal),
          })
        }
      );

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to update settings');
      }

      // ✅ Show success message
      setSuccess(true);
      console.log('✅ Settings saved:', data.data);

      // Hide success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);

    } catch (err) {
      console.error('❌ Error saving settings:', err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="settings-page">
        <div className="loading">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <h1>Platform Settings</h1>

      {/* ✅ Error Toast */}
      {error && (
        <div className="toast error">
          <span>{error}</span>
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {/* ✅ Success Toast */}
      {success && (
        <div className="toast success">
          <span>Settings saved successfully!</span>
          <button onClick={() => setSuccess(false)}>×</button>
        </div>
      )}

      {/* ✅ Settings Form */}
      <form className="settings-form">
        {/* Platform Name */}
        <div className="form-group">
          <label htmlFor="platform_name">Platform Name</label>
          <input
            type="text"
            id="platform_name"
            name="platform_name"
            value={settings.platform_name}
            onChange={handleChange}
            placeholder="e.g., Ticketa"
            disabled={saving}
          />
        </div>

        {/* Support Email */}
        <div className="form-group">
          <label htmlFor="support_email">Support Email</label>
          <input
            type="email"
            id="support_email"
            name="support_email"
            value={settings.support_email}
            onChange={handleChange}
            placeholder="e.g., support@ticketa.com"
            disabled={saving}
          />
        </div>

        {/* Platform Fee */}
        <div className="form-group">
          <label htmlFor="platform_fee">Platform Fee (%)</label>
          <input
            type="number"
            id="platform_fee"
            name="platform_fee"
            value={settings.platform_fee}
            onChange={handleChange}
            placeholder="e.g., 3"
            step="0.01"
            min="0"
            disabled={saving}
          />
          <small>Commission taken from each ticket sale</small>
        </div>

        {/* Minimum Withdrawal */}
        <div className="form-group">
          <label htmlFor="minimum_withdrawal">Minimum Withdrawal Amount (₦)</label>
          <input
            type="number"
            id="minimum_withdrawal"
            name="minimum_withdrawal"
            value={settings.minimum_withdrawal}
            onChange={handleChange}
            placeholder="e.g., 10000"
            step="1"
            min="0"
            disabled={saving}
          />
          <small>Minimum amount organizers can withdraw</small>
        </div>

        {/* Save Button */}
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
};

export default AdminSettingsPage;
```

### Step 2: Add CSS Styling

```css
.settings-page {
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
}

.settings-page h1 {
  margin-bottom: 30px;
  font-size: 24px;
  font-weight: 600;
}

.settings-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-weight: 500;
  color: #333;
}

.form-group input {
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  font-family: inherit;
}

.form-group input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
}

.form-group input:disabled {
  background-color: #f5f5f5;
  cursor: not-allowed;
}

.form-group small {
  color: #666;
  font-size: 12px;
}

.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-primary {
  background-color: #007bff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: #0056b3;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Toast Notifications */
.toast {
  position: fixed;
  top: 20px;
  right: 20px;
  padding: 16px 20px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  animation: slideIn 0.3s ease;
  z-index: 1000;
}

.toast.success {
  background-color: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.toast.error {
  background-color: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.toast button {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: inherit;
  padding: 0;
  margin-left: 8px;
}

.loading {
  text-align: center;
  padding: 40px;
  color: #666;
}

@keyframes slideIn {
  from {
    transform: translateX(400px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}
```

### Step 3: Add Route to Admin Navigation

In your admin routing file, add:

```javascript
import AdminSettingsPage from './pages/AdminSettingsPage';

// In your routes:
<Route path="/admin/settings" element={<AdminSettingsPage />} />
```

---

## 🧪 TESTING

### Test 1: Fetch Settings

```bash
curl -X GET https://tiketa-alpha.vercel.app/api/v1/admin/settings
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "platform_name": "Ticketa",
    "support_email": "support@ticketa.com",
    "platform_fee": 3,
    "minimum_withdrawal": 10000,
    "updated_at": "2026-05-07T14:30:00Z"
  }
}
```

### Test 2: Update Settings

```bash
curl -X PUT https://tiketa-alpha.vercel.app/api/v1/admin/settings \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "platform_name": "Ticketa Pro",
    "support_email": "help@ticketa.com",
    "platform_fee": 5,
    "minimum_withdrawal": 50000
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Settings updated successfully",
  "data": {
    "id": 1,
    "platform_name": "Ticketa Pro",
    "support_email": "help@ticketa.com",
    "platform_fee": 5,
    "minimum_withdrawal": 50000,
    "updated_at": "2026-05-07T14:35:00Z"
  }
}
```

### Test 3: Frontend Integration

1. Navigate to `/admin/settings`
2. Verify settings are loaded and displayed
3. Change a value (e.g., platform name)
4. Click "Save Changes"
5. Verify success toast appears
6. Refresh page
7. Verify new value is still there

---

## 📋 FIELD SPECIFICATIONS

### Platform Name
- **Type**: Text
- **Max Length**: 255 characters
- **Required**: Yes
- **Example**: "Ticketa", "Ticketa Pro"

### Support Email
- **Type**: Email
- **Format**: Must be valid email (user@domain.com)
- **Required**: Yes
- **Example**: "support@ticketa.com"

### Platform Fee
- **Type**: Numeric (decimal)
- **Range**: 0 to 100
- **Unit**: Percentage (%)
- **Required**: Yes
- **Example**: 3, 5, 2.5
- **Usage**: Commission taken from each ticket sale

### Minimum Withdrawal
- **Type**: Numeric (integer)
- **Range**: 0 to unlimited
- **Unit**: Nigerian Naira (₦)
- **Required**: Yes
- **Example**: 10000, 50000, 100000
- **Usage**: Minimum amount organizers must have to request withdrawal

---

## 🔐 SECURITY

### Authentication
- ✅ GET endpoint: Public read (no auth required)
- ✅ PUT endpoint: Admin only (requires admin token)
- ✅ Protected by `adminAuth` middleware

### Validation
- ✅ Email format validation
- ✅ Numeric value validation
- ✅ Positive number validation
- ✅ Required field validation

### Database
- ✅ RLS policies for public read
- ✅ RLS policies for admin update only
- ✅ Service role key used for updates

---

## 📁 FILES CREATED/MODIFIED

**Created:**
- ✅ `db/migrations/018_create_platform_settings_table.sql`
- ✅ `controllers/platformSettingsController.js`

**Modified:**
- ✅ `routes/adminRoutes.js` - Added settings routes

**To Create (Frontend):**
- `pages/AdminSettingsPage.jsx` - Settings page component
- Add CSS for styling
- Add route to admin navigation

---

## 🚀 DEPLOYMENT

**Backend Status**: ✅ Ready to deploy

**Steps:**
1. Run migration: `018_create_platform_settings_table.sql` in Supabase
2. Commit changes to GitHub
3. Push to main branch
4. Vercel auto-deploys (30-60 seconds)

**Frontend Status**: 📝 Implementation guide provided

**Steps:**
1. Create `AdminSettingsPage.jsx` component
2. Add CSS styling
3. Add route to admin navigation
4. Test with backend endpoints
5. Commit and push

---

## ✅ VERIFICATION CHECKLIST

**Backend:**
- [x] Database migration created
- [x] Controller functions created
- [x] Routes added to admin routes
- [x] Error handling implemented
- [x] Validation implemented
- [x] No TypeScript/linting errors

**Frontend (To Do):**
- [ ] Settings page component created
- [ ] Form fields implemented
- [ ] Fetch settings on page load
- [ ] Save button functionality
- [ ] Success/error toasts
- [ ] Loading states
- [ ] Form validation
- [ ] Responsive design

---

## 📞 SUPPORT

**API Documentation**: This file

**Backend Code**:
- Controller: `controllers/platformSettingsController.js`
- Routes: `routes/adminRoutes.js`
- Migration: `db/migrations/018_create_platform_settings_table.sql`

**Frontend Code Template**: See "Frontend Implementation" section above

---

**Status**: ✅ Backend complete, frontend implementation guide provided

**Last Updated**: May 7, 2026

