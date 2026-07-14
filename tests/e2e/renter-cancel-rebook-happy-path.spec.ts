/**
 * E2E Test: Renter-Cancelled Booking Can Be Re-booked End-to-End (Happy Path)
 *
 * Mirrors cancelled-booking-rebook-happy-path.spec.ts but uses the renter-cancel
 * endpoint (POST /api/bookings/:id/cancel) instead of the owner-cancel endpoint.
 * Renter-initiated cancellations go through a different code path and may restore
 * the split listing differently — this test closes that coverage gap.
 *
 * Flow:
 *  1. Owner creates a period listing.
 *  2. Renter A acquires a lock and books one day — triggers a period→single split.
 *  3. Renter A self-cancels via POST /api/bookings/:id/cancel — the split listing
 *     must be restored to 'available'.
 *  4. Renter B (a different user) acquires a lock on the restored listing.
 *     → Must succeed with 200/201 (not 409 LISTING_NOT_AVAILABLE or 404 LISTING_NOT_FOUND).
 *  5. Renter B completes the booking via POST /api/bookings.
 *     → Must succeed with 200/201.
 *  6. DB assertions: booking exists, listing is now 'booked', lock is active/consumed.
 *
 * Authentication: Uses the x-demo-auth header bypass (development mode only).
 *
 * Requirements:
 *   DATABASE_URL env var must point to the development database.
 *   The application must be running (default: http://localhost:5000).
 *   NODE_ENV must NOT be "production" to allow x-demo-auth bypass.
 *
 * To run:
 *   npx playwright test tests/e2e/renter-cancel-rebook-happy-path.spec.ts
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
// Suite: After renter self-cancels, second renter successfully re-books
// ============================================================================
test.describe('Renter-cancel happy-path re-book — second renter locks and books the restored split slot', () => {
  const tag = `renter-cancel-happy-${Date.now()}`;
  const ownerId = `test-owner-${tag}`;
  const ownerEmail = `${ownerId}@example.com`;

  const renterAId = `test-renter-a-${tag}`;
  const renterAEmail = `${renterAId}@example.com`;

  const renterBId = `test-renter-b-${tag}`;
  const renterBEmail = `${renterBId}@example.com`;

  const today = new Date();
  const periodStart = addDays(today, 20);
  const periodEnd = addDays(today, 24);
  const bookingDate = addDays(today, 21);

  let testSpotId = '';
  let originalOwnerIdOnSpot: string | null = null;
  let splitListingId = '';
  let renterBBookingId = '';
  let renterBLockStatus = -1;
  let renterBLockBody: Record<string, unknown> = {};
  let renterBBookingStatus = -1;
  let renterBBookingBody: Record<string, unknown> = {};
  let setupSucceeded = false;

  test.beforeAll(async () => {
    const termsRow = await query(
      `SELECT COALESCE(MAX(version), 1) AS v FROM terms_versions WHERE is_active = true`,
    );
    const termsVersion = Number(termsRow.rows[0]?.v ?? 1);

    const spot = await acquireTestSpot(ownerId);
    testSpotId = spot.spotId;
    originalOwnerIdOnSpot = spot.originalOwnerId;

    await ensureUser(ownerId, ownerEmail, 'RCH', 'Owner', 'owner', termsVersion);
    await ensureUser(renterAId, renterAEmail, 'RCH', 'RenterA', 'renter', termsVersion);
    await ensureUser(renterBId, renterBEmail, 'RCH', 'RenterB', 'renter', termsVersion);

    const ownerHeaders = makeDemoAuthHeader(ownerId, ownerEmail, 'RCH', 'Owner');
    const renterAHeaders = makeDemoAuthHeader(renterAId, renterAEmail, 'RCH', 'RenterA');

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

    // Step 2a: Renter A acquires a lock on the period listing
    const lockAResult = await apiPost(`/api/spots/${testSpotId}/locks`, {
      listingId: parentListingId,
      bookingDate,
    }, renterAHeaders);

    if (lockAResult.status >= 300) {
      throw new Error(`Renter A lock failed (${lockAResult.status}): ${JSON.stringify(lockAResult.body)}`);
    }

    // Step 2b: Renter A books one day — triggers the period→single split
    const bookingAResult = await apiPost('/api/bookings', {
      spotId: testSpotId,
      listingId: parentListingId,
      bookingDate,
      dailyRate: '5.00',
      totalAmount: '5.00',
    }, renterAHeaders);

    if (bookingAResult.status >= 300) {
      throw new Error(`Renter A booking failed (${bookingAResult.status}): ${JSON.stringify(bookingAResult.body)}`);
    }
    const bookingAId = bookingAResult.body.id as string;

    // Locate the split listing created for the booked date
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
      throw new Error('Split single-day listing for the booked date was not found after Renter A booking');
    }
    splitListingId = splitRow.rows[0].id as string;

    // Step 3: Renter A self-cancels via POST /api/bookings/:id/cancel
    // This is the renter-cancel code path (different from owner-cancel).
    const cancelResult = await apiPost(`/api/bookings/${bookingAId}/cancel`, {}, renterAHeaders);
    if (cancelResult.status >= 300) {
      throw new Error(`Renter A self-cancel failed (${cancelResult.status}): ${JSON.stringify(cancelResult.body)}`);
    }

    // Confirm the split listing is now 'available'
    const listingStatusRow = await query(
      `SELECT status FROM spot_listings WHERE id = $1`,
      [splitListingId],
    );
    if (listingStatusRow.rows[0]?.status !== 'available') {
      throw new Error(
        `Split listing is not available after renter-cancel: ${JSON.stringify(listingStatusRow.rows[0])}`,
      );
    }

    // Purge any stale active locks left from Renter A before Renter B attempts
    await query(
      `UPDATE spot_locks SET status = 'released'
       WHERE listing_id = $1 AND booking_date = $2 AND status = 'active'`,
      [splitListingId, bookingDate],
    );

    // Step 4: Renter B acquires a lock on the now-restored split listing
    const renterBHeaders = makeDemoAuthHeader(renterBId, renterBEmail, 'RCH', 'RenterB');

    const lockBResult = await apiPost(`/api/spots/${testSpotId}/locks`, {
      listingId: splitListingId,
      bookingDate,
    }, renterBHeaders);

    renterBLockStatus = lockBResult.status;
    renterBLockBody = lockBResult.body;

    if (lockBResult.status >= 300) {
      // Record but don't throw — the individual tests will surface the failure with clear messages
      setupSucceeded = true;
      return;
    }

    // Step 5: Renter B completes the booking on the restored split listing
    const bookingBResult = await apiPost('/api/bookings', {
      spotId: testSpotId,
      listingId: splitListingId,
      bookingDate,
      dailyRate: '5.00',
      totalAmount: '5.00',
    }, renterBHeaders);

    renterBBookingStatus = bookingBResult.status;
    renterBBookingBody = bookingBResult.body;

    if (bookingBResult.status < 300) {
      renterBBookingId = bookingBResult.body.id as string;
    }

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
        [[ownerId, renterAId, renterBId]],
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
        [[ownerId, renterAId, renterBId]],
      );
    } finally {
      await closeTestPool();
    }
  });

  // --------------------------------------------------------------------------
  // Test 1: Renter B's lock request on the restored listing must succeed
  // --------------------------------------------------------------------------
  test('Renter B acquires a lock on the renter-cancel-restored split listing without LISTING_NOT_AVAILABLE or LISTING_NOT_FOUND', async () => {
    expect(setupSucceeded, 'Setup must succeed before running lock test').toBe(true);

    expect(
      renterBLockStatus,
      `Lock request for Renter B must succeed (200/201). Got ${renterBLockStatus}. ` +
      `Body: ${JSON.stringify(renterBLockBody)}. ` +
      `If the error code is LISTING_NOT_AVAILABLE the locking fix incorrectly rejected a legitimately available listing after renter self-cancel.`,
    ).toBeGreaterThanOrEqual(200);

    expect(
      renterBLockStatus,
      `Lock request for Renter B must succeed (200/201). Got ${renterBLockStatus}. ` +
      `Body: ${JSON.stringify(renterBLockBody)}`,
    ).toBeLessThan(300);

    // Explicitly assert neither error code fires on the happy path
    const errorCode = renterBLockBody.code as string | undefined;
    expect(
      errorCode,
      'LISTING_NOT_AVAILABLE must NOT be returned for an available renter-cancel-restored listing',
    ).not.toBe('LISTING_NOT_AVAILABLE');
    expect(
      errorCode,
      'LISTING_NOT_FOUND must NOT be returned for an existing available renter-cancel-restored listing',
    ).not.toBe('LISTING_NOT_FOUND');
  });

  // --------------------------------------------------------------------------
  // Test 2: Renter B's booking must succeed end-to-end
  // --------------------------------------------------------------------------
  test('Renter B completes a booking on the renter-cancel-restored split listing successfully', async () => {
    expect(setupSucceeded, 'Setup must succeed before running booking test').toBe(true);

    // If the lock itself failed, surface the failure with an explanatory message
    expect(
      renterBLockStatus,
      `Cannot test booking because the preceding lock request failed (${renterBLockStatus}). ` +
      `Lock body: ${JSON.stringify(renterBLockBody)}`,
    ).toBeLessThan(300);

    expect(
      renterBBookingStatus,
      `Booking by Renter B must succeed (200/201). Got ${renterBBookingStatus}. ` +
      `Body: ${JSON.stringify(renterBBookingBody)}`,
    ).toBeGreaterThanOrEqual(200);

    expect(
      renterBBookingStatus,
      `Booking by Renter B must succeed (200/201). Got ${renterBBookingStatus}. ` +
      `Body: ${JSON.stringify(renterBBookingBody)}`,
    ).toBeLessThan(300);
  });

  // --------------------------------------------------------------------------
  // Test 3: DB confirms one active booking exists for Renter B on that date
  // --------------------------------------------------------------------------
  test('DB contains exactly one active booking for Renter B on the renter-cancel-restored split listing date', async () => {
    expect(setupSucceeded, 'Setup must succeed before verifying DB state').toBe(true);

    expect(renterBLockStatus).toBeLessThan(300);
    expect(renterBBookingStatus).toBeLessThan(300);

    const { rows } = await query(
      `SELECT id, status FROM bookings
       WHERE renter_id = $1
         AND spot_id = $2
         AND booking_date = $3
         AND status NOT IN ('cancelled', 'renter_cancelled')`,
      [renterBId, testSpotId, bookingDate],
    );

    expect(
      rows.length,
      `Expected exactly one active booking for Renter B on ${bookingDate}. Found: ${JSON.stringify(rows)}`,
    ).toBe(1);
  });

  // --------------------------------------------------------------------------
  // Test 4: The restored listing transitions to 'booked' after Renter B books
  // --------------------------------------------------------------------------
  test('Renter-cancel-restored split listing is marked as booked after Renter B completes the booking', async () => {
    expect(setupSucceeded, 'Setup must succeed before verifying listing status').toBe(true);

    expect(renterBLockStatus).toBeLessThan(300);
    expect(renterBBookingStatus).toBeLessThan(300);

    const { rows } = await query(
      `SELECT status FROM spot_listings WHERE id = $1`,
      [splitListingId],
    );

    expect(rows.length, 'The split listing must still exist in the DB').toBe(1);
    expect(
      rows[0].status,
      'Renter-cancel-restored split listing must be "booked" after Renter B completes the booking',
    ).toBe('booked');
  });

  // --------------------------------------------------------------------------
  // Test 5: A lock record for Renter B was created in the DB
  //
  // After a successful booking the lock is released/consumed by the server,
  // so we check for the lock record's existence (any status) rather than
  // requiring it to still be 'active'.
  // --------------------------------------------------------------------------
  test('A lock record for Renter B was created in the DB for the renter-cancel-restored split listing', async () => {
    expect(setupSucceeded, 'Setup must succeed before verifying lock state').toBe(true);

    expect(renterBLockStatus).toBeLessThan(300);

    const { rows } = await query(
      `SELECT id, user_id, status FROM spot_locks
       WHERE listing_id = $1
         AND booking_date = $2
         AND user_id = $3`,
      [splitListingId, bookingDate, renterBId],
    );

    expect(
      rows.length,
      `Expected at least one lock record for Renter B on listing ${splitListingId} on ${bookingDate}. ` +
      `A lock record must have been created even if it was later released after booking. Found: ${JSON.stringify(rows)}`,
    ).toBeGreaterThanOrEqual(1);
  });
});
