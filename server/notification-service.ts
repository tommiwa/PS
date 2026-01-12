// Notification Service - handles email and in-app notifications
// Supports both SendGrid and Microsoft 365 Graph API for email functionality

import { MailService } from '@sendgrid/mail';
import { ConfidentialClientApplication, Configuration } from '@azure/msal-node';
import axios from 'axios';
import type { WaitingList, ParkingSpot, AuthUser } from '@shared/schema';
import { storage } from './storage';

// Email provider configuration
type EmailProvider = 'ms365' | 'sendgrid' | 'mock';

// Check which email providers are configured
const MS365_CONFIGURED = !!(
  process.env.MS365_TENANT_ID &&
  process.env.MS365_CLIENT_ID &&
  process.env.MS365_CLIENT_SECRET &&
  process.env.MS365_SENDER_EMAIL
);
const SENDGRID_CONFIGURED = !!process.env.SENDGRID_API_KEY;

// Determine which provider to use (MS365 takes priority if both are configured)
const activeProvider: EmailProvider = MS365_CONFIGURED ? 'ms365' : (SENDGRID_CONFIGURED ? 'sendgrid' : 'mock');

let mailService: MailService | null = null;
let msalClient: ConfidentialClientApplication | null = null;

// Initialize SendGrid if configured
if (SENDGRID_CONFIGURED) {
  try {
    mailService = new MailService();
    mailService.setApiKey(process.env.SENDGRID_API_KEY!);
    console.log('✓ SendGrid initialized successfully');
  } catch (error) {
    console.error('❌ SendGrid initialization failed:', error);
  }
}

// Initialize Microsoft 365 Graph API if configured
if (MS365_CONFIGURED) {
  try {
    const msalConfig: Configuration = {
      auth: {
        clientId: process.env.MS365_CLIENT_ID!,
        authority: `https://login.microsoftonline.com/${process.env.MS365_TENANT_ID}`,
        clientSecret: process.env.MS365_CLIENT_SECRET!
      }
    };
    msalClient = new ConfidentialClientApplication(msalConfig);
    console.log('✓ Microsoft 365 Graph API initialized successfully');
  } catch (error) {
    console.error('❌ Microsoft 365 initialization failed:', error);
  }
}

// Log the active email provider
if (activeProvider === 'ms365') {
  console.log('📧 Email provider: Microsoft 365 Graph API');
} else if (activeProvider === 'sendgrid') {
  console.log('📧 Email provider: SendGrid');
} else {
  console.log('⚠️  No email provider configured - using mock notifications for development');
}

// Helper function to get MS365 access token
async function getMS365AccessToken(): Promise<string> {
  if (!msalClient) {
    throw new Error('MS365 client not initialized');
  }
  
  const tokenRequest = {
    scopes: ['https://graph.microsoft.com/.default']
  };
  
  const response = await msalClient.acquireTokenByClientCredential(tokenRequest);
  if (!response?.accessToken) {
    throw new Error('Failed to acquire MS365 access token');
  }
  
  return response.accessToken;
}

// Send email via Microsoft 365 Graph API
async function sendEmailViaMS365(
  to: string,
  subject: string,
  text: string,
  html: string
): Promise<void> {
  const accessToken = await getMS365AccessToken();
  const senderEmail = process.env.MS365_SENDER_EMAIL!;
  
  const emailPayload = {
    message: {
      subject: subject,
      body: {
        contentType: 'HTML',
        content: html
      },
      toRecipients: [
        {
          emailAddress: {
            address: to
          }
        }
      ]
    },
    saveToSentItems: true
  };
  
  await axios.post(
    `https://graph.microsoft.com/v1.0/users/${senderEmail}/sendMail`,
    emailPayload,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    }
  );
}

// Export helper function to check email provider status
export function getEmailProviderStatus(): { 
  provider: EmailProvider; 
  ms365Available: boolean; 
  sendgridAvailable: boolean;
} {
  return {
    provider: activeProvider,
    ms365Available: MS365_CONFIGURED,
    sendgridAvailable: SENDGRID_CONFIGURED
  };
}

export interface EmailNotification {
  to: string;
  subject: string;
  text: string;
  html: string;
  type: 'assignment' | 'welcome' | 'booking_confirmation' | 'booking_cancelled' | 'payment_reminder' | 'spot_availability' | 'weekly_report' | 'system_maintenance' | 'general';
}

export interface InAppNotification {
  id: string;
  userId: string;
  type: 'assignment' | 'welcome' | 'booking_confirmation' | 'booking_cancelled' | 'payment_reminder' | 'spot_availability' | 'weekly_report' | 'system_maintenance' | 'general';
  title: string;
  message: string;
  data?: any;
  read: boolean;
  createdAt: Date;
  expiresAt?: Date;
}

/**
 * Email Templates
 */
