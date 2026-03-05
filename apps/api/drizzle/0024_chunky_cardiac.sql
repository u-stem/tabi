CREATE TYPE "public"."quick_poll_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TABLE "quick_poll_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"poll_id" uuid NOT NULL,
	"label" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quick_poll_options" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quick_poll_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"poll_id" uuid NOT NULL,
	"option_id" uuid NOT NULL,
	"user_id" uuid,
	"anonymous_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quick_poll_votes_user_or_anonymous" CHECK (user_id IS NOT NULL OR anonymous_id IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "quick_poll_votes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quick_polls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" uuid NOT NULL,
	"share_token" varchar(64) NOT NULL,
	"question" text NOT NULL,
	"allow_multiple" boolean DEFAULT false NOT NULL,
	"show_results_before_vote" boolean DEFAULT true NOT NULL,
	"status" "quick_poll_status" DEFAULT 'open' NOT NULL,
	"closed_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quick_polls_share_token_unique" UNIQUE("share_token")
);
--> statement-breakpoint
ALTER TABLE "quick_polls" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "quick_poll_options" ADD CONSTRAINT "quick_poll_options_poll_id_quick_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."quick_polls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quick_poll_votes" ADD CONSTRAINT "quick_poll_votes_poll_id_quick_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."quick_polls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quick_poll_votes" ADD CONSTRAINT "quick_poll_votes_option_id_quick_poll_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."quick_poll_options"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quick_poll_votes" ADD CONSTRAINT "quick_poll_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quick_polls" ADD CONSTRAINT "quick_polls_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "quick_poll_options_poll_id_idx" ON "quick_poll_options" USING btree ("poll_id");--> statement-breakpoint
CREATE INDEX "quick_poll_votes_poll_id_idx" ON "quick_poll_votes" USING btree ("poll_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quick_poll_votes_option_user_idx" ON "quick_poll_votes" USING btree ("poll_id","option_id","user_id") WHERE user_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "quick_poll_votes_option_anonymous_idx" ON "quick_poll_votes" USING btree ("poll_id","option_id","anonymous_id") WHERE anonymous_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "quick_polls_creator_id_idx" ON "quick_polls" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "quick_polls_expires_at_idx" ON "quick_polls" USING btree ("expires_at");