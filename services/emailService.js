import nodemailer from 'nodemailer';
import { supabase } from '../utils/supabaseClient.js';

// Initialize email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

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
 */
export const getOrganizerEmail = async (organizerId) => {
  try {
    console.log('🔍 Fetching organizer email for ID:', organizerId);

    const { data: user, error } = await supabase
      .from('users')
      .select('email, full_name')
      .eq('id', organizerId)
      .single();

    if (error) {
      console.error('❌ Error fetching organizer:', error);
      return null;
    }

    console.log('✅ Organizer found:', user.email);
    return user;
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
