import { sql } from "drizzle-orm";
import { db } from "./db";

export interface SwapRepairResult {
  reverseListingCount: number;
  reverseBookingCount: number;
  forwardBookingCount: number;
  forwardListingCount: number;
}

/**
 * Startup data repair for spot-swap / spot-transfer attribution damage.
 *
 * A spot personally assigned to an employee is ALWAYS peer-to-peer. When an
 * admin swap soft-deleted and re-created an owner's listings they were wrongly
 * stamped created_by_admin=true (routing payment to Workplace Services instead
 * of the owner). The FORWARD repair fixes that.
 *
 * TRANSFER-AWARENESS: booked pool-era listings survive a spot assignment in
 * ACTIVE state (soft-delete only touches status='available' listings), so an
 * unscoped repair misattributed pool-era history to the new owner. All repairs
 * are scoped by the current owner's TENURE START on the spot, derived from
 * spot_assignment_history: the earliest 'assigned' event for the current owner
 * after the last event that is NOT an 'assigned' for that owner (covers other
 * users' events AND the owner's own 'unassigned'/'released', so an
 * A -> released -> A lifecycle starts the tenure at the re-assignment and the
 * intervening pool period is never forward-repaired). Spots with no assignment
 * history (legacy, never transferred) have NULL tenure_start = full tenure.
 *
 * The REVERSE repair undoes damage the old unscoped repair caused, and only
 * touches rows whose POOL STATE at creation time is positively proven:
 *  - the last assignment-history event at/before the listing's creation is an
 *    'unassigned'/'released' (spot was in the pool), OR
 *  - no event precedes the creation AND no other user has an 'assigned' event
 *    before the current tenure (the current tenure assignment is the spot's
 *    first recorded ownership, so nothing else could have covered creation).
 * A prior individual owner's rows (last event = their 'assigned') are never
 * touched, and the current owner's own earlier-tenure rows (A -> B -> A) are
 * never touched. Restored attribution goes to the pool admin recovered from
 * the spot's own admin-created listings.
 *
 * All statements are idempotent — a second run is a no-op.
 */
