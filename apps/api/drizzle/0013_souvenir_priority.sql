CREATE TYPE "public"."souvenir_priority" AS ENUM('high', 'medium');--> statement-breakpoint
ALTER TABLE "souvenir_items" ADD COLUMN "priority" "souvenir_priority";
