import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("No DATABASE_URL found");
  process.exit(1);
}

const pool = new Pool({ connectionString });

const SPOT_IDS = [
  "f1738a52-6d1e-4200-bd2a-13fa1bd8b6b5", // P34
  "57c4bf16-00b8-4e20-83d0-b7fc0ca951aa", // P100
];
const FROM_DATE = "2026-07-01";
const DRY_RUN = process.argv.includes("--dry-run");

async function run() {
  const client = await pool.connect();
  try {
    if (DRY_RUN) console.log("=== DRY RUN — no changes will be made ===\n");

    // Verify spots exist
    for (const spotId of SPOT_IDS) {
      const r = await client.query(
        "SELECT spot_number FROM parking_spots WHERE id = $1",
        [spotId]
      );
      if (r.rows.length === 0) {
        console.error(`Spot ${spotId} not found — wrong database?`);
        process.exit(1);
      }
      console.log(`Found: ${r.rows[0].spot_number} (${spotId})`);
    }

    // Show upcoming bookings before FROM_DATE to confirm they are safe
    const bookingCheck = await client.query(
      `SELECT b.booking_date, sl.status AS listing_status
       FROM bookings b
       JOIN spot_listings sl ON sl.id = b.listing_id
       WHERE b.spot_id = ANY($1::text[])
         AND b.booking_date >= '2026-06-01'
         AND b.booking_date < $2
         AND b.status NOT IN ('cancelled')
       ORDER BY b.booking_date`,
      [SPOT_IDS, FROM_DATE]
    );
    if (bookingCheck.rows.length > 0) {
      console.log("\nExisting bookings before July 1 (these will NOT be affected):");
      bookingCheck.rows.forEach((r: any) =>
        console.log(`  ${r.booking_date} — listing status: ${r.listing_status}`)
      );
    } else {
      console.log("\nNo upcoming bookings before July 1.");
    }

    // Preview what will be deleted
    const preview = await client.query(
      `SELECT sl.id, ps.spot_number, sl.listing_type, sl.single_date, sl.status
       FROM spot_listings sl
       JOIN parking_spots ps ON ps.id = sl.spot_id
       WHERE sl.spot_id = ANY($1::text[])
         AND sl.status = 'available'
         AND sl.deleted_at IS NULL
         AND sl.listing_type = 'single'
         AND sl.single_date >= $2::date
       ORDER BY ps.spot_number, sl.single_date`,
      [SPOT_IDS, FROM_DATE]
    );
    console.log(`\nListings to soft-delete (single_date >= ${FROM_DATE}): ${preview.rows.length}`);
    if (preview.rows.length > 0) {
      const first = preview.rows[0];
      const last = preview.rows[preview.rows.length - 1];
      console.log(`  Range: ${first.single_date} → ${last.single_date} on ${first.spot_number}...${last.spot_number}`);
    }

    // Period listings that start on/after FROM_DATE → full delete
    const periodDel = await client.query(
      `SELECT id, period_start_date, period_end_date FROM spot_listings
       WHERE spot_id = ANY($1::text[]) AND status = 'available' AND deleted_at IS NULL
         AND listing_type = 'period' AND period_start_date >= $2::date`,
      [SPOT_IDS, FROM_DATE]
    );
    console.log(`Period listings to fully delete: ${periodDel.rows.length}`);
    periodDel.rows.forEach((r: any) =>
      console.log(`  ${r.period_start_date} → ${r.period_end_date}`)
    );

    // Period listings that straddle FROM_DATE → truncate (not delete)
    const periodTrunc = await client.query(
      `SELECT id, period_start_date, period_end_date FROM spot_listings
       WHERE spot_id = ANY($1::text[]) AND status = 'available' AND deleted_at IS NULL
         AND listing_type = 'period'
         AND period_start_date < $2::date AND period_end_date >= $2::date`,
      [SPOT_IDS, FROM_DATE]
    );
    console.log(`Period listings to truncate to June 30: ${periodTrunc.rows.length}`);
    periodTrunc.rows.forEach((r: any) =>
      console.log(`  ${r.period_start_date} → ${r.period_end_date} will become → 2026-06-30`)
    );

    if (DRY_RUN) {
      console.log("\nDry run complete. Re-run without --dry-run to apply.");
      return;
    }

    await client.query("BEGIN");
    let total = 0;

    // Delete single listings >= FROM_DATE
    const r1 = await client.query(
      `UPDATE spot_listings SET deleted_at = NOW()
       WHERE spot_id = ANY($1::text[]) AND status = 'available' AND deleted_at IS NULL
         AND listing_type = 'single' AND single_date >= $2::date`,
      [SPOT_IDS, FROM_DATE]
    );
    total += r1.rowCount ?? 0;
    console.log(`\nSoft-deleted ${r1.rowCount} single listings`);

    // Delete period listings that start on/after FROM_DATE
    const r2 = await client.query(
      `UPDATE spot_listings SET deleted_at = NOW()
       WHERE spot_id = ANY($1::text[]) AND status = 'available' AND deleted_at IS NULL
         AND listing_type = 'period' AND period_start_date >= $2::date`,
      [SPOT_IDS, FROM_DATE]
    );
    total += r2.rowCount ?? 0;
    console.log(`Soft-deleted ${r2.rowCount} period listings (fully after ${FROM_DATE})`);

    // Truncate period listings that straddle FROM_DATE
    const r3 = await client.query(
      `UPDATE spot_listings SET period_end_date = '2026-06-30'
       WHERE spot_id = ANY($1::text[]) AND status = 'available' AND deleted_at IS NULL
         AND listing_type = 'period'
         AND period_start_date < $2::date AND period_end_date >= $2::date`,
      [SPOT_IDS, FROM_DATE]
    );
    total += r3.rowCount ?? 0;
    console.log(`Truncated ${r3.rowCount} period listings to end 2026-06-30`);

    // Delete recurring listings starting on/after FROM_DATE
    const r4 = await client.query(
      `UPDATE spot_listings SET deleted_at = NOW()
       WHERE spot_id = ANY($1::text[]) AND status = 'available' AND deleted_at IS NULL
         AND listing_type = 'recurring' AND recurring_start_date >= $2::date`,
      [SPOT_IDS, FROM_DATE]
    );
    total += r4.rowCount ?? 0;
    console.log(`Soft-deleted ${r4.rowCount} recurring listings (fully after ${FROM_DATE})`);

    // Truncate recurring listings that straddle FROM_DATE
    const r5 = await client.query(
      `UPDATE spot_listings SET recurring_end_date = '2026-06-30'
       WHERE spot_id = ANY($1::text[]) AND status = 'available' AND deleted_at IS NULL
         AND listing_type = 'recurring' AND recurring_start_date < $2::date
         AND (recurring_end_date IS NULL OR recurring_end_date >= $2::date)`,
      [SPOT_IDS, FROM_DATE]
    );
    total += r5.rowCount ?? 0;
    console.log(`Truncated ${r5.rowCount} recurring listings to end 2026-06-30`);

    await client.query("COMMIT");
    console.log(`\nDone. Total affected: ${total}`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error — rolled back:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
