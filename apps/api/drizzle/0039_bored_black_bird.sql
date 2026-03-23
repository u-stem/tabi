ALTER TABLE "expenses" ADD COLUMN "currency" text DEFAULT 'JPY' NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "exchange_rate" numeric(12, 6);--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "base_amount" integer;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "currency" text DEFAULT 'JPY' NOT NULL;