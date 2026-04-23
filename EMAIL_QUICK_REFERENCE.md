# Email Notification - Quick Reference

## The Change in 30 Seconds

**Before:** Platform owner gets email for every ticket sale
**After:** Buyer + Organizer get emails, platform owner doesn't

## Three Emails Sent After Payment

1. **Buyer Confirmation** → buyer@example.com
   - Subject: "Ticket Purchase Confirmation - [Event]"
   - Content: Purchase details, transaction reference

2. **Organizer Notification** → organizer@example.com
   - Subject: "New ticket sold — [Event]"
   - Content: Sale details, **organizer earnings**, fee breakdown

3. **Ticket Details** → buyer@example.com
   - Subject: "Your Tickets for [Event]"
   - Content: Ticket numbers, QR codes

## Setup (3 Steps)

### Step 1: Generate Gmail App Password
- Go to https://myaccount.google.com/apppasswords
- Generate password
- Copy 16-character code

### Step 2: Add to .env
```
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=xxxx xxxx xxxx xxxx
```

### Step 3: Deploy to Vercel
- Add EMAIL_USER and EMAIL_PASSWORD to Vercel environment variables
- Redeploy

## Email Recipients

| Email | To | From |
|-------|----|----|
| Confirmation | Buyer | `transaction.buyer_email` |
| Notification | Organizer | `users` table (organizer_id) |
| Ticket Details | Buyer | `transaction.buyer_email` |

## Organizer Email Content

```
Subject: New ticket sold — [Event Name]

Attendee: [Name]
Email: [Email]
Amount Paid: ₦[Amount]
Your Earnings: ₦[Earnings]
Reference: [Reference]
Date: [Date/Time]

Breakdown:
- Ticket Price: ₦[Price]
- Platform Fee (3%): ₦[Fee]
- Processing Fee: ₦[Fee]
- Your Earnings: ₦[Earnings]
```

## Testing

```bash
# Make a test payment
curl -X POST https://tiketa-alpha.vercel.app/api/v1/payments/initiate \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "event-id",
    "cartItems": [{"price": 2100, "quantity": 1}],
    "attendees": [{"name": "Test", "email": "test@example.com"}],
    "buyerEmail": "buyer@example.com",
    "buyerName": "Test Buyer"
  }'

# Verify payment (after Squadco payment)
curl -X POST https://tiketa-alpha.vercel.app/api/v1/payments/verify \
  -H "Content-Type: application/json" \
  -d '{"reference": "TXN_..."}'
```

## Verify Emails

1. Check buyer's inbox for confirmation email
2. Check organizer's inbox for notification email
3. Check buyer's inbox for ticket details email
4. Check backend logs for email status

## Console Logs

```
📧 Sending buyer confirmation email...
✅ Buyer confirmation email sent: <id>
📧 Sending organizer notification email...
✅ Organizer notification email sent: <id>
📧 Sending ticket details email...
✅ Ticket details email sent: <id>
```

## Files Changed

- `services/emailService.js` - New email service
- `controllers/paymentController.js` - Updated to send emails
- `.env` - Email configuration
- `.env.example` - Email template

## Email Service Functions

```javascript
// Buyer confirmation
sendBuyerConfirmationEmail(transaction, event)

// Organizer notification
sendOrganizerNotificationEmail(transaction, event, organizerEmail)

// Ticket details
sendTicketDetailsEmail(transaction, event, tickets)

// Get organizer email
getOrganizerEmail(organizerId)

// Test configuration
testEmailConfiguration()
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Invalid login" | Check EMAIL_PASSWORD is app password, not Gmail password |
| "Connection timeout" | Check internet, verify firewall allows SMTP |
| "Emails not sent" | Check backend logs, verify EMAIL_USER and EMAIL_PASSWORD are set |
| "Emails in spam" | Check spam folder, add to contacts |

## Documentation

- `EMAIL_NOTIFICATION_RESTRUCTURE.md` - Full technical details
- `EMAIL_SETUP_GUIDE.md` - Step-by-step setup
- `EMAIL_NOTIFICATION_SUMMARY.md` - Overview
- `EMAIL_QUICK_REFERENCE.md` - This file

## Status

✅ Code implemented
✅ Committed to GitHub
✅ Auto-deployed to Vercel
⏳ Awaiting email configuration

---

**Last Updated:** April 21, 2026
