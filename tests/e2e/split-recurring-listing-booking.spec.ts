/**
 * E2E Test: Split Recurring Listing Booking Flow
 *
 * Verifies that when a renter books one day from a recurring listing (weekly pattern):
 * 1. The parent recurring listing is archived (cancelled + soft-deleted).
 * 2. Individual single-day listings are created for every matching day in the range.
 * 3. The booked day listing has status='booked'; the rest have status='available'.
 * 4. Each split listing carries originalListingType='recurring'.
 * 5. The booking references the new single-day listing (not the parent).
 * 6. The /api/my-listings endpoint returns split listings with originalListingType='recurring'.
 * 7. The /api/my-listings endpoint excludes the cancelled parent listing.
 * 8. No duplicate per-day listings exist (no ghost calendar entries).
 *
 * Authentication: Uses the x-demo-auth header bypass (development mode only).
 *
 * Requirements:
 *   DATABASE_URL env var must point to the development database.
 *   The application must be running (default: http://localhost:5000).
 *   NODE_ENV must NOT be "production" to allow x-demo-auth bypass.
 *
 * To run:
 *   npx playwright test tests/e2e/split-recurring-listing-booking.spec.ts
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

/**
 * Enumerate all dates in [startStr, endStr] inclusive that fall on targetDays (JS day numbers).
 */
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

// Monday=1, Wednesday=3
const RECURRING_DAYS = [1, 3];
const RECURRING_DAY_NAMES = ['monday', 'wednesday'];