export async function runSwapRepair(log: (msg: string) => void = console.log): Promise<SwapRepairResult> {
  // Common CTEs (inlined per statement — statements don't share state)
  const tenureCte = sql`
    tenure AS (
      SELECT ps.id AS spot_id, ps.owner_id,
        (SELECT min(h.effective_at) FROM spot_assignment_history h
          WHERE h.spot_id = ps.id
            AND h.user_id = ps.owner_id
            AND h.action = 'assigned'
            -- Same-time transfer rule: a direct transfer records the previous
            -- owner's 'unassigned'/'released' and the new owner's 'assigned'
            -- with the SAME effective_at. The 'assigned' counts as later, so
            -- the boundary comparison is >= (not >).
            AND h.effective_at >= COALESCE(
              (SELECT max(h2.effective_at) FROM spot_assignment_history h2
                WHERE h2.spot_id = ps.id
                  AND NOT (h2.user_id = ps.owner_id AND h2.action = 'assigned')),
              '-infinity'::timestamp)
        ) AS tenure_start
      FROM parking_spots ps
      WHERE ps.owner_id IS NOT NULL
    ),
    pool_admin AS (
      -- Original WPS attribution per spot: the admin owner of the spot's
      -- historical admin-created listings.
      SELECT sl.spot_id, mode() WITHIN GROUP (ORDER BY sl.owner_id) AS admin_owner_id
      FROM spot_listings sl
      JOIN tenure t ON t.spot_id = sl.spot_id
      WHERE sl.created_by_admin = true
        AND sl.owner_id IS DISTINCT FROM t.owner_id
      GROUP BY sl.spot_id
    )
  `;

  // Positive pool-state proof at a listing's creation time (see module doc).
  const poolProof = (aliasCreatedAt: ReturnType<typeof sql.raw>) => sql`
    COALESCE(
      (SELECT h.action IN ('unassigned', 'released')
        FROM spot_assignment_history h
        WHERE h.spot_id = sl.spot_id
          AND h.effective_at <= ${aliasCreatedAt}
        -- Same-time transfer rule: at equal effective_at, 'assigned' counts as
        -- the later event.
        ORDER BY h.effective_at DESC, (h.action = 'assigned') DESC
        LIMIT 1),
      NOT EXISTS (
        SELECT 1 FROM spot_assignment_history h3
        WHERE h3.spot_id = sl.spot_id
          AND h3.action = 'assigned'
          AND h3.user_id <> t.owner_id
          AND h3.effective_at < t.tenure_start
      )
    )
  `;

  // 1a. REVERSE repair — listings: pool-era listings wrongly flipped to the
  // current owner get their WPS attribution back.
  const reverseListingRepair = await db.execute(sql`
    WITH ${tenureCte}
    UPDATE spot_listings sl
    SET created_by_admin = true,
        owner_id = pa.admin_owner_id
    FROM tenure t, pool_admin pa
    WHERE t.spot_id = sl.spot_id
      AND pa.spot_id = sl.spot_id
      AND t.tenure_start IS NOT NULL
      AND sl.created_at < t.tenure_start
      AND sl.created_by_admin = false
      AND sl.owner_id = t.owner_id
      AND ${poolProof(sql.raw("sl.created_at"))}
  `);
  const reverseListingCount = (reverseListingRepair as any)?.rowCount || 0;
  if (reverseListingCount > 0) {
    log(`Swap repair (reverse): restored WPS attribution on ${reverseListingCount} pool-era listings created before the current owner's tenure`);
  }

  // 1b. REVERSE repair — bookings: runs AFTER the listing restoration and is
  // keyed on the booking's own listing being a proven pool-era admin listing.
  // Bookings on a prior individual owner's listings or the current owner's own
  // earlier-tenure listings are never touched. Attribution is restored to the
  // listing's owner (the pool admin).
  const reverseBookingRepair = await db.execute(sql`
    WITH ${tenureCte}
    UPDATE bookings b
    SET owner_id = sl.owner_id
    FROM tenure t, spot_listings sl
    WHERE t.spot_id = b.spot_id
      AND sl.id = b.listing_id
      AND t.tenure_start IS NOT NULL
      AND b.booking_date < t.tenure_start::date
      AND b.owner_id = t.owner_id
      AND sl.created_by_admin = true
      AND sl.owner_id IS DISTINCT FROM t.owner_id
      AND sl.created_at < t.tenure_start
      AND b.status NOT IN ('cancelled')
      AND ${poolProof(sql.raw("sl.created_at"))}
  `);
  const reverseBookingCount = (reverseBookingRepair as any)?.rowCount || 0;
  if (reverseBookingCount > 0) {
    log(`Swap repair (reverse): restored original owner attribution on ${reverseBookingCount} pre-tenure bookings`);
  }

  // 2a. FORWARD repair — bookings FIRST (the listing update below clears the
  // damage signature we join on). Tenure-scoped.
  const bookingRepair = await db.execute(sql`
    WITH ${tenureCte}
    UPDATE bookings b
    SET owner_id = ps.owner_id
    FROM parking_spots ps
    JOIN tenure t ON t.spot_id = ps.id, spot_listings sl
    WHERE ps.id = b.spot_id
      AND sl.id = b.listing_id
      AND ps.owner_id IS NOT NULL
      AND sl.created_by_admin = true
      AND sl.deleted_at IS NULL
      AND (t.tenure_start IS NULL OR b.booking_date >= t.tenure_start::date)
      AND (t.tenure_start IS NULL OR sl.created_at >= t.tenure_start)
      AND b.owner_id IS DISTINCT FROM ps.owner_id
      AND b.status NOT IN ('cancelled')
  `);
  const forwardBookingCount = (bookingRepair as any)?.rowCount || 0;
  if (forwardBookingCount > 0) {
    log(`Swap repair: fixed ${forwardBookingCount} bookings on swap-damaged listings (owner attribution)`);
  }

  // 2b. FORWARD repair — listings, tenure-scoped: only ACTIVE listings created
  // within the current owner's tenure. Pool-era active listings keep WPS flag.
  const listingRepair = await db.execute(sql`
    WITH ${tenureCte}
    UPDATE spot_listings sl
    SET created_by_admin = false,
        owner_id = ps.owner_id
    FROM parking_spots ps
    JOIN tenure t ON t.spot_id = ps.id
    WHERE ps.id = sl.spot_id
      AND ps.owner_id IS NOT NULL
      AND sl.created_by_admin = true
      AND sl.deleted_at IS NULL
      AND (t.tenure_start IS NULL OR sl.created_at >= t.tenure_start)
  `);
  const forwardListingCount = (listingRepair as any)?.rowCount || 0;
  if (forwardListingCount > 0) {
    log(`Swap repair: fixed ${forwardListingCount} admin-flagged listings on individually-owned spots (owner attribution, created_by_admin=false)`);
  }

  return { reverseListingCount, reverseBookingCount, forwardBookingCount, forwardListingCount };
}
