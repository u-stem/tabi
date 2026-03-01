-- Migrate push notification preferences from user-level to per-device

-- Step 1: Add preferences column to push_subscriptions
ALTER TABLE "push_subscriptions"
  ADD COLUMN "preferences" jsonb NOT NULL DEFAULT '{}';
--> statement-breakpoint

-- Step 2: Copy each user's push preferences into all their subscriptions.
-- Only stores entries that exist in notification_preferences (existing explicit settings).
-- Absent keys fall back to NOTIFICATION_DEFAULTS in application code.
UPDATE "push_subscriptions" ps
SET "preferences" = (
  SELECT COALESCE(jsonb_object_agg(np.type, np.push), '{}')
  FROM "notification_preferences" np
  WHERE np.user_id = ps.user_id
);
--> statement-breakpoint

-- Step 3: Drop push column from notification_preferences
ALTER TABLE "notification_preferences" DROP COLUMN "push";
