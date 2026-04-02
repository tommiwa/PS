ALTER TABLE "sale_events" ADD COLUMN IF NOT EXISTS "notify_past_renters" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "sale_events" ADD COLUMN IF NOT EXISTS "notify_active_renters" boolean NOT NULL DEFAULT false;
