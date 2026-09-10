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
  {
    name: "parking_spots_deleted_at",
    checkQuery: `SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'parking_spots' AND column_name = 'deleted_at')`,
    migrationStatements: [
      `ALTER TABLE parking_spots ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP`,
    ],
  },
  {
    name: "spot_listings_deleted_at",
    checkQuery: `SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'spot_listings' AND column_name = 'deleted_at')`,
    migrationStatements: [
      `ALTER TABLE spot_listings ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP`,
    ],
  },
  {
    name: "soft_delete_orphaned_split_listings",
    checkQuery: `
      SELECT NOT EXISTS (
        SELECT 1
        FROM spot_listings
        WHERE status = 'cancelled'
          AND admin_notes LIKE '%Split into individual day listings due to partial booking%'
          AND deleted_at IS NULL
      ) AS exists
    `,
    migrationStatements: [
      `
        UPDATE spot_listings
        SET deleted_at = NOW(),
            updated_at = NOW()
        WHERE status = 'cancelled'
          AND admin_notes LIKE '%Split into individual day listings due to partial booking%'
          AND deleted_at IS NULL
      `,
    ],
  },
  {
    name: "issues_mode_column",
    checkQuery: `SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'issues' AND column_name = 'mode')`,
    migrationStatements: [
      `ALTER TABLE issues ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'issue'`,
      `UPDATE issues SET mode = 'positive' WHERE LOWER(TRIM(title)) = 'positive feedback' AND mode = 'issue'`,
      `UPDATE issues SET mode = 'rating' WHERE LOWER(TRIM(title)) = 'rating' AND mode = 'issue'`,
    ],
  },
  {
    name: "bookings_last_owner_reminder_sent_at",
    checkQuery: `SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'last_owner_reminder_sent_at')`,
    migrationStatements: [
      `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS last_owner_reminder_sent_at TIMESTAMP`,
    ],
  },
  {
    name: "spend_milestones_table",
    checkQuery: `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'spend_milestones')`,
    migrationStatements: [
      `CREATE TABLE IF NOT EXISTS spend_milestones (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        milestone_amount DECIMAL(12,2) NOT NULL,
        total_spend_at_trigger DECIMAL(12,2) NOT NULL,
        total_bookings INTEGER NOT NULL,
        p2p_revenue DECIMAL(12,2) NOT NULL,
        participants INTEGER NOT NULL,
        sent_at TIMESTAMP NOT NULL DEFAULT NOW(),
        emailed_to TEXT NOT NULL
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "UDX_spend_milestones_amount" ON spend_milestones (milestone_amount)`,
    ],
  },
  {
    name: "owner_rental_milestones_table",
    checkQuery: `SELECT
      EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'owner_rental_milestone_state')
      AND EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'owner_rental_milestones')
      AND EXISTS (
        SELECT FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'owner_rental_milestones'
          AND indexname = 'UDX_owner_rental_milestones_owner_count'
      )
      AND EXISTS (
        SELECT FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'owner_rental_milestone_state'
          AND indexname = 'IDX_owner_rental_milestone_baseline_v1'
      ) AS exists`,
    migrationStatements: [
      `CREATE TABLE IF NOT EXISTS owner_rental_milestone_state (
        owner_id VARCHAR PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        lifetime_booking_count INTEGER NOT NULL DEFAULT 0,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS owner_rental_milestones (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        milestone_count INTEGER NOT NULL,
        triggering_booking_id VARCHAR NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
        lifetime_booking_count INTEGER NOT NULL,
        delivery_status TEXT NOT NULL DEFAULT 'pending',
        delivery_provider TEXT,
        delivery_error TEXT,
        delivery_attempt_count INTEGER NOT NULL DEFAULT 0,
        sending_started_at TIMESTAMP,
        claimed_at TIMESTAMP NOT NULL DEFAULT NOW(),
        delivered_at TIMESTAMP
      )`,
      `ALTER TABLE owner_rental_milestones
       ADD COLUMN IF NOT EXISTS delivery_attempt_count INTEGER NOT NULL DEFAULT 0`,
      `ALTER TABLE owner_rental_milestones
       ADD COLUMN IF NOT EXISTS sending_started_at TIMESTAMP`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "UDX_owner_rental_milestones_owner_count"
       ON owner_rental_milestones (owner_id, milestone_count)`,
      `CREATE INDEX IF NOT EXISTS "IDX_owner_rental_milestones_triggering_booking"
       ON owner_rental_milestones (triggering_booking_id)`,
      `INSERT INTO owner_rental_milestone_state (owner_id, lifetime_booking_count, updated_at)
       SELECT b.owner_id, COUNT(*)::integer, NOW()
       FROM bookings b
       INNER JOIN users u ON u.id = b.owner_id
       WHERE b.owner_id <> 'unassigned'
         AND b.renter_id <> b.owner_id
       GROUP BY b.owner_id
       ON CONFLICT (owner_id) DO NOTHING`,
      `CREATE INDEX IF NOT EXISTS "IDX_owner_rental_milestone_baseline_v1"
       ON owner_rental_milestone_state (owner_id)`,
    ],
  },
  {
    name: "scheduled_spot_releases_table",
    checkQuery: `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'scheduled_spot_releases')`,
    migrationStatements: [
      `CREATE TABLE IF NOT EXISTS scheduled_spot_releases (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        spot_id VARCHAR NOT NULL REFERENCES parking_spots(id) ON DELETE CASCADE,
        scheduled_date DATE NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_by VARCHAR,
        notes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        applied_at TIMESTAMP,
        cancelled_at TIMESTAMP
      )`,
      `CREATE INDEX IF NOT EXISTS "IDX_scheduled_spot_releases_spot_id" ON scheduled_spot_releases (spot_id)`,
      `CREATE INDEX IF NOT EXISTS "IDX_scheduled_spot_releases_status" ON scheduled_spot_releases (status)`,
      `CREATE INDEX IF NOT EXISTS "IDX_scheduled_spot_releases_scheduled_date" ON scheduled_spot_releases (scheduled_date)`,
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
        const stmtResult = await pool.query(statement);
        if (stmtResult.rowCount !== null && stmtResult.rowCount > 0) {
          log(`Migration ${migration.name}: affected ${stmtResult.rowCount} row(s)`);
        }
      }
      log(`Migration applied: ${migration.name}`);
    } catch (error) {
      console.error(`Required migration failed (${migration.name}):`, error);
      throw new Error(`Failed to apply required migration: ${migration.name}`);
    }
  }
}
