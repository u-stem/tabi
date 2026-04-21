import type { CrossDayEntry, ScheduleResponse } from "@sugara/shared";

export type TimelineItem =
  | { type: "schedule"; schedule: ScheduleResponse }
  | { type: "crossDay"; entry: CrossDayEntry };

/**
 * Build a merged timeline of schedules and cross-day entries.
 *
 * Schedules with a valid cross-day anchor (both `crossDayAnchor` and
 * `crossDayAnchorSourceId` set, and the source id matching one of the
 * crossDayEntries) are placed immediately before/after their target crossDay
 * and sorted by sortOrder within that slot. All other schedules (including
 * schedules with a broken/stale anchor whose source doesn't match any
 * crossDay) flow through the time-based merge: time-having schedules flush
 * pending crossDays whose endTime is <= the schedule's startTime, and
 * null-startTime schedules do not flush. Remaining crossDays fall through to
 * the end (endTime-having entries sorted by endTime, then null-endTime
 * entries).
 */
export function buildMergedTimeline(
  schedules: ScheduleResponse[],
  crossDayEntries: CrossDayEntry[] | undefined,
): TimelineItem[] {
  if (!crossDayEntries || crossDayEntries.length === 0) {
    return schedules.map((schedule) => ({ type: "schedule", schedule }));
  }

  const validSourceIds = new Set(crossDayEntries.map((e) => e.schedule.id));

  const anchoredBefore: ScheduleResponse[] = [];
  const anchoredAfter: ScheduleResponse[] = [];
  const plainSchedules: ScheduleResponse[] = [];

  for (const schedule of schedules) {
    const anchor = schedule.crossDayAnchor;
    const sourceId = schedule.crossDayAnchorSourceId;
    if (anchor && sourceId && validSourceIds.has(sourceId)) {
      if (anchor === "before") anchoredBefore.push(schedule);
      else anchoredAfter.push(schedule);
    } else {
      plainSchedules.push(schedule);
    }
  }

  const sortBySortOrder = (a: ScheduleResponse, b: ScheduleResponse) => a.sortOrder - b.sortOrder;
  anchoredBefore.sort(sortBySortOrder);
  anchoredAfter.sort(sortBySortOrder);

  const merged = timeBasedMerge(plainSchedules, crossDayEntries);

  for (const entry of crossDayEntries) {
    const sourceId = entry.schedule.id;
    const before = anchoredBefore.filter((s) => s.crossDayAnchorSourceId === sourceId);
    const after = anchoredAfter.filter((s) => s.crossDayAnchorSourceId === sourceId);
    if (before.length === 0 && after.length === 0) continue;

    const pos = merged.findIndex((item) => item.type === "crossDay" && item.entry === entry);
    if (pos === -1) continue;

    if (after.length > 0) {
      merged.splice(
        pos + 1,
        0,
        ...after.map((s): TimelineItem => ({ type: "schedule", schedule: s })),
      );
    }
    if (before.length > 0) {
      merged.splice(
        pos,
        0,
        ...before.map((s): TimelineItem => ({ type: "schedule", schedule: s })),
      );
    }
  }

  return merged;
}

function timeBasedMerge(
  schedules: ScheduleResponse[],
  crossDayEntries: CrossDayEntry[],
): TimelineItem[] {
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
