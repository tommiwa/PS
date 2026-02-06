// Notification Service - handles email and in-app notifications
// Supports Mandrill and Microsoft 365 Graph API for email functionality

import { ConfidentialClientApplication, Configuration } from '@azure/msal-node';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import type { WaitingList, ParkingSpot, AuthUser } from '@shared/schema';
import { storage } from './storage';

const LOGO_BASE64 = fs.readFileSync(path.join(process.cwd(), 'client/public/favicon.png')).toString('base64');

// Email provider configuration
type EmailProvider = 'ms365' | 'mandrill' | 'mock';

// Check which email providers are configured
const MS365_CONFIGURED = !!(
  process.env.MS365_TENANT_ID &&
  process.env.MS365_CLIENT_ID &&
  process.env.MS365_CLIENT_SECRET &&
  process.env.MS365_SENDER_EMAIL
);
const MANDRILL_CONFIGURED = !!(process.env.MANDRILL_API_KEY);

// Determine which provider to use (MS365 takes priority if both are configured)
const activeProvider: EmailProvider = MS365_CONFIGURED ? 'ms365' : (MANDRILL_CONFIGURED ? 'mandrill' : 'mock');

let msalClient: ConfidentialClientApplication | null = null;

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

// Log Mandrill configuration status
if (MANDRILL_CONFIGURED) {
  console.log('✓ Mandrill configured successfully');
}

// Log the active email provider
if (activeProvider === 'ms365') {
  console.log('📧 Email provider: Microsoft 365 Graph API');
} else if (activeProvider === 'mandrill') {
  console.log('📧 Email provider: Mandrill');
} else {
  console.log('⚠️  No email provider configured - using mock notifications for development');
}

