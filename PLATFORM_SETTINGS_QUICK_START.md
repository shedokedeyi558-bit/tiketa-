# Platform Settings - Quick Start for Frontend

**Status**: ✅ Backend ready, frontend implementation needed

---

## 🚀 QUICK START

### 1. Fetch Settings on Page Load

```javascript
useEffect(() => {
  const fetchSettings = async () => {
    const response = await fetch('https://tiketa-alpha.vercel.app/api/v1/admin/settings');
    const data = await response.json();
    setSettings(data.data);
  };
  fetchSettings();
}, []);
```

### 2. Create Form Fields

```javascript
<input 
  name="platform_name" 
  value={settings.platform_name} 
  onChange={(e) => setSettings({...settings, platform_name: e.target.value})}
/>
<input 
  name="support_email" 
  value={settings.support_email} 
  onChange={(e) => setSettings({...settings, support_email: e.target.value})}
/>
<input 
  name="platform_fee" 
  type="number" 
  value={settings.platform_fee} 
  onChange={(e) => setSettings({...settings, platform_fee: e.target.value})}
/>
<input 
  name="minimum_withdrawal" 
  type="number" 
  value={settings.minimum_withdrawal} 
  onChange={(e) => setSettings({...settings, minimum_withdrawal: e.target.value})}
/>
```

### 3. Save Settings

```javascript
const handleSave = async () => {
  const response = await fetch('https://tiketa-alpha.vercel.app/api/v1/admin/settings', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(settings)
  });
  
  const data = await response.json();
  if (data.success) {
    showSuccessToast('Settings saved!');
  } else {
    showErrorToast(data.message);
  }
};
```

---

## 📋 API ENDPOINTS

### GET /api/v1/admin/settings
- **Auth**: Not required
- **Returns**: Current settings

### PUT /api/v1/admin/settings
- **Auth**: Required (admin token)
- **Body**: `{platform_name, support_email, platform_fee, minimum_withdrawal}`
- **Returns**: Updated settings

---

## 🎯 FIELDS

| Field | Type | Example |
|-------|------|---------|
| platform_name | Text | "Ticketa" |
| support_email | Email | "support@ticketa.com" |
| platform_fee | Number | 3 |
| minimum_withdrawal | Number | 10000 |

---

## ✅ CHECKLIST

- [ ] Create AdminSettingsPage component
- [ ] Add form fields for all 4 settings
- [ ] Fetch settings on page load
- [ ] Show loading state while fetching
- [ ] Populate form with fetched data
- [ ] Add Save Changes button
- [ ] Call PUT endpoint on save
- [ ] Show success toast on save
- [ ] Show error toast on error
- [ ] Add form validation
- [ ] Test with backend

---

## 📚 FULL DOCUMENTATION

See `PLATFORM_SETTINGS_IMPLEMENTATION.md` for:
- Complete React component code
- CSS styling
- Detailed testing instructions
- Error handling examples
- Field specifications

---

**Backend Status**: ✅ Ready  
**Frontend Status**: 📝 To implement

