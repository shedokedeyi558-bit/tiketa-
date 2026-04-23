# Email Notification Restructure - Ticket Sales

## Overview
Restructured the email notification flow after successful ticket purchases to send emails to the buyer and organizer instead of the platform owner.

## Changes Made

### 1. Created Email Service
**File:** `services/emailService.js`

**Three Email Functions:**

#### a) sendBuyerConfirmationEmail
- **Recipient:** Buyer (from transaction.buyer_email)
- **Subject:** "Ticket Purchase Confirmation - [Event Name]"
- **Content:**
  - Event title, date, location
  - Amount paid
  - Transaction reference
  - Confirmation message

#### b) sendOrganizerNotificationEmail
- **Recipient:** Organizer (fetched from users table using organizer_id)
- **Subject:** "New ticket sold — [Event Name]"
- **Content:**
  - Attendee name and email
  - Amount paid
  - **Organizer earnings (after 3% platform fee)**
  - Transaction reference
  - Date/time of purchase
  - Breakdown of fees

#### c) sendTicketDetailsEmail
- **Recipient:** Buyer (from transaction.buyer_email)
- **Subject:** "Your Tickets for [Event Name]"
- **Content:**
  - Ticket numbers
  - QR codes (if generated)
  - Event details
  - Instructions for using tickets

### 2. Updated Payment Controller
**File:** `controllers/paymentController.js`

**Changes in processVerifiedPayment function:**
- Added import for email service functions
- After payment verification and ticket generation:
  1. Sends buyer confirmation email
  2. Fetches organizer email from users table
  3. Sends organizer notification email
  4. Sends ticket details email to buyer