// Send email via Mandrill API
async function sendEmailViaMandrill(
  to: string,
  subject: string,
  text: string,
  html: string
): Promise<void> {
  const apiKey = process.env.MANDRILL_API_KEY!;
  const fromEmail = process.env.MANDRILL_FROM_EMAIL || 'noreply@bci.ca';
  const fromName = process.env.MANDRILL_FROM_NAME || 'BCI ParkShare';
  
  const payload = {
    key: apiKey,
    message: {
      html: html,
      text: text,
      subject: subject,
      from_email: fromEmail,
      from_name: fromName,
      to: [
        {
          email: to,
          type: 'to'
        }
      ],
      headers: {
        'Reply-To': fromEmail
      },
      track_opens: true,
      track_clicks: true,
      images: [
        {
          type: 'image/png',
          name: 'logo',
          content: LOGO_BASE64
        }
      ]
    }
  };
  
  await axios.post(
    'https://mandrillapp.com/api/1.0/messages/send.json',
    payload,
    {
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );
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
      ],
      attachments: [
        {
          '@odata.type': '#microsoft.graph.fileAttachment',
          name: 'logo.png',
          contentId: 'logo',
          isInline: true,
          contentType: 'image/png',
          contentBytes: LOGO_BASE64
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
  mandrillAvailable: boolean;
} {
  return {
    provider: activeProvider,
    ms365Available: MS365_CONFIGURED,
    mandrillAvailable: MANDRILL_CONFIGURED
  };
}

export interface EmailNotification {
  to: string;
  subject: string;
  text: string;
  html: string;
  type: 'assignment' | 'welcome' | 'booking_confirmation' | 'booking_cancelled' | 'payment_reminder' | 'spot_availability' | 'weekly_report' | 'system_maintenance' | 'general' | 'waiting_list_enrollment' | 'waiting_list_admin';
}

export interface InAppNotification {
  id: string;
  userId: string;
  type: 'assignment' | 'welcome' | 'booking_confirmation' | 'booking_cancelled' | 'payment_reminder' | 'spot_availability' | 'weekly_report' | 'system_maintenance' | 'general' | 'waiting_list_enrollment' | 'waiting_list_admin';
  title: string;
  message: string;
  data?: any;
  read: boolean;
  createdAt: Date;
  expiresAt?: Date;
}

/**
 * Email Design System
 * Brand Color: BCI Blue #1e9df1 (matches app primary color)
 * All emails use consistent BCI blue branding
 */

const BCI_BLUE = '#1e9df1';
const BCI_BLUE_DARK = '#1580c9';


type EmailTheme = 'primary' | 'success' | 'warning' | 'danger' | 'neutral';

const themeColors: Record<EmailTheme, { accent: string; light: string; footerBar: string }> = {
  primary: { accent: BCI_BLUE, light: '#e0f2fe', footerBar: BCI_BLUE },
  success: { accent: BCI_BLUE, light: '#e0f2fe', footerBar: BCI_BLUE },
  warning: { accent: BCI_BLUE, light: '#e0f2fe', footerBar: BCI_BLUE },
  danger: { accent: BCI_BLUE, light: '#e0f2fe', footerBar: BCI_BLUE },
  neutral: { accent: BCI_BLUE, light: '#e0f2fe', footerBar: BCI_BLUE }
};

/**
 * Wraps email content with consistent header, footer, and styling
 * Design inspired by Smartlead.ai - clean, minimal, professional
 */
export function wrapEmailTemplate(options: {
  title: string;
  content: string;
  theme?: EmailTheme;
  ctaButton?: { text: string; url: string; secondary?: boolean };
  secondaryButton?: { text: string; url: string };
}): string {
  const theme = options.theme || 'primary';
  const colors = themeColors[theme];
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${options.title}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    /* Reset styles */
    body, table, td, p, a, li { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #c7d2e3; }
    
    /* Container styles */
    .email-container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    
    /* Content styles */
    .email-content {
      padding: 40px 48px;
      font-family: 'Segoe UI', Arial, Helvetica, sans-serif;
      font-size: 16px;
      line-height: 1.7;
      color: #374151;
    }
    .email-content p { margin: 0 0 16px 0; }
    .email-content p:last-child { margin-bottom: 0; }
    
    /* Card/Box styles */
    .info-card {
      background-color: #f8fafc;
      border-radius: 8px;
      padding: 20px 24px;
      margin: 24px 0;
      border-left: 4px solid ${colors.accent};
    }
    .info-card h3 {
      font-family: 'Segoe UI', Arial, Helvetica, sans-serif;
      font-size: 16px;
      font-weight: 600;
      color: #1e293b;
      margin: 0 0 12px 0;
    }
    .info-card ul {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .info-card li {
      padding: 6px 0;
      font-size: 15px;
      color: #475569;
    }
    .info-card li strong { color: #1e293b; }
    
    /* Highlight box */
    .highlight-box {
      background-color: ${colors.light};
      border-radius: 6px;
      padding: 14px 18px;
      margin: 20px 0;
      font-size: 15px;
    }
    
    /* Button styles */
    .button-container { text-align: left; margin: 28px 0; }
    .btn {
      display: inline-block;
      padding: 12px 28px;
      font-family: 'Segoe UI', Arial, Helvetica, sans-serif;
      font-size: 15px;
      font-weight: 600;
      text-decoration: none;
      border-radius: 6px;
      margin-right: 10px;
    }
    .btn-primary {
      background-color: ${colors.accent};
      color: #ffffff !important;
    }
    .btn-secondary {
      background-color: #ffffff;
      color: ${colors.accent} !important;
      border: 2px solid ${colors.accent};
    }
    
    /* Responsive styles */
    @media screen and (max-width: 600px) {
      .email-container { width: 100% !important; border-radius: 0 !important; }
      .email-content { padding: 28px 24px !important; }
      .email-title { font-size: 22px !important; }
      .info-card { padding: 16px 18px !important; }
      .btn { display: block; margin: 8px 0 !important; text-align: center; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #c7d2e3;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #c7d2e3;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" class="email-container" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.08);">
          
          <!-- Logo Header -->
          <tr>
            <td style="padding: 36px 48px 0 48px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="vertical-align: middle; padding-right: 14px;">
                    <img src="cid:logo" alt="BCI ParkShare" width="44" height="44" style="width: 44px; height: 44px; border-radius: 10px; display: block;" />
                  </td>
                  <td style="vertical-align: middle;">
                    <span style="color: ${BCI_BLUE}; font-family: 'Segoe UI', Arial, Helvetica, sans-serif; font-size: 22px; font-weight: 700;">BCI ParkShare</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Title -->
          <tr>
            <td style="padding: 28px 48px 0 48px;">
              <h1 style="color: ${BCI_BLUE}; font-family: 'Segoe UI', Arial, Helvetica, sans-serif; font-size: 28px; font-weight: 700; margin: 0; line-height: 1.3; letter-spacing: -0.3px;">${options.title}</h1>
            </td>
          </tr>
          
          <!-- Separator Line -->
          <tr>
            <td style="padding: 20px 48px 0 48px;">
              <div style="height: 1px; background-color: #e2e8f0;"></div>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td class="email-content" style="padding: 28px 48px 40px 48px; font-family: 'Segoe UI', Arial, Helvetica, sans-serif; font-size: 16px; line-height: 1.7; color: #374151;">
              ${options.content}
              
              ${options.ctaButton ? `
              <div class="button-container" style="margin: 28px 0 0 0;">
                <a href="${options.ctaButton.url}" class="btn btn-primary" style="display: inline-block; padding: 12px 28px; font-family: 'Segoe UI', Arial, Helvetica, sans-serif; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 6px; background-color: ${colors.accent}; color: #ffffff;">${options.ctaButton.text}</a>
                ${options.secondaryButton ? `<a href="${options.secondaryButton.url}" class="btn btn-secondary" style="display: inline-block; padding: 12px 28px; font-family: 'Segoe UI', Arial, Helvetica, sans-serif; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 6px; background-color: #ffffff; color: ${colors.accent}; border: 2px solid ${colors.accent}; margin-left: 10px;">${options.secondaryButton.text}</a>` : ''}
              </div>
              ` : ''}
            </td>
          </tr>
          
          <!-- Warm Regards -->
          <tr>
            <td style="padding: 0 48px 32px 48px;">
              <p style="font-family: 'Segoe UI', Arial, Helvetica, sans-serif; font-size: 15px; color: #64748b; margin: 0;">
                Warm regards,<br>
                <strong style="color: #475569;">The BCI ParkShare Team</strong>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 0 48px 24px 48px; text-align: center;">
              <p style="font-family: 'Segoe UI', Arial, Helvetica, sans-serif; font-size: 11px; color: #94a3b8; margin: 0;">
                A BCI Workplace Services Initiative &bull; In partnership with Technology &amp; Innovation &bull; &copy; ${new Date().getFullYear()} BCI
              </p>
            </td>
          </tr>
          
          <!-- Colored Footer Bar -->
          <tr>
            <td style="height: 8px; background-color: ${BCI_BLUE};"></td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Email Templates
 */
export const createAssignmentNotification = (
  user: { name: string; email: string },
  waitingListEntry: WaitingList,
  spotDetails: { spotNumber: string; location: string; building: string }
): EmailNotification => {
  const subject = `Parking Spot Assigned - Spot ${spotDetails.spotNumber}`;
  
  const text = `Dear ${user.name},

Great news! We're excited to let you know that a parking spot has been assigned to you from the waiting list.

SPOT DETAILS:
- Spot Number: ${spotDetails.spotNumber}
- Location: ${spotDetails.location} - ${spotDetails.building}
- Type: Standard

NEXT STEPS:
1. Please respond within 48 hours to accept or decline this assignment
2. If accepted, you'll receive setup instructions and access details
3. If declined, you'll remain on the waiting list with your current priority

IMPORTANT: This assignment will expire if not confirmed within 48 hours.

Warm regards,
The BCI ParkShare Team`;

  const content = `
    <p>Dear ${user.name},</p>
    <p>Great news! We're excited to let you know that a parking spot has been assigned to you from the waiting list. Your patience has paid off!</p>
    
    <div class="info-card" style="background-color: #f8fafc; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid ${BCI_BLUE};">
      <h3 style="font-family: Arial, Helvetica, sans-serif; font-size: 18px; font-weight: 600; color: #1e293b; margin: 0 0 16px 0;">Your Assigned Spot</h3>
      <ul style="margin: 0; padding: 0; list-style: none;">
        <li style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 15px;"><strong style="color: #475569;">Spot Number:</strong> ${spotDetails.spotNumber}</li>
        <li style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 15px;"><strong style="color: #475569;">Location:</strong> ${spotDetails.location} - ${spotDetails.building}</li>
        <li style="padding: 8px 0; font-size: 15px;"><strong style="color: #475569;">Spot Type:</strong> Standard</li>
      </ul>
    </div>
    
    <div class="info-card" style="background-color: #f8fafc; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid ${BCI_BLUE};">
      <h3 style="font-family: Arial, Helvetica, sans-serif; font-size: 18px; font-weight: 600; color: #1e293b; margin: 0 0 16px 0;">Next Steps</h3>
      <ol style="margin: 0; padding-left: 20px;">
        <li style="padding: 6px 0;">Please respond within <strong>48 hours</strong> to accept or decline</li>
        <li style="padding: 6px 0;">If you accept, you'll receive setup instructions and access details</li>
        <li style="padding: 6px 0;">If you decline, you'll stay on the waiting list with your current priority</li>
      </ol>
    </div>
    
    <div class="highlight-box warning" style="background-color: #e0f2fe; border-radius: 8px; padding: 16px 20px; margin: 24px 0;">
      <strong>Important:</strong> This assignment will expire if not confirmed within 48 hours. Please respond promptly to secure your spot.
    </div>
  `;

  const html = wrapEmailTemplate({
    title: 'Your Parking Spot Is Ready',
    content,
    theme: 'success'
  });

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
  const priorityLabel = waitingListEntry.priority === 1 ? "High" : waitingListEntry.priority === 2 ? "Medium" : "Standard";
  
  const text = `Dear ${user.name},

Welcome to the BCI ParkShare waiting list! We're delighted to have you join our parking community.

YOUR ENROLLMENT DETAILS:
- Preferred Spot Type: ${waitingListEntry.preferredSpotTypeId ? 'Selected' : 'Any Available'}
- Preferred Location: ${waitingListEntry.preferredLocationId ? 'Selected' : 'Any Location'}
- Priority Level: ${priorityLabel}
- Enrollment Date: ${waitingListEntry.enrolledDate?.toLocaleDateString()}

WHAT HAPPENS NEXT:
- We'll monitor spot availability that matches your preferences
- When a spot becomes available, you'll be notified immediately
- You'll have 48 hours to accept or decline any assignment
- You can update your preferences anytime through BCI ParkShare

Thank you for your patience. We'll be in touch soon!

Warm regards,
The BCI ParkShare Team`;

  const content = `
    <p>Dear ${user.name},</p>
    <p>Welcome to the BCI ParkShare waiting list! We're delighted to have you join our parking community. Your enrollment has been successfully processed.</p>
    
    <div class="info-card" style="background-color: #f8fafc; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid ${BCI_BLUE};">
      <h3 style="font-family: Arial, Helvetica, sans-serif; font-size: 18px; font-weight: 600; color: #1e293b; margin: 0 0 16px 0;">Your Enrollment Details</h3>
      <ul style="margin: 0; padding: 0; list-style: none;">
        <li style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 15px;"><strong style="color: #475569;">Preferred Spot Type:</strong> ${waitingListEntry.preferredSpotTypeId ? 'Selected' : 'Any Available'}</li>
        <li style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 15px;"><strong style="color: #475569;">Preferred Location:</strong> ${waitingListEntry.preferredLocationId ? 'Selected' : 'Any Location'}</li>
        <li style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 15px;"><strong style="color: #475569;">Priority Level:</strong> ${priorityLabel}</li>
        <li style="padding: 8px 0; font-size: 15px;"><strong style="color: #475569;">Enrollment Date:</strong> ${waitingListEntry.enrolledDate?.toLocaleDateString()}</li>
      </ul>
    </div>
    
    <div class="info-card" style="background-color: #f8fafc; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid ${BCI_BLUE};">
      <h3 style="font-family: Arial, Helvetica, sans-serif; font-size: 18px; font-weight: 600; color: #1e293b; margin: 0 0 16px 0;">What Happens Next</h3>
      <ul style="margin: 0; padding: 0; list-style: none;">
        <li style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 15px;">We'll monitor spot availability matching your preferences</li>
        <li style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 15px;">When a spot becomes available, you'll be notified immediately</li>
        <li style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 15px;">You'll have 48 hours to accept or decline any assignment</li>
        <li style="padding: 8px 0; font-size: 15px;">You can update your preferences anytime through BCI ParkShare</li>
      </ul>
    </div>
    
    <p>Thank you for your patience. We'll be in touch as soon as a spot matching your preferences becomes available!</p>
  `;

  const html = wrapEmailTemplate({
    title: 'Welcome to the Waiting List',
    content,
    theme: 'primary'
  });

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
  },
  owner?: { name: string; email: string } | null
): EmailNotification => {
  const subject = `Booking Confirmed - Spot ${booking.spotNumber}`;
  
  const ownerText = owner ? `\nSPOT OWNER:\n- Name: ${owner.name}\n- Email: ${owner.email}\n` : '';
  
  const text = `Dear ${user.name},

Great news! Your parking spot booking has been confirmed. We're excited to have you parked with us!

BOOKING DETAILS:
- Spot Number: ${booking.spotNumber}
- Location: ${booking.location} - ${booking.building}
- Booking Date: ${booking.startDate.toLocaleDateString()} to ${booking.endDate.toLocaleDateString()}
- Amount: $${booking.totalAmount}
${ownerText}
IMPORTANT INFORMATION:
- Please use your BCI access card to enter the parking facility.
- Refer to the visual directory in Bull & Bear to locate your assigned spot before arriving.
- Kindly use the parking space responsibly and follow all facility guidelines.

Thank you for choosing BCI ParkShare!

Warm regards,
The BCI ParkShare Team`;

  const ownerSection = owner ? `
    <div class="info-card" style="background-color: #e0f2fe; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid ${BCI_BLUE};">
      <h3 style="font-family: Arial, Helvetica, sans-serif; font-size: 18px; font-weight: 600; color: #1e293b; margin: 0 0 16px 0;">Spot Owner</h3>
      <ul style="margin: 0; padding: 0; list-style: none;">
        <li style="padding: 8px 0; border-bottom: 1px solid #bfdbfe; font-size: 15px;"><strong style="color: #475569;">Name:</strong> ${owner.name}</li>
        <li style="padding: 8px 0; font-size: 15px;"><strong style="color: #475569;">Email:</strong> ${owner.email}</li>
      </ul>
    </div>
  ` : '';

  const content = `
    <p>Dear ${user.name},</p>
    <p>Great news! Your parking spot booking has been confirmed. We're excited to have you parked with us!</p>
    
    <div class="info-card" style="background-color: #f8fafc; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid ${BCI_BLUE};">
      <h3 style="font-family: Arial, Helvetica, sans-serif; font-size: 18px; font-weight: 600; color: #1e293b; margin: 0 0 16px 0;">Booking Details</h3>
      <ul style="margin: 0; padding: 0; list-style: none;">
        <li style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 15px;"><strong style="color: #475569;">Spot Number:</strong> ${booking.spotNumber}</li>
        <li style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 15px;"><strong style="color: #475569;">Location:</strong> ${booking.location} - ${booking.building}</li>
        <li style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 15px;"><strong style="color: #475569;">Booking Date:</strong> ${booking.startDate.toLocaleDateString()} to ${booking.endDate.toLocaleDateString()}</li>
        <li style="padding: 8px 0; font-size: 15px;"><strong style="color: #475569;">Amount:</strong> <span style="color: ${BCI_BLUE}; font-weight: 600;">$${booking.totalAmount}</span></li>
      </ul>
    </div>
    
    ${ownerSection}
    
    <div class="info-card" style="background-color: #f8fafc; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid ${BCI_BLUE};">
      <h3 style="font-family: Arial, Helvetica, sans-serif; font-size: 18px; font-weight: 600; color: #1e293b; margin: 0 0 16px 0;">Important Information</h3>
      <ul style="margin: 0; padding: 0 0 0 20px; list-style: disc;">
        <li style="padding: 4px 0; font-size: 15px; color: #475569; line-height: 1.6;">Please use your BCI access card to enter the parking facility.</li>
        <li style="padding: 4px 0; font-size: 15px; color: #475569; line-height: 1.6;">Refer to the visual directory in Bull & Bear to locate your assigned spot before arriving.</li>
        <li style="padding: 4px 0; font-size: 15px; color: #475569; line-height: 1.6;">Kindly use the parking space responsibly and follow all facility guidelines.</li>
      </ul>
    </div>
    
    <p>Thank you for choosing BCI ParkShare. We hope you have a seamless parking experience!</p>
  `;

  const html = wrapEmailTemplate({
    title: 'Booking Confirmed',
    content,
    theme: 'success'
  });

  return {
    to: user.email,
    subject,
    text,
    html,
    type: 'booking_confirmation'
  };
};

// Owner notification when someone books their spot
export const createOwnerBookingNotification = (
  owner: { name: string; email: string },
  renter: { name: string; email: string },
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
  const subject = `New Booking for Your Spot ${booking.spotNumber}`;
  
  const text = `Dear ${owner.name},

Great news! Your parking spot has been booked. Thank you for sharing your space with a colleague!

BOOKING DETAILS:
- Spot Number: ${booking.spotNumber}
- Location: ${booking.location} - ${booking.building}
- Booking Date: ${booking.startDate.toLocaleDateString()} to ${booking.endDate.toLocaleDateString()}
- Amount: $${booking.totalAmount}

RENTER INFORMATION:
- Name: ${renter.name}
- Email: ${renter.email}

Your spot will be used during this period. If you have any concerns, please contact the BCI ParkShare team.

Warm regards,
The BCI ParkShare Team`;

  const content = `
    <p>Dear ${owner.name},</p>
    <p>Great news! Your parking spot has been booked. Thank you for sharing your space with a colleague!</p>
    
    <div class="info-card" style="background-color: #f8fafc; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid ${BCI_BLUE};">
      <h3 style="font-family: Arial, Helvetica, sans-serif; font-size: 18px; font-weight: 600; color: #1e293b; margin: 0 0 16px 0;">Booking Details</h3>
      <ul style="margin: 0; padding: 0; list-style: none;">
        <li style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 15px;"><strong style="color: #475569;">Spot Number:</strong> ${booking.spotNumber}</li>
        <li style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 15px;"><strong style="color: #475569;">Location:</strong> ${booking.location} - ${booking.building}</li>
        <li style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 15px;"><strong style="color: #475569;">Booking Date:</strong> ${booking.startDate.toLocaleDateString()} to ${booking.endDate.toLocaleDateString()}</li>
        <li style="padding: 8px 0; font-size: 15px;"><strong style="color: #475569;">Amount:</strong> <span style="color: ${BCI_BLUE}; font-weight: 600;">$${booking.totalAmount}</span></li>
      </ul>
    </div>
    
    <div class="info-card" style="background-color: #e0f2fe; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid ${BCI_BLUE};">
      <h3 style="font-family: Arial, Helvetica, sans-serif; font-size: 18px; font-weight: 600; color: #1e293b; margin: 0 0 16px 0;">Renter Information</h3>
      <ul style="margin: 0; padding: 0; list-style: none;">
        <li style="padding: 8px 0; border-bottom: 1px solid #bfdbfe; font-size: 15px;"><strong style="color: #475569;">Name:</strong> ${renter.name}</li>
        <li style="padding: 8px 0; font-size: 15px;"><strong style="color: #475569;">Email:</strong> ${renter.email}</li>
      </ul>
    </div>
    
    <p>Your spot will be used during this period. If you have any concerns, please don't hesitate to contact our support team.</p>
  `;

  const html = wrapEmailTemplate({
    title: 'Your Spot Has Been Booked',
    content,
    theme: 'success'
  });

  return {
    to: owner.email,
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
  const subject = `Booking Cancelled - Spot ${booking.spotNumber}`;
  
  const bookingDateStr = booking.bookingDate instanceof Date 
    ? booking.bookingDate.toLocaleDateString() 
    : new Date(booking.bookingDate).toLocaleDateString();
  
  const text = `Dear ${user.name},

We wanted to let you know that your parking spot booking has been cancelled.

BOOKING DETAILS:
- Spot Number: ${booking.spotNumber}
- Location: ${booking.location} - ${booking.building}
- Booking Date: ${bookingDateStr}
- Cancelled By: ${booking.cancelledBy}${booking.reason ? `\n- Reason: ${booking.reason}` : ''}

REFUND INFORMATION:
- If you made a payment, a refund will be processed according to our cancellation policy
- Refunds typically take 5-7 business days to appear in your account
- You'll receive a separate confirmation once the refund is processed

WHAT'S NEXT:
- You can search for and book another available parking spot
- Update your preferences to receive notifications about available spots
- Contact support if you have any questions about this cancellation

We apologize for any inconvenience and appreciate your understanding.

Warm regards,
The BCI ParkShare Team`;

  const content = `
    <p>Dear ${user.name},</p>
    <p>We wanted to let you know that your parking spot booking has been cancelled. We understand this may be inconvenient, and we're here to help you find an alternative.</p>
    
    <div class="info-card" style="background-color: #f8fafc; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid ${BCI_BLUE};">
      <h3 style="font-family: Arial, Helvetica, sans-serif; font-size: 18px; font-weight: 600; color: #1e293b; margin: 0 0 16px 0;">Cancellation Details</h3>
      <ul style="margin: 0; padding: 0; list-style: none;">
        <li style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 15px;"><strong style="color: #475569;">Spot Number:</strong> ${booking.spotNumber}</li>
        <li style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 15px;"><strong style="color: #475569;">Location:</strong> ${booking.location} - ${booking.building}</li>
        <li style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 15px;"><strong style="color: #475569;">Booking Date:</strong> ${bookingDateStr}</li>
        <li style="padding: 8px 0; font-size: 15px;"><strong style="color: #475569;">Cancelled By:</strong> ${booking.cancelledBy}</li>
        ${booking.reason ? `<li style="padding: 8px 0; font-size: 15px;"><strong style="color: #475569;">Reason:</strong> ${booking.reason}</li>` : ''}
      </ul>
    </div>
    
    <div class="info-card" style="background-color: #f8fafc; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid ${BCI_BLUE};">
      <h3 style="font-family: Arial, Helvetica, sans-serif; font-size: 18px; font-weight: 600; color: #1e293b; margin: 0 0 16px 0;">Refund Information</h3>
      <ul style="margin: 0; padding: 0; list-style: none;">
        <li style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 15px;">If you made a payment, a refund will be processed according to our cancellation policy</li>
        <li style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 15px;">Refunds typically take 5-7 business days to appear in your account</li>
        <li style="padding: 8px 0; font-size: 15px;">You'll receive a separate confirmation once the refund is processed</li>
      </ul>
    </div>
    
    <div class="highlight-box" style="background-color: #f0fdf4; border-radius: 8px; padding: 16px 20px; margin: 24px 0;">
      <strong>Need another spot?</strong> We have many other parking options available. Browse our listings to find a convenient alternative.
    </div>
  `;

  const html = wrapEmailTemplate({
    title: 'Booking Cancelled',
    content,
    theme: 'danger'
  });

  return {
    to: user.email,
    subject,
    text,
    html,
    type: 'booking_cancelled'
  };
};

// Owner notification when a booking on their spot is cancelled
export const createOwnerBookingCancellationNotification = (
  owner: { name: string; email: string },
  renter: { name: string; email: string },
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
  const subject = `Booking Cancelled - Spot ${booking.spotNumber}`;
  
  const bookingDateStr = booking.bookingDate instanceof Date 
    ? booking.bookingDate.toLocaleDateString() 
    : new Date(booking.bookingDate).toLocaleDateString();
  
  const text = `Dear ${owner.name},

We wanted to let you know that a booking for your parking spot has been cancelled.

BOOKING DETAILS:
- Spot Number: ${booking.spotNumber}
- Location: ${booking.location} - ${booking.building}
- Booking Date: ${bookingDateStr}
- Renter: ${renter.name} (${renter.email})
- Cancelled By: ${booking.cancelledBy}${booking.reason ? `\n- Reason: ${booking.reason}` : ''}

Your spot is now available for this date. If you'd like, you can make it available again for other colleagues to book.

Warm regards,
The BCI ParkShare Team`;

  const content = `
    <p>Dear ${owner.name},</p>
    <p>We wanted to let you know that a booking for your parking spot has been cancelled.</p>
    
    <div class="info-card" style="background-color: #f8fafc; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid ${BCI_BLUE};">
      <h3 style="font-family: Arial, Helvetica, sans-serif; font-size: 18px; font-weight: 600; color: #1e293b; margin: 0 0 16px 0;">Cancellation Details</h3>
      <ul style="margin: 0; padding: 0; list-style: none;">
        <li style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 15px;"><strong style="color: #475569;">Spot Number:</strong> ${booking.spotNumber}</li>
        <li style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 15px;"><strong style="color: #475569;">Location:</strong> ${booking.location} - ${booking.building}</li>
        <li style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 15px;"><strong style="color: #475569;">Booking Date:</strong> ${bookingDateStr}</li>
        <li style="padding: 8px 0; font-size: 15px;"><strong style="color: #475569;">Cancelled By:</strong> ${booking.cancelledBy}</li>
        ${booking.reason ? `<li style="padding: 8px 0; font-size: 15px;"><strong style="color: #475569;">Reason:</strong> ${booking.reason}</li>` : ''}
      </ul>
    </div>
    
    <div class="info-card" style="background-color: #e0f2fe; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid ${BCI_BLUE};">
      <h3 style="font-family: Arial, Helvetica, sans-serif; font-size: 18px; font-weight: 600; color: #1e293b; margin: 0 0 16px 0;">Renter Information</h3>
      <ul style="margin: 0; padding: 0; list-style: none;">
        <li style="padding: 8px 0; border-bottom: 1px solid #bfdbfe; font-size: 15px;"><strong style="color: #475569;">Name:</strong> ${renter.name}</li>
        <li style="padding: 8px 0; font-size: 15px;"><strong style="color: #475569;">Email:</strong> ${renter.email}</li>
      </ul>
    </div>
    
    <div class="highlight-box" style="background-color: #dbeafe; border-radius: 8px; padding: 16px 20px; margin: 24px 0;">
      <strong>Good news:</strong> Your spot is now available for this date again. If you'd like, you can make it available for other colleagues to book.
    </div>
  `;

  const html = wrapEmailTemplate({
    title: 'Booking Cancelled',
    content,
    theme: 'warning'
  });

  return {
    to: owner.email,
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
    ? `Payment Overdue - Spot ${payment.spotNumber} (${payment.daysOverdue} days)`
    : `Payment Reminder - Spot ${payment.spotNumber}`;
  
  const text = `Dear ${user.name},

${isOverdue ? 'Your payment is now overdue and requires immediate attention.' : 'This is a friendly reminder about your upcoming payment.'}

PAYMENT DETAILS:
- Spot Number: ${payment.spotNumber}
- Amount Due: $${payment.amount}
- Due Date: ${payment.dueDate.toLocaleDateString()}
${isOverdue ? `- Days Overdue: ${payment.daysOverdue}` : ''}

${isOverdue 
  ? 'ACTION REQUIRED: Please make your payment immediately to avoid service interruption. Late fees may apply.'
  : 'Please ensure payment is made by the due date to maintain uninterrupted access to your parking spot.'
}

To make a payment, please log into your account or contact our billing department.

Warm regards,
The BCI ParkShare Team`;

  const amountColor = isOverdue ? '#ef4444' : '#f59e0b';
  const content = `
    <p>Dear ${user.name},</p>
    <p>${isOverdue ? 'Your payment is now overdue and requires immediate attention.' : 'This is a friendly reminder about your upcoming payment for your parking spot.'}</p>
    
    <div class="info-card" style="background-color: #f8fafc; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid ${amountColor};">
      <h3 style="font-family: Arial, Helvetica, sans-serif; font-size: 18px; font-weight: 600; color: #1e293b; margin: 0 0 16px 0;">Payment Details</h3>
      <ul style="margin: 0; padding: 0; list-style: none;">
        <li style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 15px;"><strong style="color: #475569;">Spot Number:</strong> ${payment.spotNumber}</li>
        <li style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 15px;"><strong style="color: #475569;">Amount Due:</strong> <span style="color: ${amountColor}; font-weight: 600; font-size: 18px;">$${payment.amount}</span></li>
        <li style="padding: 8px 0; ${isOverdue ? 'border-bottom: 1px solid #e2e8f0;' : ''} font-size: 15px;"><strong style="color: #475569;">Due Date:</strong> ${payment.dueDate.toLocaleDateString()}</li>
        ${isOverdue ? `<li style="padding: 8px 0; font-size: 15px;"><strong style="color: #ef4444;">Days Overdue:</strong> <span style="color: #ef4444; font-weight: 600;">${payment.daysOverdue}</span></li>` : ''}
      </ul>
    </div>
    
    ${isOverdue ? `
    <div class="highlight-box danger" style="background-color: #fee2e2; border-radius: 8px; padding: 16px 20px; margin: 24px 0;">
      <strong>Action Required:</strong> Please make your payment immediately to avoid service interruption. Late fees may apply according to our payment policy.
    </div>
    ` : `
    <div class="highlight-box" style="background-color: #e0f2fe; border-radius: 8px; padding: 16px 20px; margin: 24px 0;">
      <strong>Reminder:</strong> Please ensure payment is made by the due date to maintain uninterrupted access to your parking spot.
    </div>
    `}
    
    <p>If you've already made this payment, please disregard this message. If you have any questions about your bill, please contact our support team.</p>
  `;

  const html = wrapEmailTemplate({
    title: isOverdue ? 'Payment Overdue' : 'Payment Reminder',
    content,
    theme: isOverdue ? 'danger' : 'warning'
  });

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
  const subject = `Parking Spots Available - ${spots.length} spot${spots.length > 1 ? 's' : ''} matching your preferences`;
  
  const spotsList = spots.map(spot => 
    `- Spot ${spot.spotNumber} (${spot.type}) - ${spot.location} - ${spot.building} - $${spot.rate}/day`
  ).join('\n');
  
  const text = `Dear ${user.name},

Great news! We're excited to let you know that new parking spots are available that match your preferences.

AVAILABLE SPOTS:
${spotsList}

These spots are available on a first-come, first-served basis. Log into your account to book one of these spots before they're taken!

QUICK ACTIONS:
- View all available spots in your account
- Book your preferred spot immediately
- Update your preferences for future notifications

Don't wait - popular spots fill up quickly!

Warm regards,
The BCI ParkShare Team`;

  const spotsHtml = spots.map(spot => `
    <div style="background-color: #f1f5f9; border-radius: 8px; padding: 16px; margin: 12px 0;">
      <div style="font-weight: 600; color: #1e293b; font-size: 16px;">Spot ${spot.spotNumber}</div>
      <div style="color: #64748b; font-size: 14px; margin-top: 4px;">${spot.type} | ${spot.location} - ${spot.building}</div>
      <div style="color: #10b981; font-weight: 600; font-size: 15px; margin-top: 8px;">$${spot.rate}/day</div>
    </div>
  `).join('');

  const content = `
    <p>Dear ${user.name},</p>
    <p>Great news! We're excited to let you know that ${spots.length} parking spot${spots.length > 1 ? 's are' : ' is'} now available that match your preferences.</p>
    
    <div class="info-card" style="background-color: #f8fafc; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid ${BCI_BLUE};">
      <h3 style="font-family: Arial, Helvetica, sans-serif; font-size: 18px; font-weight: 600; color: #1e293b; margin: 0 0 16px 0;">Available Spots</h3>
      ${spotsHtml}
    </div>
    
    <div class="highlight-box" style="background-color: #e0f2fe; border-radius: 8px; padding: 16px 20px; margin: 24px 0;">
      <strong>Act Fast:</strong> These spots are available on a first-come, first-served basis. Popular spots fill up quickly!
    </div>
    
    <p>Log into your account now to view more details and secure your preferred spot.</p>
  `;

  const html = wrapEmailTemplate({
    title: 'New Spots Available',
    content,
    theme: 'success'
  });

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
  const subject = `Your Weekly Parking Summary - ${summary.weekStart.toLocaleDateString()} to ${summary.weekEnd.toLocaleDateString()}`;
  
  const text = `Dear ${user.name},

Here's your weekly parking summary for ${summary.weekStart.toLocaleDateString()} - ${summary.weekEnd.toLocaleDateString()}:

WEEK OVERVIEW:
- Total Bookings: ${summary.totalBookings}
- Total Amount: $${summary.totalAmount}
- Active Spots: ${summary.activeSpots}
- Upcoming Bookings: ${summary.upcomingBookings}
${summary.pendingPayments > 0 ? `- Pending Payments: ${summary.pendingPayments}` : ''}

${summary.pendingPayments > 0 ? 'ACTION REQUIRED: You have pending payments that need attention.' : 'All payments are up to date. Thank you!'}

QUICK ACTIONS:
- View detailed booking history
- Make payments for outstanding balances
- Book spots for upcoming weeks
- Update your parking preferences

Thank you for being part of the BCI ParkShare community!

Warm regards,
The BCI ParkShare Team`;

  const statsHtml = `
    <table style="width: 100%; border-collapse: collapse;">
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 12px 0; font-size: 15px; color: #475569;">Total Bookings</td>
        <td style="padding: 12px 0; font-size: 15px; font-weight: 600; text-align: right; color: #2563eb;">${summary.totalBookings}</td>
      </tr>
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 12px 0; font-size: 15px; color: #475569;">Total Amount</td>
        <td style="padding: 12px 0; font-size: 15px; font-weight: 600; text-align: right; color: #10b981;">$${summary.totalAmount}</td>
      </tr>
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 12px 0; font-size: 15px; color: #475569;">Active Spots</td>
        <td style="padding: 12px 0; font-size: 15px; font-weight: 600; text-align: right; color: #2563eb;">${summary.activeSpots}</td>
      </tr>
      <tr style="${summary.pendingPayments > 0 ? 'border-bottom: 1px solid #e2e8f0;' : ''}">
        <td style="padding: 12px 0; font-size: 15px; color: #475569;">Upcoming Bookings</td>
        <td style="padding: 12px 0; font-size: 15px; font-weight: 600; text-align: right; color: #2563eb;">${summary.upcomingBookings}</td>
      </tr>
      ${summary.pendingPayments > 0 ? `
      <tr>
        <td style="padding: 12px 0; font-size: 15px; color: #475569;">Pending Payments</td>
        <td style="padding: 12px 0; font-size: 15px; font-weight: 600; text-align: right; color: #ef4444;">${summary.pendingPayments}</td>
      </tr>
      ` : ''}
    </table>
  `;

  const content = `
    <p>Dear ${user.name},</p>
    <p>Here's your weekly parking summary for the week of ${summary.weekStart.toLocaleDateString()} to ${summary.weekEnd.toLocaleDateString()}.</p>
    
    <div class="info-card" style="background-color: #f8fafc; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid ${BCI_BLUE};">
      <h3 style="font-family: Arial, Helvetica, sans-serif; font-size: 18px; font-weight: 600; color: #1e293b; margin: 0 0 16px 0;">Week Overview</h3>
      ${statsHtml}
    </div>
    
    ${summary.pendingPayments > 0 ? `
    <div class="highlight-box" style="background-color: #e0f2fe; border-radius: 8px; padding: 16px 20px; margin: 24px 0;">
      <strong>Action Required:</strong> You have ${summary.pendingPayments} pending payment${summary.pendingPayments > 1 ? 's' : ''} that need attention.
    </div>
    ` : `
    <div class="highlight-box" style="background-color: #f0fdf4; border-radius: 8px; padding: 16px 20px; margin: 24px 0;">
      <strong>Great news!</strong> All your payments are up to date. Thank you for being a responsible member of our community!
    </div>
    `}
    
    <p>Thank you for being part of the BCI ParkShare community. We're here to make your parking experience as smooth as possible.</p>
  `;

  const html = wrapEmailTemplate({
    title: 'Your Weekly Summary',
    content,
    theme: 'primary'
  });

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
  const subject = maintenance.isUrgent 
    ? `Urgent System Maintenance Notice - ${maintenance.title}`
    : `Scheduled System Maintenance - ${maintenance.title}`;
  
  const text = `Dear ${user.name},

${maintenance.isUrgent ? 'We have urgent system maintenance that requires your attention.' : 'We wanted to inform you about upcoming scheduled maintenance.'}

MAINTENANCE DETAILS:
- Title: ${maintenance.title}
- Description: ${maintenance.description}
- Start Date: ${maintenance.startDate.toLocaleString()}
- End Date: ${maintenance.endDate.toLocaleString()}
- Affected Services: ${maintenance.affectedServices.join(', ')}

${maintenance.isUrgent 
  ? 'This is urgent maintenance that may affect your parking access. Please plan accordingly.'
  : 'This maintenance is scheduled in advance and should have minimal impact on your parking experience.'
}

WHAT YOU NEED TO KNOW:
- Access to affected services may be temporarily limited during this window
- Please plan alternative arrangements if necessary
- We'll notify you when maintenance is complete
- Contact support if you have urgent concerns

We appreciate your patience and understanding.

Warm regards,
The BCI ParkShare Team`;

  const servicesHtml = maintenance.affectedServices.map(service => 
    `<li style="padding: 4px 0; font-size: 14px;">${service}</li>`
  ).join('');
  
  const borderColor = maintenance.isUrgent ? '#ef4444' : '#64748b';

  const content = `
    <p>Dear ${user.name},</p>
    <p>${maintenance.isUrgent ? 'We have urgent system maintenance that requires your attention.' : 'We wanted to inform you about upcoming scheduled maintenance that may affect some of our services.'}</p>
    
    <div class="info-card" style="background-color: #f8fafc; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid ${borderColor};">
      <h3 style="font-family: Arial, Helvetica, sans-serif; font-size: 18px; font-weight: 600; color: #1e293b; margin: 0 0 16px 0;">Maintenance Details</h3>
      <ul style="margin: 0; padding: 0; list-style: none;">
        <li style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 15px;"><strong style="color: #475569;">Title:</strong> ${maintenance.title}</li>
        <li style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 15px;"><strong style="color: #475569;">Description:</strong> ${maintenance.description}</li>
        <li style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 15px;"><strong style="color: #475569;">Start Time:</strong> <span style="color: ${borderColor}; font-weight: 600;">${maintenance.startDate.toLocaleString()}</span></li>
        <li style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 15px;"><strong style="color: #475569;">End Time:</strong> <span style="color: ${borderColor}; font-weight: 600;">${maintenance.endDate.toLocaleString()}</span></li>
        <li style="padding: 8px 0; font-size: 15px;">
          <strong style="color: #475569;">Affected Services:</strong>
          <ul style="margin: 8px 0 0 16px; padding: 0;">${servicesHtml}</ul>
        </li>
      </ul>
    </div>
    
    ${maintenance.isUrgent ? `
    <div class="highlight-box" style="background-color: #fee2e2; border-radius: 8px; padding: 16px 20px; margin: 24px 0;">
      <strong>Important:</strong> This maintenance may affect your parking access. Please plan accordingly and contact support if you have urgent concerns.
    </div>
    ` : `
    <div class="highlight-box" style="background-color: #f1f5f9; border-radius: 8px; padding: 16px 20px; margin: 24px 0;">
      <strong>Note:</strong> This scheduled maintenance should have minimal impact on your parking experience. We'll keep you updated on our progress.
    </div>
    `}
    
    <div class="info-card" style="background-color: #f8fafc; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid ${BCI_BLUE};">
      <h3 style="font-family: Arial, Helvetica, sans-serif; font-size: 18px; font-weight: 600; color: #1e293b; margin: 0 0 16px 0;">What You Need to Know</h3>
      <ul style="margin: 0; padding: 0; list-style: none;">
        <li style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 15px;">Access to affected services may be temporarily limited during this window</li>
        <li style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 15px;">Please plan alternative arrangements if necessary</li>
        <li style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 15px;">We'll notify you when maintenance is complete</li>
        <li style="padding: 8px 0; font-size: 15px;">Contact support if you have any urgent concerns</li>
      </ul>
    </div>
    
    <p>We appreciate your patience and understanding as we work to improve our services.</p>
  `;

  const html = wrapEmailTemplate({
    title: maintenance.isUrgent ? 'Urgent Maintenance Notice' : 'System Maintenance',
    content,
    theme: maintenance.isUrgent ? 'danger' : 'neutral'
  });

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
  const priorityLabel = enrollmentDetails.priority === 1 ? "High" : enrollmentDetails.priority === 2 ? "Medium" : "Standard";
  const subject = `Welcome to the BCI ParkShare Waiting List`;
  
  const text = `Dear ${user.name},

Thank you for joining the BCI ParkShare Waiting List! We're excited to have you as part of our parking community.

YOUR ENROLLMENT DETAILS:
- Priority Level: ${priorityLabel}
- Preferred Spot Type: ${enrollmentDetails.preferredSpotType || 'Any Available'}
- Enrollment Date: ${enrollmentDetails.enrolledDate.toLocaleDateString()}

WHAT HAPPENS NEXT:
1. We'll monitor spot availability that matches your preferences
2. When a spot becomes available, we'll notify you immediately
3. You'll have 48 hours to accept or decline the assignment
4. Your position is based on your priority level and enrollment date

You can view and manage your waiting list status anytime in your profile settings.

Thank you for your patience. We'll be in touch soon!

Warm regards,
The BCI ParkShare Team`;

  const priorityBadgeStyle = enrollmentDetails.priority === 1 
    ? "background-color: #fef2f2; color: #dc2626;" 
    : enrollmentDetails.priority === 2 
      ? "background-color: #fef9c3; color: #ca8a04;" 
      : "background-color: #f0fdf4; color: #16a34a;";

  const content = `
    <p>Dear ${user.name},</p>
    <p>Thank you for joining the BCI ParkShare Waiting List! We're excited to have you as part of our parking community.</p>
    
    <div class="info-card" style="background-color: #f8fafc; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid ${BCI_BLUE};">
      <h3 style="font-family: Arial, Helvetica, sans-serif; font-size: 18px; font-weight: 600; color: #1e293b; margin: 0 0 16px 0;">Your Enrollment Details</h3>
      <ul style="margin: 0; padding: 0; list-style: none;">
        <li style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 15px;">
          <strong style="color: #475569;">Priority Level:</strong> 
          <span style="display: inline-block; padding: 4px 12px; border-radius: 12px; font-weight: 600; ${priorityBadgeStyle}">${priorityLabel}</span>
        </li>
        <li style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 15px;"><strong style="color: #475569;">Preferred Spot Type:</strong> ${enrollmentDetails.preferredSpotType || 'Any Available'}</li>
        <li style="padding: 8px 0; font-size: 15px;"><strong style="color: #475569;">Enrollment Date:</strong> ${enrollmentDetails.enrolledDate.toLocaleDateString()}</li>
      </ul>
    </div>
    
    <div class="info-card" style="background-color: #f8fafc; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid ${BCI_BLUE};">
      <h3 style="font-family: Arial, Helvetica, sans-serif; font-size: 18px; font-weight: 600; color: #1e293b; margin: 0 0 16px 0;">What Happens Next</h3>
      <ul style="margin: 0; padding: 0; list-style: none;">
        <li style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 15px;"><strong style="color: #475569;">1.</strong> We'll monitor spot availability that matches your preferences</li>
        <li style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 15px;"><strong style="color: #475569;">2.</strong> When a spot becomes available, we'll notify you immediately</li>
        <li style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 15px;"><strong style="color: #475569;">3.</strong> You'll have 48 hours to accept or decline the assignment</li>
        <li style="padding: 8px 0; font-size: 15px;"><strong style="color: #475569;">4.</strong> Your position is based on your priority level and enrollment date</li>
      </ul>
    </div>
    
    <p>Thank you for your patience. We'll be in touch as soon as a spot matching your preferences becomes available!</p>
  `;

  const html = wrapEmailTemplate({
    title: "You're on the Waiting List",
    content,
    theme: 'primary'
  });

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
  const priorityLabel = enrollmentDetails.priority === 1 ? "High" : enrollmentDetails.priority === 2 ? "Medium" : "Standard";
  const subject = `New Waiting List Enrollment - ${newMember.name}`;
  
  const text = `Dear ${admin.name},

A new user has joined the BCI ParkShare waiting list and may require a spot assignment.

NEW MEMBER DETAILS:
- Name: ${newMember.name}
- Email: ${newMember.email}
- Priority Level: ${priorityLabel}
- Preferred Spot Type: ${enrollmentDetails.preferredSpotType || 'Any Available'}
- Enrollment Date: ${enrollmentDetails.enrolledDate.toLocaleDateString()}

Please review the waiting list and assign spots as they become available.

Warm regards,
BCI ParkShare System`;

  const priorityBadgeStyle = enrollmentDetails.priority === 1 
    ? "background-color: #fef2f2; color: #dc2626;" 
    : enrollmentDetails.priority === 2 
      ? "background-color: #fef9c3; color: #ca8a04;" 
      : "background-color: #f0fdf4; color: #16a34a;";

  const content = `
    <p>Dear ${admin.name},</p>
    <p>A new user has joined the BCI ParkShare waiting list and may require a spot assignment.</p>
    
    <div class="info-card" style="background-color: #f8fafc; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid ${BCI_BLUE};">
      <h3 style="font-family: Arial, Helvetica, sans-serif; font-size: 18px; font-weight: 600; color: #1e293b; margin: 0 0 16px 0;">New Member Details</h3>
      <ul style="margin: 0; padding: 0; list-style: none;">
        <li style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 15px;"><strong style="color: #475569;">Name:</strong> ${newMember.name}</li>
        <li style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 15px;"><strong style="color: #475569;">Email:</strong> <a href="mailto:${newMember.email}" style="color: #2563eb;">${newMember.email}</a></li>
        <li style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 15px;">
          <strong style="color: #475569;">Priority Level:</strong> 
          <span style="display: inline-block; padding: 4px 12px; border-radius: 12px; font-weight: 600; ${priorityBadgeStyle}">${priorityLabel}</span>
        </li>
        <li style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 15px;"><strong style="color: #475569;">Preferred Spot Type:</strong> ${enrollmentDetails.preferredSpotType || 'Any Available'}</li>
        <li style="padding: 8px 0; font-size: 15px;"><strong style="color: #475569;">Enrollment Date:</strong> ${enrollmentDetails.enrolledDate.toLocaleDateString()}</li>
      </ul>
    </div>
    
    <p>Please review the waiting list and assign spots as they become available.</p>
  `;

  const html = wrapEmailTemplate({
    title: 'New Waiting List Enrollment',
    content,
    theme: 'primary'
  });

  return {
    to: admin.email,
    subject,
    text,
    html,
    type: 'waiting_list_admin'
  };
};

/**
 * Waiting List Removal Notification - sent to user when they leave the waiting list
 */
export const createWaitingListRemovalNotification = (
  user: { name: string; email: string }
): EmailNotification => {
  const subject = `You've Left the BCI ParkShare Waiting List`;
  
  const text = `Dear ${user.name},

This email confirms that you have been successfully removed from the BCI ParkShare Waiting List.

If this was unintentional, you can re-enroll anytime through your profile settings in the BCI ParkShare app.

We hope to see you back soon!

Warm regards,
The BCI ParkShare Team`;

  const content = `
    <p>Dear ${user.name},</p>
    <p>This email confirms that you have been successfully removed from the BCI ParkShare Waiting List.</p>
    
    <div class="info-card" style="background-color: #f8fafc; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid ${BCI_BLUE};">
      <h3 style="font-family: Arial, Helvetica, sans-serif; font-size: 18px; font-weight: 600; color: #1e293b; margin: 0 0 16px 0;">What This Means</h3>
      <ul style="margin: 0; padding: 0; list-style: none;">
        <li style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 15px;"><strong style="color: #475569;">Status:</strong> You are no longer on the waiting list for a permanent parking spot</li>
        <li style="padding: 8px 0; font-size: 15px;"><strong style="color: #475569;">Daily Bookings:</strong> You can still book available daily parking spots through the app</li>
      </ul>
    </div>
    
    <p>If this was unintentional, you can re-enroll anytime through your profile settings in the BCI ParkShare app.</p>
    <p>We hope to see you back soon!</p>
  `;

  const html = wrapEmailTemplate({
    title: "You've Left the Waiting List",
    content,
    theme: 'neutral'
  });

  return {
    to: user.email,
    subject,
    text,
    html,
    type: 'general'
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
        console.error('❌ MS365 email failed, attempting Mandrill fallback:', ms365Error);
        // Fall through to Mandrill if available
        if (MANDRILL_CONFIGURED) {
          await sendEmailViaMandrill(
            notification.to,
            notification.subject,
            notification.text,
            notification.html
          );
          console.log(`✓ Email sent via Mandrill (fallback) to ${notification.to}: ${notification.subject}`);
          return { success: true, provider: 'mandrill' };
        }
        throw ms365Error;
      }
    }

    // Use Mandrill if it's the active provider
    if (activeProvider === 'mandrill' && MANDRILL_CONFIGURED) {
      await sendEmailViaMandrill(
        notification.to,
        notification.subject,
        notification.text,
        notification.html
      );
      console.log(`✓ Email sent via Mandrill to ${notification.to}: ${notification.subject}`);
      return { success: true, provider: 'mandrill' };
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
        message: `You've been enrolled in the waiting list. We'll notify you when a parking spot becomes available.`,
        data: {
          waitingListEntryId: waitingListEntry.id,
          preferredSpotTypeId: waitingListEntry.preferredSpotTypeId,
          preferredLocationId: waitingListEntry.preferredLocationId
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
  userPreferences: { bookingConfirmations?: boolean; emailNotifications?: boolean } = {},
  owner?: { name: string; email: string; id: string } | null
): Promise<{ emailSent: boolean; inAppSent: boolean; ownerEmailSent: boolean; ownerInAppSent: boolean }> {
  const results = { emailSent: false, inAppSent: false, ownerEmailSent: false, ownerInAppSent: false };

  try {
    // Send email notification to renter if user has booking confirmations enabled
    if (userPreferences.emailNotifications !== false && userPreferences.bookingConfirmations !== false) {
      const emailNotification = createBookingConfirmationNotification(user, booking, owner);
      const emailResult = await sendEmailNotification(emailNotification);
      results.emailSent = emailResult.success;
    }

    // Send in-app notification to renter
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

    // Send notification to spot owner if provided
    if (owner && owner.email) {
      try {
        const ownerNotification = createOwnerBookingNotification(owner, user, booking);
        const ownerEmailResult = await sendEmailNotification(ownerNotification);
        results.ownerEmailSent = ownerEmailResult.success;
        
        // Send in-app notification to owner
        await storage.createInAppNotification({
          userId: owner.id,
          type: 'booking_confirmation',
          title: `New Booking: Spot ${booking.spotNumber}`,
          message: `${user.name} has booked your spot ${booking.spotNumber} from ${booking.startDate.toLocaleDateString()} to ${booking.endDate.toLocaleDateString()}.`,
          data: {
            bookingId: booking.id,
            spotNumber: booking.spotNumber,
            renterName: user.name,
            renterEmail: user.email,
            totalAmount: booking.totalAmount
          },
          read: false
        });
        results.ownerInAppSent = true;
        
        console.log(`✓ Owner notification sent to ${owner.name} (email: ${results.ownerEmailSent}, in-app: ${results.ownerInAppSent})`);
      } catch (ownerError) {
        console.error('❌ Error sending owner notification:', ownerError);
      }
    }

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
  userPreferences: { bookingConfirmations?: boolean; emailNotifications?: boolean } = {},
  owner?: { name: string; email: string; id: string } | null
): Promise<{ emailSent: boolean; inAppSent: boolean; ownerEmailSent: boolean; ownerInAppSent: boolean }> {
  const results = { emailSent: false, inAppSent: false, ownerEmailSent: false, ownerInAppSent: false };

  try {
    // Send email notification to renter if user has booking confirmations enabled
    if (userPreferences.emailNotifications !== false && userPreferences.bookingConfirmations !== false) {
      const emailNotification = createBookingCancellationNotification(user, booking);
      const emailResult = await sendEmailNotification(emailNotification);
      results.emailSent = emailResult.success;
    }

    // Send in-app notification to renter (always sent)
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

    // Send notification to spot owner if provided
    if (owner && owner.email) {
      try {
        const ownerNotification = createOwnerBookingCancellationNotification(owner, user, booking);
        const ownerEmailResult = await sendEmailNotification(ownerNotification);
        results.ownerEmailSent = ownerEmailResult.success;
        
        const bookingDateStr = booking.bookingDate instanceof Date 
          ? booking.bookingDate.toLocaleDateString() 
          : new Date(booking.bookingDate).toLocaleDateString();
        
        // Send in-app notification to owner
        await storage.createInAppNotification({
          userId: owner.id,
          type: 'booking_cancelled',
          title: `Booking Cancelled: Spot ${booking.spotNumber}`,
          message: `A booking for your spot ${booking.spotNumber} on ${bookingDateStr} has been cancelled by ${booking.cancelledBy}.`,
          data: {
            bookingId: booking.id,
            spotNumber: booking.spotNumber,
            renterName: user.name,
            renterEmail: user.email,
            cancelledBy: booking.cancelledBy,
            reason: booking.reason
          },
          read: false
        });
        results.ownerInAppSent = true;
        
        console.log(`✓ Owner cancellation notification sent to ${owner.name} (email: ${results.ownerEmailSent}, in-app: ${results.ownerInAppSent})`);
      } catch (ownerError) {
        console.error('❌ Error sending owner cancellation notification:', ownerError);
      }
    }

    console.log(`✓ Booking cancellation notifications sent to ${user.name} (email: ${results.emailSent}, in-app: ${results.inAppSent})`);
    
  } catch (error) {
    console.error('❌ Error sending booking cancellation notifications:', error);
  }

  return results;
}

/**
 * Send notification to former owner when they are unassigned from a spot
 */
export async function sendSpotUnassignmentNotification(
  formerOwner: { name: string; email: string | null; id: string },
  spotDetails: { spotNumber: string; location: string; building: string },
  cancelledBookingsCount: number
): Promise<{ emailSent: boolean; inAppSent: boolean }> {
  const results = { emailSent: false, inAppSent: false };

  try {
    // Send email notification only if user has email
    if (formerOwner.email) {
      const subject = `Parking Spot Unassigned: ${spotDetails.spotNumber}`;
      
      const bookingsMessage = cancelledBookingsCount > 0 
        ? `\n\nNote: ${cancelledBookingsCount} future booking(s) for this spot have been automatically cancelled.`
        : '';
      
      const text = `Dear ${formerOwner.name},

This is to inform you that you have been unassigned from parking spot ${spotDetails.spotNumber}.

SPOT DETAILS:
• Spot Number: ${spotDetails.spotNumber}
• Location: ${spotDetails.location}
• Building: ${spotDetails.building}${bookingsMessage}

If you have any questions about this change, please contact the BCI Workplace Services team.

Best regards,
BCI ParkShare Team`;

      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Parking Spot Unassigned</title>
  <style>
    .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
    .header { background: #dc2626; color: white; padding: 20px; text-align: center; }
    .content { padding: 30px; background: #f8fafc; }
    .spot-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626; }
    .footer { text-align: center; color: #64748b; padding: 20px; }
    .warning { background: #fef3c7; border-left: 4px solid ${BCI_BLUE}; padding: 15px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Parking Spot Unassigned</h1>
    </div>
    
    <div class="content">
      <p>Dear ${formerOwner.name},</p>
      <p>This is to inform you that you have been unassigned from your parking spot.</p>
      
      <div class="spot-details">
        <h3>Spot Details</h3>
        <ul>
          <li><strong>Spot Number:</strong> ${spotDetails.spotNumber}</li>
          <li><strong>Location:</strong> ${spotDetails.location}</li>
          <li><strong>Building:</strong> ${spotDetails.building}</li>
        </ul>
      </div>
      
      ${cancelledBookingsCount > 0 ? `
      <div class="warning">
        <strong>Note:</strong> ${cancelledBookingsCount} future booking(s) for this spot have been automatically cancelled.
      </div>
      ` : ''}
      
      <p>If you have any questions about this change, please contact the BCI Workplace Services team.</p>
    </div>
    
    <div class="footer">
      <p style="font-size: 11px; color: #94a3b8;">A BCI Workplace Services Initiative &bull; In partnership with Technology &amp; Innovation &bull; &copy; ${new Date().getFullYear()} BCI</p>
    </div>
  </div>
</body>
</html>`;

      const emailResult = await sendEmailNotification({
        to: formerOwner.email,
        subject,
        text,
        html,
        type: 'general'
      });
      results.emailSent = emailResult.success;
    }

    // Send in-app notification (always sent regardless of email)
    await storage.createInAppNotification({
      userId: formerOwner.id,
      type: 'general',
      title: `Spot Unassigned: ${spotDetails.spotNumber}`,
      message: `You have been unassigned from parking spot ${spotDetails.spotNumber} at ${spotDetails.location}.${cancelledBookingsCount > 0 ? ` ${cancelledBookingsCount} future booking(s) were cancelled.` : ''}`,
      data: {
        spotNumber: spotDetails.spotNumber,
        location: spotDetails.location,
        building: spotDetails.building,
        cancelledBookingsCount
      },
      read: false
    });
    
    results.inAppSent = true;

    console.log(`✓ Spot unassignment notification sent to ${formerOwner.name} (email: ${results.emailSent}, in-app: ${results.inAppSent})`);
    
  } catch (error) {
    console.error('❌ Error sending spot unassignment notification:', error);
  }

  return results;
}

/**
 * Send notification to renters when their future bookings are cancelled due to spot unassignment
 */
export async function sendBookingsCancelledDueToUnassignmentNotification(
  renter: { name: string; email: string | null; id: string },
  cancelledBookings: Array<{ bookingDate: string; spotNumber: string; location: string; building: string }>,
  formerOwnerName: string
): Promise<{ emailSent: boolean; inAppSent: boolean }> {
  const results = { emailSent: false, inAppSent: false };

  if (cancelledBookings.length === 0) return results;

  try {
    // Send email notification only if user has email
    if (renter.email) {
      const subject = `Booking(s) Cancelled: Spot Reassignment`;
      
      const bookingsList = cancelledBookings.map(b => 
        `• ${b.bookingDate} - Spot ${b.spotNumber} at ${b.location}`
      ).join('\n');
      
      const text = `Dear ${renter.name},

We're writing to inform you that the following booking(s) have been cancelled due to a parking spot reassignment:

${bookingsList}

This cancellation occurred because the spot owner has been changed by administration. If any payments were made, they will be refunded according to the standard refund policy.

We apologize for any inconvenience. Please visit BCI ParkShare to book an alternative spot.

Best regards,
BCI ParkShare Team`;

      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bookings Cancelled</title>
  <style>
    .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
    .header { background: #f59e0b; color: white; padding: 20px; text-align: center; }
    .content { padding: 30px; background: #f8fafc; }
    .bookings-list { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${BCI_BLUE}; }
    .footer { text-align: center; color: #64748b; padding: 20px; }
    .info { background: #dbeafe; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Booking(s) Cancelled</h1>
    </div>
    
    <div class="content">
      <p>Dear ${renter.name},</p>
      <p>We're writing to inform you that the following booking(s) have been cancelled due to a parking spot reassignment:</p>
      
      <div class="bookings-list">
        <h3>Cancelled Bookings</h3>
        <ul>
          ${cancelledBookings.map(b => `<li><strong>${b.bookingDate}</strong> - Spot ${b.spotNumber} at ${b.location}</li>`).join('')}
        </ul>
      </div>
      
      <div class="info">
        <strong>Why was this cancelled?</strong><br>
        This cancellation occurred because the spot owner has been changed by administration. If any payments were made, they will be refunded according to the standard refund policy.
      </div>
      
      <p>We apologize for any inconvenience. Please visit BCI ParkShare to book an alternative spot.</p>
    </div>
    
    <div class="footer">
      <p style="font-size: 11px; color: #94a3b8;">A BCI Workplace Services Initiative &bull; In partnership with Technology &amp; Innovation &bull; &copy; ${new Date().getFullYear()} BCI</p>
    </div>
  </div>
</body>
</html>`;

      const emailResult = await sendEmailNotification({
        to: renter.email,
        subject,
        text,
        html,
        type: 'booking_cancelled'
      });
      results.emailSent = emailResult.success;
    }

    // Send in-app notification (always sent regardless of email)
    await storage.createInAppNotification({
      userId: renter.id,
      type: 'booking_cancelled',
      title: `${cancelledBookings.length} Booking(s) Cancelled`,
      message: `Your booking(s) have been cancelled due to a parking spot reassignment. Please visit BCI ParkShare to book an alternative spot.`,
      data: {
        cancelledBookings,
        reason: 'spot_reassignment'
      },
      read: false
    });
    
    results.inAppSent = true;

    console.log(`✓ Bookings cancelled notification sent to ${renter.name} for ${cancelledBookings.length} booking(s) (email: ${results.emailSent}, in-app: ${results.inAppSent})`);
    
  } catch (error) {
    console.error('❌ Error sending bookings cancelled notification:', error);
  }

  return results;
}