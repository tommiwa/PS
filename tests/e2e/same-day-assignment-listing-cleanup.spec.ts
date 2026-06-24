/**
 * E2E Test: Listing Cleanup on Same-Day Spot Reassignment
 *
 * Verifies that when an admin performs an immediate spot assignment (no
 * scheduledDate, or scheduledDate = today), the system soft-deletes all
 * unbooked listings for that spot from today onwards, while leaving any
 * booked listings untouched.
 *
 * Flow:
 * 1. Set up an admin user, an outgoing owner, and an incoming assignee.
 * 2. Acquire a test spot and assign it to the outgoing owner.
 * 3. Create several unbooked single listings from today onwards (status='available').
 * 4. Directly insert a single listing that already has status='booked' to
 *    simulate a listing tied to an existing booking.
 * 5. Call POST /api/admin/assign-spot with no scheduledDate (immediate path).
 * 6. Assertions:
 *    a. All unbooked listings (status='available') have deletedAt set (soft-deleted).
 *    b. The booked listing (status='booked') is NOT soft-deleted (deletedAt IS NULL).
 *    c. The spot's ownerId is updated to the incoming assignee.
 *
 * Authentication: Uses the x-demo-auth header bypass (development mode only).
 *
 * Requirements:
 *   DATABASE_URL env var must point to the development database.
 *   The application must be running (default: http://localhost:5000).
 *   NODE_ENV must NOT be "production" to allow x-demo-auth bypass.
 *
 * To run:
 *   npx playwright test tests/e2e/same-day-assignment-listing-cleanup.spec.ts
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

async function acquireTestSpot(
  ownerId: string,
): Promise<{ spotId: string; spotNumber: string; originalOwnerId: string | null }> {
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

// ============================================================================
// Suite: Same-day immediate assignment soft-deletes unbooked listings
// ============================================================================

test.describe('Same-day spot assignment — listing cleanup', () => {
  const tag = `same-day-assign-${Date.now()}`;

  const adminId = `test-admin-${tag}`;
  const adminEmail = `${adminId}@example.com`;

  const outgoingOwnerId = `test-outgoing-${tag}`;
  const outgoingOwnerEmail = `${outgoingOwnerId}@example.com`;

  const incomingUserId = `test-incoming-${tag}`;
  const incomingUserEmail = `${incomingUserId}@example.com`;

  const today = addDays(new Date(), 0);         // today YYYY-MM-DD
  const tomorrow = addDays(new Date(), 1);      // tomorrow
  const dayAfter = addDays(new Date(), 2);      // day after tomorrow

  let testSpotId = '';
  let originalOwnerIdOnSpot: string | null = null;

  // IDs of listings we insert directly
  let unbookedTodayListingId = '';
  let unbookedTomorrowListingId = '';
  let bookedTodayListingId = '';

  let setupSucceeded = false;

  test.beforeAll(async () => {
    const termsRow = await query(
      `SELECT COALESCE(MAX(version), 1) AS v FROM terms_versions WHERE is_active = true`,
    );
    const termsVersion = Number(termsRow.rows[0]?.v ?? 1);

    // Create users
    await ensureUser(adminId, adminEmail, 'Test', 'Admin', 'admin', termsVersion);
    await ensureUser(outgoingOwnerId, outgoingOwnerEmail, 'Test', 'Outgoing', 'owner', termsVersion);
    await ensureUser(incomingUserId, incomingUserEmail, 'Test', 'Incoming', 'renter', termsVersion);

    // Acquire a clean spot for the outgoing owner
    const spot = await acquireTestSpot(outgoingOwnerId);
    testSpotId = spot.spotId;
    originalOwnerIdOnSpot = spot.originalOwnerId;

    // Insert unbooked single listing for today (status='available')
    const unbookedToday = await query(
      `INSERT INTO spot_listings
         (spot_id, owner_id, listing_type, single_date, daily_rate, status, created_at, updated_at)
       VALUES ($1, $2, 'single', $3, 5.00, 'available', NOW(), NOW())
       RETURNING id`,
      [testSpotId, outgoingOwnerId, today],
    );
    unbookedTodayListingId = unbookedToday.rows[0].id as string;

    // Insert unbooked single listing for tomorrow (status='available')
    const unbookedTomorrow = await query(
      `INSERT INTO spot_listings
         (spot_id, owner_id, listing_type, single_date, daily_rate, status, created_at, updated_at)
       VALUES ($1, $2, 'single', $3, 5.00, 'available', NOW(), NOW())
       RETURNING id`,
      [testSpotId, outgoingOwnerId, tomorrow],
    );
    unbookedTomorrowListingId = unbookedTomorrow.rows[0].id as string;

    // Insert a "booked" single listing for today (status='booked') to simulate a listing
    // that already has a booking attached — the cleanup must NOT touch this one.
    const bookedToday = await query(
      `INSERT INTO spot_listings
         (spot_id, owner_id, listing_type, single_date, daily_rate, status, created_at, updated_at)
       VALUES ($1, $2, 'single', $3, 5.00, 'booked', NOW(), NOW())
       RETURNING id`,
      [testSpotId, outgoingOwnerId, today],
    );
    bookedTodayListingId = bookedToday.rows[0].id as string;

    // Perform an immediate assignment (no scheduledDate → immediate path)
    const adminHeaders = makeDemoAuthHeader(adminId, adminEmail, 'Test', 'Admin', ['admin']);
    const assignResult = await apiPost('/api/admin/assign-spot', {
      spotId: testSpotId,
      userId: incomingUserId,
    }, adminHeaders);

    if (assignResult.status >= 300) {
      throw new Error(
        `assign-spot failed (${assignResult.status}): ${JSON.stringify(assignResult.body)}`,
      );
    }

    setupSucceeded = true;
  });

  test.afterAll(async () => {
    try {
      // Clean up listings (both soft-deleted and still-active ones)
      await query(
        `DELETE FROM spot_listings WHERE id = ANY($1)`,
        [[unbookedTodayListingId, unbookedTomorrowListingId, bookedTodayListingId].filter(Boolean)],
      );
      // Restore spot ownership
      if (testSpotId) {
        await query(
          'UPDATE parking_spots SET owner_id = $1 WHERE id = $2',
          [originalOwnerIdOnSpot, testSpotId],
        );
      }
      // Remove test users
      await query(
        'DELETE FROM users WHERE id = ANY($1)',
        [[adminId, outgoingOwnerId, incomingUserId]],
      );
    } finally {
      await closeTestPool();
    }
  });

  // --- Assertion 1: Unbooked listing for today is soft-deleted ---
  test('unbooked single listing for today is soft-deleted after immediate assignment', async () => {
    expect(setupSucceeded, 'Test setup must succeed before assertions').toBe(true);

    const { rows } = await query(
      'SELECT deleted_at FROM spot_listings WHERE id = $1',
      [unbookedTodayListingId],
    );
    expect(rows.length, 'Listing must still exist in DB (soft-delete, not hard-delete)').toBe(1);
    expect(
      rows[0].deleted_at,
      'Unbooked listing for today must have deletedAt set (soft-deleted) after immediate assignment',
    ).not.toBeNull();
  });

  // --- Assertion 2: Unbooked listing for tomorrow is soft-deleted ---
  test('unbooked single listing for tomorrow is soft-deleted after immediate assignment', async () => {
    expect(setupSucceeded, 'Test setup must succeed before assertions').toBe(true);

    const { rows } = await query(
      'SELECT deleted_at FROM spot_listings WHERE id = $1',
      [unbookedTomorrowListingId],
    );
    expect(rows.length, 'Listing must still exist in DB (soft-delete, not hard-delete)').toBe(1);
    expect(
      rows[0].deleted_at,
      'Unbooked listing for tomorrow must have deletedAt set (soft-deleted) after immediate assignment',
    ).not.toBeNull();
  });

  // --- Assertion 3: Booked listing is NOT soft-deleted ---
  test('booked listing is NOT soft-deleted after immediate assignment', async () => {
    expect(setupSucceeded, 'Test setup must succeed before assertions').toBe(true);

    const { rows } = await query(
      'SELECT deleted_at, status FROM spot_listings WHERE id = $1',
      [bookedTodayListingId],
    );
    expect(rows.length, 'Booked listing must still exist in DB').toBe(1);
    expect(
      rows[0].deleted_at,
      'Booked listing must NOT have deletedAt set — only unbooked (available) listings are cleaned up',
    ).toBeNull();
    expect(rows[0].status, 'Booked listing status must remain "booked"').toBe('booked');
  });

  // --- Assertion 4: No unbooked active listings remain for today or later ---
  test('no active (non-deleted) unbooked listings remain for this spot from today onwards after immediate assignment', async () => {
    expect(setupSucceeded, 'Test setup must succeed before assertions').toBe(true);

    const { rows } = await query(
      `SELECT id, listing_type, single_date, status, deleted_at
       FROM spot_listings
       WHERE spot_id = $1
         AND deleted_at IS NULL
         AND status = 'available'
         AND listing_type = 'single'
         AND single_date >= $2`,
      [testSpotId, today],
    );

    expect(
      rows.length,
      'No active unbooked single listings should remain for this spot from today onwards after immediate assignment',
    ).toBe(0);
  });

  // --- Assertion 5: Spot owner is updated to the incoming user ---
  test('spot ownerId is updated to the newly assigned user after immediate assignment', async () => {
    expect(setupSucceeded, 'Test setup must succeed before assertions').toBe(true);

    const { rows } = await query(
      'SELECT owner_id FROM parking_spots WHERE id = $1',
      [testSpotId],
    );
    expect(rows.length, 'Spot must still exist in DB').toBe(1);
    expect(
      rows[0].owner_id,
      'Spot ownerId must be updated to the newly assigned incoming user',
    ).toBe(incomingUserId);
  });
});
