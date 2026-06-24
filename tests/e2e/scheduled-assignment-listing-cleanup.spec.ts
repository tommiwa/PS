/**
 * E2E Test: Listing Cleanup on Scheduled (Future-Date) Spot Assignment
 *
 * Verifies that when an admin performs a scheduled spot assignment (scheduledDate
 * is a future date), the system soft-deletes all unbooked listings for that spot
 * from the scheduledDate onwards, while:
 *   - Leaving unbooked listings that fall entirely BEFORE the scheduledDate untouched.
 *   - Leaving booked listings untouched regardless of date.
 *
 * Flow:
 * 1. Set up an admin user, an outgoing owner, and an incoming assignee.
 * 2. Acquire a test spot and assign it to the outgoing owner.
 * 3. Create an unbooked listing BEFORE the scheduled date (should NOT be deleted).
 * 4. Create unbooked listings ON and AFTER the scheduled date (should be soft-deleted).
 * 5. Create a booked listing ON the scheduled date (must NOT be touched).
 * 6. Call POST /api/admin/assign-spot with a future scheduledDate and cancelFutureBookings: true.
 * 7. Assertions:
 *    a. Unbooked listing before scheduledDate is NOT soft-deleted.
 *    b. Unbooked listing on scheduledDate is soft-deleted.
 *    c. Unbooked listing after scheduledDate is soft-deleted.
 *    d. Booked listing on scheduledDate is NOT soft-deleted.
 *    e. No active (non-deleted) unbooked listings remain for this spot from scheduledDate onwards.
 *    f. The spot's ownerId is NOT immediately updated (assignment is pending/scheduled).
 *
 * Authentication: Uses the x-demo-auth header bypass (development mode only).
 *
 * Requirements:
 *   DATABASE_URL env var must point to the development database.
 *   The application must be running (default: http://localhost:5000).
 *   NODE_ENV must NOT be "production" to allow x-demo-auth bypass.
 *
 * To run:
 *   npx playwright test tests/e2e/scheduled-assignment-listing-cleanup.spec.ts
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
// Suite: Scheduled future-date assignment soft-deletes unbooked listings from
//        scheduledDate onwards, leaving earlier listings and booked ones intact.
// ============================================================================

test.describe('Scheduled spot assignment — listing cleanup', () => {
  const tag = `sched-assign-${Date.now()}`;

  const adminId = `test-admin-${tag}`;
  const adminEmail = `${adminId}@example.com`;

  const outgoingOwnerId = `test-outgoing-${tag}`;
  const outgoingOwnerEmail = `${outgoingOwnerId}@example.com`;

  const incomingUserId = `test-incoming-${tag}`;
  const incomingUserEmail = `${incomingUserId}@example.com`;

  // Schedule the assignment 7 days from today so it is unambiguously future.
  const scheduledDate = addDays(new Date(), 7);       // YYYY-MM-DD, 7 days out
  const dayBeforeScheduled = addDays(new Date(), 6);  // 1 day before scheduled date
  const dayAfterScheduled = addDays(new Date(), 8);   // 1 day after scheduled date

  let testSpotId = '';
  let originalOwnerIdOnSpot: string | null = null;

  // IDs of listings we insert directly
  let unbookedBeforeListingId = '';   // before scheduledDate — must NOT be soft-deleted
  let unbookedOnListingId = '';       // on scheduledDate — must be soft-deleted
  let unbookedAfterListingId = '';    // after scheduledDate — must be soft-deleted
  let bookedOnListingId = '';         // booked on scheduledDate — must NOT be soft-deleted

  let setupSucceeded = false;
  let scheduledAssignmentId: string | null = null;

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

    // Insert unbooked listing BEFORE the scheduled date (should be left alone)
    const unbookedBefore = await query(
      `INSERT INTO spot_listings
         (spot_id, owner_id, listing_type, single_date, daily_rate, status, created_at, updated_at)
       VALUES ($1, $2, 'single', $3, 5.00, 'available', NOW(), NOW())
       RETURNING id`,
      [testSpotId, outgoingOwnerId, dayBeforeScheduled],
    );
    unbookedBeforeListingId = unbookedBefore.rows[0].id as string;

    // Insert unbooked listing ON the scheduled date (should be soft-deleted)
    const unbookedOn = await query(
      `INSERT INTO spot_listings
         (spot_id, owner_id, listing_type, single_date, daily_rate, status, created_at, updated_at)
       VALUES ($1, $2, 'single', $3, 5.00, 'available', NOW(), NOW())
       RETURNING id`,
      [testSpotId, outgoingOwnerId, scheduledDate],
    );
    unbookedOnListingId = unbookedOn.rows[0].id as string;

    // Insert unbooked listing AFTER the scheduled date (should be soft-deleted)
    const unbookedAfter = await query(
      `INSERT INTO spot_listings
         (spot_id, owner_id, listing_type, single_date, daily_rate, status, created_at, updated_at)
       VALUES ($1, $2, 'single', $3, 5.00, 'available', NOW(), NOW())
       RETURNING id`,
      [testSpotId, outgoingOwnerId, dayAfterScheduled],
    );
    unbookedAfterListingId = unbookedAfter.rows[0].id as string;

    // Insert a "booked" listing ON the scheduled date — must NOT be touched by cleanup
    const bookedOn = await query(
      `INSERT INTO spot_listings
         (spot_id, owner_id, listing_type, single_date, daily_rate, status, created_at, updated_at)
       VALUES ($1, $2, 'single', $3, 5.00, 'booked', NOW(), NOW())
       RETURNING id`,
      [testSpotId, outgoingOwnerId, scheduledDate],
    );
    bookedOnListingId = bookedOn.rows[0].id as string;

    // Perform a scheduled future assignment
    const adminHeaders = makeDemoAuthHeader(adminId, adminEmail, 'Test', 'Admin', ['admin']);
    const assignResult = await apiPost('/api/admin/assign-spot', {
      spotId: testSpotId,
      userId: incomingUserId,
      scheduledDate,
      cancelFutureBookings: true,
    }, adminHeaders);

    if (assignResult.status >= 300) {
      throw new Error(
        `assign-spot failed (${assignResult.status}): ${JSON.stringify(assignResult.body)}`,
      );
    }

    // Capture the scheduled assignment id for cleanup
    const body = assignResult.body as Record<string, unknown>;
    const sa = body.scheduledAssignment as Record<string, unknown> | undefined;
    scheduledAssignmentId = (sa?.id as string | undefined) ?? null;

    setupSucceeded = true;
  });

  test.afterAll(async () => {
    try {
      // Clean up all test listings (soft-deleted or still active)
      const listingIds = [
        unbookedBeforeListingId,
        unbookedOnListingId,
        unbookedAfterListingId,
        bookedOnListingId,
      ].filter(Boolean);
      if (listingIds.length > 0) {
        await query(`DELETE FROM spot_listings WHERE id = ANY($1)`, [listingIds]);
      }

      // Cancel / remove the scheduled assignment record so it does not interfere
      if (scheduledAssignmentId) {
        await query(
          `DELETE FROM scheduled_spot_assignments WHERE id = $1`,
          [scheduledAssignmentId],
        );
      }

      // Restore spot ownership to what it was before the test
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

  // --- Assertion 1: Unbooked listing BEFORE scheduledDate is NOT soft-deleted ---
  test('unbooked listing before scheduledDate is NOT soft-deleted after scheduled assignment', async () => {
    expect(setupSucceeded, 'Test setup must succeed before assertions').toBe(true);

    const { rows } = await query(
      'SELECT deleted_at, status FROM spot_listings WHERE id = $1',
      [unbookedBeforeListingId],
    );
    expect(rows.length, 'Listing must still exist in DB').toBe(1);
    expect(
      rows[0].deleted_at,
      'Unbooked listing before scheduledDate must NOT have deletedAt set — only listings from scheduledDate onwards are cleaned up',
    ).toBeNull();
    expect(rows[0].status, 'Listing status before scheduledDate must remain "available"').toBe('available');
  });

  // --- Assertion 2: Unbooked listing ON scheduledDate is soft-deleted ---
  test('unbooked listing on scheduledDate is soft-deleted after scheduled assignment', async () => {
    expect(setupSucceeded, 'Test setup must succeed before assertions').toBe(true);

    const { rows } = await query(
      'SELECT deleted_at FROM spot_listings WHERE id = $1',
      [unbookedOnListingId],
    );
    expect(rows.length, 'Listing must still exist in DB (soft-delete, not hard-delete)').toBe(1);
    expect(
      rows[0].deleted_at,
      'Unbooked listing on scheduledDate must have deletedAt set (soft-deleted)',
    ).not.toBeNull();
  });

  // --- Assertion 3: Unbooked listing AFTER scheduledDate is soft-deleted ---
  test('unbooked listing after scheduledDate is soft-deleted after scheduled assignment', async () => {
    expect(setupSucceeded, 'Test setup must succeed before assertions').toBe(true);

    const { rows } = await query(
      'SELECT deleted_at FROM spot_listings WHERE id = $1',
      [unbookedAfterListingId],
    );
    expect(rows.length, 'Listing must still exist in DB (soft-delete, not hard-delete)').toBe(1);
    expect(
      rows[0].deleted_at,
      'Unbooked listing after scheduledDate must have deletedAt set (soft-deleted)',
    ).not.toBeNull();
  });

  // --- Assertion 4: Booked listing ON scheduledDate is NOT soft-deleted ---
  test('booked listing on scheduledDate is NOT soft-deleted after scheduled assignment', async () => {
    expect(setupSucceeded, 'Test setup must succeed before assertions').toBe(true);

    const { rows } = await query(
      'SELECT deleted_at, status FROM spot_listings WHERE id = $1',
      [bookedOnListingId],
    );
    expect(rows.length, 'Booked listing must still exist in DB').toBe(1);
    expect(
      rows[0].deleted_at,
      'Booked listing must NOT have deletedAt set — only unbooked (available) listings are cleaned up',
    ).toBeNull();
    expect(rows[0].status, 'Booked listing status must remain "booked"').toBe('booked');
  });

  // --- Assertion 5: No active unbooked listings remain from scheduledDate onwards ---
  test('no active unbooked listings remain for this spot from scheduledDate onwards after scheduled assignment', async () => {
    expect(setupSucceeded, 'Test setup must succeed before assertions').toBe(true);

    const { rows } = await query(
      `SELECT id, listing_type, single_date, status, deleted_at
       FROM spot_listings
       WHERE spot_id = $1
         AND deleted_at IS NULL
         AND status = 'available'
         AND listing_type = 'single'
         AND single_date >= $2`,
      [testSpotId, scheduledDate],
    );

    expect(
      rows.length,
      'No active unbooked single listings should remain for this spot from scheduledDate onwards after scheduled assignment',
    ).toBe(0);
  });

  // --- Assertion 6: Spot ownerId is NOT changed immediately for a scheduled assignment ---
  test('spot ownerId is NOT immediately updated for a scheduled (future-date) assignment', async () => {
    expect(setupSucceeded, 'Test setup must succeed before assertions').toBe(true);

    const { rows } = await query(
      'SELECT owner_id FROM parking_spots WHERE id = $1',
      [testSpotId],
    );
    expect(rows.length, 'Spot must still exist in DB').toBe(1);
    expect(
      rows[0].owner_id,
      'Spot ownerId must NOT be updated yet — a scheduled assignment is pending, not immediate',
    ).toBe(outgoingOwnerId);
  });
});
