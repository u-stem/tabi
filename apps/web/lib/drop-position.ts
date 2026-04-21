import type { CrossDayEntry, ScheduleResponse } from "@sugara/shared";
import { buildMergedTimeline, timelineSortableIds } from "./merge-timeline";

/**
 * Determine whether the pointer currently sits in the upper half of the
 * drop target's bounding rect. Works with pointer, mouse, and touch events.
 */
export function isOverUpperHalf(
  activatorEvent: Event | null,
  deltaY: number,
  overRect: { top: number; height: number } | null | undefined,
): boolean {
  if (!overRect || !activatorEvent) return false;
  let startY: number | null = null;
  const ev = activatorEvent as PointerEvent | MouseEvent | TouchEvent;
  if ("clientY" in ev && typeof ev.clientY === "number") {
    startY = ev.clientY;
  } else if ("touches" in ev && ev.touches?.[0]) {
    startY = ev.touches[0].clientY;
  }
  if (startY == null) return false;
  const currentY = startY + deltaY;
  const midY = overRect.top + overRect.height / 2;
  return currentY < midY;
}

export type DropTarget =
  | { kind: "schedule"; overId: string; upperHalf: boolean }
  | { kind: "timeline" }
  | { kind: "outside" };

/**
 * Compute the insertion index in the schedules array for a new item
 * (candidate→timeline drop). The target describes what the pointer is over
 * and whether it hovers the upper or lower half of that element.
 *
 * Returns an index in the range [0, schedules.length] suitable for
 * `schedules.splice(idx, 0, newItem)`.
 */
export function computeCandidateInsertIndex(
  schedules: ScheduleResponse[],
  crossDayEntries: CrossDayEntry[] | undefined,
  target: DropTarget,
): number {
  if (target.kind !== "schedule") {
    return schedules.length;
  }

  const merged = buildMergedTimeline(schedules, crossDayEntries);
  const mergedIds = timelineSortableIds(merged);
  const overIdx = mergedIds.indexOf(target.overId);
  if (overIdx === -1) return schedules.length;

  const overItem = merged[overIdx];
  if (overItem.type === "schedule") {
    const idx = schedules.findIndex((s) => s.id === overItem.schedule.id);
    if (idx === -1) return schedules.length;
    return target.upperHalf ? idx : idx + 1;
  }

  // crossDay: the hovered item is a visual placeholder, not a real schedule
  // in this day's schedules array. Map to the nearest schedule neighbor.
  if (target.upperHalf) {
    let prevIdx = overIdx - 1;
    while (prevIdx >= 0 && merged[prevIdx].type !== "schedule") prevIdx--;
    if (prevIdx < 0) return 0;
    const prev = merged[prevIdx];
    if (prev.type !== "schedule") return 0;
    const idx = schedules.findIndex((s) => s.id === prev.schedule.id);
    return idx === -1 ? 0 : idx + 1;
  }

  let nextIdx = overIdx + 1;
  while (nextIdx < merged.length && merged[nextIdx].type !== "schedule") nextIdx++;
  if (nextIdx >= merged.length) return schedules.length;
  const next = merged[nextIdx];
  if (next.type !== "schedule") return schedules.length;
  const idx = schedules.findIndex((s) => s.id === next.schedule.id);
  return idx === -1 ? schedules.length : idx;
}

/**
 * Compute the post-move index in the schedules array for an existing
 * schedule being reordered (schedule→timeline drop). Returns null if the
 * active schedule cannot be located or the move is a no-op.
 *
 * The returned index refers to the final position in a post-move array of
 * the same length as `schedules` — i.e., the result of moving active to that
 * slot. Pass it into `arrayMove(schedules, from, to)` after adjusting for
 * the splice-then-insert semantics (see caller).
 */
export function computeScheduleReorderIndex(
  schedules: ScheduleResponse[],
  crossDayEntries: CrossDayEntry[] | undefined,
  activeId: string,
  target: DropTarget,
): number | null {
  const activeIdx = schedules.findIndex((s) => s.id === activeId);
  if (activeIdx === -1) return null;

  // Computing the insert index on the schedules list with active removed
  // gives the destination slot in the post-move array (length unchanged
  // because we will reinsert active there).
  const without = schedules.filter((s) => s.id !== activeId);

  // When dropping on active itself, treat as no-op.
  if (target.kind === "schedule" && target.overId === activeId) return null;

  const insert = computeCandidateInsertIndex(without, crossDayEntries, target);
  return insert;
}

export type AnchorUpdate = {
  anchor: "before" | "after" | null;
  anchorSourceId: string | null;
};

export type CandidateDropResult = {
  insertIndex: number;
  anchor: AnchorUpdate;
};

/**
 * Like `computeCandidateInsertIndex`, but also returns the anchor update that
 * should be written to the inserted schedule. When the drop target is a
 * crossDay sortable (id prefixed with `cross-`), the anchor is set to
 * 'before' / 'after' with the source schedule id extracted from the prefix.
 * For any other drop (regular schedule, timeline zone, outside), the anchor
 * is cleared.
 */
export function computeCandidateDropResult(
  schedules: ScheduleResponse[],
  crossDayEntries: CrossDayEntry[] | undefined,
  target: DropTarget,
): CandidateDropResult {
  return {
    insertIndex: computeCandidateInsertIndex(schedules, crossDayEntries, target),
    anchor: extractAnchor(target),
  };
}

/**
 * Like `computeScheduleReorderIndex` but also returns the anchor update.
 * Returns null when the underlying index computation returns null (active id
 * not found or same-over no-op).
 */
export function computeScheduleReorderResult(
  schedules: ScheduleResponse[],
  crossDayEntries: CrossDayEntry[] | undefined,
  activeId: string,
  target: DropTarget,
): { destIndex: number; anchor: AnchorUpdate } | null {
  const destIndex = computeScheduleReorderIndex(schedules, crossDayEntries, activeId, target);
  if (destIndex === null) return null;
  return { destIndex, anchor: extractAnchor(target) };
}

function extractAnchor(target: DropTarget): AnchorUpdate {
  if (target.kind !== "schedule") {
    return { anchor: null, anchorSourceId: null };
  }
  const match = /^cross-(.+)$/.exec(target.overId);
  if (!match) return { anchor: null, anchorSourceId: null };
  return {
    anchor: target.upperHalf ? "before" : "after",
    anchorSourceId: match[1],
  };
}
