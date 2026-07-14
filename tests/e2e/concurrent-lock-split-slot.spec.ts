/**
 * Integration Test: Concurrent Lock Requests on a Restored Split Slot
 *
 * Verifies that when two renters simultaneously attempt to acquire a lock on a
 * split-listing slot that was just restored to 'available' (e.g. after an
 * owner-cancel), the pessimistic locking system correctly allows exactly one
 * lock to succeed and rejects the other with a 409 SPOT_ALREADY_LOCKED error.
 *
 * This guards against the race condition where both transactions see no active
 * locks (empty SELECT FOR UPDATE result) and both proceed to insert — a gap
 * that was fixed by locking the listing row itself at the start of the
 * lock-acquisition transaction.
 *
 * Flow:
 * 1. Owner creates a period listing.
 * 2. Renter A books one day (triggers a split into single-day listings).
 * 3. Owner cancels the booking — the split listing is restored to 'available'.
 * 4. Two new renters (B and C) fire simultaneous lock requests for that slot.
 * 5. Exactly one request must succeed (200/201) and the other must get 409.
 * 6. Only one active, non-expired lock exists for that listing+date in the DB.
 *
 * Authentication: Uses the x-demo-auth header bypass (development mode only).
 *
 * Requirements:
 *   DATABASE_URL env var must point to the development database.
 *   The application must be running (default: http://localhost:5000).
 *   NODE_ENV must NOT be "production" to allow x-demo-auth bypass.
 *
 * To run:
 *   npx playwright test tests/e2e/concurrent-lock-split-slot.spec.ts
 */

import { test, expect } from '@playwright/test';
import { query, closeTestPool, addDays } from './helpers/test-db';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:5000';

function makeDemoAuthHeader(id: string, email: string, firstName: string, lastName: string) {
  return { 'x-demo-auth': JSON.stringify({ id, email, firstName, lastName }) };
}

async function apiPost(
  path: string,
  body: Record<string, unknown>,
  authHeaders: Record<string, string>,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify(body),
  });
  const responseBody = await response.json().catch(() => ({})) as Record<string, unknown>;
  return { status: response.status, body: responseBody };
}

async function acquireTestSpot(ownerId: string): Promise<{ spotId: string; spotNumber: string; originalOwnerId: string | null }> {
  const spotRow = await query(
    `SELECT ps.id, ps.spot_number, ps.owner_id
     FROM parking_spots ps
     WHERE ps.is_bci_managed = false
       AND NOT EXISTS (
         SELECT 1 FROM spot_listings sl
         WHERE sl.spot_id = ps.id
           AND sl.deleted_at IS NULL
           AND sl.status NOT IN ('cancelled', 'used', 'unused')
       )
     ORDER BY ps.created_at
     LIMIT 1`,
  );
  if (spotRow.rows.length === 0) throw new Error('No available test spot found');

  const spotId = spotRow.rows[0].id as string;
  const spotNumber = spotRow.rows[0].spot_number as string;
  const originalOwnerId = (spotRow.rows[0].owner_id as string | null) ?? null;

  await query('UPDATE parking_spots SET owner_id = $1 WHERE id = $2', [ownerId, spotId]);

  return { spotId, spotNumber, originalOwnerId };
}

async function ensureUser(
  id: string,
  email: string,
  firstName: string,
  lastName: string,
  role: string,
  termsVersion: number,
) {
  await query(
    `INSERT INTO users (id, email, first_name, last_name, roles, accepted_terms_version, status, last_login, created_at, updated_at)
     VALUES ($1, $2, $3, $4, ARRAY[$5]::text[], $6, 'active', NOW(), NOW(), NOW())
     ON CONFLICT (id) DO UPDATE
       SET roles = ARRAY[$5]::text[], accepted_terms_version = $6, updated_at = NOW()`,
    [id, email, firstName, lastName, role, termsVersion],
  );
}

