ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "last_owner_reminder_sent_at" timestamp;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN IF NOT EXISTS "mode" text DEFAULT 'issue' NOT NULL;--> statement-breakpoint
ALTER TABLE "parking_spots" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
