-- BEFORE UPDATE trigger: FK ON DELETE SET NULL で source_id が null になった時、
-- cross_day_anchor enum も同時に null に揃え、check 制約違反を防ぐ。
-- このファイルは drizzle-kit の introspect 対象外なので、db:generate で上書きされない。

CREATE OR REPLACE FUNCTION schedules_clear_anchor_enum_on_null()
RETURNS trigger AS $$
BEGIN
  IF NEW.cross_day_anchor_source_id IS NULL AND NEW.cross_day_anchor IS NOT NULL THEN
    NEW.cross_day_anchor := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS schedules_anchor_enum_sync ON schedules;
CREATE TRIGGER schedules_anchor_enum_sync
BEFORE UPDATE OF cross_day_anchor_source_id ON schedules
FOR EACH ROW
EXECUTE FUNCTION schedules_clear_anchor_enum_on_null();
