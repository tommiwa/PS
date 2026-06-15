/**
 * One-off resend: milestone email to WPS + all admins with corrected
 * production P2P revenue (bug fix Task #288). No DB records written.
 */
import { createSpendMilestoneEmail, sendEmailNotification } from '../server/notification-service';

// Real production values — queried from prod DB on 2026-06-13
const metrics = {
  totalBookings: 728,
  totalSpend:    10005.28,
  p2pRevenue:    4069.28,
  participants:  119,
};
const startDate       = '2026-03-16';
const milestoneAmount = 10000;

const WPS_EMAIL   = 'workplaceservices@bci.ca';
const ADMIN_EMAILS = [
  'brian.morton@bci.ca',
  'Clayton.Mcclure@bci.ca',
  'chase.mackenzie@bci.ca',
  'Gayleen.Nazaruk@bci.ca',
  'Colleen.Norcross@bci.ca',
  'lijin.joseji@bci.ca',
];

async function main() {
  const { subject, text, html } = createSpendMilestoneEmail(milestoneAmount, metrics, startDate);

  const ccEmails = ADMIN_EMAILS.filter(e => e.toLowerCase() !== WPS_EMAIL.toLowerCase());

  console.log(`TO:  ${WPS_EMAIL}`);
  console.log(`CC:  ${ccEmails.join(', ')}`);
  console.log(`Sending...`);

  const result = await sendEmailNotification({
    to: WPS_EMAIL,
    cc: ccEmails,
    subject,
    text,
    html,
    type: 'general',
  });

  if (result.success) {
    console.log(`✓ Milestone email sent via ${result.provider}`);
  } else {
    console.error('✗ Failed:', result.error);
    process.exit(1);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
