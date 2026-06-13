import nodemailer from 'nodemailer';
import { supabase } from '../utils/supabaseClient.js';
import { Resend } from 'resend';

// ─── Email transport ──────────────────────────────────────────────────────────
// Prefer Resend (HTTPS API — works on Render free tier, no SMTP port blocking)
// Fall back to nodemailer/Gmail SMTP if RESEND_API_KEY is not set
let resendClient = null;
if (process.env.RESEND_API_KEY) {
  resendClient = new Resend(process.env.RESEND_API_KEY);
  console.log('✅ Email transport: Resend (HTTPS API)');
}

// Nodemailer transporter (Gmail SMTP fallback)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
});

if (!resendClient) {
  console.log('⚠️ RESEND_API_KEY not set — using Gmail SMTP (may be blocked on Render)');
  // Warm-up check (non-blocking)
  transporter.verify().then(() => {
    console.log('✅ Email transporter verified — SMTP connection OK');
  }).catch((err) => {
    console.error('❌ Email transporter FAILED verification:', err.message, err.code);
    console.error('   Set RESEND_API_KEY to fix email delivery on Render');
  });
}

/**
 * Internal helper — sends via Resend if available, else Gmail SMTP
 */
async function sendEmail({ to, subject, html, from }) {
  const fromAddr = from || process.env.EMAIL_FROM || `"Ticketa" <${process.env.EMAIL_USER}>`;

  if (resendClient) {
    const { data, error } = await resendClient.emails.send({ from: fromAddr, to, subject, html });
    if (error) throw new Error(error.message);
    return { messageId: data?.id };
  }

  const info = await transporter.sendMail({ from: fromAddr, to, subject, html });
  return { messageId: info.messageId };
}

/**
 * Send buyer confirmation email
 * Confirms their purchase with ticket details and transaction reference
 */
