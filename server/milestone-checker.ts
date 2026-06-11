import { storage } from './storage';
import { computeMilestoneMetrics } from './reports-controller';
import { sendSpendMilestoneEmail } from './notification-service';

/**
 * Checks whether cumulative spend since `milestone_start_date` has crossed
 * one or more new milestone thresholds. For each newly crossed threshold, it
 * atomically claims the milestone by inserting a DB row (ON CONFLICT DO NOTHING),
 * then sends the email only when the insert succeeds. This prevents duplicate
 * emails under concurrent requests.
 *
 * Designed to be called fire-and-forget (setImmediate) — it will never throw.
 */
export async function checkSpendMilestones(): Promise<void> {
  try {
    const [startDateConfig, intervalConfig] = await Promise.all([
      storage.getAppConfigValue('milestone_start_date'),
      storage.getAppConfigValue('milestone_interval')
    ]);

    const startDate = startDateConfig || '2026-03-16';
    const interval = Number(intervalConfig) || 10000;

    if (interval <= 0) {
      console.log('[Milestone Checker] milestone_interval is 0 or negative — milestone emails disabled.');
      return;
    }

    const [metrics, latestFired] = await Promise.all([
      computeMilestoneMetrics(startDate),
      storage.getLatestFiredMilestone()
    ]);

    if (metrics.totalSpend <= 0) return;

    const nextThreshold = latestFired + interval;
    if (metrics.totalSpend < nextThreshold) return;

    const adminEmails = await storage.getAllAdminEmails();

    let threshold = nextThreshold;
    while (metrics.totalSpend >= threshold) {
      console.log(`[Milestone Checker] Attempting to claim milestone $${threshold.toLocaleString()} — total spend: $${metrics.totalSpend.toFixed(2)}`);
      try {
        // Claim the milestone row first. ON CONFLICT DO NOTHING means only one
        // concurrent caller wins the insert; others get null back and skip.
        const claimed = await storage.recordMilestone({
          milestoneAmount: threshold.toFixed(2),
          totalSpendAtTrigger: metrics.totalSpend.toFixed(2),
          totalBookings: metrics.totalBookings,
          p2pRevenue: metrics.p2pRevenue.toFixed(2),
          participants: metrics.participants,
          emailedTo: ['workplaceservices@bci.ca', ...adminEmails].join(', ')
        });

        if (!claimed) {
          console.log(`[Milestone Checker] Milestone $${threshold.toLocaleString()} already claimed by another process — skipping email.`);
        } else {
          await sendSpendMilestoneEmail(threshold, metrics, startDate, adminEmails);
          console.log(`[Milestone Checker] Milestone $${threshold.toLocaleString()} email sent successfully.`);
        }
      } catch (err) {
        console.error(`[Milestone Checker] Failed to claim/send milestone $${threshold}:`, err);
        break;
      }
      threshold += interval;
    }
  } catch (error) {
    console.error('[Milestone Checker] Unexpected error:', error);
  }
}
