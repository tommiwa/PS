import { storage } from './storage';
import { computeMilestoneMetrics } from './reports-controller';
import { sendSpendMilestoneEmail } from './notification-service';
import { sendOwnerRentalMilestoneEmail } from './notification-service';
import { ownerRentalMilestones, ownerRentalMilestoneState, type Booking, type OwnerRentalMilestone } from '@shared/schema';
import { sql } from 'drizzle-orm';

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
    const [startDateConfig, intervalConfig, notificationsEnabledConfig] = await Promise.all([
      storage.getAppConfigValue('milestone_start_date'),
      storage.getAppConfigValue('milestone_interval'),
      storage.getAppConfigValue('milestone_notifications_enabled')
    ]);

    const startDate = startDateConfig || '2026-03-16';
    const interval = Number(intervalConfig) || 10000;
    const notificationsEnabled = notificationsEnabledConfig === 'true';

    if (interval <= 0) {
      console.log('[Milestone Checker] milestone_interval is 0 or negative — milestone emails disabled.');
      return;
    }

    if (!notificationsEnabled) {
      console.log('[Milestone Checker] milestone_notifications_enabled is false — skipping email sends (dev/QA environment guard).');
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

/**
 * Advances the owner's lifetime peer-booking count and creates the durable claim
 * in the same transaction as the booking. The state table is initialized from
 * historical bookings during migration, so only new bookings advance it.
 */
export async function advanceOwnerRentalMilestone(
  tx: any,
  booking: Booking
): Promise<OwnerRentalMilestone | null> {
  if (!booking.ownerId || booking.ownerId === 'unassigned' || booking.renterId === booking.ownerId) {
    return null;
  }

  const [state] = await tx
    .insert(ownerRentalMilestoneState)
    .values({
      ownerId: booking.ownerId,
      lifetimeBookingCount: 1,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: ownerRentalMilestoneState.ownerId,
      set: {
        lifetimeBookingCount: sql`${ownerRentalMilestoneState.lifetimeBookingCount} + 1`,
        updatedAt: new Date(),
      },
    })
    .returning();

  const lifetimeBookingCount = Number(state.lifetimeBookingCount);
  if (lifetimeBookingCount <= 0 || lifetimeBookingCount % 100 !== 0) {
    return null;
  }

  const [claim] = await tx
    .insert(ownerRentalMilestones)
    .values({
      ownerId: booking.ownerId,
      milestoneCount: lifetimeBookingCount,
      triggeringBookingId: booking.id,
      lifetimeBookingCount,
      deliveryStatus: 'pending',
      deliveryAttemptCount: 0,
    })
    .onConflictDoNothing()
    .returning();
  return claim ?? null;
}

/**
 * Delivers a previously committed claim. Every exit path records a final
 * delivery status, while errors remain isolated from booking creation.
 */
export async function deliverOwnerRentalMilestone(claim: OwnerRentalMilestone): Promise<void> {
  try {
    const deliveryClaimed = await storage.claimOwnerRentalMilestoneDelivery(claim.id);
    if (!deliveryClaimed) return;

    const owner = await storage.getUser(claim.ownerId);
    if (!owner?.email) {
      const error = 'Owner has no email address';
      await storage.updateOwnerRentalMilestoneDelivery(claim.id, { status: 'failed', error });
      console.error(`[Owner Milestone] Delivery failed for owner ${claim.ownerId}, milestone ${claim.milestoneCount}: ${error}`);
      return;
    }

    const ownerName = [owner.firstName, owner.lastName].filter(Boolean).join(' ') || 'ParkShare owner';
    const delivery = await sendOwnerRentalMilestoneEmail(
      { name: ownerName, email: owner.email },
      claim.milestoneCount,
      { deliveryKey: `owner-rental-milestone-${claim.id}` }
    );

    if (delivery.success) {
      try {
        await storage.updateOwnerRentalMilestoneDelivery(claim.id, {
          status: 'sent',
          provider: delivery.provider,
        });
        console.log(`[Owner Milestone] Sent ${claim.milestoneCount}-booking thank-you to owner ${claim.ownerId}.`);
      } catch (statusError) {
        console.error(
          `[Owner Milestone] Provider accepted claim ${claim.id}, but sent status could not be recorded; leaving delivery as sending for reconciliation:`,
          statusError
        );
      }
    } else if (delivery.ambiguous) {
      console.error(
        `[Owner Milestone] Delivery outcome is ambiguous for claim ${claim.id}; leaving status as sending to prevent a duplicate attempt: ${delivery.error || 'unknown transport error'}`
      );
    } else {
      await storage.updateOwnerRentalMilestoneDelivery(claim.id, {
        status: 'failed',
        provider: delivery.provider,
        error: delivery.error || 'Unknown email delivery failure',
      });
      console.error(`[Owner Milestone] Delivery failed for owner ${claim.ownerId}, milestone ${claim.milestoneCount}: ${delivery.error || 'unknown error'}`);
    }
  } catch (error) {
    console.error(`[Owner Milestone] Failed to deliver claim ${claim.id}:`, error);
  }
}

export async function deliverPendingOwnerRentalMilestones(): Promise<void> {
  try {
    const pendingClaims = await storage.getPendingOwnerRentalMilestones();
    for (const claim of pendingClaims) {
      await deliverOwnerRentalMilestone(claim);
    }
  } catch (error) {
    console.error('[Owner Milestone] Failed to recover pending milestone deliveries:', error);
  }
}
