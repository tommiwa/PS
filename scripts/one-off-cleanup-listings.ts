import { Pool } from "pg";

// Try NEON_DATABASE_URL first (production Neon DB), fall back to DATABASE_URL
const connectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error("No database URL found");
  process.exit(1);
}

console.log("Connecting with:", connectionString.replace(/:[^:@]+@/, ":***@"));

const pool = new Pool({ connectionString });

const SPOT_IDS = [
  "f1738a52-6d1e-4200-bd2a-13fa1bd8b6b5", // P34
  "57c4bf16-00b8-4e20-83d0-b7fc0ca951aa", // P100
];
const FROM_DATE = "2026-07-01";

async function run() {
  const client = await pool.connect();
  try {
    // First verify spots exist
    for (const spotId of SPOT_IDS) {
      const spotRes = await client.query(
        "SELECT spot_number FROM parking_spots WHERE id = $1",
        [spotId]
      );
      if (spotRes.rows.length === 0) {
        console.warn(`WARNING: Spot ${spotId} not found in this database!`);
      } else {
        console.log(`Found spot: ${spotRes.rows[0].spot_number}`);
      }
    }

    // Count what we'd delete (dry run first)
    for (const spotId of SPOT_IDS) {
      const countRes = await client.query(
        `SELECT COUNT(*) FROM spot_listings
         WHERE spot_id = $1
           AND status = 'available'
           AND (
             (listing_type = 'single' AND single_date >= $2::date)
             OR
             (listing_type = 'period' AND period_end_date >= $2::date)
             OR
             (listing_type = 'recurring' AND (recurring_end_date IS NULL OR recurring_end_date >= $2::date))
           )`,
        [spotId, FROM_DATE]
      );
      console.log(`Spot ${spotId}: would delete ${countRes.rows[0].count} listing(s)`);
    }

    await client.query("BEGIN");

    let grandTotal = 0;
    for (const spotId of SPOT_IDS) {
      const spotRes = await client.query(
        "SELECT spot_number FROM parking_spots WHERE id = $1",
        [spotId]
      );
      const spotNumber = spotRes.rows[0]?.spot_number ?? spotId;

      const result = await client.query(
        `UPDATE spot_listings
         SET status = 'deleted'
         WHERE spot_id = $1
           AND status = 'available'
           AND (
             (listing_type = 'single' AND single_date >= $2::date)
             OR
             (listing_type = 'period' AND period_end_date >= $2::date)
             OR
             (listing_type = 'recurring' AND (recurring_end_date IS NULL OR recurring_end_date >= $2::date))
           )`,
        [spotId, FROM_DATE]
      );

      const deleted = result.rowCount ?? 0;
      grandTotal += deleted;
      console.log(`Spot ${spotNumber}: ${deleted} listing(s) soft-deleted`);
    }

    await client.query("COMMIT");
    console.log(`\nDone. Total soft-deleted: ${grandTotal}`);
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
