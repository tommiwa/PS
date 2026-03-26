import { pool } from "./db";
import { log } from "./vite";

interface MigrationCheck {
  name: string;
  checkQuery: string;
  migrationStatements: string[];
}

const migrations: MigrationCheck[] = [
  {
    name: "spot_alert_subscriptions_table",
    checkQuery: `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'spot_alert_subscriptions')`,
    migrationStatements: [
      `CREATE TABLE IF NOT EXISTS spot_alert_subscriptions (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        is_active BOOLEAN NOT NULL DEFAULT false,
        days_of_week INTEGER[] NOT NULL DEFAULT ARRAY[]::integer[],
        max_daily_price DECIMAL(10,2),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS "IDX_spot_alert_subscriptions_user_id" ON spot_alert_subscriptions (user_id)`,
      `CREATE INDEX IF NOT EXISTS "IDX_spot_alert_subscriptions_is_active" ON spot_alert_subscriptions (is_active)`,
    ],
  },
  {
    name: "feature_announcements_table",
    checkQuery: `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'feature_announcements')`,
    migrationStatements: [
      `CREATE TABLE IF NOT EXISTS feature_announcements (
        id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        badge_label TEXT,
        enabled BOOLEAN NOT NULL DEFAULT true,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
    ],
  },
  {
    name: "users_last_seen_announcement_id",
    checkQuery: `SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'last_seen_announcement_id')`,
    migrationStatements: [
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_announcement_id INTEGER`,
    ],
  },
  {
    name: "feature_announcements_badge_color",
    checkQuery: `SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'feature_announcements' AND column_name = 'badge_color')`,
    migrationStatements: [
      `ALTER TABLE feature_announcements ADD COLUMN IF NOT EXISTS badge_color TEXT`,
    ],
  },
  {
    name: "booking_subscriptions",
    checkQuery: `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'booking_subscriptions')`,
    migrationStatements: [
      `CREATE TABLE IF NOT EXISTS booking_subscriptions (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL UNIQUE,
        is_enabled BOOLEAN NOT NULL DEFAULT false,
        days_of_week INTEGER[] NOT NULL DEFAULT ARRAY[]::integer[],
        max_price DECIMAL(10, 2),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS "IDX_booking_subscriptions_user_id" ON booking_subscriptions (user_id)`,
    ],
  },
  {
    name: "bookings_unique_active_spot_date",
    checkQuery: `SELECT EXISTS (
      SELECT FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'bookings'
        AND indexname = 'UDX_bookings_active_spot_date'
    )`,
    migrationStatements: [
      `CREATE UNIQUE INDEX IF NOT EXISTS "UDX_bookings_active_spot_date"
       ON bookings (spot_id, booking_date)
       WHERE status NOT IN ('cancelled')`
    ],
  },
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
