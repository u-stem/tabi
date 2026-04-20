ALTER TABLE "schedules" ADD COLUMN "cross_day_anchor" text;--> statement-breakpoint
ALTER TABLE "schedules" ADD COLUMN "cross_day_anchor_source_id" uuid;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_cross_day_anchor_source_id_schedules_id_fk" FOREIGN KEY ("cross_day_anchor_source_id") REFERENCES "public"."schedules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "schedules_anchor_source_idx" ON "schedules" USING btree ("cross_day_anchor_source_id");--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_anchor_consistency" CHECK (("schedules"."cross_day_anchor" is null) = ("schedules"."cross_day_anchor_source_id" is null));