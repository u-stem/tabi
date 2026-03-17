CREATE TYPE "public"."souvenir_share_style" AS ENUM('recommend', 'errand');--> statement-breakpoint
ALTER TABLE "souvenir_items" ADD COLUMN "share_style" "souvenir_share_style";