export const createAssignmentNotification = (
  user: { name: string; email: string },
  waitingListEntry: WaitingList,
  spotDetails: { spotNumber: string; location: string; building: string }
): EmailNotification => {
  const subject = `🎉 Parking Spot Assignment - Spot ${spotDetails.spotNumber} Available!`;
  
  const text = `Dear ${user.name},

Great news! You've been assigned a parking spot from the waiting list.

SPOT DETAILS:
• Spot Number: ${spotDetails.spotNumber}
• Location: ${spotDetails.location}
• Building: ${spotDetails.building}
• Type: ${waitingListEntry.preferredSpotType || 'Standard'}

NEXT STEPS:
1. Please respond within 48 hours to accept or decline this assignment
2. If accepted, you'll receive setup instructions and access details
3. If declined, you'll remain on the waiting list with your current priority

IMPORTANT: This assignment will expire if not confirmed within 48 hours.

Best regards,
BCI ParkShare Team`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Parking Spot Assignment</title>
  <style>
    .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
    .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
    .content { padding: 30px; background: #f8fafc; }
    .spot-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981; }
    .next-steps { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .button { display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 5px; }
    .footer { text-align: center; color: #64748b; padding: 20px; }
    .important { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Parking Spot Assigned!</h1>
    </div>
    
    <div class="content">
      <p>Dear ${user.name},</p>
      <p>Great news! You've been assigned a parking spot from the waiting list.</p>
      
      <div class="spot-details">
        <h3>📍 Your Assigned Spot</h3>
        <ul>
          <li><strong>Spot Number:</strong> ${spotDetails.spotNumber}</li>
          <li><strong>Location:</strong> ${spotDetails.location}</li>
          <li><strong>Building:</strong> ${spotDetails.building}</li>
          <li><strong>Type:</strong> ${waitingListEntry.preferredSpotType || 'Standard'}</li>
        </ul>
      </div>
      
      <div class="next-steps">
        <h3>🎯 Next Steps</h3>
        <ol>
          <li>Please respond within <strong>48 hours</strong> to accept or decline this assignment</li>
          <li>If accepted, you'll receive setup instructions and access details</li>
          <li>If declined, you'll remain on the waiting list with your current priority</li>
        </ol>
        
        <div style="text-align: center; margin-top: 20px;">
          <a href="#" class="button">Accept Assignment</a>
          <a href="#" class="button" style="background: #ef4444;">Decline Assignment</a>
        </div>
      </div>
      
      <div class="important">
        <strong>⏰ Important:</strong> This assignment will expire if not confirmed within 48 hours.
      </div>
    </div>
    
    <div class="footer">
      <p>Best regards,<br>BCI ParkShare Team</p>
    </div>
  </div>
</body>
</html>`;

  return {
    to: user.email,
    subject,
    text,
    html,
    type: 'assignment'
  };
};

export const createWelcomeNotification = (
  user: { name: string; email: string },
  waitingListEntry: WaitingList
): EmailNotification => {
  const subject = `Welcome to BCI ParkShare Waiting List`;
  
  const text = `Dear ${user.name},

Welcome to the BCI parking waiting list! Your enrollment has been confirmed.

YOUR DETAILS:
• Preferred Spot Type: ${waitingListEntry.preferredSpotType || 'Any'}
• Preferred Building: ${waitingListEntry.preferredBuilding || 'Any'}
• Priority Level: ${waitingListEntry.priority}
• Enrollment Date: ${waitingListEntry.enrolledDate?.toLocaleDateString()}

WHAT'S NEXT:
• You'll be notified when a spot matching your preferences becomes available
• We'll contact you within 48 hours of a spot becoming available
• You can update your preferences anytime in your profile

Thank you for your patience!

Best regards,
BCI ParkShare Team`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
    .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
    .content { padding: 30px; background: #f8fafc; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to BCI ParkShare Waiting List</h1>
    </div>
    <div class="content">
      <p>Dear ${user.name},</p>
      <p>Your enrollment has been confirmed. We'll notify you when a spot becomes available.</p>
    </div>
  </div>
</body>
</html>`;

  return {
    to: user.email,
    subject,
    text,
    html,
    type: 'welcome'
  };
};

export const createBookingConfirmationNotification = (
  user: { name: string; email: string },
  booking: {
    id: string;
    spotNumber: string;
    location: string;
    building: string;
    startDate: Date;
    endDate: Date;
    rate: number;
    totalAmount: number;
  }
): EmailNotification => {
  const subject = `✅ Booking Confirmed - Spot ${booking.spotNumber}`;
  
  const text = `Dear ${user.name},

Your parking spot booking has been confirmed! Here are the details:

BOOKING DETAILS:
• Booking ID: ${booking.id}
• Spot Number: ${booking.spotNumber}
• Location: ${booking.location}
• Building: ${booking.building}
• Start Date: ${booking.startDate.toLocaleDateString()}
• End Date: ${booking.endDate.toLocaleDateString()}
• Rate: $${booking.rate}/day
• Total Amount: $${booking.totalAmount}

IMPORTANT INFORMATION:
• Please arrive at your assigned spot on or after your start date
• Your access will be activated at 12:01 AM on your start date
• Remember to display any required parking permits
• Contact support if you need to make changes to your booking

Thank you for using BCI ParkShare!

Best regards,
BCI ParkShare Team`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Booking Confirmation</title>
  <style>
    .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
    .header { background: #10b981; color: white; padding: 20px; text-align: center; }
    .content { padding: 30px; background: #f8fafc; }
    .booking-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981; }
    .important-info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .footer { text-align: center; color: #64748b; padding: 20px; }
    .amount { font-size: 1.2em; font-weight: bold; color: #10b981; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ Booking Confirmed!</h1>
    </div>
    
    <div class="content">
      <p>Dear ${user.name},</p>
      <p>Your parking spot booking has been confirmed! Here are your details:</p>
      
      <div class="booking-details">
        <h3>📋 Booking Details</h3>
        <ul>
          <li><strong>Booking ID:</strong> ${booking.id}</li>
          <li><strong>Spot Number:</strong> ${booking.spotNumber}</li>
          <li><strong>Location:</strong> ${booking.location}</li>
          <li><strong>Building:</strong> ${booking.building}</li>
          <li><strong>Start Date:</strong> ${booking.startDate.toLocaleDateString()}</li>
          <li><strong>End Date:</strong> ${booking.endDate.toLocaleDateString()}</li>
          <li><strong>Rate:</strong> $${booking.rate}/day</li>
          <li><strong>Total Amount:</strong> <span class="amount">$${booking.totalAmount}</span></li>
        </ul>
      </div>
      
      <div class="important-info">
        <h3>📝 Important Information</h3>
        <ul>
          <li>Please arrive at your assigned spot on or after your start date</li>
          <li>Your access will be activated at 12:01 AM on your start date</li>
          <li>Remember to display any required parking permits</li>
          <li>Contact support if you need to make changes to your booking</li>
        </ul>
      </div>
    </div>
    
    <div class="footer">
      <p>Thank you for using BCI ParkShare!<br>BCI ParkShare Team</p>
    </div>
  </div>
</body>
</html>`;

  return {
    to: user.email,
    subject,
    text,
    html,
    type: 'booking_confirmation'
  };
};

export const createBookingCancellationNotification = (
  user: { name: string; email: string },
  booking: {
    id: string;
    spotNumber: string;
    location: string;
    building: string;
    bookingDate: Date | string;
    cancelledBy: string;
    reason?: string;
  }
): EmailNotification => {
  const subject = `❌ Booking Cancelled - Spot ${booking.spotNumber}`;
  
  const bookingDateStr = booking.bookingDate instanceof Date 
    ? booking.bookingDate.toLocaleDateString() 
    : new Date(booking.bookingDate).toLocaleDateString();
  
  const text = `Dear ${user.name},

Your parking spot booking has been cancelled.

BOOKING DETAILS:
• Booking ID: ${booking.id}
• Spot Number: ${booking.spotNumber}
• Location: ${booking.location}
• Building: ${booking.building}
• Booking Date: ${bookingDateStr}
• Cancelled By: ${booking.cancelledBy}${booking.reason ? `\n• Reason: ${booking.reason}` : ''}

REFUND INFORMATION:
• If you made a payment, a refund will be processed according to our cancellation policy
• Refunds typically take 5-7 business days to appear in your account
• You'll receive a separate confirmation once the refund is processed

WHAT'S NEXT:
• You can search for and book another available parking spot
• Update your preferences to receive notifications about available spots
• Contact support if you have any questions about this cancellation

We apologize for any inconvenience this may have caused.

Best regards,
BCI ParkShare Team`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Booking Cancelled</title>
  <style>
    .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
    .header { background: #ef4444; color: white; padding: 20px; text-align: center; }
    .content { padding: 30px; background: #f8fafc; }
    .booking-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444; }
    .refund-info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .next-steps { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .button { display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 5px; }
    .footer { text-align: center; color: #64748b; padding: 20px; }
    .info-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>❌ Booking Cancelled</h1>
    </div>
    
    <div class="content">
      <p>Dear ${user.name},</p>
      <p>Your parking spot booking has been cancelled.</p>
      
      <div class="booking-details">
        <h3>📋 Booking Details</h3>
        <ul>
          <li><strong>Booking ID:</strong> ${booking.id}</li>
          <li><strong>Spot Number:</strong> ${booking.spotNumber}</li>
          <li><strong>Location:</strong> ${booking.location}</li>
          <li><strong>Building:</strong> ${booking.building}</li>
          <li><strong>Booking Date:</strong> ${bookingDateStr}</li>
          <li><strong>Cancelled By:</strong> ${booking.cancelledBy}</li>
          ${booking.reason ? `<li><strong>Reason:</strong> ${booking.reason}</li>` : ''}
        </ul>
      </div>
      
      <div class="refund-info">
        <h3>💰 Refund Information</h3>
        <ul>
          <li>If you made a payment, a refund will be processed according to our cancellation policy</li>
          <li>Refunds typically take 5-7 business days to appear in your account</li>
          <li>You'll receive a separate confirmation once the refund is processed</li>
        </ul>
      </div>
      
      <div class="next-steps">
        <h3>🎯 What's Next</h3>
        <ul>
          <li>You can search for and book another available parking spot</li>
          <li>Update your preferences to receive notifications about available spots</li>
          <li>Contact support if you have any questions about this cancellation</li>
        </ul>
        
        <div style="text-align: center; margin-top: 20px;">
          <a href="#" class="button">Search Available Spots</a>
          <a href="#" class="button" style="background: #3b82f6;">Contact Support</a>
        </div>
      </div>
      
      <div class="info-box">
        We apologize for any inconvenience this may have caused.
      </div>
    </div>
    
    <div class="footer">
      <p>Best regards,<br>BCI ParkShare Team</p>
    </div>
  </div>
</body>
</html>`;

  return {
    to: user.email,
    subject,
    text,
    html,
    type: 'booking_cancelled'
  };
};

export const createPaymentReminderNotification = (
  user: { name: string; email: string },
  payment: {
    bookingId: string;
    spotNumber: string;
    amount: number;
    dueDate: Date;
    daysOverdue?: number;
  }
): EmailNotification => {
  const isOverdue = payment.daysOverdue && payment.daysOverdue > 0;
  const subject = isOverdue 
    ? `🚨 Payment Overdue - Spot ${payment.spotNumber} (${payment.daysOverdue} days)`
    : `💰 Payment Reminder - Spot ${payment.spotNumber}`;
  
  const text = `Dear ${user.name},

${isOverdue ? 'Your payment is now overdue.' : 'This is a friendly reminder about your upcoming payment.'}

PAYMENT DETAILS:
• Booking ID: ${payment.bookingId}
• Spot Number: ${payment.spotNumber}
• Amount Due: $${payment.amount}
• Due Date: ${payment.dueDate.toLocaleDateString()}
${isOverdue ? `• Days Overdue: ${payment.daysOverdue}` : ''}

${isOverdue 
  ? 'URGENT ACTION REQUIRED:\nPlease make your payment immediately to avoid service interruption. Late fees may apply.'
  : 'Please ensure payment is made by the due date to maintain uninterrupted access to your parking spot.'
}

To make a payment, please log into your account or contact our billing department.

Best regards,
BCI ParkShare Team`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Reminder</title>
  <style>
    .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
    .header { background: ${isOverdue ? '#ef4444' : '#f59e0b'}; color: white; padding: 20px; text-align: center; }
    .content { padding: 30px; background: #f8fafc; }
    .payment-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${isOverdue ? '#ef4444' : '#f59e0b'}; }
    .urgent { background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; }
    .button { display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
    .footer { text-align: center; color: #64748b; padding: 20px; }
    .amount { font-size: 1.2em; font-weight: bold; color: ${isOverdue ? '#ef4444' : '#f59e0b'}; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${isOverdue ? '🚨 Payment Overdue' : '💰 Payment Reminder'}</h1>
    </div>
    
    <div class="content">
      <p>Dear ${user.name},</p>
      <p>${isOverdue ? 'Your payment is now overdue.' : 'This is a friendly reminder about your upcoming payment.'}</p>
      
      <div class="payment-details">
        <h3>💳 Payment Details</h3>
        <ul>
          <li><strong>Booking ID:</strong> ${payment.bookingId}</li>
          <li><strong>Spot Number:</strong> ${payment.spotNumber}</li>
          <li><strong>Amount Due:</strong> <span class="amount">$${payment.amount}</span></li>
          <li><strong>Due Date:</strong> ${payment.dueDate.toLocaleDateString()}</li>
          ${isOverdue ? `<li><strong>Days Overdue:</strong> ${payment.daysOverdue}</li>` : ''}
        </ul>
      </div>
      
      ${isOverdue ? `
      <div class="urgent">
        <strong>⚠️ URGENT ACTION REQUIRED:</strong><br>
        Please make your payment immediately to avoid service interruption. Late fees may apply.
      </div>
      ` : `
      <p>Please ensure payment is made by the due date to maintain uninterrupted access to your parking spot.</p>
      `}
      
      <div style="text-align: center; margin: 20px 0;">
        <a href="#" class="button">Make Payment</a>
      </div>
    </div>
    
    <div class="footer">
      <p>Best regards,<br>BCI ParkShare Team</p>
    </div>
  </div>
</body>
</html>`;

  return {
    to: user.email,
    subject,
    text,
    html,
    type: 'payment_reminder'
  };
};

export const createSpotAvailabilityNotification = (
  user: { name: string; email: string },
  spots: {
    spotNumber: string;
    location: string;
    building: string;
    type: string;
    rate: number;
  }[]
): EmailNotification => {
  const subject = `🅿️ New Parking Spots Available - ${spots.length} spot${spots.length > 1 ? 's' : ''} match your preferences`;
  
  const spotsList = spots.map(spot => 
    `• Spot ${spot.spotNumber} (${spot.type}) - ${spot.location}, ${spot.building} - $${spot.rate}/day`
  ).join('\n');
  
  const text = `Dear ${user.name},

Great news! New parking spots are available that match your preferences:

AVAILABLE SPOTS:
${spotsList}

These spots are available on a first-come, first-served basis. Log into your account to book one of these spots before they're taken!

QUICK ACTIONS:
• View all available spots in your account
• Update your preferences for future notifications
• Book your preferred spot immediately

Don't wait - popular spots fill up quickly!

Best regards,
BCI ParkShare Team`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Spots Available</title>
  <style>
    .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
    .header { background: #3b82f6; color: white; padding: 20px; text-align: center; }
    .content { padding: 30px; background: #f8fafc; }
    .spots-list { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6; }
    .spot-item { padding: 10px; margin: 5px 0; background: #f1f5f9; border-radius: 4px; }
    .button { display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 5px; }
    .footer { text-align: center; color: #64748b; padding: 20px; }
    .urgent { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🅿️ Spots Available!</h1>
    </div>
    
    <div class="content">
      <p>Dear ${user.name},</p>
      <p>Great news! <strong>${spots.length} parking spot${spots.length > 1 ? 's are' : ' is'} available</strong> that match your preferences:</p>
      
      <div class="spots-list">
        <h3>📍 Available Spots</h3>
        ${spots.map(spot => `
        <div class="spot-item">
          <strong>Spot ${spot.spotNumber}</strong> (${spot.type})<br>
          📍 ${spot.location}, ${spot.building}<br>
          💰 $${spot.rate}/day
        </div>
        `).join('')}
      </div>
      
      <div class="urgent">
        <strong>⏰ Act Fast:</strong> These spots are available on a first-come, first-served basis!
      </div>
      
      <div style="text-align: center; margin: 20px 0;">
        <a href="#" class="button">View Available Spots</a>
        <a href="#" class="button" style="background: #3b82f6;">Book Now</a>
      </div>
    </div>
    
    <div class="footer">
      <p>Best regards,<br>BCI ParkShare Team</p>
    </div>
  </div>
</body>
</html>`;

  return {
    to: user.email,
    subject,
    text,
    html,
    type: 'spot_availability'
  };
};

export const createWeeklySummaryNotification = (
  user: { name: string; email: string },
  summary: {
    weekStart: Date;
    weekEnd: Date;
    totalBookings: number;
    totalAmount: number;
    activeSpots: number;
    upcomingBookings: number;
    pendingPayments: number;
  }
): EmailNotification => {
  const subject = `📊 Weekly Parking Summary - ${summary.weekStart.toLocaleDateString()} to ${summary.weekEnd.toLocaleDateString()}`;
  
  const text = `Dear ${user.name},

Here's your weekly parking summary for ${summary.weekStart.toLocaleDateString()} - ${summary.weekEnd.toLocaleDateString()}:

WEEK OVERVIEW:
• Total Bookings: ${summary.totalBookings}
• Total Amount: $${summary.totalAmount}
• Active Spots: ${summary.activeSpots}
• Upcoming Bookings: ${summary.upcomingBookings}
${summary.pendingPayments > 0 ? `• Pending Payments: ${summary.pendingPayments}` : ''}

${summary.pendingPayments > 0 ? 'ACTION REQUIRED: You have pending payments that need attention.' : 'All payments are up to date. Thank you!'}

QUICK ACTIONS:
• View detailed booking history
• Make payments for outstanding balances
• Book spots for upcoming weeks
• Update your parking preferences

Thank you for using BCI ParkShare!

Best regards,
BCI ParkShare Team`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Weekly Summary</title>
  <style>
    .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
    .header { background: #8b5cf6; color: white; padding: 20px; text-align: center; }
    .content { padding: 30px; background: #f8fafc; }
    .summary-stats { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #8b5cf6; }
    .stat-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
    .stat-item:last-child { border-bottom: none; }
    .stat-value { font-weight: bold; color: #8b5cf6; }
    .button { display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 5px; }
    .footer { text-align: center; color: #64748b; padding: 20px; }
    .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 Weekly Summary</h1>
      <p>${summary.weekStart.toLocaleDateString()} - ${summary.weekEnd.toLocaleDateString()}</p>
    </div>
    
    <div class="content">
      <p>Dear ${user.name},</p>
      <p>Here's your weekly parking summary:</p>
      
      <div class="summary-stats">
        <h3>📈 Week Overview</h3>
        <div class="stat-item">
          <span>Total Bookings</span>
          <span class="stat-value">${summary.totalBookings}</span>
        </div>
        <div class="stat-item">
          <span>Total Amount</span>
          <span class="stat-value">$${summary.totalAmount}</span>
        </div>
        <div class="stat-item">
          <span>Active Spots</span>
          <span class="stat-value">${summary.activeSpots}</span>
        </div>
        <div class="stat-item">
          <span>Upcoming Bookings</span>
          <span class="stat-value">${summary.upcomingBookings}</span>
        </div>
        ${summary.pendingPayments > 0 ? `
        <div class="stat-item">
          <span>Pending Payments</span>
          <span class="stat-value" style="color: #ef4444;">${summary.pendingPayments}</span>
        </div>
        ` : ''}
      </div>
      
      ${summary.pendingPayments > 0 ? `
      <div class="warning">
        <strong>⚠️ ACTION REQUIRED:</strong> You have ${summary.pendingPayments} pending payment${summary.pendingPayments > 1 ? 's' : ''} that need attention.
      </div>
      ` : `
      <p style="color: #10b981; font-weight: bold;">✅ All payments are up to date. Thank you!</p>
      `}
      
      <div style="text-align: center; margin: 20px 0;">
        <a href="#" class="button">View Details</a>
        ${summary.pendingPayments > 0 ? '<a href="#" class="button" style="background: #ef4444;">Make Payment</a>' : ''}
      </div>
    </div>
    
    <div class="footer">
      <p>Thank you for using BCI ParkShare!<br>BCI ParkShare Team</p>
    </div>
  </div>
</body>
</html>`;

  return {
    to: user.email,
    subject,
    text,
    html,
    type: 'weekly_report'
  };
};

export const createSystemMaintenanceNotification = (
  user: { name: string; email: string },
  maintenance: {
    title: string;
    description: string;
    startDate: Date;
    endDate: Date;
    affectedServices: string[];
    isUrgent: boolean;
  }
): EmailNotification => {
  const subject = `${maintenance.isUrgent ? '🚨 URGENT' : '🔧'} System Maintenance Notice - ${maintenance.title}`;
  
  const text = `Dear ${user.name},

${maintenance.isUrgent ? 'URGENT SYSTEM MAINTENANCE NOTICE' : 'Scheduled system maintenance notification'}

MAINTENANCE DETAILS:
• Title: ${maintenance.title}
• Description: ${maintenance.description}
• Start Date: ${maintenance.startDate.toLocaleString()}
• End Date: ${maintenance.endDate.toLocaleString()}
• Affected Services: ${maintenance.affectedServices.join(', ')}

${maintenance.isUrgent 
  ? 'This is urgent maintenance that may affect your parking access. Please plan accordingly.'
  : 'This maintenance is scheduled in advance and should have minimal impact on your parking experience.'
}

WHAT YOU NEED TO KNOW:
• Access to affected services may be temporarily limited
• Please plan alternative arrangements if necessary
• We'll notify you when maintenance is complete
• Contact support if you have urgent concerns

We apologize for any inconvenience and appreciate your understanding.

Best regards,
BCI ParkShare Team`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>System Maintenance</title>
  <style>
    .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
    .header { background: ${maintenance.isUrgent ? '#ef4444' : '#64748b'}; color: white; padding: 20px; text-align: center; }
    .content { padding: 30px; background: #f8fafc; }
    .maintenance-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${maintenance.isUrgent ? '#ef4444' : '#64748b'}; }
    .service-item { padding: 5px 0; }
    .urgent-notice { background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; }
    .footer { text-align: center; color: #64748b; padding: 20px; }
    .datetime { font-weight: bold; color: ${maintenance.isUrgent ? '#ef4444' : '#64748b'}; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${maintenance.isUrgent ? '🚨 URGENT MAINTENANCE' : '🔧 System Maintenance'}</h1>
    </div>
    
    <div class="content">
      <p>Dear ${user.name},</p>
      <p>${maintenance.isUrgent ? 'We have urgent system maintenance that requires immediate attention.' : 'We have scheduled system maintenance that may affect some services.'}</p>
      
      <div class="maintenance-details">
        <h3>🔧 Maintenance Details</h3>
        <ul>
          <li><strong>Title:</strong> ${maintenance.title}</li>
          <li><strong>Description:</strong> ${maintenance.description}</li>
          <li><strong>Start:</strong> <span class="datetime">${maintenance.startDate.toLocaleString()}</span></li>
          <li><strong>End:</strong> <span class="datetime">${maintenance.endDate.toLocaleString()}</span></li>
          <li><strong>Affected Services:</strong>
            <ul>
              ${maintenance.affectedServices.map(service => `<li class="service-item">${service}</li>`).join('')}
            </ul>
          </li>
        </ul>
      </div>
      
      ${maintenance.isUrgent ? `
      <div class="urgent-notice">
        <strong>⚠️ URGENT NOTICE:</strong> This maintenance may affect your parking access. Please plan accordingly and contact support if you have urgent concerns.
      </div>
      ` : `
      <p>This scheduled maintenance should have minimal impact on your parking experience. We'll keep you updated on our progress.</p>
      `}
      
      <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3>📋 What You Need to Know</h3>
        <ul>
          <li>Access to affected services may be temporarily limited</li>
          <li>Please plan alternative arrangements if necessary</li>
          <li>We'll notify you when maintenance is complete</li>
          <li>Contact support if you have urgent concerns</li>
        </ul>
      </div>
    </div>
    
    <div class="footer">
      <p>We apologize for any inconvenience and appreciate your understanding.<br>BCI ParkShare Team</p>
    </div>
  </div>
</body>
</html>`;

  return {
    to: user.email,
    subject,
    text,
    html,
    type: 'system_maintenance'
  };
};

/**
 * Waiting List Enrollment Notification - sent to user when they join the waiting list
 */
export const createWaitingListEnrollmentNotification = (
  user: { name: string; email: string },
  enrollmentDetails: {
    priority: number;
    preferredSpotType: string | null;
    enrolledDate: Date;
  }
): EmailNotification => {
  const priorityLabel = enrollmentDetails.priority === 1 ? "High" : enrollmentDetails.priority === 2 ? "Medium" : "Low";
  const subject = `Parking Waiting List - You're On the List!`;
  
  const text = `Dear ${user.name},

You have successfully joined the BCI ParkShare Waiting List!

ENROLLMENT DETAILS:
• Priority Level: ${priorityLabel}
• Preferred Spot Type: ${enrollmentDetails.preferredSpotType || 'No preference'}
• Enrolled Date: ${enrollmentDetails.enrolledDate.toLocaleDateString()}

WHAT HAPPENS NEXT:
1. We'll monitor spot availability that matches your preferences
2. When a spot becomes available, we'll notify you immediately
3. You'll have 48 hours to accept or decline the assignment
4. Your position is based on your priority level and enrollment date

You can view and manage your waiting list status in your profile settings.

Best regards,
BCI ParkShare Team`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Waiting List Confirmation</title>
  <style>
    .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
    .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
    .content { padding: 30px; background: #f8fafc; }
    .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb; }
    .next-steps { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .footer { text-align: center; color: #64748b; padding: 20px; }
    .priority-badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-weight: bold; }
    .priority-high { background: #fef2f2; color: #dc2626; }
    .priority-medium { background: #fef9c3; color: #ca8a04; }
    .priority-low { background: #f0fdf4; color: #16a34a; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>You're On the Waiting List!</h1>
    </div>
    
    <div class="content">
      <p>Dear ${user.name},</p>
      <p>You have successfully joined the BCI ParkShare Waiting List. We'll notify you as soon as a parking spot matching your preferences becomes available.</p>
      
      <div class="details">
        <h3>Your Enrollment Details</h3>
        <ul>
          <li><strong>Priority Level:</strong> <span class="priority-badge priority-${priorityLabel.toLowerCase()}">${priorityLabel}</span></li>
          <li><strong>Preferred Spot Type:</strong> ${enrollmentDetails.preferredSpotType || 'No preference'}</li>
          <li><strong>Enrolled Date:</strong> ${enrollmentDetails.enrolledDate.toLocaleDateString()}</li>
        </ul>
      </div>
      
      <div class="next-steps">
        <h3>What Happens Next?</h3>
        <ol>
          <li>We'll monitor spot availability that matches your preferences</li>
          <li>When a spot becomes available, we'll notify you immediately</li>
          <li>You'll have 48 hours to accept or decline the assignment</li>
          <li>Your position is based on your priority level and enrollment date</li>
        </ol>
      </div>
    </div>
    
    <div class="footer">
      <p>Best regards,<br>BCI ParkShare Team</p>
    </div>
  </div>
</body>
</html>`;

  return {
    to: user.email,
    subject,
    text,
    html,
    type: 'waiting_list_enrollment'
  };
};

/**
 * Waiting List Enrollment Admin Notification - sent to admin when someone joins the waiting list
 */
export const createWaitingListEnrollmentAdminNotification = (
  admin: { name: string; email: string },
  newMember: { name: string; email: string },
  enrollmentDetails: {
    priority: number;
    preferredSpotType: string | null;
    enrolledDate: Date;
  }
): EmailNotification => {
  const priorityLabel = enrollmentDetails.priority === 1 ? "High" : enrollmentDetails.priority === 2 ? "Medium" : "Low";
  const subject = `New Waiting List Enrollment - ${newMember.name}`;
  
  const text = `Dear ${admin.name},

A new user has joined the parking waiting list.

NEW MEMBER DETAILS:
• Name: ${newMember.name}
• Email: ${newMember.email}
• Priority Level: ${priorityLabel}
• Preferred Spot Type: ${enrollmentDetails.preferredSpotType || 'No preference'}
• Enrolled Date: ${enrollmentDetails.enrolledDate.toLocaleDateString()}

Please review the waiting list and assign spots as they become available.

Best regards,
BCI ParkShare System`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Waiting List Enrollment</title>
  <style>
    .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
    .header { background: #7c3aed; color: white; padding: 20px; text-align: center; }
    .content { padding: 30px; background: #f8fafc; }
    .member-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #7c3aed; }
    .footer { text-align: center; color: #64748b; padding: 20px; }
    .priority-badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-weight: bold; }
    .priority-high { background: #fef2f2; color: #dc2626; }
    .priority-medium { background: #fef9c3; color: #ca8a04; }
    .priority-low { background: #f0fdf4; color: #16a34a; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>New Waiting List Enrollment</h1>
    </div>
    
    <div class="content">
      <p>Dear ${admin.name},</p>
      <p>A new user has joined the parking waiting list and may need a spot assignment.</p>
      
      <div class="member-details">
        <h3>New Member Details</h3>
        <ul>
          <li><strong>Name:</strong> ${newMember.name}</li>
          <li><strong>Email:</strong> <a href="mailto:${newMember.email}">${newMember.email}</a></li>
          <li><strong>Priority Level:</strong> <span class="priority-badge priority-${priorityLabel.toLowerCase()}">${priorityLabel}</span></li>
          <li><strong>Preferred Spot Type:</strong> ${enrollmentDetails.preferredSpotType || 'No preference'}</li>
          <li><strong>Enrolled Date:</strong> ${enrollmentDetails.enrolledDate.toLocaleDateString()}</li>
        </ul>
      </div>
      
      <p>Please review the waiting list and assign spots as they become available.</p>
    </div>
    
    <div class="footer">
      <p>BCI ParkShare System</p>
    </div>
  </div>
</body>
</html>`;

  return {
    to: admin.email,
    subject,
    text,
    html,
    type: 'waiting_list_admin'
  };
};

/**
 * Send Email Notification
 */
export async function sendEmailNotification(notification: EmailNotification): Promise<{ success: boolean; error?: string; provider?: EmailProvider }> {
  try {
    // Mock notification if no provider is configured
    if (activeProvider === 'mock') {
      console.log('📧 MOCK EMAIL NOTIFICATION:');
      console.log(`To: ${notification.to}`);
      console.log(`Subject: ${notification.subject}`);
      console.log(`Type: ${notification.type}`);
      console.log('---');
      
      // Simulate email sending delay
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return { success: true, provider: 'mock' };
    }

    // Try Microsoft 365 first if it's the active provider
    if (activeProvider === 'ms365' && msalClient) {
      try {
        await sendEmailViaMS365(
          notification.to,
          notification.subject,
          notification.text,
          notification.html
        );
        console.log(`✓ Email sent via MS365 to ${notification.to}: ${notification.subject}`);
        return { success: true, provider: 'ms365' };
      } catch (ms365Error) {
        console.error('❌ MS365 email failed, attempting SendGrid fallback:', ms365Error);
        // Fall through to SendGrid if available
        if (mailService) {
          await mailService.send({
            to: notification.to,
            from: process.env.SENDGRID_FROM_EMAIL || 'noreply@bci.ca',
            subject: notification.subject,
            text: notification.text,
            html: notification.html,
          });
          console.log(`✓ Email sent via SendGrid (fallback) to ${notification.to}: ${notification.subject}`);
          return { success: true, provider: 'sendgrid' };
        }
        throw ms365Error;
      }
    }

    // Use SendGrid if it's the active provider
    if (activeProvider === 'sendgrid' && mailService) {
      await mailService.send({
        to: notification.to,
        from: process.env.SENDGRID_FROM_EMAIL || 'noreply@bci.ca',
        subject: notification.subject,
        text: notification.text,
        html: notification.html,
      });
      console.log(`✓ Email sent via SendGrid to ${notification.to}: ${notification.subject}`);
      return { success: true, provider: 'sendgrid' };
    }

    throw new Error('No email provider available');
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ Failed to send email to ${notification.to}:`, errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Main Notification Functions
 */
export async function sendAssignmentNotification(
  user: { name: string; email: string; id: string },
  waitingListEntry: WaitingList,
  spotDetails: { spotNumber: string; location: string; building: string },
  userPreferences: { emailNotifications?: boolean; pushNotifications?: boolean } = {}
): Promise<{ emailSent: boolean; inAppSent: boolean }> {
  const results = { emailSent: false, inAppSent: false };

  try {
    // Send email notification if user has email notifications enabled
    if (userPreferences.emailNotifications !== false) {
      const emailNotification = createAssignmentNotification(user, waitingListEntry, spotDetails);
      const emailResult = await sendEmailNotification(emailNotification);
      results.emailSent = emailResult.success;
    }

    // Send in-app notification if user has push notifications enabled
    if (userPreferences.pushNotifications !== false) {
      await storage.createInAppNotification({
        userId: user.id,
        type: 'assignment',
        title: `Parking Spot Assigned: ${spotDetails.spotNumber}`,
        message: `You've been assigned parking spot ${spotDetails.spotNumber} in ${spotDetails.building}. Please respond within 48 hours.`,
        data: {
          spotNumber: spotDetails.spotNumber,
          location: spotDetails.location,
          building: spotDetails.building,
          waitingListEntryId: waitingListEntry.id,
          expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000)
        },
        read: false,
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000)
      });
      
      results.inAppSent = true;
    }

    console.log(`✓ Assignment notifications sent to ${user.name} (email: ${results.emailSent}, in-app: ${results.inAppSent})`);
    
  } catch (error) {
    console.error('❌ Error sending assignment notifications:', error);
  }

  return results;
}

export async function sendWelcomeNotification(
  user: { name: string; email: string; id: string },
  waitingListEntry: WaitingList,
  userPreferences: { emailNotifications?: boolean; pushNotifications?: boolean } = {}
): Promise<{ emailSent: boolean; inAppSent: boolean }> {
  const results = { emailSent: false, inAppSent: false };

  try {
    // Send welcome email
    if (userPreferences.emailNotifications !== false) {
      const emailNotification = createWelcomeNotification(user, waitingListEntry);
      const emailResult = await sendEmailNotification(emailNotification);
      results.emailSent = emailResult.success;
    }

    // Send in-app welcome notification
    if (userPreferences.pushNotifications !== false) {
      await storage.createInAppNotification({
        userId: user.id,
        type: 'welcome',
        title: 'Welcome to BCI ParkShare Waiting List',
        message: `You've been enrolled in the waiting list. We'll notify you when a ${waitingListEntry.preferredSpotType || 'parking'} spot becomes available.`,
        data: {
          waitingListEntryId: waitingListEntry.id,
          preferredSpotType: waitingListEntry.preferredSpotType,
          preferredBuilding: waitingListEntry.preferredBuilding
        },
        read: false
      });
      
      results.inAppSent = true;
    }

    console.log(`✓ Welcome notifications sent to ${user.name} (email: ${results.emailSent}, in-app: ${results.inAppSent})`);
    
  } catch (error) {
    console.error('❌ Error sending welcome notifications:', error);
  }

  return results;
}

export async function sendBookingConfirmationNotification(
  user: { name: string; email: string; id: string },
  booking: {
    id: string;
    spotNumber: string;
    location: string;
    building: string;
    startDate: Date;
    endDate: Date;
    rate: number;
    totalAmount: number;
  },
  userPreferences: { bookingConfirmations?: boolean; emailNotifications?: boolean } = {}
): Promise<{ emailSent: boolean; inAppSent: boolean }> {
  const results = { emailSent: false, inAppSent: false };

  try {
    // Send email notification if user has booking confirmations enabled
    if (userPreferences.emailNotifications !== false && userPreferences.bookingConfirmations !== false) {
      const emailNotification = createBookingConfirmationNotification(user, booking);
      const emailResult = await sendEmailNotification(emailNotification);
      results.emailSent = emailResult.success;
    }

    // Send in-app notification
    await storage.createInAppNotification({
      userId: user.id,
      type: 'booking_confirmation',
      title: `Booking Confirmed: Spot ${booking.spotNumber}`,
      message: `Your booking for spot ${booking.spotNumber} from ${booking.startDate.toLocaleDateString()} to ${booking.endDate.toLocaleDateString()} has been confirmed.`,
      data: {
        bookingId: booking.id,
        spotNumber: booking.spotNumber,
        totalAmount: booking.totalAmount
      },
      read: false
    });
    
    results.inAppSent = true;

    console.log(`✓ Booking confirmation notifications sent to ${user.name} (email: ${results.emailSent}, in-app: ${results.inAppSent})`);
    
  } catch (error) {
    console.error('❌ Error sending booking confirmation notifications:', error);
  }

  return results;
}

export async function sendPaymentReminderNotification(
  user: { name: string; email: string; id: string },
  payment: {
    bookingId: string;
    spotNumber: string;
    amount: number;
    dueDate: Date;
    daysOverdue?: number;
  },
  userPreferences: { paymentReminders?: boolean; emailNotifications?: boolean } = {}
): Promise<{ emailSent: boolean; inAppSent: boolean }> {
  const results = { emailSent: false, inAppSent: false };

  try {
    // Send email notification if user has payment reminders enabled
    if (userPreferences.emailNotifications !== false && userPreferences.paymentReminders !== false) {
      const emailNotification = createPaymentReminderNotification(user, payment);
      const emailResult = await sendEmailNotification(emailNotification);
      results.emailSent = emailResult.success;
    }

    // Send in-app notification
    const isOverdue = payment.daysOverdue && payment.daysOverdue > 0;
    await storage.createInAppNotification({
      userId: user.id,
      type: 'payment_reminder',
      title: isOverdue ? `Payment Overdue: Spot ${payment.spotNumber}` : `Payment Reminder: Spot ${payment.spotNumber}`,
      message: `${isOverdue ? 'Overdue payment' : 'Payment reminder'} for $${payment.amount}. Due: ${payment.dueDate.toLocaleDateString()}`,
      data: {
        bookingId: payment.bookingId,
        amount: payment.amount,
        dueDate: payment.dueDate,
        daysOverdue: payment.daysOverdue
      },
      read: false
    });
    
    results.inAppSent = true;

    console.log(`✓ Payment reminder notifications sent to ${user.name} (email: ${results.emailSent}, in-app: ${results.inAppSent})`);
    
  } catch (error) {
    console.error('❌ Error sending payment reminder notifications:', error);
  }

  return results;
}

export async function sendSpotAvailabilityNotification(
  user: { name: string; email: string; id: string },
  spots: {
    spotNumber: string;
    location: string;
    building: string;
    type: string;
    rate: number;
  }[],
  userPreferences: { spotAvailability?: boolean; emailNotifications?: boolean } = {}
): Promise<{ emailSent: boolean; inAppSent: boolean }> {
  const results = { emailSent: false, inAppSent: false };

  try {
    // Send email notification if user has spot availability notifications enabled
    if (userPreferences.emailNotifications !== false && userPreferences.spotAvailability !== false) {
      const emailNotification = createSpotAvailabilityNotification(user, spots);
      const emailResult = await sendEmailNotification(emailNotification);
      results.emailSent = emailResult.success;
    }

    // Send in-app notification
    await storage.createInAppNotification({
      userId: user.id,
      type: 'spot_availability',
      title: `${spots.length} Spot${spots.length > 1 ? 's' : ''} Available`,
      message: `New parking spots are available that match your preferences. Act fast!`,
      data: {
        spotsCount: spots.length,
        spots: spots
      },
      read: false
    });
    
    results.inAppSent = true;

    console.log(`✓ Spot availability notifications sent to ${user.name} (email: ${results.emailSent}, in-app: ${results.inAppSent})`);
    
  } catch (error) {
    console.error('❌ Error sending spot availability notifications:', error);
  }

  return results;
}

export async function sendWeeklySummaryNotification(
  user: { name: string; email: string; id: string },
  summary: {
    weekStart: Date;
    weekEnd: Date;
    totalBookings: number;
    totalAmount: number;
    activeSpots: number;
    upcomingBookings: number;
    pendingPayments: number;
  },
  userPreferences: { weeklyReports?: boolean; emailNotifications?: boolean } = {}
): Promise<{ emailSent: boolean; inAppSent: boolean }> {
  const results = { emailSent: false, inAppSent: false };

  try {
    // Send email notification if user has weekly reports enabled
    if (userPreferences.emailNotifications !== false && userPreferences.weeklyReports !== false) {
      const emailNotification = createWeeklySummaryNotification(user, summary);
      const emailResult = await sendEmailNotification(emailNotification);
      results.emailSent = emailResult.success;
    }

    // Send in-app notification
    await storage.createInAppNotification({
      userId: user.id,
      type: 'weekly_report',
      title: 'Weekly Parking Summary',
      message: `Your weekly summary: ${summary.totalBookings} bookings, $${summary.totalAmount} total${summary.pendingPayments > 0 ? `, ${summary.pendingPayments} pending payments` : ''}`,
      data: summary,
      read: false
    });
    
    results.inAppSent = true;

    console.log(`✓ Weekly summary notifications sent to ${user.name} (email: ${results.emailSent}, in-app: ${results.inAppSent})`);
    
  } catch (error) {
    console.error('❌ Error sending weekly summary notifications:', error);
  }

  return results;
}

export async function sendSystemMaintenanceNotification(
  user: { name: string; email: string; id: string },
  maintenance: {
    title: string;
    description: string;
    startDate: Date;
    endDate: Date;
    affectedServices: string[];
    isUrgent: boolean;
  },
  userPreferences: { systemMaintenance?: boolean; emailNotifications?: boolean } = {}
): Promise<{ emailSent: boolean; inAppSent: boolean }> {
  const results = { emailSent: false, inAppSent: false };

  try {
    // Send email notification if user has system maintenance notifications enabled
    if (userPreferences.emailNotifications !== false && userPreferences.systemMaintenance !== false) {
      const emailNotification = createSystemMaintenanceNotification(user, maintenance);
      const emailResult = await sendEmailNotification(emailNotification);
      results.emailSent = emailResult.success;
    }

    // Send in-app notification
    await storage.createInAppNotification({
      userId: user.id,
      type: 'system_maintenance',
      title: maintenance.isUrgent ? 'URGENT: System Maintenance' : 'System Maintenance Notice',
      message: `${maintenance.title} - ${maintenance.startDate.toLocaleDateString()} to ${maintenance.endDate.toLocaleDateString()}`,
      data: maintenance,
      read: false
    });
    
    results.inAppSent = true;

    console.log(`✓ System maintenance notifications sent to ${user.name} (email: ${results.emailSent}, in-app: ${results.inAppSent})`);
    
  } catch (error) {
    console.error('❌ Error sending system maintenance notifications:', error);
  }

  return results;
}

export async function sendBookingCancellationNotification(
  user: { name: string; email: string; id: string },
  booking: {
    id: string;
    spotNumber: string;
    location: string;
    building: string;
    bookingDate: Date | string;
    cancelledBy: string;
    reason?: string;
  },
  userPreferences: { bookingConfirmations?: boolean; emailNotifications?: boolean } = {}
): Promise<{ emailSent: boolean; inAppSent: boolean }> {
  const results = { emailSent: false, inAppSent: false };

  try {
    // Send email notification if user has booking confirmations enabled
    if (userPreferences.emailNotifications !== false && userPreferences.bookingConfirmations !== false) {
      const emailNotification = createBookingCancellationNotification(user, booking);
      const emailResult = await sendEmailNotification(emailNotification);
      results.emailSent = emailResult.success;
    }

    // Send in-app notification (always sent)
    await storage.createInAppNotification({
      userId: user.id,
      type: 'booking_cancelled',
      title: `Booking Cancelled: Spot ${booking.spotNumber}`,
      message: `Your booking for spot ${booking.spotNumber} has been cancelled by ${booking.cancelledBy}.${booking.reason ? ` Reason: ${booking.reason}` : ''}`,
      data: {
        bookingId: booking.id,
        spotNumber: booking.spotNumber,
        location: booking.location,
        building: booking.building,
        cancelledBy: booking.cancelledBy,
        reason: booking.reason
      },
      read: false
    });
    
    results.inAppSent = true;

    console.log(`✓ Booking cancellation notifications sent to ${user.name} (email: ${results.emailSent}, in-app: ${results.inAppSent})`);
    
  } catch (error) {
    console.error('❌ Error sending booking cancellation notifications:', error);
  }

  return results;
}