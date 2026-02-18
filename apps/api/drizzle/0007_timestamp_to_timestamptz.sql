-- Convert all timestamp columns from "timestamp without time zone" to "timestamp with time zone"
-- Existing values are interpreted as UTC (Supabase/PostgreSQL default timezone)

-- users
ALTER TABLE "users" ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "users" ALTER COLUMN "updated_at" TYPE timestamptz USING "updated_at" AT TIME ZONE 'UTC';

-- sessions
ALTER TABLE "sessions" ALTER COLUMN "expires_at" TYPE timestamptz USING "expires_at" AT TIME ZONE 'UTC';
ALTER TABLE "sessions" ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "sessions" ALTER COLUMN "updated_at" TYPE timestamptz USING "updated_at" AT TIME ZONE 'UTC';

-- accounts
ALTER TABLE "accounts" ALTER COLUMN "expires_at" TYPE timestamptz USING "expires_at" AT TIME ZONE 'UTC';
ALTER TABLE "accounts" ALTER COLUMN "access_token_expires_at" TYPE timestamptz USING "access_token_expires_at" AT TIME ZONE 'UTC';
ALTER TABLE "accounts" ALTER COLUMN "refresh_token_expires_at" TYPE timestamptz USING "refresh_token_expires_at" AT TIME ZONE 'UTC';
ALTER TABLE "accounts" ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "accounts" ALTER COLUMN "updated_at" TYPE timestamptz USING "updated_at" AT TIME ZONE 'UTC';

-- verifications
ALTER TABLE "verifications" ALTER COLUMN "expires_at" TYPE timestamptz USING "expires_at" AT TIME ZONE 'UTC';
ALTER TABLE "verifications" ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "verifications" ALTER COLUMN "updated_at" TYPE timestamptz USING "updated_at" AT TIME ZONE 'UTC';

-- trips
ALTER TABLE "trips" ALTER COLUMN "share_token_expires_at" TYPE timestamptz USING "share_token_expires_at" AT TIME ZONE 'UTC';
ALTER TABLE "trips" ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "trips" ALTER COLUMN "updated_at" TYPE timestamptz USING "updated_at" AT TIME ZONE 'UTC';

-- day_patterns
ALTER TABLE "day_patterns" ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE 'UTC';

-- schedules
ALTER TABLE "schedules" ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "schedules" ALTER COLUMN "updated_at" TYPE timestamptz USING "updated_at" AT TIME ZONE 'UTC';

-- schedule_reactions
ALTER TABLE "schedule_reactions" ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE 'UTC';

-- activity_logs
ALTER TABLE "activity_logs" ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE 'UTC';

-- friends
ALTER TABLE "friends" ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "friends" ALTER COLUMN "updated_at" TYPE timestamptz USING "updated_at" AT TIME ZONE 'UTC';

-- bookmark_lists
ALTER TABLE "bookmark_lists" ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "bookmark_lists" ALTER COLUMN "updated_at" TYPE timestamptz USING "updated_at" AT TIME ZONE 'UTC';

-- bookmarks
ALTER TABLE "bookmarks" ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "bookmarks" ALTER COLUMN "updated_at" TYPE timestamptz USING "updated_at" AT TIME ZONE 'UTC';

-- groups
ALTER TABLE "groups" ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "groups" ALTER COLUMN "updated_at" TYPE timestamptz USING "updated_at" AT TIME ZONE 'UTC';

-- group_members
ALTER TABLE "group_members" ALTER COLUMN "added_at" TYPE timestamptz USING "added_at" AT TIME ZONE 'UTC';
