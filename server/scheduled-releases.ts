import { storage } from './storage';
import { dbAuditStorage as auditStorage } from './audit-storage';

export async function applyScheduledSpotReleases(): Promise<number> {
  try {
    const dueReleases = await storage.getPendingScheduledReleasesDue();

    if (dueReleases.length === 0) return 0;

    console.log(`[Scheduled Releases] Found ${dueReleases.length} due release(s) to apply`);

    let appliedCount = 0;

    for (const release of dueReleases) {
      try {
        const spot = await storage.getParkingSpot(release.spotId);

        if (!spot) {
          console.error(`[Scheduled Releases] Spot not found for release ${release.id}, skipping`);
          continue;
        }

        const prevOwner = spot.ownerId ? await storage.getUser(spot.ownerId) : null;

        const updatedSpot = await storage.updateParkingSpot(release.spotId, {
          ownerId: null,
          isBookable: false,
        });

        if (!updatedSpot) {
          console.error(`[Scheduled Releases] Failed to update spot ${release.spotId}`);
          continue;
        }

        if (prevOwner) {
          const remainingSpots = await storage.getParkingSpotsByOwner(prevOwner.id);
          if (remainingSpots.length === 0 && prevOwner.roles.includes('owner')) {
            await storage.removeUserRole(prevOwner.id, 'owner');
            console.log(`[Scheduled Releases] Removed owner role from ${prevOwner.email} (no remaining spots)`);
          }
        }

        if (prevOwner) {
          await storage.recordSpotAssignment({
            spotId: release.spotId,
            userId: prevOwner.id,
            action: 'released',
            effectiveAt: new Date(),
            actorId: release.createdBy || undefined,
            notes: `Applied scheduled release (scheduled for ${release.scheduledDate})`,
          });
        }

        const location = await storage.getLocation(spot.locationId);
        const locationName = location ? `${location.office} - ${location.level}` : 'Unknown';
        const buildingName = location?.building || 'Unknown';

        if (prevOwner?.email) {
          try {
            const { sendEmailNotification, wrapEmailTemplate } = await import('./notification-service');
            const ownerName = `${prevOwner.firstName || ''} ${prevOwner.lastName || ''}`.trim() || prevOwner.email;
            const content = `
              <p>Dear ${ownerName},</p>
              <p>This is to let you know that your parking spot <strong>${spot.spotNumber}</strong> (${locationName}) has been released back to the BCI parking pool as of <strong>${new Date(release.scheduledDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</strong>.</p>
              <p>If you have any questions, please contact Workplace Services.</p>
            `;
            await sendEmailNotification({
              to: prevOwner.email,
              subject: `Parking Spot ${spot.spotNumber} Released`,
              text: `Your parking spot ${spot.spotNumber} has been released back to the BCI parking pool as of ${release.scheduledDate}.`,
              html: wrapEmailTemplate({ title: 'Parking Spot Released', content, theme: 'neutral' }),
              type: 'assignment',
            });
            console.log(`[Scheduled Releases] Release notification sent to former owner ${prevOwner.email}`);
          } catch (emailError) {
            console.error(`[Scheduled Releases] Failed to send release email for release ${release.id}:`, emailError);
          }
        }

        if (release.createdBy) {
          try {
            const adminUser = await storage.getUser(release.createdBy);
            if (adminUser?.email) {
              const { sendEmailNotification, wrapEmailTemplate } = await import('./notification-service');
              const adminName = `${adminUser.firstName || ''} ${adminUser.lastName || ''}`.trim() || adminUser.email;
              const formerOwnerName = prevOwner
                ? `${prevOwner.firstName || ''} ${prevOwner.lastName || ''}`.trim() || prevOwner.email || 'the former owner'
                : 'the former owner';
              const content = `
                <p>Dear ${adminName},</p>
                <p>This is to confirm that the scheduled release you set up has been applied:</p>
                <ul>
                  <li><strong>Spot:</strong> ${spot.spotNumber}</li>
                  <li><strong>Location:</strong> ${locationName} (${buildingName})</li>
                  <li><strong>Former Owner:</strong> ${formerOwnerName}${prevOwner?.email ? ` (${prevOwner.email})` : ''}</li>
                  <li><strong>Effective Date:</strong> ${new Date(release.scheduledDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</li>
                </ul>
                <p>The spot has been returned to the BCI parking pool and is now available for reassignment.</p>
              `;
              await sendEmailNotification({
                to: adminUser.email,
                subject: `[Admin Summary] Scheduled Release Applied: Spot ${spot.spotNumber}`,
                text: `The scheduled release of spot ${spot.spotNumber} from ${formerOwnerName} has been applied as of ${release.scheduledDate}.`,
                html: wrapEmailTemplate({ title: 'Scheduled Release Applied', content, theme: 'neutral' }),
                type: 'assignment',
              });
              console.log(`[Scheduled Releases] Admin summary sent to ${adminUser.email}`);
            }
          } catch (adminEmailError) {
            console.error(`[Scheduled Releases] Failed to send admin summary for release ${release.id}:`, adminEmailError);
          }
        }

        await storage.updateScheduledRelease(release.id, {
          status: 'applied',
          appliedAt: new Date(),
        });

        await auditStorage.createAuditLog({
          correlationId: `scheduled-release-${release.id}`,
          action: 'RELEASE',
          entityType: 'parking_spot',
          entityId: release.spotId,
          actorId: 'SYSTEM',
          actorEmail: 'system@bci.ca',
          actorRole: 'system',
          success: true,
          message: `Applied scheduled release: spot ${spot.spotNumber} released from ${prevOwner ? `${prevOwner.firstName} ${prevOwner.lastName} (${prevOwner.email})` : 'unknown owner'} - originally scheduled for ${release.scheduledDate}`,
          before: spot,
          after: updatedSpot,
          requestMeta: {
            method: 'SYSTEM',
            path: '/system/scheduled-release',
            ip: '127.0.0.1',
          },
        });

        appliedCount++;
        console.log(`[Scheduled Releases] Applied release ${release.id}: spot ${spot.spotNumber} released`);
      } catch (releaseError) {
        console.error(`[Scheduled Releases] Error applying release ${release.id}:`, releaseError);
      }
    }

    if (appliedCount > 0) {
      console.log(`[Scheduled Releases] Successfully applied ${appliedCount}/${dueReleases.length} scheduled release(s)`);
    }

    return appliedCount;
  } catch (error) {
    console.error("[Scheduled Releases] Error in scheduled release job:", error);
    return 0;
  }
}
