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
  {
    name: "sale_events_table_v2",
    checkQuery: `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sale_events')`,
    migrationStatements: [
      `CREATE TABLE IF NOT EXISTS sale_events (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        calendar_label TEXT NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        discount_type TEXT NOT NULL,
        discount_value DECIMAL(10,2) NOT NULL,
        status TEXT NOT NULL DEFAULT 'inactive',
        affected_listing_count INTEGER NOT NULL DEFAULT 0,
        created_by VARCHAR,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
    ],
  },
  {
    name: "spot_listings_sale_event_id_col",
    checkQuery: `SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'spot_listings' AND column_name = 'sale_event_id')`,
    migrationStatements: [
      `ALTER TABLE spot_listings ADD COLUMN IF NOT EXISTS sale_event_id VARCHAR`,
    ],
  },
  {
    name: "spot_listings_original_daily_rate_col",
    checkQuery: `SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'spot_listings' AND column_name = 'original_daily_rate')`,
    migrationStatements: [
      `ALTER TABLE spot_listings ADD COLUMN IF NOT EXISTS original_daily_rate DECIMAL(10,2)`,
    ],
  },
  {
    name: "spot_listings_sale_calendar_label_col",
    checkQuery: `SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'spot_listings' AND column_name = 'sale_calendar_label')`,
    migrationStatements: [
      `ALTER TABLE spot_listings ADD COLUMN IF NOT EXISTS sale_calendar_label VARCHAR(100)`,
    ],
  },
  {
    name: "spot_listings_sale_start_date_col",
    checkQuery: `SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'spot_listings' AND column_name = 'sale_start_date')`,
    migrationStatements: [
      `ALTER TABLE spot_listings ADD COLUMN IF NOT EXISTS sale_start_date TEXT`,
    ],
  },
  {
    name: "spot_listings_sale_end_date_col",
    checkQuery: `SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'spot_listings' AND column_name = 'sale_end_date')`,
    migrationStatements: [
      `ALTER TABLE spot_listings ADD COLUMN IF NOT EXISTS sale_end_date TEXT`,
    ],
  },
  {
    name: "sale_events_label_color_col",
    checkQuery: `SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sale_events' AND column_name = 'label_color')`,
    migrationStatements: [
      `ALTER TABLE sale_events ADD COLUMN IF NOT EXISTS label_color TEXT NOT NULL DEFAULT 'fuchsia'`,
    ],
  },
  {
    name: "spot_listings_sale_calendar_color_col",
    checkQuery: `SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'spot_listings' AND column_name = 'sale_calendar_color')`,
    migrationStatements: [
      `ALTER TABLE spot_listings ADD COLUMN IF NOT EXISTS sale_calendar_color VARCHAR(20)`,
    ],
  },
  {
    name: "sale_events_notify_past_renters_col",
    checkQuery: `SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sale_events' AND column_name = 'notify_past_renters')`,
    migrationStatements: [
      `ALTER TABLE sale_events ADD COLUMN IF NOT EXISTS notify_past_renters BOOLEAN NOT NULL DEFAULT false`,
    ],
  },
  {
    name: "sale_events_notify_active_renters_col",
    checkQuery: `SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sale_events' AND column_name = 'notify_active_renters')`,
    migrationStatements: [
      `ALTER TABLE sale_events ADD COLUMN IF NOT EXISTS notify_active_renters BOOLEAN NOT NULL DEFAULT false`,
    ],
  },
  {
    name: "fix_orphaned_booking_listing_ids",
    checkQuery: `
      SELECT NOT EXISTS (
        SELECT 1
        FROM bookings b
        JOIN spot_listings sl ON sl.id = b.listing_id
        WHERE sl.status = 'cancelled'
          AND sl.listing_type IN ('period', 'recurring')
          AND b.status != 'cancelled'
          AND EXISTS (
            SELECT 1
            FROM spot_listings sl2
            WHERE sl2.spot_id = b.spot_id
              AND sl2.single_date = b.booking_date
              AND sl2.listing_type = 'single'
              AND sl2.status = 'booked'
          )
      ) AS exists
    `,
    migrationStatements: [
      `
        WITH candidate_listings AS (
          SELECT DISTINCT ON (spot_id, single_date)
            id, spot_id, single_date
          FROM spot_listings
          WHERE listing_type = 'single'
            AND status = 'booked'
          ORDER BY spot_id, single_date, created_at DESC
        )
        UPDATE bookings
        SET listing_id = cl.id,
            updated_at = NOW()
        FROM spot_listings sl, candidate_listings cl
        WHERE bookings.listing_id = sl.id
          AND cl.spot_id = sl.spot_id
          AND cl.single_date = bookings.booking_date
          AND sl.status = 'cancelled'
          AND sl.listing_type IN ('period', 'recurring')
          AND bookings.status != 'cancelled'
      `,
    ],
  },
  {
    name: "backfill_split_listing_original_listing_type",
    checkQuery: `
      SELECT NOT EXISTS (
        SELECT 1
        FROM spot_listings
        WHERE listing_type = 'single'
          AND original_listing_type IS NULL
          AND (
            (period_start_date IS NOT NULL AND period_end_date IS NOT NULL)
            OR recurring_start_date IS NOT NULL
          )
      ) AS exists
    `,
    migrationStatements: [
      `
        UPDATE spot_listings
        SET original_listing_type = 'period',
            updated_at = NOW()
        WHERE listing_type = 'single'
          AND original_listing_type IS NULL
          AND period_start_date IS NOT NULL
          AND period_end_date IS NOT NULL
      `,
      `
        UPDATE spot_listings
        SET original_listing_type = 'recurring',
            updated_at = NOW()
        WHERE listing_type = 'single'
          AND original_listing_type IS NULL
          AND recurring_start_date IS NOT NULL
      `,
    ],
  },
  {
    name: "fix_orphaned_booked_listing_statuses",
    checkQuery: `
      SELECT NOT EXISTS (
        SELECT 1
        FROM spot_listings sl
        WHERE sl.status = 'booked'
          AND NOT EXISTS (
            SELECT 1
            FROM bookings b
            WHERE b.listing_id = sl.id
              AND b.status != 'cancelled'
          )
      ) AS exists
    `,
    migrationStatements: [
      `
        UPDATE spot_listings
        SET status = 'available',
            updated_at = NOW()
        WHERE status = 'booked'
          AND NOT EXISTS (
            SELECT 1
            FROM bookings b
            WHERE b.listing_id = spot_listings.id
              AND b.status != 'cancelled'
          )
      `,
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
