CREATE INDEX "activity_logs_trip_id_created_at_idx" ON "activity_logs" USING btree ("trip_id","created_at");--> statement-breakpoint
CREATE INDEX "day_patterns_trip_day_id_idx" ON "day_patterns" USING btree ("trip_day_id");--> statement-breakpoint
CREATE INDEX "friends_requester_id_idx" ON "friends" USING btree ("requester_id");--> statement-breakpoint
CREATE INDEX "friends_addressee_id_idx" ON "friends" USING btree ("addressee_id");--> statement-breakpoint
CREATE INDEX "schedules_trip_id_idx" ON "schedules" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "schedules_day_pattern_id_idx" ON "schedules" USING btree ("day_pattern_id");--> statement-breakpoint
CREATE INDEX "trip_members_user_id_idx" ON "trip_members" USING btree ("user_id");