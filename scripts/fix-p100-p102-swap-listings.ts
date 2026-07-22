/**
 * One-off script: fix listing status after P100 → P102 spot swap on 2026-07-22.
 *
 * What happened:
 *   The swap moved booking b7de2ac7 from P100 to P102, but (due to the now-fixed
 *   bug) listing statuses and the booking's listingId were not updated.
 *
 * Current (broken) state:
 *   - Booking b7de2ac7 on P102 still references P100's listing (3a5fb775) as its listingId.
 *   - P100's listing for 2026-07-22 (3a5fb775) is stuck at status='booked'.
 *   - P102's own listing for 2026-07-22 (b0ae5235) is incorrectly at status='available'.
 *
 * What this script does (atomically):
 *   1. Verifies the expected records exist with the expected states.
 *   2. Reverts P100's 2026-07-22 listing to status='available'.
 *   3. Marks  P102's 2026-07-22 listing to status='booked'.
 *   4. Updates the booking's listingId to point to P102's listing.
 *
 * Run with --dry-run first to preview changes without committing.
 *
 * Usage:
 *   npx tsx scripts/fix-p100-p102-swap-listings.ts --dry-run
 *   npx tsx scripts/fix-p100-p102-swap-listings.ts
 */

import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL not set — aborting.");
  process.exit(1);
}

const pool = new Pool({ connectionString });

const DRY_RUN = process.argv.includes("--dry-run");

// IDs confirmed from prod read-only query on 2026-07-22
const P100_SPOT_ID      = "57c4bf16-00b8-4e20-83d0-b7fc0ca951aa";
const P102_SPOT_ID      = "152c3f29-f330-4800-b174-6a643f089195";
const BOOKING_ID        = "b7de2ac7-281d-4ee3-9fba-9c950f290307"; // P102 booking for 2026-07-22
const P100_LISTING_ID   = "3a5fb775-bfb1-47da-baf8-66dc1e811be4"; // P100's July 22 listing (stuck 'booked')
const P102_LISTING_ID   = "b0ae5235-94d2-4b89-8c14-f5926ff09245"; // P102's July 22 listing (stuck 'available')
const BOOKING_DATE      = "2026-07-22";

async function run() {
  const client = await pool.connect();
  try {
    if (DRY_RUN) console.log("=== DRY RUN — no changes will be committed ===\n");

    // --- Pre-flight checks ---

    // 1. Verify spots
    const spotsRes = await client.query(
      `SELECT id, spot_number FROM parking_spots WHERE id = ANY($1::text[])`,
      [[P100_SPOT_ID, P102_SPOT_ID]]
    );
    const spots = Object.fromEntries(spotsRes.rows.map((r: any) => [r.id, r.spot_number]));
    if (!spots[P100_SPOT_ID]) { console.error("P100 spot not found — wrong database?"); process.exit(1); }
    if (!spots[P102_SPOT_ID]) { console.error("P102 spot not found — wrong database?"); process.exit(1); }
    console.log(`✓ Spots: ${spots[P100_SPOT_ID]} (${P100_SPOT_ID}), ${spots[P102_SPOT_ID]} (${P102_SPOT_ID})`);

    // 2. Verify booking is on P102 with listing pointing at P100
    const bookingRes = await client.query(
      `SELECT id, spot_id, listing_id, booking_date, status FROM bookings WHERE id = $1`,
      [BOOKING_ID]
    );
    if (bookingRes.rows.length === 0) { console.error("Booking not found — wrong database?"); process.exit(1); }
    const booking = bookingRes.rows[0];
    console.log(`\nBooking ${BOOKING_ID}:`);
    console.log(`  spot_id:     ${booking.spot_id}   (expected: ${P102_SPOT_ID})`);
    console.log(`  listing_id:  ${booking.listing_id}  (expected: ${P100_LISTING_ID} — the stale P100 listing)`);
    console.log(`  booking_date: ${booking.booking_date}`);
    console.log(`  status:       ${booking.status}`);

    if (booking.spot_id !== P102_SPOT_ID) {
      console.error(`\nBooking spot_id is ${booking.spot_id}, expected P102 (${P102_SPOT_ID}).`);
      console.error("The swap may not have happened yet, or IDs are wrong. Aborting.");
      process.exit(1);
    }
    if (booking.listing_id !== P100_LISTING_ID) {
      console.warn(`\nBooking listing_id is already ${booking.listing_id}, not P100's listing.`);
      console.warn("This may mean the script already ran or the state is different than expected.");
      console.warn("Proceeding with pre-flight checks on listings...");
    }

    // 3. Verify P100's listing is stuck 'booked'
    const p100ListingRes = await client.query(
      `SELECT id, status, single_date, listing_type FROM spot_listings WHERE id = $1`,
      [P100_LISTING_ID]
    );
    if (p100ListingRes.rows.length === 0) { console.error("P100 listing not found."); process.exit(1); }
    const p100Listing = p100ListingRes.rows[0];
    console.log(`\nP100 listing ${P100_LISTING_ID}:`);
    console.log(`  status:       ${p100Listing.status}   (expected: 'booked')`);
    console.log(`  single_date:  ${p100Listing.single_date}`);

    // 4. Verify P102's listing is stuck 'available'
    const p102ListingRes = await client.query(
      `SELECT id, status, single_date, listing_type FROM spot_listings WHERE id = $1`,
      [P102_LISTING_ID]
    );
    if (p102ListingRes.rows.length === 0) { console.error("P102 listing not found."); process.exit(1); }
    const p102Listing = p102ListingRes.rows[0];
    console.log(`\nP102 listing ${P102_LISTING_ID}:`);
    console.log(`  status:       ${p102Listing.status}   (expected: 'available')`);
    console.log(`  single_date:  ${p102Listing.single_date}`);

    if (DRY_RUN) {
      console.log("\n--- Changes that WOULD be applied ---");
      console.log(`  UPDATE spot_listings SET status='available' WHERE id='${P100_LISTING_ID}'`);
      console.log(`  UPDATE spot_listings SET status='booked'    WHERE id='${P102_LISTING_ID}'`);
      console.log(`  UPDATE bookings SET listing_id='${P102_LISTING_ID}' WHERE id='${BOOKING_ID}'`);
      console.log("\nDry run complete. Re-run without --dry-run to apply.");
      return;
    }

    // --- Apply fixes atomically ---
    await client.query("BEGIN");

    const r1 = await client.query(
      `UPDATE spot_listings SET status = 'available', updated_at = NOW()
       WHERE id = $1 AND status = 'booked'`,
      [P100_LISTING_ID]
    );
    console.log(`\nReverted P100 listing to 'available': ${r1.rowCount} row(s) updated`);

    const r2 = await client.query(
      `UPDATE spot_listings SET status = 'booked', updated_at = NOW()
       WHERE id = $1 AND status = 'available'`,
      [P102_LISTING_ID]
    );
    console.log(`Marked P102 listing as 'booked': ${r2.rowCount} row(s) updated`);

    const r3 = await client.query(
      `UPDATE bookings SET listing_id = $1, updated_at = NOW()
       WHERE id = $2`,
      [P102_LISTING_ID, BOOKING_ID]
    );
    console.log(`Re-linked booking to P102's listing: ${r3.rowCount} row(s) updated`);

    await client.query("COMMIT");
    console.log("\nDone. All changes committed.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("\nError — rolled back:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
