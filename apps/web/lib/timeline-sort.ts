import type { ScheduleResponse } from "@sugara/shared";
import { compareByStartTime } from "@/lib/format";

/**
 * Returns true when the schedule list is in time-sort order AND no schedule
 * carries a manual cross-day anchor.
 *
 * The "any anchor" check matters because a schedule with `crossDayAnchor` set
 * is pinned regardless of its startTime — even if startTimes happen to be
 * ascending, the time-sort button should still be enabled so the user can
 * reset the anchor and re-sort by time.
 *
 * `compareByStartTime` places null startTimes at the end, so a list ending in
 * null-startTime entries is considered sorted; a null-startTime entry in the
 * middle breaks the order.
 */
export function isScheduleListSorted(schedules: ScheduleResponse[]): boolean {
  const hasAnyAnchor = schedules.some(
    (s) => s.crossDayAnchor != null && s.crossDayAnchorSourceId != null,
  );
  if (hasAnyAnchor) return false;
  if (schedules.length <= 1) return true;
  return schedules.every(
    (schedule, i) => i === 0 || compareByStartTime(schedules[i - 1], schedule) <= 0,
  );
}
