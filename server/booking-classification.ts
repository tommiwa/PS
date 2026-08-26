import type { SpotListing, ParkingSpot } from "@shared/schema";

/**
 * Authoritative BCI-vs-peer-to-peer classification.
 *
 * A booking/listing is a Workplace Services (payroll) one ONLY when the spot has
 * no individual owner. A spot that is personally assigned to an employee is
 * ALWAYS peer-to-peer, even if its listing was created (or re-created during an
 * admin assign/swap flow) with createdByAdmin = true.
 *
 * Rules:
 * - Spot has an individual owner (ownerId set)  → peer-to-peer (false)
 * - No listing record (direct assignment)       → WPS only if spot is BCI-managed pool spot
 * - Otherwise                                   → listing.createdByAdmin === true
 */
export function isWorkplaceServicesListing(
  listing: Pick<SpotListing, "createdByAdmin"> | null | undefined,
  spot: Pick<ParkingSpot, "ownerId" | "isBciManaged"> | null | undefined
): boolean {
  // Current spot ownership is authoritative: individually-owned spots are always P2P
  if (spot && spot.ownerId) return false;

  if (!listing) {
    // No listing context (e.g. direct assignment booking): fall back to spot flag
    return spot ? spot.isBciManaged === true : false;
  }

  return listing.createdByAdmin === true;
}

/**
 * Swap-damage signature used by the startup data repair (server/index.ts).
 *
 * Only ACTIVE (non-soft-deleted) listings flagged created_by_admin=true on a spot
 * that currently has an individual owner are repaired. Rationale:
 * - The assignment flow can no longer produce this state, so any such listing is
 *   damage from a past admin swap (soft-delete + re-create) — never legitimate.
 * - Historical/soft-deleted listings are NEVER touched: a prior owner's booked
 *   listings, and pool-era (WPS) listings from before a spot was assigned to a
 *   person, are soft-deleted by the swap flow and keep their original attribution,
 *   so a later legitimate reassignment does not transfer history to the new owner.
 */
export function isSwapDamagedListing(
  listing: Pick<SpotListing, "createdByAdmin" | "deletedAt"> | null | undefined,
  spot: Pick<ParkingSpot, "ownerId"> | null | undefined
): boolean {
  if (!listing || !spot?.ownerId) return false;
  return listing.createdByAdmin === true && listing.deletedAt == null;
}

/**
 * Attribution to stamp on a listing created via an admin flow for a given spot.
 * Listings on individually-owned spots must keep the owner's attribution and
 * must NOT be flagged admin-created (they are peer-to-peer).
 */
export function resolveAdminListingAttribution(
  spot: Pick<ParkingSpot, "ownerId"> | null | undefined,
  adminUserId: string
): { ownerId: string; createdByAdmin: boolean } {
  if (spot?.ownerId) {
    return { ownerId: spot.ownerId, createdByAdmin: false };
  }
  return { ownerId: adminUserId, createdByAdmin: true };
}
