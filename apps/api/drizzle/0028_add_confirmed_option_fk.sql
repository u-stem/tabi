ALTER TABLE "schedule_polls"
  ADD CONSTRAINT "schedule_polls_confirmed_option_id_fk"
  FOREIGN KEY ("confirmed_option_id")
  REFERENCES "schedule_poll_options"("id")
  ON DELETE SET NULL;
