/**
 * E2E Test: Split Listing Booking Flow
 *
 * Verifies that when a renter books one day from a period listing:
 * 1. The parent period listing is archived (cancelled + soft-deleted).
 * 2. Individual single-day listings are created for every day in the range.
 * 3. The booked day listing has status='booked'; the rest have status='available'.
 * 4. Each split listing carries originalListingType='period'.
 * 5. The booking references the new single-day listing (not the parent).
 * 6. The /api/my-listings endpoint returns split listings with originalListingType='period'.
 * 7. The /api/my-listings endpoint excludes the cancelled parent listing.
 * 8. The /api/my-listings response includes renter info for the booked split listing.
 * 9. No duplicate per-day listings exist (no ghost calendar entries).
 *
 * Authentication: Uses the x-demo-auth header bypass (development mode only).
 *
 * Requirements:
 *   DATABASE_URL env var must point to the development database.
 *   The application must be running (default: http://localhost:5000).
 *   NODE_ENV must NOT be "production" to allow x-demo-auth bypass.
 *
 * To run:
 *   npx playwright test tests/e2e/split-listing-booking.spec.ts
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

const PERIOD_DAYS = 4;

test.describe('Split listing booking flow', () => {
  const ownerId = `test-owner-split-${Date.now()}`;
  const ownerEmail = `${ownerId}@example.com`;
  const renterId = `test-renter-split-${Date.now()}`;
  const renterEmail = `${renterId}@example.com`;

  const today = new Date();
  const periodStart = addDays(today, 10);
  const periodEnd = addDays(today, 10 + PERIOD_DAYS);
  const bookingDate = addDays(today, 12);

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
       VALUES ($1, $2, 'Split', 'Owner', ARRAY['owner']::text[], $3, 'active', NOW(), NOW(), NOW())
       ON CONFLICT (id) DO UPDATE
         SET roles = ARRAY['owner']::text[], accepted_terms_version = $3, updated_at = NOW()`,
      [ownerId, ownerEmail, termsVersion],
    );

    await query(
      `INSERT INTO users (id, email, first_name, last_name, roles, accepted_terms_version, status, last_login, created_at, updated_at)
       VALUES ($1, $2, 'Split', 'Renter', ARRAY['renter']::text[], $3, 'active', NOW(), NOW(), NOW())
       ON CONFLICT (id) DO UPDATE
         SET roles = ARRAY['renter']::text[], accepted_terms_version = $3, updated_at = NOW()`,
      [renterId, renterEmail, termsVersion],
    );

    const ownerHeaders = makeDemoAuthHeader(ownerId, ownerEmail, 'Split', 'Owner');
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

    const renterHeaders = makeDemoAuthHeader(renterId, renterEmail, 'Split', 'Renter');
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

  test('parent listing is cancelled and soft-deleted after booking', async () => {
    expect(setupSucceeded, 'Test setup must succeed before verifying DB state').toBe(true);

    const { rows } = await query(
      'SELECT status, deleted_at FROM spot_listings WHERE id = $1',
      [parentListingId],
    );
    expect(rows.length).toBe(1);
    expect(rows[0].status, 'Parent period listing must be cancelled after split').toBe('cancelled');
    expect(rows[0].deleted_at, 'Parent period listing must be soft-deleted (deleted_at IS NOT NULL)').not.toBeNull();
  });

  test(`${PERIOD_DAYS + 1} single-day listings are created from the split with originalListingType='period'`, async () => {
    expect(setupSucceeded).toBe(true);

    const { rows } = await query(
      `SELECT single_date, status, original_listing_type
       FROM spot_listings
       WHERE spot_id = $1
         AND listing_type = 'single'
         AND original_listing_type = 'period'
         AND deleted_at IS NULL
       ORDER BY single_date`,
      [testSpotId],
    );

    const expectedCount = PERIOD_DAYS + 1;
    expect(rows.length, `Period of ${PERIOD_DAYS + 1} days should produce exactly ${expectedCount} split listings`).toBe(expectedCount);

    const bookedRows = rows.filter(r => r.status === 'booked');
    const availableRows = rows.filter(r => r.status === 'available');
    expect(bookedRows.length, 'Exactly one split listing should be booked (the booking date)').toBe(1);
    expect(availableRows.length, 'All remaining split listings should be available').toBe(PERIOD_DAYS);

    const rawDate = bookedRows[0].single_date;
    const bookedDateStr = rawDate instanceof Date
      ? rawDate.toISOString().slice(0, 10)
      : String(rawDate).slice(0, 10);
    expect(bookedDateStr, 'The booked split listing must correspond to the booking date').toBe(bookingDate);
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
      'SELECT listing_type, status FROM spot_listings WHERE id = $1',
      [rows[0].listing_id as string],
    );
    expect(listingRows[0].listing_type, 'Referenced listing must be a single-day listing').toBe('single');
    expect(listingRows[0].status, 'Referenced listing must be booked').toBe('booked');
  });

  test('/api/my-listings returns split listings with originalListingType="period" and excludes the parent', async ({ request }) => {
    expect(setupSucceeded).toBe(true);

    const response = await request.get(`${BASE_URL}/api/my-listings`, {
      headers: makeDemoAuthHeader(ownerId, ownerEmail, 'Split', 'Owner'),
    });
    expect(response.status()).toBe(200);
    const listings = await response.json() as Array<Record<string, unknown>>;
    expect(Array.isArray(listings)).toBe(true);

    const splitListings = listings.filter(l => l.originalListingType === 'period');
    expect(
      splitListings.length,
      'Owner listings must include split single-day listings with originalListingType="period"',
    ).toBeGreaterThan(0);

    const parentInList = listings.find(l => l.id === parentListingId);
    expect(
      parentInList,
      'Cancelled/archived parent period listing must NOT appear in /api/my-listings',
    ).toBeUndefined();
  });

  test('/api/my-listings includes renter info for the booked split listing', async ({ request }) => {
    expect(setupSucceeded).toBe(true);

    const response = await request.get(`${BASE_URL}/api/my-listings`, {
      headers: makeDemoAuthHeader(ownerId, ownerEmail, 'Split', 'Owner'),
    });
    expect(response.status()).toBe(200);
    const listings = await response.json() as Array<Record<string, unknown>>;

    const bookedSplitListings = listings.filter(
      l => l.originalListingType === 'period' && l.status === 'booked',
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

  test('no duplicate per-day listings exist on any day of the split range (calendar ghost-entry check)', async () => {
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
