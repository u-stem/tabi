import type { CrossDayEntry, DayResponse } from "@sugara/shared";

export function getCrossDayEntries(days: DayResponse[], targetDayNumber: number): CrossDayEntry[] {
  const entries: CrossDayEntry[] = [];

  for (const day of days) {
    for (const pattern of day.patterns) {
      for (const schedule of pattern.schedules) {
        if (
          schedule.endDayOffset != null &&
          schedule.endDayOffset > 0 &&
          day.dayNumber < targetDayNumber &&
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
