-- Add missing columns and tables that were previously created via db:push without migrations.
-- All statements use IF NOT EXISTS / EXCEPTION handling to be safe on existing databases.

-- trip_status: add "scheduling" value added by poll feature (pushed without migration)
ALTER TYPE "public"."trip_status" ADD VALUE IF NOT EXISTS 'scheduling' BEFORE 'draft';

-- users: add columns added by Better Auth plugins that were pushed without migrations
-- (username, display_username, users_username_unique are already in 0002)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_anonymous" boolean NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "guest_expires_at" timestamp with time zone;

-- trips: add cover_image_position and make destination/dates nullable (pushed without migration)
ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "cover_image_position" smallint NOT NULL DEFAULT 50;
ALTER TABLE "trips" ALTER COLUMN "destination" DROP NOT NULL;
ALTER TABLE "trips" ALTER COLUMN "start_date" DROP NOT NULL;
ALTER TABLE "trips" ALTER COLUMN "end_date" DROP NOT NULL;

-- Enums
DO $$ BEGIN
  CREATE TYPE "public"."poll_status" AS ENUM('open', 'confirmed', 'closed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."poll_response" AS ENUM('ok', 'maybe', 'ng');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."expense_split_type" AS ENUM('equal', 'custom');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- schedule_polls
CREATE TABLE IF NOT EXISTS "schedule_polls" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "note" text,
  "status" "poll_status" NOT NULL DEFAULT 'open',
  "deadline" timestamp with time zone,
  "share_token" varchar(64),
  "share_token_expires_at" timestamp with time zone,
  "confirmed_option_id" uuid,
  "trip_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "schedule_polls_share_token_unique" UNIQUE("share_token")
);
ALTER TABLE "schedule_polls" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  ALTER TABLE "schedule_polls" ADD CONSTRAINT "schedule_polls_trip_id_trips_id_fk"
    FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- schedule_poll_options
CREATE TABLE IF NOT EXISTS "schedule_poll_options" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "poll_id" uuid NOT NULL,
  "start_date" date NOT NULL,
  "end_date" date NOT NULL,
  "sort_order" integer NOT NULL DEFAULT 0,
  CONSTRAINT "poll_options_date_range_check" CHECK ("end_date" >= "start_date")
);
ALTER TABLE "schedule_poll_options" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  ALTER TABLE "schedule_poll_options" ADD CONSTRAINT "schedule_poll_options_poll_id_schedule_polls_id_fk"
    FOREIGN KEY ("poll_id") REFERENCES "public"."schedule_polls"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
CREATE INDEX IF NOT EXISTS "schedule_poll_options_poll_id_idx" ON "schedule_poll_options" ("poll_id");

-- schedule_poll_participants
CREATE TABLE IF NOT EXISTS "schedule_poll_participants" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "poll_id" uuid NOT NULL,
  "user_id" uuid NOT NULL
);
ALTER TABLE "schedule_poll_participants" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  ALTER TABLE "schedule_poll_participants" ADD CONSTRAINT "schedule_poll_participants_poll_id_schedule_polls_id_fk"
    FOREIGN KEY ("poll_id") REFERENCES "public"."schedule_polls"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "schedule_poll_participants" ADD CONSTRAINT "schedule_poll_participants_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
CREATE INDEX IF NOT EXISTS "schedule_poll_participants_poll_id_idx" ON "schedule_poll_participants" ("poll_id");
CREATE UNIQUE INDEX IF NOT EXISTS "schedule_poll_participants_poll_user_unique" ON "schedule_poll_participants" ("poll_id", "user_id");

-- schedule_poll_responses
CREATE TABLE IF NOT EXISTS "schedule_poll_responses" (
  "participant_id" uuid NOT NULL,
  "option_id" uuid NOT NULL,
  "response" "poll_response" NOT NULL,
  CONSTRAINT "schedule_poll_responses_participant_id_option_id_pk" PRIMARY KEY ("participant_id", "option_id")
);
ALTER TABLE "schedule_poll_responses" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  ALTER TABLE "schedule_poll_responses" ADD CONSTRAINT "schedule_poll_responses_participant_id_schedule_poll_participants_id_fk"
    FOREIGN KEY ("participant_id") REFERENCES "public"."schedule_poll_participants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "schedule_poll_responses" ADD CONSTRAINT "schedule_poll_responses_option_id_schedule_poll_options_id_fk"
    FOREIGN KEY ("option_id") REFERENCES "public"."schedule_poll_options"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- expenses
CREATE TABLE IF NOT EXISTS "expenses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "trip_id" uuid NOT NULL,
  "paid_by_user_id" uuid NOT NULL,
  "title" varchar(200) NOT NULL,
  "amount" integer NOT NULL,
  "split_type" "expense_split_type" NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "expenses" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  ALTER TABLE "expenses" ADD CONSTRAINT "expenses_trip_id_trips_id_fk"
    FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "expenses" ADD CONSTRAINT "expenses_paid_by_user_id_users_id_fk"
    FOREIGN KEY ("paid_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
CREATE INDEX IF NOT EXISTS "expenses_trip_id_idx" ON "expenses" ("trip_id");

-- expense_splits
CREATE TABLE IF NOT EXISTS "expense_splits" (
  "expense_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "amount" integer NOT NULL,
  CONSTRAINT "expense_splits_expense_id_user_id_pk" PRIMARY KEY ("expense_id", "user_id")
);
ALTER TABLE "expense_splits" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  ALTER TABLE "expense_splits" ADD CONSTRAINT "expense_splits_expense_id_expenses_id_fk"
    FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "expense_splits" ADD CONSTRAINT "expense_splits_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
