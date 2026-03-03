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
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is not set.');
  process.exit(1);
}

const targetArg = process.argv[2];
if (!targetArg) {
  console.error('ERROR: Please provide the user email or "FirstName LastName" as the first argument.');
  console.error('  Usage: npx tsx scripts/cleanup-user-listings.ts <email|"First Last"> [--execute]');
  console.error('  Examples:');
  console.error('    npx tsx scripts/cleanup-user-listings.ts jeff.morris@bci.ca');
  console.error('    npx tsx scripts/cleanup-user-listings.ts "Jeff Morris"');
  process.exit(1);
}

const isDryRun = !process.argv.includes('--execute');
const pool = new Pool({ connectionString: DATABASE_URL });

async function run() {
  const client = await pool.connect();

  try {
    console.log('='.repeat(60));
    console.log('BCI ParkShare — Spot Listing Cleanup Script');
    console.log('='.repeat(60));
    console.log(`Target       : ${targetArg}`);
    console.log(`Mode         : ${isDryRun ? 'DRY RUN (no changes will be made)' : 'EXECUTE (changes will be applied)'}`);
    console.log('='.repeat(60));

    // 1. Find the user — try email first, then name
    const isEmail = targetArg.includes('@');
    let userRes;

    if (isEmail) {
      userRes = await client.query(
        `SELECT id, first_name, last_name, email
         FROM users
         WHERE LOWER(email) = LOWER($1)
         LIMIT 1`,
        [targetArg]
      );
    } else {
      // Try "First Last" name match
      const parts = targetArg.trim().split(/\s+/);
      const firstName = parts[0];
      const lastName = parts.slice(1).join(' ');
      userRes = await client.query(
        `SELECT id, first_name, last_name, email
         FROM users
         WHERE LOWER(first_name) = LOWER($1) AND LOWER(last_name) = LOWER($2)
         LIMIT 1`,
        [firstName, lastName]
      );
    }

    if (userRes.rows.length === 0) {
      console.error(`\nNo user found matching: ${targetArg}`);
      // Show similar matches to help
      const fuzzy = await client.query(
        `SELECT id, first_name, last_name, email FROM users
         WHERE LOWER(first_name) ILIKE $1 OR LOWER(last_name) ILIKE $2 OR LOWER(email) ILIKE $3
         LIMIT 5`,
        [`%${targetArg.split(/[\s@]/)[0]}%`, `%${targetArg.split(/[\s@]/)[0]}%`, `%${targetArg.split(/[\s@]/)[0]}%`]
      );
      if (fuzzy.rows.length > 0) {
        console.error('\nDid you mean one of these?');
        for (const u of fuzzy.rows) {
          console.error(`  ${u.first_name} ${u.last_name} <${u.email}> (id: ${u.id})`);
        }
      }
      process.exit(1);
    }

    const user = userRes.rows[0];
    console.log(`\nUser found:`);
    console.log(`  ID    : ${user.id}`);
    console.log(`  Name  : ${user.first_name} ${user.last_name}`);
    console.log(`  Email : ${user.email}`);

    // 2. Find all their listings
    const listingsRes = await client.query(
      `SELECT
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
       WHERE sl.owner_id = $1
       ORDER BY sl.created_at DESC`,
      [user.id]
    );

    const listings = listingsRes.rows;

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
        (l.spot_number ?? 'N/A').toString().padEnd(10) +
        l.status.padEnd(14) +
        l.listing_type.padEnd(12) +
        dateStr.toString().padEnd(24) +
        `$${Number(l.daily_rate ?? 0).toFixed(2)}`.padEnd(10) +
        l.id
      );
    }

    // 3. Identify listings eligible for cancellation
    const toCancel = listings.filter(l => l.status === 'available');
    const skipped = listings.filter(l => l.status !== 'available');

    console.log(`\nSummary:`);
    console.log(`  Total listings      : ${listings.length}`);
    console.log(`  Will be cancelled   : ${toCancel.length} (status = "available")`);
    console.log(`  Skipped (no change) : ${skipped.length} (already cancelled / used / booked)`);

    if (toCancel.length === 0) {
      console.log('\nNo "available" listings to cancel. Nothing to do.');
      if (isDryRun) console.log('\n[DRY RUN] No changes were made.');
      process.exit(0);
    }

    const cancelIds = toCancel.map(l => l.id);

    // 4. Find active bookings tied to those listings
    const bookingsRes = await client.query(
      `SELECT b.id, b.status, b.booking_date, b.total_amount, b.listing_id,
              u.first_name AS renter_first, u.last_name AS renter_last, u.email AS renter_email
       FROM bookings b
       LEFT JOIN users u ON b.renter_id = u.id
       WHERE b.listing_id = ANY($1)
         AND b.status IN ('pending', 'confirmed', 'upcoming', 'active')
       ORDER BY b.booking_date`,
      [cancelIds]
    );

    const activeBookings = bookingsRes.rows;

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
      console.log(`  npx tsx scripts/cleanup-user-listings.ts "${targetArg}" --execute`);
      console.log('='.repeat(60));
      process.exit(0);
    }

    // 5. EXECUTE: Cancel the listings
    console.log('\nApplying changes...');

    await client.query(
      `UPDATE spot_listings
       SET status = 'cancelled', updated_at = NOW()
       WHERE id = ANY($1)`,
      [cancelIds]
    );
    console.log(`  ✓ Cancelled ${toCancel.length} listing(s).`);

    // 6. EXECUTE: Cancel active bookings
    if (activeBookings.length > 0) {
      const bookingIds = activeBookings.map(b => b.id);
      await client.query(
        `UPDATE bookings
         SET status = 'cancelled',
             cancellation_reason = 'Listing cancelled by admin (bulk cleanup)',
             updated_at = NOW()
         WHERE id = ANY($1)`,
        [bookingIds]
      );
      console.log(`  ✓ Cancelled ${activeBookings.length} booking(s).`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('Cleanup complete.');
    console.log(`  Listings cancelled : ${toCancel.length}`);
    console.log(`  Bookings cancelled : ${activeBookings.length}`);
    console.log('='.repeat(60));

  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error('\nUnexpected error:', err);
  process.exit(1);
});
