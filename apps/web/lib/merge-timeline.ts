import type { CrossDayEntry, ScheduleResponse } from "@sugara/shared";

export type TimelineItem =
  | { type: "schedule"; schedule: ScheduleResponse }
  | { type: "crossDay"; entry: CrossDayEntry };

/**
 * Build a merged timeline of schedules and cross-day entries.
 * Cross-day entries are placed before the first schedule whose startTime
 * is after the entry's endTime. Entries without endTime go to the end.
 */
export function buildMergedTimeline(
  schedules: ScheduleResponse[],
  crossDayEntries: CrossDayEntry[] | undefined,
): TimelineItem[] {
  if (!crossDayEntries || crossDayEntries.length === 0) {
    return schedules.map((schedule) => ({ type: "schedule", schedule }));
  }

  const merged: TimelineItem[] = [];
  const remaining = [...crossDayEntries];

  for (const schedule of schedules) {
    const scheduleTime = schedule.startTime?.slice(0, 5) ?? null;

    const toInsert: CrossDayEntry[] = [];
    for (let j = remaining.length - 1; j >= 0; j--) {
      const entryTime = remaining[j].schedule.endTime?.slice(0, 5) ?? null;
      if (entryTime && scheduleTime && entryTime <= scheduleTime) {
        toInsert.unshift(remaining[j]);
        remaining.splice(j, 1);
      }
    }
    toInsert.sort((a, b) => {
      const ta = a.schedule.endTime?.slice(0, 5) ?? "";
      const tb = b.schedule.endTime?.slice(0, 5) ?? "";
      return ta < tb ? -1 : ta > tb ? 1 : 0;
    });
    for (const entry of toInsert) {
      merged.push({ type: "crossDay", entry });
    }
    merged.push({ type: "schedule", schedule });
  }
  for (const entry of remaining) {
    merged.push({ type: "crossDay", entry });
  }

  return merged;
}

/** Extract sortable IDs from a merged timeline (cross-day entries use prefixed ID). */
export function timelineSortableIds(items: TimelineItem[]): string[] {
  return items.map((item) =>
    item.type === "crossDay" ? `cross-${item.entry.schedule.id}` : item.schedule.id,
  );
}

/** Extract only the regular schedule order from a merged timeline. */
export function timelineScheduleOrder(items: TimelineItem[]): ScheduleResponse[] {
  const result: ScheduleResponse[] = [];
  for (const item of items) {
    if (item.type === "schedule") {
      result.push(item.schedule);
    }
  }
  return result;
}
