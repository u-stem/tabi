CREATE TYPE "public"."transport_method" AS ENUM('train', 'bus', 'taxi', 'walk', 'car', 'airplane');--> statement-breakpoint
ALTER TABLE "spots" ADD COLUMN "departure_place" varchar(200);--> statement-breakpoint
ALTER TABLE "spots" ADD COLUMN "arrival_place" varchar(200);--> statement-breakpoint
ALTER TABLE "spots" ADD COLUMN "transport_method" "transport_method";