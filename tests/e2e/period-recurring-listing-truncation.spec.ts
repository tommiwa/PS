/**
 * E2E Test: Period and Recurring Listing Truncation on Spot Reassignment
 *
 * Verifies that when an admin performs an immediate spot assignment (today),
 * the system truncates period and recurring listings that START before today
 * but EXTEND into or beyond today — setting their end dates to (today - 1 day).
 * Listings that end entirely before today must NOT be modified.
 *
 * Truncation paths exercised (steps 2 & 3 of softDeleteListingsBySpotIdFromDate):
 *   Step 2 — Period listings: periodStartDate < today AND periodEndDate >= today
 *             → periodEndDate is set to (today - 1 day)
 *   Step 3 — Recurring listings: recurringStartDate < today AND
 *             (recurringEndDate IS NULL OR recurringEndDate >= today)
 *             → recurringEndDate is set to (today - 1 day)
 *
 * Scenarios tested:
 *   A. Period listing spanning past → future: truncated (periodEndDate = yesterday)
 *   B. Period listing entirely in the past (ends yesterday): NOT modified
 *   C. Recurring listing starting in the past with no end date: truncated (recurringEndDate = yesterday)
 *   D. Recurring listing starting in the past with future end date: truncated (recurringEndDate = yesterday)
 *   E. Recurring listing starting in the past with past end date (ends yesterday): NOT modified
 *
 * Authentication: Uses the x-demo-auth header bypass (development mode only).
 *
 * Requirements:
 *   DATABASE_URL env var must point to the development database.
 *   The application must be running (default: http://localhost:5000).
 *   NODE_ENV must NOT be "production" to allow x-demo-auth bypass.
 *
 * To run:
 *   npx playwright test tests/e2e/period-recurring-listing-truncation.spec.ts
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
// Suite: Immediate assignment truncates period/recurring listings crossing today
// ============================================================================

test.describe('Spot assignment — period and recurring listing truncation', () => {
  const tag = `trunc-assign-${Date.now()}`;

  const adminId = `test-admin-${tag}`;
  const adminEmail = `${adminId}@example.com`;

  const outgoingOwnerId = `test-outgoing-${tag}`;
  const outgoingOwnerEmail = `${outgoingOwnerId}@example.com`;

  const incomingUserId = `test-incoming-${tag}`;
  const incomingUserEmail = `${incomingUserId}@example.com`;

  // Date anchors
  const yesterday = addDays(new Date(), -1);   // today - 1
  const today = addDays(new Date(), 0);        // today YYYY-MM-DD
  const tomorrow = addDays(new Date(), 1);     // today + 1
  const farPast = addDays(new Date(), -30);    // 30 days ago (well before today)
  const farFuture = addDays(new Date(), 30);   // 30 days from now

  let testSpotId = '';
  let originalOwnerIdOnSpot: string | null = null;

  // Listing IDs inserted by setup
  let periodCrossingId = '';      // Scenario A: period start=farPast, end=farFuture → truncated
  let periodPastOnlyId = '';      // Scenario B: period start=farPast, end=yesterday → NOT modified
  let recurringNoEndId = '';      // Scenario C: recurring start=farPast, no end → truncated
  let recurringFutureEndId = '';  // Scenario D: recurring start=farPast, end=farFuture → truncated
  let recurringPastEndId = '';    // Scenario E: recurring start=farPast, end=yesterday → NOT modified

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

    // Scenario A: Period listing crossing today (start in past, end in future) → should be truncated
    const resA = await query(
      `INSERT INTO spot_listings
         (spot_id, owner_id, listing_type, period_start_date, period_end_date, daily_rate, status, created_at, updated_at)
       VALUES ($1, $2, 'period', $3, $4, 5.00, 'available', NOW(), NOW())
       RETURNING id`,
      [testSpotId, outgoingOwnerId, farPast, farFuture],
    );
    periodCrossingId = resA.rows[0].id as string;

    // Scenario B: Period listing entirely in the past (ends yesterday) → must NOT be modified
    const resB = await query(
      `INSERT INTO spot_listings
         (spot_id, owner_id, listing_type, period_start_date, period_end_date, daily_rate, status, created_at, updated_at)
       VALUES ($1, $2, 'period', $3, $4, 5.00, 'available', NOW(), NOW())
       RETURNING id`,
      [testSpotId, outgoingOwnerId, farPast, yesterday],
    );
    periodPastOnlyId = resB.rows[0].id as string;

    // Scenario C: Recurring listing starting in the past with no end date → should be truncated
    const resC = await query(
      `INSERT INTO spot_listings
         (spot_id, owner_id, listing_type, recurring_start_date, days_of_week, daily_rate, status, created_at, updated_at)
       VALUES ($1, $2, 'recurring', $3, ARRAY['monday','tuesday','wednesday','thursday','friday']::text[], 5.00, 'available', NOW(), NOW())
       RETURNING id`,
      [testSpotId, outgoingOwnerId, farPast],
    );
    recurringNoEndId = resC.rows[0].id as string;

    // Scenario D: Recurring listing starting in the past with future end date → should be truncated
    const resD = await query(
      `INSERT INTO spot_listings
         (spot_id, owner_id, listing_type, recurring_start_date, recurring_end_date, days_of_week, daily_rate, status, created_at, updated_at)
       VALUES ($1, $2, 'recurring', $3, $4, ARRAY['monday','tuesday','wednesday','thursday','friday']::text[], 5.00, 'available', NOW(), NOW())
       RETURNING id`,
      [testSpotId, outgoingOwnerId, farPast, farFuture],
    );
    recurringFutureEndId = resD.rows[0].id as string;

    // Scenario E: Recurring listing starting in the past with past end date (ends yesterday) → must NOT be modified
    const resE = await query(
      `INSERT INTO spot_listings
         (spot_id, owner_id, listing_type, recurring_start_date, recurring_end_date, days_of_week, daily_rate, status, created_at, updated_at)
       VALUES ($1, $2, 'recurring', $3, $4, ARRAY['monday','tuesday','wednesday','thursday','friday']::text[], 5.00, 'available', NOW(), NOW())
       RETURNING id`,
      [testSpotId, outgoingOwnerId, farPast, yesterday],
    );
    recurringPastEndId = resE.rows[0].id as string;

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
      await query(
        `DELETE FROM spot_listings WHERE id = ANY($1)`,
        [[
          periodCrossingId,
          periodPastOnlyId,
          recurringNoEndId,
          recurringFutureEndId,
          recurringPastEndId,
        ].filter(Boolean)],
      );
      if (testSpotId) {
        await query(
          'UPDATE parking_spots SET owner_id = $1 WHERE id = $2',
          [originalOwnerIdOnSpot, testSpotId],
        );
      }
      await query(
        'DELETE FROM users WHERE id = ANY($1)',
        [[adminId, outgoingOwnerId, incomingUserId]],
      );
    } finally {
      await closeTestPool();
    }
  });

  // --- Scenario A: Period listing crossing today is truncated ---
  test('period listing starting before today and ending after today has periodEndDate set to yesterday', async () => {
    expect(setupSucceeded, 'Test setup must succeed before assertions').toBe(true);

    const { rows } = await query(
      'SELECT period_end_date, deleted_at FROM spot_listings WHERE id = $1',
      [periodCrossingId],
    );
    expect(rows.length, 'Listing must still exist in DB').toBe(1);
    expect(
      rows[0].deleted_at,
      'Period listing crossing today must NOT be hard-deleted or fully soft-deleted',
    ).toBeNull();

    const endDate = (rows[0].period_end_date as Date | string);
    const endDateStr = typeof endDate === 'string'
      ? endDate.slice(0, 10)
      : endDate.toISOString().slice(0, 10);
    expect(
      endDateStr,
      'periodEndDate must be set to (today - 1 day) after immediate assignment',
    ).toBe(yesterday);
  });

  // --- Scenario B: Period listing entirely before today is NOT modified ---
  test('period listing ending before today is NOT modified after immediate assignment', async () => {
    expect(setupSucceeded, 'Test setup must succeed before assertions').toBe(true);

    const { rows } = await query(
      'SELECT period_end_date, deleted_at FROM spot_listings WHERE id = $1',
      [periodPastOnlyId],
    );
    expect(rows.length, 'Listing must still exist in DB').toBe(1);
    expect(
      rows[0].deleted_at,
      'Period listing entirely in the past must NOT be soft-deleted',
    ).toBeNull();

    const endDate = (rows[0].period_end_date as Date | string);
    const endDateStr = typeof endDate === 'string'
      ? endDate.slice(0, 10)
      : endDate.toISOString().slice(0, 10);
    expect(
      endDateStr,
      'periodEndDate must remain unchanged (yesterday) for a listing entirely before today',
    ).toBe(yesterday);
  });

  // --- Scenario C: Recurring listing with no end date is truncated ---
  test('recurring listing starting before today with no end date gets recurringEndDate set to yesterday', async () => {
    expect(setupSucceeded, 'Test setup must succeed before assertions').toBe(true);

    const { rows } = await query(
      'SELECT recurring_end_date, deleted_at FROM spot_listings WHERE id = $1',
      [recurringNoEndId],
    );
    expect(rows.length, 'Listing must still exist in DB').toBe(1);
    expect(
      rows[0].deleted_at,
      'Recurring listing with no end date must NOT be fully soft-deleted',
    ).toBeNull();

    const endDate = (rows[0].recurring_end_date as Date | string | null);
    expect(endDate, 'recurringEndDate must be set (not null) after truncation').not.toBeNull();
    const endDateStr = typeof endDate === 'string'
      ? (endDate as string).slice(0, 10)
      : (endDate as Date).toISOString().slice(0, 10);
    expect(
      endDateStr,
      'recurringEndDate must be set to (today - 1 day) after immediate assignment',
    ).toBe(yesterday);
  });

  // --- Scenario D: Recurring listing with future end date is truncated ---
  test('recurring listing starting before today with future end date gets recurringEndDate set to yesterday', async () => {
    expect(setupSucceeded, 'Test setup must succeed before assertions').toBe(true);

    const { rows } = await query(
      'SELECT recurring_end_date, deleted_at FROM spot_listings WHERE id = $1',
      [recurringFutureEndId],
    );
    expect(rows.length, 'Listing must still exist in DB').toBe(1);
    expect(
      rows[0].deleted_at,
      'Recurring listing with future end date must NOT be fully soft-deleted',
    ).toBeNull();

    const endDate = (rows[0].recurring_end_date as Date | string | null);
    expect(endDate, 'recurringEndDate must be set (not null) after truncation').not.toBeNull();
    const endDateStr = typeof endDate === 'string'
      ? (endDate as string).slice(0, 10)
      : (endDate as Date).toISOString().slice(0, 10);
    expect(
      endDateStr,
      'recurringEndDate must be set to (today - 1 day) after immediate assignment',
    ).toBe(yesterday);
  });

  // --- Scenario E: Recurring listing with past end date is NOT modified ---
  test('recurring listing starting before today with end date before today is NOT modified after immediate assignment', async () => {
    expect(setupSucceeded, 'Test setup must succeed before assertions').toBe(true);

    const { rows } = await query(
      'SELECT recurring_end_date, deleted_at FROM spot_listings WHERE id = $1',
      [recurringPastEndId],
    );
    expect(rows.length, 'Listing must still exist in DB').toBe(1);
    expect(
      rows[0].deleted_at,
      'Recurring listing entirely in the past must NOT be soft-deleted',
    ).toBeNull();

    const endDate = (rows[0].recurring_end_date as Date | string | null);
    expect(endDate, 'recurringEndDate must still be set (not null)').not.toBeNull();
    const endDateStr = typeof endDate === 'string'
      ? (endDate as string).slice(0, 10)
      : (endDate as Date).toISOString().slice(0, 10);
    expect(
      endDateStr,
      'recurringEndDate must remain unchanged (yesterday) for a listing entirely before today',
    ).toBe(yesterday);
  });
});
