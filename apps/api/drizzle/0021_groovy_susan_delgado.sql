ALTER TABLE "schedules" ADD COLUMN "latitude" double precision;--> statement-breakpoint
ALTER TABLE "schedules" ADD COLUMN "longitude" double precision;--> statement-breakpoint
ALTER TABLE "schedules" ADD COLUMN "place_id" varchar(255);--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "maps_enabled" boolean DEFAULT false NOT NULL;