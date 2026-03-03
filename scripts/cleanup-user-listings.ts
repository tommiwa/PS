/**
 * ONE-OFF CLEANUP SCRIPT: Remove spot listings for a specific user
 *
 * This is a standalone administrative script. It does NOT run on deployment
 * or on any schedule — it must be triggered manually.
 *
 * Usage:
 *   DRY RUN (safe, no changes made):
 *     npx tsx scripts/cleanup-user-listings.ts <email>
 *
 *   ACTUALLY EXECUTE (cancels listings and their active bookings):
 *     npx tsx scripts/cleanup-user-listings.ts <email> --execute
 *
 * Examples:
 *   npx tsx scripts/cleanup-user-listings.ts jeff.morris@bci.ca
 *   npx tsx scripts/cleanup-user-listings.ts jeff.morris@bci.ca --execute
 *
 * What it does:
 *   - Finds the user by email
 *   - Lists ALL their spot_listings (all statuses)
 *   - Cancels "available" listings → sets status to "cancelled"
 *   - Cancels any active bookings tied to those listings (pending/confirmed/upcoming)
 *   - Leaves already-cancelled, used, or booked-and-completed records untouched
 */

import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is not set.');
  process.exit(1);
}

const targetEmail = process.argv[2];
if (!targetEmail) {
  console.error('ERROR: Please provide the user email as the first argument.');
  console.error('  Usage: npx tsx scripts/cleanup-user-listings.ts <email> [--execute]');
  process.exit(1);
}

const isDryRun = !process.argv.includes('--execute');
const sql = neon(DATABASE_URL);

