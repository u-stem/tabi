ALTER TYPE "public"."notification_type" ADD VALUE 'settlement_checked';--> statement-breakpoint
CREATE TABLE "settlement_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"from_user_id" uuid NOT NULL,
	"to_user_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"paid_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "settlement_payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "settlement_payments" ADD CONSTRAINT "settlement_payments_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_payments" ADD CONSTRAINT "settlement_payments_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_payments" ADD CONSTRAINT "settlement_payments_to_user_id_users_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_payments" ADD CONSTRAINT "settlement_payments_paid_by_user_id_users_id_fk" FOREIGN KEY ("paid_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "settlement_payments_trip_id_idx" ON "settlement_payments" USING btree ("trip_id");--> statement-breakpoint
CREATE UNIQUE INDEX "settlement_payments_trip_from_to_amount_idx" ON "settlement_payments" USING btree ("trip_id","from_user_id","to_user_id","amount");