test.describe('Split recurring listing booking flow', () => {
  const ownerId = `test-owner-recurring-${Date.now()}`;
  const ownerEmail = `${ownerId}@example.com`;
  const renterId = `test-renter-recurring-${Date.now()}`;
  const renterEmail = `${renterId}@example.com`;

  const today = new Date();
  // Start the recurring listing 10 days from today to avoid conflicts with near-future bookings
  const recurringStartDate = addDays(today, 10);
  // End 35 days after start to get several Mondays and Wednesdays (5 weeks ~ 10 matching days)
  const recurringEndDate = addDays(today, 45);

  // Compute all expected matching dates for assertions
  const allMatchingDates = recurringDatesInRange(recurringStartDate, recurringEndDate, RECURRING_DAYS);

  // Pick the first matching day as the booking date
  const bookingDate = allMatchingDates[0];

  // Remaining matching dates (everything except the booking date)
  const remainingMatchingDates = allMatchingDates.filter(d => d !== bookingDate);

  let testSpotId = '';
  let testSpotNumber = '';
  let originalOwnerIdOnSpot: string | null = null;
  let parentListingId = '';
  let bookingId = '';
  let setupSucceeded = false;

  test.beforeAll(async () => {
    const termsRow = await query(
      `SELECT COALESCE(MAX(version), 1) AS v FROM terms_versions WHERE is_active = true`,
    );
    const termsVersion = Number(termsRow.rows[0]?.v ?? 1);

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

    testSpotId = spotRow.rows[0].id as string;
    testSpotNumber = spotRow.rows[0].spot_number as string;
    originalOwnerIdOnSpot = (spotRow.rows[0].owner_id as string | null) ?? null;

    await query('UPDATE parking_spots SET owner_id = $1 WHERE id = $2', [ownerId, testSpotId]);

    await query(
      `INSERT INTO users (id, email, first_name, last_name, roles, accepted_terms_version, status, last_login, created_at, updated_at)
       VALUES ($1, $2, 'Recur', 'Owner', ARRAY['owner']::text[], $3, 'active', NOW(), NOW(), NOW())
       ON CONFLICT (id) DO UPDATE
         SET roles = ARRAY['owner']::text[], accepted_terms_version = $3, updated_at = NOW()`,
      [ownerId, ownerEmail, termsVersion],
    );

    await query(
      `INSERT INTO users (id, email, first_name, last_name, roles, accepted_terms_version, status, last_login, created_at, updated_at)
       VALUES ($1, $2, 'Recur', 'Renter', ARRAY['renter']::text[], $3, 'active', NOW(), NOW(), NOW())
       ON CONFLICT (id) DO UPDATE
         SET roles = ARRAY['renter']::text[], accepted_terms_version = $3, updated_at = NOW()`,
      [renterId, renterEmail, termsVersion],
    );

    const ownerHeaders = makeDemoAuthHeader(ownerId, ownerEmail, 'Recur', 'Owner');

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

    const renterHeaders = makeDemoAuthHeader(renterId, renterEmail, 'Recur', 'Renter');

    const lockResult = await apiPost(`/api/spots/${testSpotId}/locks`, {
      listingId: parentListingId,
      bookingDate,
    }, renterHeaders);

    if (lockResult.status >= 300) {
      throw new Error(`Lock creation failed (${lockResult.status}): ${JSON.stringify(lockResult.body)}`);
    }

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

  test('parent recurring listing is cancelled and soft-deleted after booking', async () => {
    expect(setupSucceeded, 'Test setup must succeed before verifying DB state').toBe(true);

    const { rows } = await query(
      'SELECT status, deleted_at FROM spot_listings WHERE id = $1',
      [parentListingId],
    );
    expect(rows.length).toBe(1);
    expect(rows[0].status, 'Parent recurring listing must be cancelled after split').toBe('cancelled');
    expect(rows[0].deleted_at, 'Parent recurring listing must be soft-deleted (deleted_at IS NOT NULL)').not.toBeNull();
  });

  test('all matching day-of-week dates produce single-day listings with originalListingType="recurring"', async () => {
    expect(setupSucceeded).toBe(true);

    const { rows } = await query(
      `SELECT single_date, status, original_listing_type
       FROM spot_listings
       WHERE spot_id = $1
         AND listing_type = 'single'
         AND original_listing_type = 'recurring'
         AND deleted_at IS NULL
       ORDER BY single_date`,
      [testSpotId],
    );

    expect(
      rows.length,
      `Expected ${allMatchingDates.length} split single-day listings (one per matching day-of-week in range)`,
    ).toBe(allMatchingDates.length);

    const bookedRows = rows.filter(r => r.status === 'booked');
    const availableRows = rows.filter(r => r.status === 'available');

    expect(bookedRows.length, 'Exactly one split listing should be booked (the booking date)').toBe(1);
    expect(
      availableRows.length,
      'All remaining matching-day listings should be available',
    ).toBe(remainingMatchingDates.length);

    const rawDate = bookedRows[0].single_date;
    const bookedDateStr = rawDate instanceof Date
      ? rawDate.toISOString().slice(0, 10)
      : String(rawDate).slice(0, 10);
    expect(bookedDateStr, 'The booked split listing must correspond to the booking date').toBe(bookingDate);
  });

  test('only dates matching the recurring day-of-week pattern are split (no off-pattern dates)', async () => {
    expect(setupSucceeded).toBe(true);

    const { rows } = await query(
      `SELECT single_date
       FROM spot_listings
       WHERE spot_id = $1
         AND listing_type = 'single'
         AND original_listing_type = 'recurring'
         AND deleted_at IS NULL`,
      [testSpotId],
    );

    for (const row of rows) {
      const raw = row.single_date;
      const dateStr = raw instanceof Date ? raw.toISOString().slice(0, 10) : String(raw).slice(0, 10);
      const d = new Date(dateStr + 'T00:00:00Z');
      expect(
        RECURRING_DAYS.includes(d.getUTCDay()),
        `Split listing on ${dateStr} (day ${d.getUTCDay()}) must match one of the recurring days [${RECURRING_DAYS}]`,
      ).toBe(true);
    }
  });

  test('booking references the new single-day listing rather than the parent', async () => {
    expect(setupSucceeded).toBe(true);

    const { rows } = await query(
      'SELECT listing_id FROM bookings WHERE id = $1',
      [bookingId],
    );
    expect(rows.length).toBe(1);
    expect(
      rows[0].listing_id,
      'Booking must reference the split single-day listing, not the archived parent',
    ).not.toBe(parentListingId);

    const { rows: listingRows } = await query(
      'SELECT listing_type, status, original_listing_type FROM spot_listings WHERE id = $1',
      [rows[0].listing_id as string],
    );
    expect(listingRows[0].listing_type, 'Referenced listing must be a single-day listing').toBe('single');
    expect(listingRows[0].status, 'Referenced listing must be booked').toBe('booked');
    expect(listingRows[0].original_listing_type, 'Referenced listing must carry originalListingType="recurring"').toBe('recurring');
  });

  test('/api/my-listings returns split listings with originalListingType="recurring" and excludes parent', async ({ request }) => {
    expect(setupSucceeded).toBe(true);

    const response = await request.get(`${BASE_URL}/api/my-listings`, {
      headers: makeDemoAuthHeader(ownerId, ownerEmail, 'Recur', 'Owner'),
    });
    expect(response.status()).toBe(200);
    const listings = await response.json() as Array<Record<string, unknown>>;
    expect(Array.isArray(listings)).toBe(true);

    const splitListings = listings.filter(l => l.originalListingType === 'recurring');
    expect(
      splitListings.length,
      'Owner listings must include split single-day listings with originalListingType="recurring"',
    ).toBeGreaterThan(0);

    const parentInList = listings.find(l => l.id === parentListingId);
    expect(
      parentInList,
      'Cancelled/archived parent recurring listing must NOT appear in /api/my-listings',
    ).toBeUndefined();
  });

  test('/api/my-listings includes renter info for the booked split listing', async ({ request }) => {
    expect(setupSucceeded).toBe(true);

    const response = await request.get(`${BASE_URL}/api/my-listings`, {
      headers: makeDemoAuthHeader(ownerId, ownerEmail, 'Recur', 'Owner'),
    });
    expect(response.status()).toBe(200);
    const listings = await response.json() as Array<Record<string, unknown>>;

    const bookedSplitListings = listings.filter(
      l => l.originalListingType === 'recurring' && l.status === 'booked',
    );
    expect(
      bookedSplitListings.length,
      'The booked split listing must appear in owner listings response',
    ).toBeGreaterThanOrEqual(1);

    const bookedListing = bookedSplitListings[0];
    const renterFirstName = (bookedListing.renterFirstName ?? bookedListing.renterName) as string | undefined;
    const hasRenterInfo = Boolean(
      renterFirstName ||
      (bookedListing.renter as Record<string, unknown> | null | undefined)?.firstName,
    );
    expect(
      hasRenterInfo,
      'The booked split listing response must include renter information (renterFirstName or renter.firstName)',
    ).toBe(true);
  });

  test('no duplicate per-day listings exist for any split date (calendar ghost-entry check)', async () => {
    expect(setupSucceeded).toBe(true);

    const { rows } = await query(
      `SELECT single_date, COUNT(*) AS listing_count
       FROM spot_listings
       WHERE spot_id = $1
         AND listing_type = 'single'
         AND deleted_at IS NULL
       GROUP BY single_date
       HAVING COUNT(*) > 1`,
      [testSpotId],
    );

    expect(
      rows.length,
      'No day in the split range should have more than one active single-day listing (prevents ghost calendar entries)',
    ).toBe(0);
  });
});