- Non-blocking error handling (email failures don't fail the payment)
- Logs email status in audit trail

### 3. Email Configuration
**Files:** `.env` and `.env.example`

**New Environment Variables:**
```
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
```

**Setup Instructions:**
1. Enable 2-Factor Authentication on Gmail account
2. Generate App Password: https://myaccount.google.com/apppasswords
3. Use app password (not regular Gmail password)

## Email Notification Flow

### After Successful Payment:

```
Payment Verified
    ↓
Update Transaction Status to 'success'
    ↓
Credit Organizer Wallet
    ↓
Record Platform Earnings
    ↓
Generate Tickets
    ↓
Update Event Ticket Count
    ↓
📧 SEND EMAILS:
    ├─ Buyer Confirmation Email
    ├─ Organizer Notification Email
    └─ Ticket Details Email
    ↓
Log Audit Trail
```

## Email Templates

### 1. Buyer Confirmation Email

**Subject:** Ticket Purchase Confirmation - [Event Name]

```
Hi [Buyer Name],

Thank you for purchasing tickets to [Event Name]!

Purchase Details:
- Event: [Event Name]
- Date: [Event Date/Time]
- Location: [Event Location]
- Amount Paid: ₦[Total Amount]
- Transaction Reference: [Reference]

What's Next?
Your ticket(s) have been generated and are ready to use. 
You'll receive a separate email with your ticket details and QR code.

If you have any questions, please contact us at support@ticketa.com

Best regards,
Ticketa Team
```

### 2. Organizer Notification Email

**Subject:** New ticket sold — [Event Name]

```
Great news! Someone just purchased a ticket to your event.

Sale Details:
- Event: [Event Name]
- Attendee Name: [Buyer Name]
- Attendee Email: [Buyer Email]
- Amount Paid: ₦[Total Amount]
- Your Earnings: ₦[Organizer Earnings]
- Transaction Reference: [Reference]
- Date/Time: [Purchase Date/Time]

Breakdown:
- Ticket Price: ₦[Ticket Price]
- Platform Fee (3%): ₦[Platform Commission]
- Processing Fee: ₦[Processing Fee]
- Your Earnings: ₦[Organizer Earnings]

Your earnings have been credited to your wallet and are available for withdrawal.

Log in to your dashboard to view all sales and manage your events.

Best regards,
Ticketa Team
```

### 3. Ticket Details Email

**Subject:** Your Tickets for [Event Name]

```
Hi [Buyer Name],

Your tickets for [Event Name] are now ready to use.

Event Details:
- Event: [Event Name]
- Date: [Event Date/Time]
- Location: [Event Location]

Your Tickets:
[For each ticket:]
- Ticket Number: [Number]
- Attendee: [Attendee Name]
- Status: Valid
- QR Code: [Image]

Important:
- Please bring your ticket (digital or printed) to the event
- The QR code will be scanned at entry
- Each ticket is valid for one person only

If you have any questions, please contact us at support@ticketa.com

Best regards,
Ticketa Team
```

## Email Service Functions

### sendBuyerConfirmationEmail(transaction, event)
```javascript
const result = await sendBuyerConfirmationEmail(transaction, event);
// Returns: { success: true, messageId: '...' } or { success: false, error: '...' }
```

### sendOrganizerNotificationEmail(transaction, event, organizerEmail)
```javascript
const result = await sendOrganizerNotificationEmail(transaction, event, organizerEmail);
// Returns: { success: true, messageId: '...' } or { success: false, error: '...' }
```

### sendTicketDetailsEmail(transaction, event, tickets)
```javascript
const result = await sendTicketDetailsEmail(transaction, event, tickets);
// Returns: { success: true, messageId: '...' } or { success: false, error: '...' }
```

### getOrganizerEmail(organizerId)
```javascript
const organizer = await getOrganizerEmail(organizerId);
// Returns: { email: '...', full_name: '...' } or null
```

## Database Queries

### Fetch Organizer Email
```sql
SELECT email, full_name FROM users WHERE id = '{organizer_id}';
```

### Verify Transaction
```sql
SELECT * FROM transactions WHERE reference = '{reference}' AND status = 'success';
```

## Error Handling

**Non-Blocking Email Errors:**
- If email sending fails, the payment is still marked as successful
- Error is logged to console and audit trail
- Payment processing continues
- User can still access their tickets

**Audit Trail:**
```javascript
{
  action: 'PAYMENT_PROCESSED',
  emails_sent: {
    buyer_confirmation: true/false,
    organizer_notification: true/false,
    ticket_details: true/false
  }
}
```

## Configuration

### Gmail Setup
1. Go to https://myaccount.google.com/apppasswords
2. Select "Mail" and "Windows Computer" (or your device)
3. Generate app password
4. Copy the 16-character password
5. Add to `.env`:
   ```
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASSWORD=xxxx xxxx xxxx xxxx
   ```

### Alternative Email Providers
To use a different email provider, update `emailService.js`:

```javascript
const transporter = nodemailer.createTransport({
  service: 'your-service', // e.g., 'outlook', 'yahoo'
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});
```

## Testing

### Test Email Configuration
```javascript
import { testEmailConfiguration } from './services/emailService.js';

const result = await testEmailConfiguration();
console.log(result);
// { success: true, message: 'Email configuration is valid' }
```

### Test Email Sending
```javascript
import { sendBuyerConfirmationEmail } from './services/emailService.js';

const transaction = {
  buyer_email: 'test@example.com',
  buyer_name: 'Test User',
  total_amount: 5000,
  reference: 'TXN_123456789'
};

const event = {
  title: 'Test Event',
  date: '2026-05-01T10:00:00Z',
  location: 'Lagos, Nigeria'
};

const result = await sendBuyerConfirmationEmail(transaction, event);
console.log(result);
```

## Console Logs

When processing a payment, you'll see:

```
📧 Starting email notification flow...
📧 Sending buyer confirmation email...
✅ Buyer confirmation email sent: <message-id>
📧 Sending organizer notification email...
✅ Organizer notification email sent: <message-id>
📧 Sending ticket details email...
✅ Ticket details email sent: <message-id>
✅ Payment processing complete with email notifications
```

## Files Modified

| File | Changes |
|------|---------|
| `services/emailService.js` | Created new email service |
| `controllers/paymentController.js` | Updated to use email service |
| `.env` | Added email configuration |
| `.env.example` | Added email configuration template |

## Deployment Status

✅ Changes committed to GitHub
✅ Auto-deployed to Vercel
✅ Ready for testing

## Next Steps

1. **Configure Email:**
   - Set up Gmail app password
   - Add EMAIL_USER and EMAIL_PASSWORD to Vercel environment variables

2. **Test Email Sending:**
   - Make a test payment
   - Verify buyer receives confirmation email
   - Verify organizer receives notification email
   - Verify buyer receives ticket details email

3. **Monitor Email Delivery:**
   - Check email logs in console
   - Monitor for bounced emails
   - Track email delivery rates

## Removed Features

❌ **Platform owner email notifications for individual ticket sales**
- Admin dashboard already shows all sales in real-time
- Reduces email volume
- Focuses notifications on relevant parties (buyer and organizer)

## Benefits

✅ **Better User Experience**
- Buyers get confirmation and ticket details
- Organizers get sales notifications with earnings breakdown
- Reduces unnecessary emails to platform owner

✅ **Improved Transparency**
- Organizers see exact earnings after fees
- Clear breakdown of all charges
- Transaction reference for tracking

✅ **Scalability**
- Email service is modular and reusable
- Easy to add more email types in future
- Non-blocking error handling

---

**Status:** ✅ COMPLETED
**Last Updated:** April 21, 2026
**Deployed:** Yes (Vercel auto-deployment)
