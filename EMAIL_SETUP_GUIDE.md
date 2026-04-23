# Email Configuration Setup Guide

## Quick Start

### Step 1: Generate Gmail App Password

1. Go to https://myaccount.google.com/apppasswords
2. Sign in with your Gmail account
3. Select "Mail" from the dropdown
4. Select "Windows Computer" (or your device type)
5. Click "Generate"
6. Copy the 16-character password (format: `xxxx xxxx xxxx xxxx`)

### Step 2: Update Environment Variables

#### Local Development (.env)
```
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=xxxx xxxx xxxx xxxx
```

#### Vercel Production
1. Go to Vercel Dashboard
2. Select your project
3. Go to Settings → Environment Variables
4. Add:
   - Name: `EMAIL_USER`, Value: `your-email@gmail.com`
   - Name: `EMAIL_PASSWORD`, Value: `xxxx xxxx xxxx xxxx`
5. Click "Save"
6. Redeploy the project

### Step 3: Test Email Configuration

```bash
# Test locally
curl -X POST http://localhost:5001/api/v1/test-email \
  -H "Content-Type: application/json"
```

## Email Notification Flow

After a successful payment:

1. **Buyer Confirmation Email**
   - Sent to: buyer's email
   - Contains: purchase confirmation, event details, transaction reference

2. **Organizer Notification Email**
   - Sent to: organizer's email (from users table)
   - Contains: sale details, attendee info, organizer earnings breakdown

3. **Ticket Details Email**
   - Sent to: buyer's email
   - Contains: ticket numbers, QR codes, event details

## Email Recipients

### Buyer Email
- Fetched from: `transaction.buyer_email`
- Receives: Confirmation + Ticket Details

### Organizer Email
- Fetched from: `users` table using `organizer_id`
- Receives: Sale Notification

### Platform Owner Email
- ❌ No longer receives individual ticket sale notifications
- ✅ Can view all sales in admin dashboard

## Troubleshooting

### Issue: "Invalid login credentials"
**Solution:** 
- Verify EMAIL_USER is correct
- Verify EMAIL_PASSWORD is the app password (not Gmail password)
- Regenerate app password if needed

### Issue: "Less secure app access"
**Solution:**
- Gmail app passwords bypass this requirement
- Ensure you're using app password, not regular password

### Issue: "SMTP connection timeout"
**Solution:**
- Check internet connection
- Verify firewall allows SMTP (port 587)
- Try using a different email provider

### Issue: "Emails not being sent"
**Solution:**
- Check backend logs for errors
- Verify EMAIL_USER and EMAIL_PASSWORD are set
- Test email configuration: `testEmailConfiguration()`
- Check spam folder

## Email Providers

### Gmail (Recommended)
```javascript
service: 'gmail',
auth: {
  user: process.env.EMAIL_USER,
  pass: process.env.EMAIL_PASSWORD,
}
```

### Outlook
```javascript
service: 'outlook',
auth: {
  user: process.env.EMAIL_USER,
  pass: process.env.EMAIL_PASSWORD,
}
```

### Yahoo
```javascript
service: 'yahoo',
auth: {
  user: process.env.EMAIL_USER,
  pass: process.env.EMAIL_PASSWORD,
}
```

### Custom SMTP
```javascript
host: process.env.SMTP_HOST,
port: process.env.SMTP_PORT,
secure: true,
auth: {
  user: process.env.EMAIL_USER,
  pass: process.env.EMAIL_PASSWORD,
}
```

## Email Content Customization

To customize email templates, edit `services/emailService.js`:

```javascript
// Example: Change email subject
const mailOptions = {
  from: process.env.EMAIL_USER,
  to: transaction.buyer_email,
  subject: 'Custom Subject Here', // Change this
  html: emailContent,
};
```

## Testing Emails

### Test Buyer Confirmation
```bash
curl -X POST http://localhost:5001/api/v1/payments/test-buyer-email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "name": "Test User",
    "eventTitle": "Test Event"
  }'
```

### Test Organizer Notification
```bash
curl -X POST http://localhost:5001/api/v1/payments/test-organizer-email \
  -H "Content-Type: application/json" \
  -d '{
    "organizerEmail": "organizer@example.com",
    "eventTitle": "Test Event",
    "buyerName": "Test Buyer",
    "earnings": 5000
  }'
```

## Email Logs

Check backend console for email logs:

```
📧 Sending buyer confirmation email to: buyer@example.com
✅ Buyer confirmation email sent: <message-id>
📧 Sending organizer notification email to: organizer@example.com
✅ Organizer notification email sent: <message-id>
📧 Sending ticket details email to: buyer@example.com
✅ Ticket details email sent: <message-id>
```

## Production Checklist

- [ ] EMAIL_USER set in Vercel environment variables
- [ ] EMAIL_PASSWORD set in Vercel environment variables
- [ ] Gmail app password generated and verified
- [ ] Test payment completed successfully
- [ ] Buyer received confirmation email
- [ ] Organizer received notification email
- [ ] Buyer received ticket details email
- [ ] Email logs show no errors
- [ ] Spam folder checked for emails

## Support

For issues with email configuration:
1. Check backend logs for error messages
2. Verify environment variables are set correctly
3. Test email configuration using `testEmailConfiguration()`
4. Check Gmail account security settings
5. Regenerate app password if needed

---

**Last Updated:** April 21, 2026
**Status:** ✅ Ready for Setup
