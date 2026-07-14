/**
 * E2E Test: Cancelled Booking Restores Split Listing to Available
 *
 * Verifies that when a spot owner cancels a booking that originated from a
 * period or recurring listing split, the corresponding single-day listing is
 * restored to 'available' (not deleted), so other renters can book it again.
 *
 * Flow:
 * 1. Owner creates a period (or recurring) listing.
 * 2. Renter books one day, triggering a split into single-day listings.
 * 3. Owner cancels that booking via POST /api/bookings/:id/owner-cancel.
 * 4. Assertions:
 *    a. The split listing referenced by the booking has status='available' and deletedAt=null.
 *    b. An active single-day listing exists for the booked date (available for re-booking).
 *    c. /api/my-listings DOES include that listing (it's available).
 *
 * Authentication: Uses the x-demo-auth header bypass (development mode only).
 *
 * Requirements:
 *   DATABASE_URL env var must point to the development database.
 *   The application must be running (default: http://localhost:5000).
 *   NODE_ENV must NOT be "production" to allow x-demo-auth bypass.
 *
 * To run:
 *   npx playwright test tests/e2e/cancelled-booking-no-ghost-listing.spec.ts
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

async function apiGet(
  path: string,
  authHeaders: Record<string, string>,
): Promise<{ status: number; body: unknown }> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
  });
  const responseBody = await response.json().catch(() => ({}));
  return { status: response.status, body: responseBody };
}

// ---------------------------------------------------------------------------
// Helper: find a spot with no active listings and temporarily assign an owner
// ---------------------------------------------------------------------------
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
// Suite 1: Period listing — owner-cancel restores split listing to available
// ============================================================================
test.describe('Owner-cancel on period-split listing — restores listing to available', () => {
  const tag = `period-cancel-${Date.now()}`;
  const ownerId = `test-owner-${tag}`;
  const ownerEmail = `${ownerId}@example.com`;
  const renterId = `test-renter-${tag}`;
  const renterEmail = `${renterId}@example.com`;

  const today = new Date();
  const periodStart = addDays(today, 14);
  const periodEnd = addDays(today, 18);
  const bookingDate = addDays(today, 15);

  let testSpotId = '';
  let originalOwnerIdOnSpot: string | null = null;
  let parentListingId = '';
  let splitListingId = '';
  let bookingId = '';
  let setupSucceeded = false;

  test.beforeAll(async () => {
    const termsRow = await query(
      `SELECT COALESCE(MAX(version), 1) AS v FROM terms_versions WHERE is_active = true`,
    );
    const termsVersion = Number(termsRow.rows[0]?.v ?? 1);

    const spot = await acquireTestSpot(ownerId);
    testSpotId = spot.spotId;
    originalOwnerIdOnSpot = spot.originalOwnerId;

    await ensureUser(ownerId, ownerEmail, 'Ghost', 'OwnerP', 'owner', termsVersion);
    await ensureUser(renterId, renterEmail, 'Ghost', 'RenterP', 'renter', termsVersion);

    const ownerHeaders = makeDemoAuthHeader(ownerId, ownerEmail, 'Ghost', 'OwnerP');
    const renterHeaders = makeDemoAuthHeader(renterId, renterEmail, 'Ghost', 'RenterP');

    // Create period listing
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
    parentListingId = listingResult.body.id as string;

    // Renter acquires a lock
    const lockResult = await apiPost(`/api/spots/${testSpotId}/locks`, {
      listingId: parentListingId,
      bookingDate,
    }, renterHeaders);

    if (lockResult.status >= 300) {
      throw new Error(`Lock creation failed (${lockResult.status}): ${JSON.stringify(lockResult.body)}`);
    }

    // Renter books one day from the period listing (triggers split)
    const bookingResult = await apiPost('/api/bookings', {
      spotId: testSpotId,
      listingId: parentListingId,
      bookingDate,
      dailyRate: '5.00',
      totalAmount: '5.00',
    }, renterHeaders);

    if (bookingResult.status >= 300) {
      throw new Error(`Booking creation failed (${bookingResult.status}): ${JSON.stringify(bookingResult.body)}`);
    }
    bookingId = bookingResult.body.id as string;

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

    // Owner cancels the booking
    const cancelResult = await apiPost(`/api/bookings/${bookingId}/owner-cancel`, {}, ownerHeaders);
    if (cancelResult.status >= 300) {
      throw new Error(`Owner-cancel failed (${cancelResult.status}): ${JSON.stringify(cancelResult.body)}`);
    }

    setupSucceeded = true;
  });

  test.afterAll(async () => {
    try {
      await query('DELETE FROM bookings WHERE renter_id = $1', [renterId]);
      await query('DELETE FROM spot_locks WHERE user_id = ANY($1)', [[ownerId, renterId]]);
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
      await query('DELETE FROM users WHERE id = ANY($1)', [[ownerId, renterId]]);
    } finally {
      await closeTestPool();
    }
  });

  test('split listing is restored to available (not deleted) after owner-cancel', async () => {
    expect(setupSucceeded, 'Test setup must succeed before verifying DB state').toBe(true);

    const { rows } = await query(
      'SELECT status, deleted_at FROM spot_listings WHERE id = $1',
      [splitListingId],
    );
    expect(rows.length, 'The split listing must still exist in the DB').toBe(1);
    expect(
      rows[0].deleted_at,
      'Split listing must NOT be soft-deleted after owner-cancel',
    ).toBeNull();
    expect(
      rows[0].status,
      'Split listing status must be "available" after owner-cancel so others can rebook',
    ).toBe('available');
  });

  test('an active listing exists for the booked date after owner-cancel (available for re-booking)', async () => {
    expect(setupSucceeded).toBe(true);

    const { rows } = await query(
      `SELECT id, status, deleted_at
       FROM spot_listings
       WHERE spot_id = $1
         AND listing_type = 'single'
         AND single_date = $2
         AND deleted_at IS NULL
         AND status = 'available'`,
      [testSpotId, bookingDate],
    );

    expect(
      rows.length,
      'An active available single-day listing should exist for the booked date after owner-cancel',
    ).toBeGreaterThan(0);
  });

  test('/api/my-listings includes the restored split listing', async () => {
    expect(setupSucceeded).toBe(true);

    const resp = await apiGet('/api/my-listings', makeDemoAuthHeader(ownerId, ownerEmail, 'Ghost', 'OwnerP'));
    expect(resp.status, '/api/my-listings must return 200').toBe(200);
    const listings = resp.body as Array<Record<string, unknown>>;
    expect(Array.isArray(listings)).toBe(true);

    const restoredListing = listings.find(l => l.id === splitListingId);
    expect(
      restoredListing,
      'The restored available split listing SHOULD appear in /api/my-listings',
    ).toBeDefined();
  });
});

// ============================================================================
// Suite 2: Recurring listing — owner-cancel restores split listing to available
// ============================================================================

function recurringDatesInRange(startStr: string, endStr: string, targetDays: number[]): string[] {
  const result: string[] = [];
  const d = new Date(startStr + 'T00:00:00Z');
  const end = new Date(endStr + 'T00:00:00Z');
  while (d <= end) {
    if (targetDays.includes(d.getUTCDay())) {
      result.push(d.toISOString().slice(0, 10));
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return result;
}

const RECURRING_DAYS = [2, 4]; // Tuesday=2, Thursday=4
const RECURRING_DAY_NAMES = ['tuesday', 'thursday'];

test.describe('Owner-cancel on recurring-split listing — restores listing to available', () => {
  const tag = `recurring-cancel-${Date.now()}`;
  const ownerId = `test-owner-${tag}`;
  const ownerEmail = `${ownerId}@example.com`;
  const renterId = `test-renter-${tag}`;
  const renterEmail = `${renterId}@example.com`;

  const today = new Date();
  const recurringStartDate = addDays(today, 14);
  const recurringEndDate = addDays(today, 49);

  const allMatchingDates = recurringDatesInRange(recurringStartDate, recurringEndDate, RECURRING_DAYS);
  const bookingDate = allMatchingDates[0];

  let testSpotId = '';
  let originalOwnerIdOnSpot: string | null = null;
  let parentListingId = '';
  let splitListingId = '';
  let bookingId = '';
  let setupSucceeded = false;

  test.beforeAll(async () => {
    if (!bookingDate) throw new Error('No matching recurring day found in the configured range');

    const termsRow = await query(
      `SELECT COALESCE(MAX(version), 1) AS v FROM terms_versions WHERE is_active = true`,
    );
    const termsVersion = Number(termsRow.rows[0]?.v ?? 1);

    const spot = await acquireTestSpot(ownerId);
    testSpotId = spot.spotId;
    originalOwnerIdOnSpot = spot.originalOwnerId;

    await ensureUser(ownerId, ownerEmail, 'Ghost', 'OwnerR', 'owner', termsVersion);
    await ensureUser(renterId, renterEmail, 'Ghost', 'RenterR', 'renter', termsVersion);

    const ownerHeaders = makeDemoAuthHeader(ownerId, ownerEmail, 'Ghost', 'OwnerR');
    const renterHeaders = makeDemoAuthHeader(renterId, renterEmail, 'Ghost', 'RenterR');

    // Create recurring listing
    const listingResult = await apiPost('/api/spot-listings', {
      spotId: testSpotId,
      listingType: 'recurring',
      recurringStartDate,
      recurringEndDate,
      daysOfWeek: RECURRING_DAY_NAMES,
      dailyRate: '5.00',
    }, ownerHeaders);

    if (listingResult.status >= 300) {
      throw new Error(`Recurring listing creation failed (${listingResult.status}): ${JSON.stringify(listingResult.body)}`);
    }
    parentListingId = listingResult.body.id as string;

    // Renter acquires a lock
    const lockResult = await apiPost(`/api/spots/${testSpotId}/locks`, {
      listingId: parentListingId,
      bookingDate,
    }, renterHeaders);

    if (lockResult.status >= 300) {
      throw new Error(`Lock creation failed (${lockResult.status}): ${JSON.stringify(lockResult.body)}`);
    }

    // Renter books one day (triggers split)
    const bookingResult = await apiPost('/api/bookings', {
      spotId: testSpotId,
      listingId: parentListingId,
      bookingDate,
      dailyRate: '5.00',
      totalAmount: '5.00',
    }, renterHeaders);

    if (bookingResult.status >= 300) {
      throw new Error(`Booking creation failed (${bookingResult.status}): ${JSON.stringify(bookingResult.body)}`);
    }
    bookingId = bookingResult.body.id as string;

    // Identify the split listing for the booked date
    const splitRow = await query(
      `SELECT id FROM spot_listings
       WHERE spot_id = $1
         AND listing_type = 'single'
         AND original_listing_type = 'recurring'
         AND single_date = $2
         AND deleted_at IS NULL`,
      [testSpotId, bookingDate],
    );
    if (splitRow.rows.length === 0) {
      throw new Error('Split single-day listing for the booked recurring date was not found after booking');
    }
    splitListingId = splitRow.rows[0].id as string;

    // Owner cancels the booking
    const cancelResult = await apiPost(`/api/bookings/${bookingId}/owner-cancel`, {}, ownerHeaders);
    if (cancelResult.status >= 300) {
      throw new Error(`Owner-cancel failed (${cancelResult.status}): ${JSON.stringify(cancelResult.body)}`);
    }

    setupSucceeded = true;
  });

  test.afterAll(async () => {
    try {
      await query('DELETE FROM bookings WHERE renter_id = $1', [renterId]);
      await query('DELETE FROM spot_locks WHERE user_id = ANY($1)', [[ownerId, renterId]]);
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
      await query('DELETE FROM users WHERE id = ANY($1)', [[ownerId, renterId]]);
    } finally {
      await closeTestPool();
    }
  });

  test('recurring split listing is restored to available (not deleted) after owner-cancel', async () => {
    expect(setupSucceeded, 'Test setup must succeed before verifying DB state').toBe(true);

    const { rows } = await query(
      'SELECT status, deleted_at FROM spot_listings WHERE id = $1',
      [splitListingId],
    );
    expect(rows.length, 'The split listing must still exist in the DB').toBe(1);
    expect(
      rows[0].deleted_at,
      'Split recurring listing must NOT be soft-deleted after owner-cancel',
    ).toBeNull();
    expect(
      rows[0].status,
      'Split recurring listing status must be "available" after owner-cancel so others can rebook',
    ).toBe('available');
  });

  test('an active listing exists for the booked recurring date after owner-cancel (available for re-booking)', async () => {
    expect(setupSucceeded).toBe(true);

    const { rows } = await query(
      `SELECT id, status, deleted_at
       FROM spot_listings
       WHERE spot_id = $1
         AND listing_type = 'single'
         AND single_date = $2
         AND deleted_at IS NULL
         AND status = 'available'`,
      [testSpotId, bookingDate],
    );

    expect(
      rows.length,
      'An active available single-day listing should exist for the booked recurring date after owner-cancel',
    ).toBeGreaterThan(0);
  });

  test('/api/my-listings includes the restored recurring split listing', async () => {
    expect(setupSucceeded).toBe(true);

    const resp = await apiGet('/api/my-listings', makeDemoAuthHeader(ownerId, ownerEmail, 'Ghost', 'OwnerR'));
    expect(resp.status, '/api/my-listings must return 200').toBe(200);
    const listings = resp.body as Array<Record<string, unknown>>;
    expect(Array.isArray(listings)).toBe(true);

    const restoredListing = listings.find(l => l.id === splitListingId);
    expect(
      restoredListing,
      'The restored available recurring split listing SHOULD appear in /api/my-listings',
    ).toBeDefined();
  });
});
