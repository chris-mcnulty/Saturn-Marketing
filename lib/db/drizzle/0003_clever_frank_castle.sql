ALTER TABLE "campaigns" ADD COLUMN "business_hours_only" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "business_hours_start" text DEFAULT '09:00' NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "business_hours_end" text DEFAULT '17:00' NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "include_saturday" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "include_sunday" boolean DEFAULT true NOT NULL;