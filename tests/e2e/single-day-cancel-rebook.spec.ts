/**
 * E2E Test: Single-Day Listing Cancellation → Re-book by Another Renter
 *
 * Verifies the full round-trip when a renter cancels a booking that originated
 * from a directly-created single-day listing (listing_type = 'single', no split):
 *   1. Owner creates a single-day listing for a specific date.
 *   2. Renter A acquires a lock and books the listing.
 *   3. Renter A cancels via POST /api/bookings/:id/cancel (renter-cancel).
 *   4. Snapshot taken: listing status and deletedAt are captured.
 *   5. Renter B acquires a lock and books the same listing.
 *   6. Assertions:
 *      a. Snapshot shows status='available' and deletedAt=null immediately after cancel.
 *      b. Renter A booking is cancelled.
 *      c. Renter B booking is confirmed/pending and belongs to renter B.
 *
 * Authentication: Uses the x-demo-auth header bypass (development mode only).
 *
 * Requirements:
 *   DATABASE_URL env var must point to the development database.
 *   The application must be running (default: http://localhost:5000).
 *   NODE_ENV must NOT be "production" to allow x-demo-auth bypass.
 *
 * To run:
 *   npx playwright test tests/e2e/single-day-cancel-rebook.spec.ts
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
// Suite: Single-day listing — renter A cancels, renter B re-books same listing
// ============================================================================
test.describe('Renter-cancel on a directly-created single-day listing — renter B re-books', () => {
  const tag = `renter-rebook-single-${Date.now()}`;
  const ownerId = `test-owner-${tag}`;
  const ownerEmail = `${ownerId}@example.com`;
  const renterAId = `test-renter-a-${tag}`;
  const renterAEmail = `${renterAId}@example.com`;
  const renterBId = `test-renter-b-${tag}`;
  const renterBEmail = `${renterBId}@example.com`;

  const today = new Date();
  const bookingDate = addDays(today, 20);

  let testSpotId = '';
  let originalOwnerIdOnSpot: string | null = null;
  let listingId = '';
  let renterABookingId = '';
  let renterBBookingId = '';
  let setupSucceeded = false;

  // Snapshot captured immediately after renter A cancels, before renter B books
  let listingStatusAfterCancel: string | null = null;
  let listingDeletedAtAfterCancel: unknown = 'NOT_CHECKED';

  test.beforeAll(async () => {
    const termsRow = await query(
      `SELECT COALESCE(MAX(version), 1) AS v FROM terms_versions WHERE is_active = true`,
    );
    const termsVersion = Number(termsRow.rows[0]?.v ?? 1);

    const spot = await acquireTestSpot(ownerId);
    testSpotId = spot.spotId;
    originalOwnerIdOnSpot = spot.originalOwnerId;

    await ensureUser(ownerId, ownerEmail, 'Ghost', 'OwnerSD', 'owner', termsVersion);
    await ensureUser(renterAId, renterAEmail, 'Ghost', 'RenterASD', 'renter', termsVersion);
    await ensureUser(renterBId, renterBEmail, 'Ghost', 'RenterBSD', 'renter', termsVersion);

    const ownerHeaders = makeDemoAuthHeader(ownerId, ownerEmail, 'Ghost', 'OwnerSD');
    const renterAHeaders = makeDemoAuthHeader(renterAId, renterAEmail, 'Ghost', 'RenterASD');
    const renterBHeaders = makeDemoAuthHeader(renterBId, renterBEmail, 'Ghost', 'RenterBSD');

    // Step 1: Owner creates a single-day listing directly (no period/recurring split)
    const listingResult = await apiPost('/api/spot-listings', {
      spotId: testSpotId,
      listingType: 'single',
      singleDate: bookingDate,
      dailyRate: '5.00',
    }, ownerHeaders);

    if (listingResult.status >= 300) {
      throw new Error(`Single-day listing creation failed (${listingResult.status}): ${JSON.stringify(listingResult.body)}`);
    }
    listingId = listingResult.body.id as string;

    // Step 2a: Renter A acquires a lock
    const lockResultA = await apiPost(`/api/spots/${testSpotId}/locks`, {
      listingId,
      bookingDate,
    }, renterAHeaders);

    if (lockResultA.status >= 300) {
      throw new Error(`Renter A lock creation failed (${lockResultA.status}): ${JSON.stringify(lockResultA.body)}`);
    }

    // Step 2b: Renter A books the single-day listing
    const bookingResultA = await apiPost('/api/bookings', {
      spotId: testSpotId,
      listingId,
      bookingDate,
      dailyRate: '5.00',
      totalAmount: '5.00',
    }, renterAHeaders);

    if (bookingResultA.status >= 300) {
      throw new Error(`Renter A booking failed (${bookingResultA.status}): ${JSON.stringify(bookingResultA.body)}`);
    }
    renterABookingId = bookingResultA.body.id as string;

    // Step 3: Renter A cancels the booking via renter-cancel endpoint
    const cancelResult = await apiPost(`/api/bookings/${renterABookingId}/cancel`, {}, renterAHeaders);
    if (cancelResult.status >= 300) {
      throw new Error(`Renter A cancel failed (${cancelResult.status}): ${JSON.stringify(cancelResult.body)}`);
    }

    // Step 4: Snapshot — capture listing state IMMEDIATELY after cancel, before renter B books
    const snapshotRow = await query(
      'SELECT status, deleted_at FROM spot_listings WHERE id = $1',
      [listingId],
    );
    if (snapshotRow.rows.length > 0) {
      listingStatusAfterCancel = snapshotRow.rows[0].status as string;
      listingDeletedAtAfterCancel = snapshotRow.rows[0].deleted_at;
    }

    // Step 5: Renter B acquires a lock for the same listing/date
    const lockResultB = await apiPost(`/api/spots/${testSpotId}/locks`, {
      listingId,
      bookingDate,
    }, renterBHeaders);

    if (lockResultB.status >= 300) {
      throw new Error(`Renter B lock creation failed (${lockResultB.status}): ${JSON.stringify(lockResultB.body)}`);
    }

    // Step 5b: Renter B books the same listing
    const bookingResultB = await apiPost('/api/bookings', {
      spotId: testSpotId,
      listingId,
      bookingDate,
      dailyRate: '5.00',
      totalAmount: '5.00',
    }, renterBHeaders);

    if (bookingResultB.status >= 300) {
      throw new Error(`Renter B booking failed (${bookingResultB.status}): ${JSON.stringify(bookingResultB.body)}`);
    }
    renterBBookingId = bookingResultB.body.id as string;

    setupSucceeded = true;
  });

  test.afterAll(async () => {
    try {
      await query('DELETE FROM bookings WHERE renter_id = ANY($1)', [[renterAId, renterBId]]);
      await query('DELETE FROM spot_locks WHERE user_id = ANY($1)', [[ownerId, renterAId, renterBId]]);
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
      await query('DELETE FROM users WHERE id = ANY($1)', [[ownerId, renterAId, renterBId]]);
    } finally {
      await closeTestPool();
    }
  });

  // Step 4: Assert the listing was available immediately after renter A's cancel
  test('single-day listing snapshot shows status=available and not deleted immediately after renter A cancels', async () => {
    expect(setupSucceeded, 'Test setup must succeed before verifying DB state').toBe(true);
    expect(
      listingStatusAfterCancel,
      'Single-day listing status must be "available" immediately after renter-cancel (snapshot taken before renter B books)',
    ).toBe('available');
    expect(
      listingDeletedAtAfterCancel,
      'Single-day listing must NOT be soft-deleted after renter-cancel',
    ).toBeNull();
  });

  test('renter A booking is cancelled', async () => {
    expect(setupSucceeded).toBe(true);

    const { rows } = await query(
      'SELECT status FROM bookings WHERE id = $1',
      [renterABookingId],
    );
    expect(rows.length, 'Renter A booking must still exist').toBe(1);
    expect(rows[0].status, 'Renter A booking must be cancelled').toBe('cancelled');
  });

  // Step 6: Assert renter B's booking is confirmed and belongs to renter B
  test('renter B booking is confirmed and belongs to renter B', async () => {
    expect(setupSucceeded, 'Test setup must succeed before checking renter B booking').toBe(true);

    const { rows } = await query(
      'SELECT id, renter_id, status FROM bookings WHERE id = $1',
      [renterBBookingId],
    );
    expect(rows.length, 'Renter B booking must exist in the DB').toBe(1);
    expect(rows[0].renter_id, 'Renter B booking must belong to renter B').toBe(renterBId);
    expect(
      ['confirmed', 'pending'].includes(rows[0].status as string),
      `Renter B booking status should be confirmed or pending, got: ${rows[0].status}`,
    ).toBe(true);
  });
});
