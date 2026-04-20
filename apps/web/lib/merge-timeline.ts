import type { CrossDayEntry, ScheduleResponse } from "@sugara/shared";

export type TimelineItem =
  | { type: "schedule"; schedule: ScheduleResponse }
  | { type: "crossDay"; entry: CrossDayEntry };

/**
 * Build a merged timeline of schedules and cross-day entries.
 *
 * Cross-day entries (with endTime) are flushed before the first time-having
 * schedule whose startTime is >= the entry's endTime. Schedules without a
 * startTime have no time anchor and therefore do not trigger a flush — they
 * flow around cross-day entries by sortOrder. Remaining cross-day entries
 * (including all entries without endTime) fall through to the end, sorted
 * by endTime; null-endTime entries keep their original order after those.
 *
 * Consequence: a null-startTime schedule placed before a time-having schedule
 * in sortOrder will render before the cross-day entry that the time-having
 * schedule triggers. Reordering the null-startTime schedule around the
 * time-having schedule lets users move it across the cross-day entry.
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

    if (scheduleTime != null) {
      const toInsert: CrossDayEntry[] = [];
      // Iterate in reverse so splice() doesn't shift the indices of unvisited entries.
      for (let j = remaining.length - 1; j >= 0; j--) {
        const entryTime = remaining[j].schedule.endTime?.slice(0, 5) ?? null;
        if (entryTime == null) continue;
        if (entryTime <= scheduleTime) {
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
    }

    merged.push({ type: "schedule", schedule });
  }

  // Trailing cross-day entries: sort entries with endTime by endTime, then
  // append entries without endTime in their original order.
  const withEnd: CrossDayEntry[] = [];
  const withoutEnd: CrossDayEntry[] = [];
  for (const entry of remaining) {
    if (entry.schedule.endTime != null) withEnd.push(entry);
    else withoutEnd.push(entry);
  }
  withEnd.sort((a, b) => {
    const ta = a.schedule.endTime?.slice(0, 5) ?? "";
    const tb = b.schedule.endTime?.slice(0, 5) ?? "";
    return ta < tb ? -1 : ta > tb ? 1 : 0;
  });
  for (const entry of withEnd) {
    merged.push({ type: "crossDay", entry });
  }
  for (const entry of withoutEnd) {
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