async function run() {
  console.log('='.repeat(60));
  console.log('BCI ParkShare — Spot Listing Cleanup Script');
  console.log('='.repeat(60));
  console.log(`Target email : ${targetEmail}`);
  console.log(`Mode         : ${isDryRun ? 'DRY RUN (no changes will be made)' : 'EXECUTE (changes will be applied)'}`);
  console.log('='.repeat(60));

  // 1. Find the user
  const users = await sql`
    SELECT id, first_name, last_name, email
    FROM users
    WHERE LOWER(email) = LOWER(${targetEmail})
    LIMIT 1
  `;

  if (users.length === 0) {
    console.error(`\nNo user found with email: ${targetEmail}`);
    console.error('Double-check the email address and try again.');
    process.exit(1);
  }

  const user = users[0];
  console.log(`\nUser found:`);
  console.log(`  ID    : ${user.id}`);
  console.log(`  Name  : ${user.first_name} ${user.last_name}`);
  console.log(`  Email : ${user.email}`);

  // 2. Find all their listings
  const listings = await sql`
    SELECT
      sl.id,
      sl.status,
      sl.listing_type,
      sl.single_date,
      sl.period_start_date,
      sl.period_end_date,
      sl.recurring_start_date,
      sl.recurring_end_date,
      sl.daily_rate,
      sl.created_at,
      ps.spot_number
    FROM spot_listings sl
    LEFT JOIN parking_spots ps ON sl.spot_id = ps.id
    WHERE sl.owner_id = ${user.id}
    ORDER BY sl.created_at DESC
  `;

  if (listings.length === 0) {
    console.log(`\nNo listings found for this user. Nothing to clean up.`);
    process.exit(0);
  }

  console.log(`\nAll listings for this user (${listings.length} total):\n`);
  console.log(
    'Spot'.padEnd(10) +
    'Status'.padEnd(14) +
    'Type'.padEnd(12) +
    'Date(s)'.padEnd(24) +
    'Rate'.padEnd(10) +
    'ID'
  );
  console.log('-'.repeat(90));

  for (const l of listings) {
    let dateStr = '';
    if (l.listing_type === 'single') dateStr = l.single_date ?? '';
    else if (l.listing_type === 'period') dateStr = `${l.period_start_date} → ${l.period_end_date}`;
    else if (l.listing_type === 'recurring') dateStr = `${l.recurring_start_date} → ${l.recurring_end_date}`;

    console.log(
      (l.spot_number ?? 'N/A').padEnd(10) +
      l.status.padEnd(14) +
      l.listing_type.padEnd(12) +
      dateStr.padEnd(24) +
      `$${Number(l.daily_rate ?? 0).toFixed(2)}`.padEnd(10) +
      l.id
    );
  }

  // 3. Identify listings eligible for cancellation
  const cancellableStatuses = ['available'];
  const toCancel = listings.filter(l => cancellableStatuses.includes(l.status));
  const skipped = listings.filter(l => !cancellableStatuses.includes(l.status));

  console.log(`\nSummary:`);
  console.log(`  Total listings      : ${listings.length}`);
  console.log(`  Will be cancelled   : ${toCancel.length} (status = "available")`);
  console.log(`  Skipped (no change) : ${skipped.length} (already cancelled / used / booked)`);

  if (toCancel.length === 0) {
    console.log('\nNo "available" listings to cancel. Nothing to do.');
    if (isDryRun) {
      console.log('\n[DRY RUN] No changes were made.');
    }
    process.exit(0);
  }

  const cancelIds = toCancel.map(l => l.id);

  // 4. Find active bookings tied to those listings
  const activeBookings = await sql`
    SELECT b.id, b.status, b.booking_date, b.total_amount, b.listing_id,
           u.first_name AS renter_first, u.last_name AS renter_last, u.email AS renter_email
    FROM bookings b
    LEFT JOIN users u ON b.renter_id = u.id
    WHERE b.listing_id = ANY(${cancelIds})
      AND b.status IN ('pending', 'confirmed', 'upcoming', 'active')
    ORDER BY b.booking_date
  `;

  if (activeBookings.length > 0) {
    console.log(`\nActive bookings that will also be cancelled (${activeBookings.length}):\n`);
    console.log('Date'.padEnd(14) + 'Amount'.padEnd(10) + 'Renter'.padEnd(30) + 'Booking ID');
    console.log('-'.repeat(80));
    for (const b of activeBookings) {
      console.log(
        String(b.booking_date).padEnd(14) +
        `$${Number(b.total_amount ?? 0).toFixed(2)}`.padEnd(10) +
        `${b.renter_first} ${b.renter_last}`.padEnd(30) +
        b.id
      );
    }
  } else {
    console.log('\nNo active bookings tied to these listings.');
  }

  if (isDryRun) {
    console.log('\n' + '='.repeat(60));
    console.log('[DRY RUN] No changes were made to the database.');
    console.log('To actually apply these changes, run with --execute:');
    console.log(`  npx tsx scripts/cleanup-user-listings.ts ${targetEmail} --execute`);
    console.log('='.repeat(60));
    process.exit(0);
  }

  // 5. EXECUTE: Cancel the listings
  console.log('\nApplying changes...');

  const now = new Date().toISOString();

  await sql`
    UPDATE spot_listings
    SET status = 'cancelled',
        updated_at = ${now}
    WHERE id = ANY(${cancelIds})
  `;
  console.log(`  ✓ Cancelled ${toCancel.length} listing(s).`);

  // 6. EXECUTE: Cancel active bookings
  if (activeBookings.length > 0) {
    const bookingIds = activeBookings.map(b => b.id);
    await sql`
      UPDATE bookings
      SET status = 'cancelled',
          cancellation_reason = 'Listing cancelled by admin (bulk cleanup)',
          updated_at = ${now}
      WHERE id = ANY(${bookingIds})
    `;
    console.log(`  ✓ Cancelled ${activeBookings.length} booking(s).`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('Cleanup complete.');
  console.log(`  Listings cancelled : ${toCancel.length}`);
  console.log(`  Bookings cancelled : ${activeBookings.length}`);
  console.log('='.repeat(60));
}

run().catch(err => {
  console.error('\nUnexpected error:', err);
  process.exit(1);
});
