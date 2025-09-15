// Notification Service - handles email and in-app notifications
// Using blueprint:javascript_sendgrid integration for email functionality

import { MailService } from '@sendgrid/mail';
import type { WaitingList, ParkingSpot, AuthUser } from '@shared/schema';

// Development mode check - will use mock notifications if API key not available
const isDevelopment = !process.env.SENDGRID_API_KEY;

let mailService: MailService | null = null;

// Initialize SendGrid only if API key is available
if (process.env.SENDGRID_API_KEY) {
  try {
    mailService = new MailService();
    mailService.setApiKey(process.env.SENDGRID_API_KEY);
    console.log('✓ SendGrid initialized successfully');
  } catch (error) {
    console.error('❌ SendGrid initialization failed:', error);
  }
} else {
  console.log('⚠️  SENDGRID_API_KEY not found - using mock notifications for development');
}

export interface EmailNotification {
  to: string;
  subject: string;
  text: string;
  html: string;
  type: 'assignment' | 'reminder' | 'expiration' | 'welcome' | 'general';
}

export interface InAppNotification {
  id: string;
  userId: string;
  type: 'assignment' | 'reminder' | 'expiration' | 'welcome' | 'general';
  title: string;
  message: string;
  data?: any;
  read: boolean;
  createdAt: Date;
  expiresAt?: Date;
}

// In-memory storage for in-app notifications (for development)
// In production, this would be stored in database
const inAppNotifications = new Map<string, InAppNotification[]>();

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
BCI Parking Management Team`;

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
      <p>Best regards,<br>BCI Parking Management Team</p>
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
  const subject = `Welcome to BCI Parking Waiting List`;
  
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
BCI Parking Management Team`;

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
      <h1>Welcome to BCI Parking Waiting List</h1>
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

/**
 * Send Email Notification
 */
export async function sendEmailNotification(notification: EmailNotification): Promise<{ success: boolean; error?: string }> {
  try {
    if (isDevelopment || !mailService) {
      // Mock notification for development
      console.log('📧 MOCK EMAIL NOTIFICATION:');
      console.log(`To: ${notification.to}`);
      console.log(`Subject: ${notification.subject}`);
      console.log(`Type: ${notification.type}`);
      console.log('---');
      
      // Simulate email sending delay
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return { success: true };
    }

    // Production email sending with SendGrid
    await mailService.send({
      to: notification.to,
      from: process.env.SENDGRID_FROM_EMAIL || 'noreply@bci.ca',
      subject: notification.subject,
      text: notification.text,
      html: notification.html,
    });

    console.log(`✓ Email sent to ${notification.to}: ${notification.subject}`);
    return { success: true };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ Failed to send email to ${notification.to}:`, errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * In-App Notification Functions
 */
export function createInAppNotification(notification: Omit<InAppNotification, 'id' | 'createdAt'>): InAppNotification {
  return {
    id: `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date(),
    ...notification
  };
}

export function addInAppNotification(notification: InAppNotification): void {
  const userNotifications = inAppNotifications.get(notification.userId) || [];
  userNotifications.unshift(notification); // Add to beginning
  
  // Keep only the 50 most recent notifications per user
  if (userNotifications.length > 50) {
    userNotifications.splice(50);
  }
  
  inAppNotifications.set(notification.userId, userNotifications);
  console.log(`📱 In-app notification added for user ${notification.userId}: ${notification.title}`);
}

export function getUserNotifications(userId: string): InAppNotification[] {
  return inAppNotifications.get(userId) || [];
}

export function markNotificationAsRead(userId: string, notificationId: string): boolean {
  const userNotifications = inAppNotifications.get(userId) || [];
  const notification = userNotifications.find(n => n.id === notificationId);
  
  if (notification) {
    notification.read = true;
    return true;
  }
  
  return false;
}

export function getUnreadNotificationCount(userId: string): number {
  const userNotifications = inAppNotifications.get(userId) || [];
  return userNotifications.filter(n => !n.read).length;
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
      const inAppNotification = createInAppNotification({
        userId: user.id,
        type: 'assignment',
        title: `Parking Spot Assigned: ${spotDetails.spotNumber}`,
        message: `You've been assigned parking spot ${spotDetails.spotNumber} in ${spotDetails.building}. Please respond within 48 hours.`,
        data: {
          spotNumber: spotDetails.spotNumber,
          location: spotDetails.location,
          building: spotDetails.building,
          waitingListEntryId: waitingListEntry.id,
          expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000) // 48 hours from now
        },
        read: false,
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000)
      });
      
      addInAppNotification(inAppNotification);
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
      const inAppNotification = createInAppNotification({
        userId: user.id,
        type: 'welcome',
        title: 'Welcome to BCI Parking Waiting List',
        message: `You've been enrolled in the waiting list. We'll notify you when a ${waitingListEntry.preferredSpotType || 'parking'} spot becomes available.`,
        data: {
          waitingListEntryId: waitingListEntry.id,
          preferredSpotType: waitingListEntry.preferredSpotType,
          preferredBuilding: waitingListEntry.preferredBuilding
        },
        read: false
      });
      
      addInAppNotification(inAppNotification);
      results.inAppSent = true;
    }

    console.log(`✓ Welcome notifications sent to ${user.name} (email: ${results.emailSent}, in-app: ${results.inAppSent})`);
    
  } catch (error) {
    console.error('❌ Error sending welcome notifications:', error);
  }

  return results;
}