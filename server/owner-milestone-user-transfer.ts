import { eq } from 'drizzle-orm';
import {
  ownerRentalMilestones,
  ownerRentalMilestoneState,
  renterBookingMilestones,
  renterBookingMilestoneState,
} from '@shared/schema';

/**
 * Transfers durable owner milestone state during the existing pre-created-user
 * to OIDC-ID migration. This must run before the old user is deleted because
 * both milestone foreign keys intentionally cascade on user deletion.
 */
export async function transferOwnerRentalMilestoneOwnership(
  tx: any,
  oldUserId: string,
  newUserId: string,
): Promise<void> {
  await tx.update(ownerRentalMilestoneState)
    .set({ ownerId: newUserId, updatedAt: new Date() })
    .where(eq(ownerRentalMilestoneState.ownerId, oldUserId));

  await tx.update(ownerRentalMilestones)
    .set({ ownerId: newUserId })
    .where(eq(ownerRentalMilestones.ownerId, oldUserId));
}

/**
 * Transfers durable renter milestone state during the existing pre-created-user
 * to OIDC-ID migration. This must run before the old user is deleted because
 * both milestone foreign keys intentionally cascade on user deletion.
 */
export async function transferRenterBookingMilestoneOwnership(
  tx: any,
  oldUserId: string,
  newUserId: string,
): Promise<void> {
  await tx.update(renterBookingMilestoneState)
    .set({ renterId: newUserId, updatedAt: new Date() })
    .where(eq(renterBookingMilestoneState.renterId, oldUserId));

  await tx.update(renterBookingMilestones)
    .set({ renterId: newUserId })
    .where(eq(renterBookingMilestones.renterId, oldUserId));
}