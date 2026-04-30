ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "last_owner_reminder_sent_at" timestamp;
