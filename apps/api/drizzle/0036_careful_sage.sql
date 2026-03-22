CREATE TABLE "discord_webhooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"webhook_url" text NOT NULL,
	"name" text DEFAULT '',
	"enabled_types" jsonb NOT NULL,
	"locale" text DEFAULT 'ja' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_success_at" timestamp with time zone,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "discord_webhooks_trip_id_unique" UNIQUE("trip_id")
);
--> statement-breakpoint
ALTER TABLE "discord_webhooks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "discord_webhooks" ADD CONSTRAINT "discord_webhooks_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discord_webhooks" ADD CONSTRAINT "discord_webhooks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;