export const sendBuyerConfirmationEmail = async (transaction, event) => {
  try {
    console.log('📧 Sending buyer confirmation email to:', transaction.buyer_email);

    const emailContent = `
      <h2>Purchase Confirmation</h2>
      <p>Hi ${transaction.buyer_name},</p>
      
      <p>Thank you for purchasing tickets to <strong>${event.title}</strong>!</p>
      
      <h3>Purchase Details:</h3>
      <ul>
        <li><strong>Event:</strong> ${event.title}</li>
        <li><strong>Date:</strong> ${new Date(event.date).toLocaleString()}</li>
        <li><strong>Location:</strong> ${event.location}</li>
        <li><strong>Amount Paid:</strong> ₦${transaction.total_amount.toLocaleString()}</li>
        <li><strong>Transaction Reference:</strong> ${transaction.reference}</li>
      </ul>
      
      <h3>What's Next?</h3>
      <p>Your ticket(s) have been generated and are ready to use. You'll receive a separate email with your ticket details and QR code.</p>
      
      <p>If you have any questions, please contact us at support@ticketa.com</p>
      
      <p>Best regards,<br/>Ticketa Team</p>
    `;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: transaction.buyer_email,
      subject: `Ticket Purchase Confirmation - ${event.title}`,
      html: emailContent,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Buyer confirmation email sent:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('❌ Error sending buyer confirmation email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send organizer notification email
 * Notifies organizer of new ticket sale
 */
export const sendOrganizerNotificationEmail = async (transaction, event, organizerEmail) => {
  try {
    console.log('📧 Sending organizer notification email to:', organizerEmail);

    const emailContent = `
      <h2>New Ticket Sold!</h2>
      <p>Great news! Someone just purchased a ticket to your event.</p>
      
      <h3>Sale Details:</h3>
      <ul>
        <li><strong>Event:</strong> ${event.title}</li>
        <li><strong>Attendee Name:</strong> ${transaction.buyer_name}</li>
        <li><strong>Attendee Email:</strong> ${transaction.buyer_email}</li>
        <li><strong>Amount Paid:</strong> ₦${transaction.total_amount.toLocaleString()}</li>
        <li><strong>Your Earnings:</strong> ₦${transaction.organizer_earnings.toLocaleString()}</li>
        <li><strong>Transaction Reference:</strong> ${transaction.reference}</li>
        <li><strong>Date/Time:</strong> ${new Date(transaction.created_at).toLocaleString()}</li>
      </ul>
      
      <h3>Breakdown:</h3>
      <ul>
        <li>Ticket Price: ₦${transaction.ticket_price.toLocaleString()}</li>
        <li>Platform Fee (3%): ₦${transaction.platform_commission.toLocaleString()}</li>
        <li>Processing Fee: ₦${transaction.processing_fee}</li>
        <li><strong>Your Earnings:</strong> ₦${transaction.organizer_earnings.toLocaleString()}</li>
      </ul>
      
      <p>Your earnings have been credited to your wallet and are available for withdrawal.</p>
      
      <p>Log in to your dashboard to view all sales and manage your events.</p>
      
      <p>Best regards,<br/>Ticketa Team</p>
    `;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: organizerEmail,
      subject: `New ticket sold — ${event.title}`,
      html: emailContent,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Organizer notification email sent:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('❌ Error sending organizer notification email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send ticket details email to buyer
 * Includes ticket number and QR code
 */
export const sendTicketDetailsEmail = async (transaction, event, tickets) => {
  try {
    console.log('📧 Sending ticket details email to:', transaction.buyer_email);

    let ticketsList = '';
    if (tickets && tickets.length > 0) {
      ticketsList = tickets.map((ticket, idx) => `
        <div style="border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 5px;">
          <h4>Ticket ${idx + 1}</h4>
          <p><strong>Ticket Number:</strong> ${ticket.ticket_number}</p>
          <p><strong>Attendee:</strong> ${ticket.buyer_name}</p>
          <p><strong>Status:</strong> ${ticket.status}</p>
          ${ticket.qr_code ? `<p><strong>QR Code:</strong></p><img src="${ticket.qr_code}" alt="QR Code" style="max-width: 200px;"/>` : ''}
        </div>
      `).join('');
    }

    const emailContent = `
      <h2>Your Tickets are Ready!</h2>
      <p>Hi ${transaction.buyer_name},</p>
      
      <p>Your tickets for <strong>${event.title}</strong> are now ready to use.</p>
      
      <h3>Event Details:</h3>
      <ul>
        <li><strong>Event:</strong> ${event.title}</li>
        <li><strong>Date:</strong> ${new Date(event.date).toLocaleString()}</li>
        <li><strong>Location:</strong> ${event.location}</li>
      </ul>
      
      <h3>Your Tickets:</h3>
      ${ticketsList}
      
      <h3>Important:</h3>
      <ul>
        <li>Please bring your ticket (digital or printed) to the event</li>
        <li>The QR code will be scanned at entry</li>
        <li>Each ticket is valid for one person only</li>
      </ul>
      
      <p>If you have any questions, please contact us at support@ticketa.com</p>
      
      <p>Best regards,<br/>Ticketa Team</p>
    `;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: transaction.buyer_email,
      subject: `Your Tickets for ${event.title}`,
      html: emailContent,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Ticket details email sent:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('❌ Error sending ticket details email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get organizer email from database
 * Tries profiles table first, falls back to Supabase auth (covers Google OAuth users
 * whose email may only be in auth.users, not profiles)
 */
export const getOrganizerEmail = async (organizerId) => {
  try {
    console.log('🔍 Fetching organizer email for ID:', organizerId);

    // 1. Try profiles table first (fastest path)
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', organizerId)
      .single();

    if (profile?.email) {
      console.log('✅ Organizer email from profiles:', profile.email);
      return { email: profile.email, full_name: profile.full_name };
    }

    // 2. Fallback: fetch from Supabase auth (covers Google OAuth users)
    console.warn('⚠️ No email in profiles for organizer, trying auth.users...');
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const { data: { user: authUser }, error: authErr } = await supabaseAdmin.auth.admin.getUserById(organizerId);

    if (authErr || !authUser?.email) {
      console.error('❌ Could not find email in auth.users either:', authErr?.message);
      return null;
    }

    console.log('✅ Organizer email from auth.users:', authUser.email);

    // Back-fill profiles.email so future lookups hit the fast path
    await supabase
      .from('profiles')
      .update({ email: authUser.email })
      .eq('id', organizerId)
      .then(({ error }) => {
        if (error) console.warn('⚠️ Back-fill profiles.email failed (non-blocking):', error.message);
        else console.log('✅ Back-filled profiles.email for organizer', organizerId);
      });

    return { email: authUser.email, full_name: profile?.full_name || authUser.user_metadata?.full_name || '' };
  } catch (error) {
    console.error('❌ Error getting organizer email:', error);
    return null;
  }
};

/**
 * Test email configuration
 */
export const testEmailConfiguration = async () => {
  try {
    console.log('🧪 Testing email configuration...');

    // Verify transporter
    const verified = await transporter.verify();
    
    if (verified) {
      console.log('✅ Email configuration is valid');
      return { success: true, message: 'Email configuration is valid' };
    } else {
      console.error('❌ Email configuration verification failed');
      return { success: false, message: 'Email configuration verification failed' };
    }
  } catch (error) {
    console.error('❌ Error testing email configuration:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send event approved email to organizer
 */
export const sendEventApprovedEmail = async (organizerEmail, organizerName, eventTitle) => {
  try {
    console.log('📧 Sending event approved email to:', organizerEmail);

    const emailContent = `
      <h2>Event Approved! 🎉</h2>
      <p>Hi ${organizerName},</p>
      
      <p>Great news! Your event <strong>${eventTitle}</strong> has been approved and is now live on Ticketa.</p>
      
      <h3>What's Next?</h3>
      <ul>
        <li>Your event is now visible to the public</li>
        <li>Attendees can start purchasing tickets</li>
        <li>You'll receive notifications for each ticket sale</li>
        <li>Track your sales in real-time from your dashboard</li>
      </ul>
      
      <p>Log in to your dashboard to manage your event and view ticket sales.</p>
      
      <p>Best regards,<br/>Ticketa Team</p>
    `;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: organizerEmail,
      subject: `Event Approved - ${eventTitle}`,
      html: emailContent,
    };

    const result = await sendEmail({ to: organizerEmail, subject: `Event Approved - ${eventTitle}`, html: emailContent });
    console.log('✅ Event approved email sent:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('❌ Error sending event approved email — code:', error.code, 'message:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Send event rejected email to organizer
 */
export const sendEventRejectedEmail = async (organizerEmail, organizerName, eventTitle, rejectionReason) => {
  try {
    console.log('📧 Sending event rejected email to:', organizerEmail);

    const emailContent = `
      <h2>Event Submission Update</h2>
      <p>Hi ${organizerName},</p>
      
      <p>Thank you for submitting your event <strong>${eventTitle}</strong> to Ticketa.</p>
      
      <p>Unfortunately, we are unable to approve your event at this time.</p>
      
      <h3>Reason:</h3>
      <p style="background-color: #f5f5f5; padding: 15px; border-left: 4px solid #ff6b6b; margin: 20px 0;">
        ${rejectionReason}
      </p>
      
      <h3>What You Can Do:</h3>
      <ul>
        <li>Review the reason for rejection</li>
        <li>Make necessary changes to your event</li>
        <li>Submit a new event that meets our guidelines</li>
        <li>Contact us if you have questions: support@ticketa.com</li>
      </ul>
      
      <p>We appreciate your understanding and look forward to working with you.</p>
      
      <p>Best regards,<br/>Ticketa Team</p>
    `;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: organizerEmail,
      subject: `Event Submission Update - ${eventTitle}`,
      html: emailContent,
    };

    const result = await sendEmail({ to: organizerEmail, subject: `Event Submission Update - ${eventTitle}`, html: emailContent });
    console.log('✅ Event rejected email sent:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('❌ Error sending event rejected email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send Ticketa custom ticket purchase confirmation email
 * Replaces Squad's generic receipt with a branded Ticketa email
 */
export const sendTicketPurchaseConfirmation = async ({ buyerName, buyerEmail, reference, event, cartItems, attendees, totalAmount }) => {
  try {
    console.log('📧 Sending Ticketa purchase confirmation to:', buyerEmail);

    const eventTitle = event?.title || 'Your Event';
    const eventDate = event?.date ? new Date(event.date).toLocaleDateString('en-NG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '';
    const eventTime = event?.start_time ? ` at ${event.start_time}` : '';
    const eventLocation = event?.location || '';

    // Build ticket types rows
    const ticketRows = (cartItems || []).map(item => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${item.name || 'Ticket'}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;">${item.quantity || 1}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">₦${Number(item.price || 0).toLocaleString()}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">₦${(Number(item.price || 0) * (parseInt(item.quantity) || 1)).toLocaleString()}</td>
      </tr>
    `).join('');

    // Build attendees list
    const attendeeList = (attendees || []).length > 0
      ? `<h3 style="color:#333;margin-top:24px;">Attendees</h3>
         <ul style="padding-left:20px;">
           ${attendees.map((a, i) => `<li style="margin-bottom:4px;">${a.name || a.fullName || `Attendee ${i + 1}`}</li>`).join('')}
         </ul>`
      : '';

    const html = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"/></head>
      <body style="font-family:Arial,sans-serif;background:#f9f9f9;margin:0;padding:0;">
        <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          
          <!-- Header -->
          <div style="background:#6c3fc5;padding:28px 32px;">
            <h1 style="color:#fff;margin:0;font-size:24px;">🎟 Ticketa</h1>
            <p style="color:#e0d0ff;margin:6px 0 0;">Your tickets are confirmed!</p>
          </div>

          <!-- Body -->
          <div style="padding:32px;">
            <p style="font-size:16px;color:#333;">Hi <strong>${buyerName}</strong>,</p>
            <p style="color:#555;">Thank you for your purchase. Your tickets for <strong>${eventTitle}</strong> are confirmed.</p>

            <!-- Event Details -->
            <div style="background:#f4f0ff;border-radius:6px;padding:16px 20px;margin:20px 0;">
              <h3 style="margin:0 0 10px;color:#6c3fc5;">📅 Event Details</h3>
              <p style="margin:4px 0;color:#333;"><strong>Event:</strong> ${eventTitle}</p>
              ${eventDate ? `<p style="margin:4px 0;color:#333;"><strong>Date:</strong> ${eventDate}${eventTime}</p>` : ''}
              ${eventLocation ? `<p style="margin:4px 0;color:#333;"><strong>Location:</strong> ${eventLocation}</p>` : ''}
            </div>

            <!-- Ticket Breakdown -->
            <h3 style="color:#333;">🎫 Tickets Purchased</h3>
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              <thead>
                <tr style="background:#f4f0ff;">
                  <th style="padding:8px 12px;text-align:left;color:#6c3fc5;">Ticket Type</th>
                  <th style="padding:8px 12px;text-align:center;color:#6c3fc5;">Qty</th>
                  <th style="padding:8px 12px;text-align:right;color:#6c3fc5;">Unit Price</th>
                  <th style="padding:8px 12px;text-align:right;color:#6c3fc5;">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                ${ticketRows}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="3" style="padding:10px 12px;text-align:right;font-weight:bold;color:#333;">Total Paid:</td>
                  <td style="padding:10px 12px;text-align:right;font-weight:bold;color:#6c3fc5;">₦${Number(totalAmount).toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>

            ${attendeeList}

            <!-- QR Code -->
            <div style="text-align:center; margin: 24px 0;">
              <p style="font-size:11px; color:#888; text-transform:uppercase; letter-spacing:1px; margin-bottom:12px;">Scan at entrance</p>
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${reference}&bgcolor=ffffff&color=1a0a2e&margin=10"
                alt="Entry QR Code"
                width="220"
                height="220"
                style="border-radius:12px; border:4px solid #6c47ff;"
              />
              <p style="font-family:monospace; font-size:11px; color:#6c47ff; margin-top:10px;">${reference}</p>
            </div>

            <!-- View Ticket Button -->
            <div style="text-align:center; margin: 20px 0;">
              <a href="https://ticketa-topaz.vercel.app/confirm?ref=${reference}"
                style="display:inline-block; background:#6c47ff; color:#ffffff; padding:14px 32px; border-radius:12px; font-weight:700; font-size:14px; text-decoration:none;">
                View Your Ticket
              </a>
            </div>

            <!-- Reference -->
            <div style="background:#f9f9f9;border:1px solid #eee;border-radius:6px;padding:14px 18px;margin:24px 0;">
              <p style="margin:0;font-size:13px;color:#888;">Transaction Reference</p>
              <p style="margin:4px 0 0;font-size:15px;font-weight:bold;color:#333;letter-spacing:0.5px;">${reference}</p>
            </div>

            <!-- Entry Notice -->
            <div style="background:#fff8e1;border-left:4px solid #f59e0b;padding:14px 18px;border-radius:0 6px 6px 0;margin:20px 0;">
              <p style="margin:0;color:#92400e;font-weight:bold;">📌 Present this email at the entrance</p>
              <p style="margin:6px 0 0;color:#92400e;font-size:14px;">Show this confirmation or quote your transaction reference to gain entry.</p>
            </div>

            <p style="color:#888;font-size:13px;margin-top:28px;">Questions? Contact us at <a href="mailto:support@ticketa.com" style="color:#6c3fc5;">support@ticketa.com</a></p>
          </div>

          <!-- Footer -->
          <div style="background:#f4f0ff;padding:16px 32px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#999;">© ${new Date().getFullYear()} Ticketa. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: `"Ticketa" <${process.env.EMAIL_USER}>`,
      to: buyerEmail,
      subject: `Your tickets for ${eventTitle} are confirmed 🎟`,
      html,
    };

    const result = await sendEmail({ to: buyerEmail, subject: `Your tickets for ${eventTitle} are confirmed 🎟`, html });
    console.log('✅ Ticketa confirmation email sent:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('❌ Error sending Ticketa confirmation email:', error);
    return { success: false, error: error.message };
  }
};
