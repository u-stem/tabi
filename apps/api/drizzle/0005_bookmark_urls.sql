ALTER TABLE "bookmarks" RENAME COLUMN "url" TO "urls";--> statement-breakpoint
ALTER TABLE "bookmarks" ALTER COLUMN "urls" SET DATA TYPE text[];--> statement-breakpoint
ALTER TABLE "bookmarks" ALTER COLUMN "urls" SET DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "bookmarks" ALTER COLUMN "urls" SET NOT NULL;--> statement-breakpoint
UPDATE "bookmarks" SET "urls" = ARRAY["urls"::text] WHERE array_length("urls", 1) IS NULL AND "urls"::text IS NOT NULL;