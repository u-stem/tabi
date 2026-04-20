import type { CrossDayEntry, DayPatternResponse, DayResponse } from "@sugara/shared";

/**
 * Collect cross-day entries visible on the target day.
 *
 * Parallel candidate patterns (e.g. sunny / rainy) are independent plans, so
 * the viewer looking at a given pattern should only see cross-days originating
 * from the same pattern line on previous days. The viewing pattern is
 * identified by its sortOrder so it matches by position across days, even
 * when IDs differ.
 *
 * Rules for selecting source patterns:
 * - If the source day has only one pattern, share it with every viewer
 *   (pre-branch common plan).
 * - If the source day has multiple patterns, prefer patterns whose sortOrder
 *   matches the viewing pattern. If no such pattern exists in the source day,
 *   fall back to the default pattern (is_default=true) so viewers still see
 *   the common plan when pattern counts differ between days.
 * - If viewingPatternSortOrder is undefined (legacy callers or views without
 *   pattern context), include every pattern.
 */
export function getCrossDayEntries(
  days: DayResponse[],
  targetDayNumber: number,
  viewingPatternSortOrder?: number,
): CrossDayEntry[] {
  const entries: CrossDayEntry[] = [];

  for (const day of days) {
    if (day.dayNumber >= targetDayNumber) continue;
    const patterns = selectSourcePatterns(day.patterns, viewingPatternSortOrder);
    for (const pattern of patterns) {
      for (const schedule of pattern.schedules) {
        if (
          schedule.endDayOffset != null &&
          schedule.endDayOffset > 0 &&
          day.dayNumber + schedule.endDayOffset >= targetDayNumber
        ) {
          const isFinal = day.dayNumber + schedule.endDayOffset === targetDayNumber;
          entries.push({
            schedule,
            sourceDayId: day.id,
            sourcePatternId: pattern.id,
            sourceDayNumber: day.dayNumber,
            crossDayPosition: isFinal ? "final" : "intermediate",
          });
        }
      }
    }
  }

  return entries;
}

function selectSourcePatterns(
  patterns: DayPatternResponse[],
  viewingSortOrder: number | undefined,
): DayPatternResponse[] {
  if (patterns.length <= 1) return patterns;
  if (viewingSortOrder == null) return patterns;

  const matching = patterns.filter((p) => p.sortOrder === viewingSortOrder);
  if (matching.length > 0) return matching;
  return patterns.filter((p) => p.isDefault);
}
