/**
 * E2E Test: Renter-Cancel Does Not Leave Ghost Listings
 *
 * Verifies that when a renter cancels a booking that originated from a
 * period or recurring listing split, the corresponding single-day listing is
 * soft-deleted (deletedAt set) and is NOT returned by normal listing queries.
 *
 * Background: When a renter books one day from a period/recurring listing, the
 * parent is archived and individual single-day "split" listings are created.
 * The booked day listing carries originalListingType='period'|'recurring'.
 * If the renter later cancels, the split listing must not be left as an active
 * 'available' single-day listing (ghost entry) — it must be soft-deleted.
 *
 * Flow:
 * 1. Owner creates a period (or recurring) listing.
 * 2. Renter books one day, triggering a split into single-day listings.
 * 3. Renter cancels that booking via POST /api/bookings/:id/cancel.
 * 4. Assertions:
 *    a. The split listing referenced by the booking has deletedAt set.
 *    b. The split listing status is 'cancelled'.
 *    c. /api/my-listings does NOT include that listing for the owner.
 *    d. No active (deletedAt IS NULL) single-day listings remain for the
 *       booked date on this spot (no ghost listing left behind).
 *
 * Authentication: Uses the x-demo-auth header bypass (development mode only).
 *
 * Requirements:
 *   DATABASE_URL env var must point to the development database.
 *   The application must be running (default: http://localhost:5000).
 *   NODE_ENV must NOT be "production" to allow x-demo-auth bypass.
 *
 * To run:
 *   npx playwright test tests/e2e/renter-cancel-no-ghost-listing.spec.ts
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
// Suite 1: Period listing — renter-cancel ghost listing check
// ============================================================================
test.describe('Renter-cancel on period-split listing — no ghost listing left behind', () => {
  const tag = `renter-period-cancel-${Date.now()}`;
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

    await ensureUser(ownerId, ownerEmail, 'Ghost', 'RCOwnerP', 'owner', termsVersion);
    await ensureUser(renterId, renterEmail, 'Ghost', 'RCRenterP', 'renter', termsVersion);

    const ownerHeaders = makeDemoAuthHeader(ownerId, ownerEmail, 'Ghost', 'RCOwnerP');
    const renterHeaders = makeDemoAuthHeader(renterId, renterEmail, 'Ghost', 'RCRenterP');

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
    const parentListingId = listingResult.body.id as string;

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

    // Renter cancels the booking (must be > 24h before booking date — booking is 15 days out)
    const cancelResult = await apiPost(`/api/bookings/${bookingId}/cancel`, {}, renterHeaders);
    if (cancelResult.status >= 300) {
      throw new Error(`Renter-cancel failed (${cancelResult.status}): ${JSON.stringify(cancelResult.body)}`);
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

  test('split listing has deletedAt set and status=cancelled after renter-cancel', async () => {
    expect(setupSucceeded, 'Test setup must succeed before verifying DB state').toBe(true);

    const { rows } = await query(
      'SELECT status, deleted_at FROM spot_listings WHERE id = $1',
      [splitListingId],
    );
    expect(rows.length, 'The split listing must still exist in the DB (soft-delete, not hard-delete)').toBe(1);
    expect(
      rows[0].deleted_at,
      'Split listing must have deletedAt set after renter-cancel (soft-deleted, not left as available)',
    ).not.toBeNull();
    expect(
      rows[0].status,
      'Split listing status must be "cancelled" after renter-cancel',
    ).toBe('cancelled');
  });

  test('no active (non-deleted) listing exists for the booked date after renter-cancel (no ghost listing)', async () => {
    expect(setupSucceeded).toBe(true);

    const { rows } = await query(
      `SELECT id, status, deleted_at
       FROM spot_listings
       WHERE spot_id = $1
         AND listing_type = 'single'
         AND single_date = $2
         AND deleted_at IS NULL`,
      [testSpotId, bookingDate],
    );

    expect(
      rows.length,
      'No active single-day listing should remain for the booked date after renter-cancel (ghost listing check)',
    ).toBe(0);
  });

  test('/api/my-listings does not return the cancelled split listing after renter-cancel', async () => {
    expect(setupSucceeded).toBe(true);

    const resp = await apiGet('/api/my-listings', makeDemoAuthHeader(ownerId, ownerEmail, 'Ghost', 'RCOwnerP'));
    expect(resp.status, '/api/my-listings must return 200').toBe(200);
    const listings = resp.body as Array<Record<string, unknown>>;
    expect(Array.isArray(listings)).toBe(true);

    const ghost = listings.find(l => l.id === splitListingId);
    expect(
      ghost,
      'The cancelled+soft-deleted split listing must NOT appear in /api/my-listings after renter-cancel',
    ).toBeUndefined();
  });
});

// ============================================================================
// Suite 2: Recurring listing — renter-cancel ghost listing check
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

test.describe('Renter-cancel on recurring-split listing — no ghost listing left behind', () => {
  const tag = `renter-recurring-cancel-${Date.now()}`;
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

    await ensureUser(ownerId, ownerEmail, 'Ghost', 'RCOwnerR', 'owner', termsVersion);
    await ensureUser(renterId, renterEmail, 'Ghost', 'RCRenterR', 'renter', termsVersion);

    const ownerHeaders = makeDemoAuthHeader(ownerId, ownerEmail, 'Ghost', 'RCOwnerR');
    const renterHeaders = makeDemoAuthHeader(renterId, renterEmail, 'Ghost', 'RCRenterR');

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
    const parentListingId = listingResult.body.id as string;

    // Renter acquires a lock
    const lockResult = await apiPost(`/api/spots/${testSpotId}/locks`, {
      listingId: parentListingId,
      bookingDate,
    }, renterHeaders);

    if (lockResult.status >= 300) {
      throw new Error(`Lock creation failed (${lockResult.status}): ${JSON.stringify(lockResult.body)}`);
    }

    // Renter books one recurring day (triggers split)
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

    // Renter cancels the booking (booking is > 24h away)
    const cancelResult = await apiPost(`/api/bookings/${bookingId}/cancel`, {}, renterHeaders);
    if (cancelResult.status >= 300) {
      throw new Error(`Renter-cancel failed (${cancelResult.status}): ${JSON.stringify(cancelResult.body)}`);
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

  test('recurring split listing has deletedAt set and status=cancelled after renter-cancel', async () => {
    expect(setupSucceeded, 'Test setup must succeed before verifying DB state').toBe(true);

    const { rows } = await query(
      'SELECT status, deleted_at FROM spot_listings WHERE id = $1',
      [splitListingId],
    );
    expect(rows.length, 'The split listing must still exist in the DB (soft-delete, not hard-delete)').toBe(1);
    expect(
      rows[0].deleted_at,
      'Split recurring listing must have deletedAt set after renter-cancel (soft-deleted, not left as available)',
    ).not.toBeNull();
    expect(
      rows[0].status,
      'Split recurring listing status must be "cancelled" after renter-cancel',
    ).toBe('cancelled');
  });

  test('no active (non-deleted) listing exists for the booked recurring date after renter-cancel (no ghost listing)', async () => {
    expect(setupSucceeded).toBe(true);

    const { rows } = await query(
      `SELECT id, status, deleted_at
       FROM spot_listings
       WHERE spot_id = $1
         AND listing_type = 'single'
         AND single_date = $2
         AND deleted_at IS NULL`,
      [testSpotId, bookingDate],
    );

    expect(
      rows.length,
      'No active single-day listing should remain for the booked recurring date after renter-cancel (ghost listing check)',
    ).toBe(0);
  });

  test('/api/my-listings does not return the cancelled recurring split listing after renter-cancel', async () => {
    expect(setupSucceeded).toBe(true);

    const resp = await apiGet('/api/my-listings', makeDemoAuthHeader(ownerId, ownerEmail, 'Ghost', 'RCOwnerR'));
    expect(resp.status, '/api/my-listings must return 200').toBe(200);
    const listings = resp.body as Array<Record<string, unknown>>;
    expect(Array.isArray(listings)).toBe(true);

    const ghost = listings.find(l => l.id === splitListingId);
    expect(
      ghost,
      'The cancelled+soft-deleted recurring split listing must NOT appear in /api/my-listings after renter-cancel',
    ).toBeUndefined();
  });
});
