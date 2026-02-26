-- Migrate souvenir_items: url/address (single varchar) → urls/addresses (text[])

ALTER TABLE "souvenir_items" ADD COLUMN IF NOT EXISTS "urls" text[] NOT NULL DEFAULT '{}';
ALTER TABLE "souvenir_items" ADD COLUMN IF NOT EXISTS "addresses" text[] NOT NULL DEFAULT '{}';

-- Migrate existing single values into arrays
UPDATE "souvenir_items" SET "urls" = ARRAY["url"::text] WHERE "url" IS NOT NULL;
UPDATE "souvenir_items" SET "addresses" = ARRAY["address"::text] WHERE "address" IS NOT NULL;

ALTER TABLE "souvenir_items" DROP COLUMN IF EXISTS "url";
ALTER TABLE "souvenir_items" DROP COLUMN IF EXISTS "address";
