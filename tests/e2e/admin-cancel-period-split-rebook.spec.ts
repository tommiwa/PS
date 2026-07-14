/**
 * E2E Test: Admin-Cancel Period-Split Booking → Re-book by Another Renter
 *
 * Verifies the full round-trip when an admin cancels a booking that originated
 * from a period listing split, and another renter can then re-book that slot:
 *   1. Owner creates a period listing.
 *   2. Renter A acquires a lock and books one day (triggers a split into a single-day listing).
 *   3. Admin cancels via POST /api/admin/bookings/:id/cancel.
 *   4. Snapshot taken: split listing status and deletedAt are captured.
 *   5. Renter B acquires a lock and books the same split listing/day.
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
 *   npx playwright test tests/e2e/admin-cancel-period-split-rebook.spec.ts
 */

import { test, expect } from '@playwright/test';
import { query, closeTestPool, addDays } from './helpers/test-db';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:5000';

function makeDemoAuthHeader(
  id: string,
  email: string,
  firstName: string,
  lastName: string,
  roles?: string[],
) {
  return { 'x-demo-auth': JSON.stringify({ id, email, firstName, lastName, ...(roles ? { roles } : {}) }) };
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
// Suite: Period listing — admin cancels renter A's booking, renter B re-books
// ============================================================================
test.describe('Admin-cancel on a period-split listing — renter B re-books the same day', () => {
  const tag = `admin-cancel-period-split-${Date.now()}`;
  const adminId = `test-admin-${tag}`;
  const adminEmail = `${adminId}@example.com`;
  const ownerId = `test-owner-${tag}`;
  const ownerEmail = `${ownerId}@example.com`;
  const renterAId = `test-renter-a-${tag}`;
  const renterAEmail = `${renterAId}@example.com`;
  const renterBId = `test-renter-b-${tag}`;
  const renterBEmail = `${renterBId}@example.com`;

  const today = new Date();
  const periodStart = addDays(today, 20);
  const periodEnd = addDays(today, 25);
  const bookingDate = addDays(today, 21);

  let testSpotId = '';
  let originalOwnerIdOnSpot: string | null = null;
  let splitListingId = '';
  let renterABookingId = '';
  let renterBBookingId = '';
  let setupSucceeded = false;

  // Snapshot captured immediately after admin cancels, before renter B books
  let splitStatusAfterCancel: string | null = null;
  let splitDeletedAtAfterCancel: unknown = 'NOT_CHECKED';

  test.beforeAll(async () => {
    const termsRow = await query(
      `SELECT COALESCE(MAX(version), 1) AS v FROM terms_versions WHERE is_active = true`,
    );
    const termsVersion = Number(termsRow.rows[0]?.v ?? 1);

    const spot = await acquireTestSpot(ownerId);
    testSpotId = spot.spotId;
    originalOwnerIdOnSpot = spot.originalOwnerId;

    await ensureUser(adminId, adminEmail, 'Ghost', 'AdminACP', 'admin', termsVersion);
    await ensureUser(ownerId, ownerEmail, 'Ghost', 'OwnerACP', 'owner', termsVersion);
    await ensureUser(renterAId, renterAEmail, 'Ghost', 'RenterAACP', 'renter', termsVersion);
    await ensureUser(renterBId, renterBEmail, 'Ghost', 'RenterBACP', 'renter', termsVersion);

    const adminHeaders = makeDemoAuthHeader(adminId, adminEmail, 'Ghost', 'AdminACP', ['admin']);
    const ownerHeaders = makeDemoAuthHeader(ownerId, ownerEmail, 'Ghost', 'OwnerACP');
    const renterAHeaders = makeDemoAuthHeader(renterAId, renterAEmail, 'Ghost', 'RenterAACP');
    const renterBHeaders = makeDemoAuthHeader(renterBId, renterBEmail, 'Ghost', 'RenterBACP');

    // Step 1: Owner creates a period listing
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

    // Step 2a: Renter A acquires a lock
    const lockResultA = await apiPost(`/api/spots/${testSpotId}/locks`, {
      listingId: parentListingId,
      bookingDate,
    }, renterAHeaders);

    if (lockResultA.status >= 300) {
      throw new Error(`Renter A lock creation failed (${lockResultA.status}): ${JSON.stringify(lockResultA.body)}`);
    }

    // Step 2b: Renter A books one day (triggers split into a single-day listing)
    const bookingResultA = await apiPost('/api/bookings', {
      spotId: testSpotId,
      listingId: parentListingId,
      bookingDate,
      dailyRate: '5.00',
      totalAmount: '5.00',
    }, renterAHeaders);

    if (bookingResultA.status >= 300) {
      throw new Error(`Renter A booking failed (${bookingResultA.status}): ${JSON.stringify(bookingResultA.body)}`);
    }
    renterABookingId = bookingResultA.body.id as string;

    // Identify the split listing created for the booked date
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

    // Step 3: Admin cancels renter A's booking via the admin cancel endpoint
    const cancelResult = await apiPost(`/api/admin/bookings/${renterABookingId}/cancel`, {
      reason: 'Test admin cancellation of period-split booking for re-book verification',
    }, adminHeaders);

    if (cancelResult.status >= 300) {
      throw new Error(`Admin cancel failed (${cancelResult.status}): ${JSON.stringify(cancelResult.body)}`);
    }

    // Step 4: Snapshot — capture split listing state IMMEDIATELY after cancel, before renter B books
    const snapshotRow = await query(
      'SELECT status, deleted_at FROM spot_listings WHERE id = $1',
      [splitListingId],
    );
    if (snapshotRow.rows.length > 0) {
      splitStatusAfterCancel = snapshotRow.rows[0].status as string;
      splitDeletedAtAfterCancel = snapshotRow.rows[0].deleted_at;
    }

    // Step 5: Renter B acquires a lock for the same day (using the restored split listing)
    const lockResultB = await apiPost(`/api/spots/${testSpotId}/locks`, {
      listingId: splitListingId,
      bookingDate,
    }, renterBHeaders);

    if (lockResultB.status >= 300) {
      throw new Error(`Renter B lock creation failed (${lockResultB.status}): ${JSON.stringify(lockResultB.body)}`);
    }

    // Step 5b: Renter B books the same split listing/day
    const bookingResultB = await apiPost('/api/bookings', {
      spotId: testSpotId,
      listingId: splitListingId,
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
      await query('DELETE FROM spot_locks WHERE user_id = ANY($1)', [[adminId, ownerId, renterAId, renterBId]]);
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
      await query('DELETE FROM users WHERE id = ANY($1)', [[adminId, ownerId, renterAId, renterBId]]);
    } finally {
      await closeTestPool();
    }
  });

  // Step 4: Assert the split listing was available immediately after the admin's cancel
  test('period-split listing snapshot shows status=available and not deleted immediately after admin cancels', async () => {
    expect(setupSucceeded, 'Test setup must succeed before verifying DB state').toBe(true);
    expect(
      splitStatusAfterCancel,
      'Period-split listing status must be "available" immediately after admin-cancel (snapshot taken before renter B books)',
    ).toBe('available');
    expect(
      splitDeletedAtAfterCancel,
      'Period-split listing must NOT be soft-deleted after admin-cancel',
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
