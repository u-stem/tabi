ALTER TABLE "bookmarks" RENAME COLUMN "url" TO "urls";--> statement-breakpoint
ALTER TABLE "bookmarks" ALTER COLUMN "urls" SET DATA TYPE text[] USING COALESCE(ARRAY["urls"::text], '{}');--> statement-breakpoint
ALTER TABLE "bookmarks" ALTER COLUMN "urls" SET DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "bookmarks" ALTER COLUMN "urls" SET NOT NULL;