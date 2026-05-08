# Toast Positioning Fix - Frontend Guide

**Date**: May 7, 2026  
**Issue**: Success toast after creating event is hidden behind the form
**Solution**: Make toast fixed at top-right with z-index 9999

---

## 🎯 PROBLEM

When a user creates an event successfully, the toast notification appears but is hidden behind the form because:
1. Toast has low z-index (or no z-index)
2. Toast is positioned relative to the form container
3. Form has higher stacking context

---

## ✅ SOLUTION

### CSS Fix

Add this CSS to your toast component or global styles:

```css
/* Toast Container - Fixed positioning at top-right */
.toast {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 9999;
  
  padding: 16px 20px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  animation: slideIn 0.3s ease;
  
  font-size: 14px;
  font-weight: 500;
}

/* Success Toast */
.toast.success {
  background-color: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

/* Error Toast */
.toast.error {
  background-color: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

/* Info Toast */
.toast.info {
  background-color: #d1ecf1;
  color: #0c5460;
  border: 1px solid #bee5eb;
}

/* Warning Toast */
.toast.warning {
  background-color: #fff3cd;
  color: #856404;
  border: 1px solid #ffeaa7;
}

/* Close Button */
.toast button {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: inherit;
  padding: 0;
  margin-left: 8px;
  line-height: 1;
}

.toast button:hover {
  opacity: 0.7;
}

/* Slide In Animation */
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

/* Slide Out Animation (optional) */
@keyframes slideOut {
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(400px);
    opacity: 0;
  }
}

.toast.exit {
  animation: slideOut 0.3s ease;
}
```

---

## 💻 REACT COMPONENT EXAMPLE

### Toast Component

```javascript
import React, { useState, useEffect } from 'react';
import './Toast.css';

const Toast = ({ message, type = 'success', duration = 3000, onClose }) => {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        setIsExiting(true);
        setTimeout(onClose, 300); // Wait for animation
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  return (
    <div className={`toast ${type} ${isExiting ? 'exit' : ''}`}>
      <span>{message}</span>
      <button onClick={onClose}>×</button>
    </div>
  );
};

export default Toast;
```

### Toast Container (Global)

```javascript
import React, { useState, useCallback } from 'react';
import Toast from './Toast';

export const ToastContext = React.createContext();

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'success', duration = 3000) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type, duration }]);
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {children}
      <div className="toast-container">
        {toasts.map(toast => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            duration={toast.duration}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};
```

### Usage in CreateEventPage

```javascript
import { useToast } from '../context/ToastContext';

const CreateEventPage = () => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleCreateEvent = async (eventData) => {
    try {
      setLoading(true);

      const response = await fetch('https://tiketa-alpha.vercel.app/api/v1/events', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(eventData)
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to create event');
      }

      // ✅ Show success toast (will appear at top-right)
      showToast('Event created successfully!', 'success', 3000);

      // Redirect or refresh
      setTimeout(() => {
        navigate('/organizer/events');
      }, 1500);

    } catch (error) {
      // ✅ Show error toast
      showToast(error.message, 'error', 5000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-event-page">
      {/* Form content */}
      <form onSubmit={handleCreateEvent}>
        {/* Form fields */}
      </form>
    </div>
  );
};

export default CreateEventPage;
```

---

## 🎨 ALTERNATIVE: Tailwind CSS

If using Tailwind CSS:

```javascript
const Toast = ({ message, type = 'success', duration = 3000, onClose }) => {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        setIsExiting(true);
        setTimeout(onClose, 300);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const typeStyles = {
    success: 'bg-green-100 text-green-800 border border-green-300',
    error: 'bg-red-100 text-red-800 border border-red-300',
    info: 'bg-blue-100 text-blue-800 border border-blue-300',
    warning: 'bg-yellow-100 text-yellow-800 border border-yellow-300',
  };

  return (
    <div
      className={`
        fixed top-5 right-5 z-[9999]
        px-5 py-4 rounded-md
        flex items-center gap-3
        shadow-md
        ${typeStyles[type]}
        ${isExiting ? 'animate-slideOut' : 'animate-slideIn'}
      `}
    >
      <span>{message}</span>
      <button
        onClick={onClose}
        className="text-xl leading-none hover:opacity-70"
      >
        ×
      </button>
    </div>
  );
};
```

---

## 🔑 KEY POINTS

### Position: Fixed
```css
position: fixed;
```
- Removes toast from document flow
- Positions relative to viewport, not parent
- Toast stays visible even when scrolling

### Z-Index: 9999
```css
z-index: 9999;
```
- Ensures toast appears above all other elements
- Use 9999 to be safe (most elements use < 1000)
- Adjust if needed for your app

### Top-Right Placement
```css
top: 20px;
right: 20px;
```
- Standard location for notifications
- Visible and not intrusive
- Doesn't block important content

### Animation
```css
animation: slideIn 0.3s ease;
```
- Smooth entrance from right
- Draws user attention
- Professional appearance

---

## 📋 IMPLEMENTATION CHECKLIST

- [ ] Add CSS with `position: fixed` and `z-index: 9999`
- [ ] Create Toast component
- [ ] Create ToastProvider context
- [ ] Wrap app with ToastProvider
- [ ] Import useToast hook in CreateEventPage
- [ ] Call showToast on success
- [ ] Call showToast on error
- [ ] Test toast appears at top-right
- [ ] Test toast doesn't get hidden
- [ ] Test toast auto-closes after duration
- [ ] Test close button works

---

## 🧪 TESTING

### Test 1: Toast Appears
1. Create an event
2. Verify toast appears at top-right
3. Verify toast is not hidden

### Test 2: Toast Auto-Closes
1. Create an event
2. Wait 3 seconds
3. Verify toast disappears

### Test 3: Close Button Works
1. Create an event
2. Click × button on toast
3. Verify toast disappears immediately

### Test 4: Multiple Toasts
1. Create multiple events quickly
2. Verify multiple toasts stack
3. Verify all are visible

### Test 5: Scroll Test
1. Create an event
2. Scroll page
3. Verify toast stays at top-right

---

## 📞 SUPPORT

**CSS Properties:**
- `position: fixed` - Fixed viewport positioning
- `z-index: 9999` - Highest stacking order
- `top: 20px; right: 20px;` - Top-right corner
- `animation` - Smooth entrance/exit

**React Patterns:**
- Context API for global state
- useCallback for memoization
- useEffect for auto-close
- useState for toast list

---

**Status**: ✅ Ready to implement

**Last Updated**: May 7, 2026

