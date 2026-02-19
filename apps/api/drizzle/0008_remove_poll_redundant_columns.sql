-- Remove redundant columns from schedule_polls (title, destination, owner_id)
-- These are now derived from the trips table via trip_id

-- Drop the owner_id index first
DROP INDEX IF EXISTS "schedule_polls_owner_id_idx";

-- Remove redundant columns
ALTER TABLE "schedule_polls" DROP COLUMN IF EXISTS "owner_id";
ALTER TABLE "schedule_polls" DROP COLUMN IF EXISTS "title";
ALTER TABLE "schedule_polls" DROP COLUMN IF EXISTS "destination";

-- Make trip_id NOT NULL (polls always belong to a trip now)
ALTER TABLE "schedule_polls" ALTER COLUMN "trip_id" SET NOT NULL;

-- Change onDelete from SET NULL to CASCADE
ALTER TABLE "schedule_polls" DROP CONSTRAINT IF EXISTS "schedule_polls_trip_id_trips_id_fk";
ALTER TABLE "schedule_polls" ADD CONSTRAINT "schedule_polls_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;