// ============================================================================
// Suite: Two renters race to lock a just-restored split slot
// ============================================================================
test.describe('Concurrent lock acquisition on restored split slot', () => {
  const tag = `concurrent-lock-${Date.now()}`;
  const ownerId = `test-owner-${tag}`;
  const ownerEmail = `${ownerId}@example.com`;

  const firstRenterId = `test-renter-first-${tag}`;
  const firstRenterEmail = `${firstRenterId}@example.com`;

  const renterBId = `test-renter-b-${tag}`;
  const renterBEmail = `${renterBId}@example.com`;

  const renterCId = `test-renter-c-${tag}`;
  const renterCEmail = `${renterCId}@example.com`;

  const today = new Date();
  const periodStart = addDays(today, 20);
  const periodEnd = addDays(today, 24);
  const bookingDate = addDays(today, 21);

  let testSpotId = '';
  let originalOwnerIdOnSpot: string | null = null;
  let splitListingId = '';
  let setupSucceeded = false;

  test.beforeAll(async () => {
    const termsRow = await query(
      `SELECT COALESCE(MAX(version), 1) AS v FROM terms_versions WHERE is_active = true`,
    );
    const termsVersion = Number(termsRow.rows[0]?.v ?? 1);

    const spot = await acquireTestSpot(ownerId);
    testSpotId = spot.spotId;
    originalOwnerIdOnSpot = spot.originalOwnerId;

    await ensureUser(ownerId, ownerEmail, 'Con', 'Owner', 'owner', termsVersion);
    await ensureUser(firstRenterId, firstRenterEmail, 'Con', 'FirstRenter', 'renter', termsVersion);
    await ensureUser(renterBId, renterBEmail, 'Con', 'RenterB', 'renter', termsVersion);
    await ensureUser(renterCId, renterCEmail, 'Con', 'RenterC', 'renter', termsVersion);

    const ownerHeaders = makeDemoAuthHeader(ownerId, ownerEmail, 'Con', 'Owner');
    const firstRenterHeaders = makeDemoAuthHeader(firstRenterId, firstRenterEmail, 'Con', 'FirstRenter');

    // Owner creates a period listing
    const listingResult = await apiPost('/api/spot-listings', {
      spotId: testSpotId,
      listingType: 'period',
      periodStartDate: periodStart,
      periodEndDate: periodEnd,
      dailyRate: '5.00',
    }, ownerHeaders);

    if (listingResult.status >= 300) {
      throw new Error(`Period listing creation failed (${listingResult.status}): ${JSON.stringify(listingResult.body)}`);
    }
    const parentListingId = listingResult.body.id as string;

    // First renter acquires a lock and books one day (triggering the period→single split)
    const lockResult = await apiPost(`/api/spots/${testSpotId}/locks`, {
      listingId: parentListingId,
      bookingDate,
    }, firstRenterHeaders);

    if (lockResult.status >= 300) {
      throw new Error(`Initial lock failed (${lockResult.status}): ${JSON.stringify(lockResult.body)}`);
    }

    const bookingResult = await apiPost('/api/bookings', {
      spotId: testSpotId,
      listingId: parentListingId,
      bookingDate,
      dailyRate: '5.00',
      totalAmount: '5.00',
    }, firstRenterHeaders);

    if (bookingResult.status >= 300) {
      throw new Error(`Initial booking failed (${bookingResult.status}): ${JSON.stringify(bookingResult.body)}`);
    }
    const bookingId = bookingResult.body.id as string;

    // Find the split listing created for the booked date
    const splitRow = await query(
      `SELECT id FROM spot_listings
       WHERE spot_id = $1
         AND listing_type = 'single'
         AND original_listing_type = 'period'
         AND single_date = $2
         AND deleted_at IS NULL`,
      [testSpotId, bookingDate],
    );
    if (splitRow.rows.length === 0) {
      throw new Error('Split single-day listing for the booked date was not found after booking');
    }
    splitListingId = splitRow.rows[0].id as string;

    // Owner cancels the booking — this restores the split listing to 'available'
    const cancelResult = await apiPost(`/api/bookings/${bookingId}/owner-cancel`, {}, ownerHeaders);
    if (cancelResult.status >= 300) {
      throw new Error(`Owner-cancel failed (${cancelResult.status}): ${JSON.stringify(cancelResult.body)}`);
    }

    // Confirm the split listing is now available
    const listingStatusRow = await query(
      `SELECT status FROM spot_listings WHERE id = $1`,
      [splitListingId],
    );
    if (listingStatusRow.rows[0]?.status !== 'available') {
      throw new Error(`Split listing is not available after owner-cancel: ${JSON.stringify(listingStatusRow.rows[0])}`);
    }

    // Make sure no stale locks linger from the first renter before the race
    await query(
      `UPDATE spot_locks SET status = 'released'
       WHERE listing_id = $1 AND booking_date = $2 AND status = 'active'`,
      [splitListingId, bookingDate],
    );

    setupSucceeded = true;
  });

  test.afterAll(async () => {
    try {
      await query(
        'DELETE FROM bookings WHERE spot_id = $1',
        [testSpotId],
      );
      await query(
        'DELETE FROM spot_locks WHERE user_id = ANY($1)',
        [[ownerId, firstRenterId, renterBId, renterCId]],
      );
      if (testSpotId) {
        await query(
          `UPDATE spot_listings SET deleted_at = NOW(), status = 'cancelled'
           WHERE spot_id = $1 AND deleted_at IS NULL`,
          [testSpotId],
        );
        await query(
          'UPDATE parking_spots SET owner_id = $1 WHERE id = $2',
          [originalOwnerIdOnSpot, testSpotId],
        );
      }
      await query(
        'DELETE FROM users WHERE id = ANY($1)',
        [[ownerId, firstRenterId, renterBId, renterCId]],
      );
    } finally {
      await closeTestPool();
    }
  });

  test('exactly one of two concurrent lock requests succeeds, the other gets 409', async () => {
    expect(setupSucceeded, 'Setup must succeed before running concurrent lock test').toBe(true);

    const renterBHeaders = makeDemoAuthHeader(renterBId, renterBEmail, 'Con', 'RenterB');
    const renterCHeaders = makeDemoAuthHeader(renterCId, renterCEmail, 'Con', 'RenterC');

    // Fire both lock requests simultaneously
    const [resultB, resultC] = await Promise.all([
      apiPost(`/api/spots/${testSpotId}/locks`, {
        listingId: splitListingId,
        bookingDate,
      }, renterBHeaders),
      apiPost(`/api/spots/${testSpotId}/locks`, {
        listingId: splitListingId,
        bookingDate,
      }, renterCHeaders),
    ]);

    const statuses = [resultB.status, resultC.status];
    const successCount = statuses.filter(s => s >= 200 && s < 300).length;
    const conflictCount = statuses.filter(s => s === 409).length;

    expect(
      successCount,
      `Exactly one lock request should succeed. Got statuses: ${JSON.stringify(statuses)}, bodies: ${JSON.stringify([resultB.body, resultC.body])}`,
    ).toBe(1);

    expect(
      conflictCount,
      `Exactly one lock request should get 409. Got statuses: ${JSON.stringify(statuses)}`,
    ).toBe(1);

    // Verify the losing response has the right error code
    const losingResult = resultB.status === 409 ? resultB : resultC;
    const losingCode = losingResult.body.code as string | undefined;
    expect(
      losingCode === 'SPOT_ALREADY_LOCKED' || losingCode === 'USER_HAS_ACTIVE_LOCK' || losingCode === 'LISTING_NOT_AVAILABLE',
      `Losing request must return a recognized conflict code, got: ${losingCode}`,
    ).toBe(true);
  });

  test('only one active non-expired lock exists in the database after the race', async () => {
    expect(setupSucceeded, 'Setup must succeed before DB verification').toBe(true);

    const { rows } = await query(
      `SELECT id, user_id FROM spot_locks
       WHERE listing_id = $1
         AND booking_date = $2
         AND status = 'active'
         AND expires_at > NOW()`,
      [splitListingId, bookingDate],
    );

    expect(
      rows.length,
      `There must be exactly one active non-expired lock for listing ${splitListingId} on ${bookingDate}. Found: ${JSON.stringify(rows)}`,
    ).toBe(1);
  });
});
