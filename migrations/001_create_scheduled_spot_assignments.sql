-- Migration: Create scheduled_spot_assignments table
-- This table supports scheduled future spot assignments (defined in shared/schema.ts)
-- It was missing from the database, causing "relation does not exist" errors

CREATE TABLE IF NOT EXISTS scheduled_spot_assignments (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  spot_id VARCHAR NOT NULL REFERENCES parking_spots(id) ON DELETE CASCADE,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  cancel_future_bookings BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending',
  actor_id VARCHAR,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "IDX_scheduled_spot_assignments_spot_id" ON scheduled_spot_assignments (spot_id);
CREATE INDEX IF NOT EXISTS "IDX_scheduled_spot_assignments_user_id" ON scheduled_spot_assignments (user_id);
CREATE INDEX IF NOT EXISTS "IDX_scheduled_spot_assignments_status" ON scheduled_spot_assignments (status);
CREATE INDEX IF NOT EXISTS "IDX_scheduled_spot_assignments_scheduled_date" ON scheduled_spot_assignments (scheduled_date);
