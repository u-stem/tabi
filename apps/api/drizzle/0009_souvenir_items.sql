CREATE TABLE "souvenir_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"recipient" varchar(100),
	"url" varchar(2000),
	"address" varchar(500),
	"memo" text,
	"is_purchased" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "souvenir_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "souvenir_items" ADD CONSTRAINT "souvenir_items_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "souvenir_items" ADD CONSTRAINT "souvenir_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "souvenir_items_trip_id_idx" ON "souvenir_items" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "souvenir_items_user_id_idx" ON "souvenir_items" USING btree ("user_id");
