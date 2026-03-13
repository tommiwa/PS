import { pool } from "./db";
import { log } from "./vite";

interface MigrationCheck {
  name: string;
  checkQuery: string;
  migrationStatements: string[];
}

const migrations: MigrationCheck[] = [
  {
    name: "scheduled_spot_assignments",
    checkQuery: `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'scheduled_spot_assignments')`,
    migrationStatements: [
      `CREATE TABLE IF NOT EXISTS scheduled_spot_assignments (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        spot_id VARCHAR NOT NULL REFERENCES parking_spots(id) ON DELETE CASCADE,
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        scheduled_date DATE NOT NULL,
        cancel_future_bookings BOOLEAN NOT NULL DEFAULT false,
        status TEXT NOT NULL DEFAULT 'pending',
        actor_id VARCHAR,
        notes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS "IDX_scheduled_spot_assignments_spot_id" ON scheduled_spot_assignments (spot_id)`,
      `CREATE INDEX IF NOT EXISTS "IDX_scheduled_spot_assignments_user_id" ON scheduled_spot_assignments (user_id)`,
      `CREATE INDEX IF NOT EXISTS "IDX_scheduled_spot_assignments_status" ON scheduled_spot_assignments (status)`,
      `CREATE INDEX IF NOT EXISTS "IDX_scheduled_spot_assignments_scheduled_date" ON scheduled_spot_assignments (scheduled_date)`,
    ],
  },
];

export async function runMigrations(): Promise<void> {
  for (const migration of migrations) {
    try {
      const result = await pool.query(migration.checkQuery);
      const exists = result.rows[0]?.exists === true;

      if (exists) {
        continue;
      }

      log(`Applying migration: ${migration.name}...`);
      for (const statement of migration.migrationStatements) {
        await pool.query(statement);
      }
      log(`Migration applied: ${migration.name}`);
    } catch (error) {
      console.error(`Required migration failed (${migration.name}):`, error);
      throw new Error(`Failed to apply required migration: ${migration.name}`);
    }
  }
}
