import {
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  pointerWithin,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import type {
  CrossDayEntry,
  ScheduleCategory,
  ScheduleColor,
  ScheduleResponse,
} from "@sugara/shared";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ApiError, api } from "@/lib/api";
import {
  buildMergedTimeline,
  timelineScheduleOrder,
  timelineSortableIds,
} from "@/lib/merge-timeline";
import { MSG } from "@/lib/messages";

type ActiveDragItem = {
  id: string;
  name: string;
  category: ScheduleCategory;
  color: ScheduleColor;
  source: "schedule" | "candidate";
};

type UseTripDragAndDropArgs = {
  tripId: string;
  currentDayId: string | null;
  currentPatternId: string | null;
  schedules: ScheduleResponse[];
  candidates: ScheduleResponse[];
  crossDayEntries?: CrossDayEntry[];
  onDone: () => void;
};

export function useTripDragAndDrop({
  tripId,
  currentDayId,
  currentPatternId,
  schedules,
  candidates,
  crossDayEntries,
  onDone,
}: UseTripDragAndDropArgs) {
  const [activeDragItem, setActiveDragItem] = useState<ActiveDragItem | null>(null);
  const [localSchedules, setLocalSchedules] = useState<ScheduleResponse[]>([]);
  const [localCandidates, setLocalCandidates] = useState<ScheduleResponse[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  const collisionDetection = pointerWithin;

  useEffect(() => {
    setLocalSchedules((prev) => {
      if (prev.length === schedules.length && prev.every((s, i) => s === schedules[i])) {
        return prev;
      }
      return schedules;
    });
  }, [schedules]);

  useEffect(() => {
    setLocalCandidates((prev) => {
      if (prev.length === candidates.length && prev.every((c, i) => c === candidates[i])) {
        return prev;
      }
      return candidates;
    });
  }, [candidates]);

  function handleDragStart(event: DragStartEvent) {
    const { active } = event;
    const type = active.data.current?.type as string | undefined;
    if (!type) return;

    const source = type === "candidate" ? "candidate" : "schedule";
    const item =
      source === "schedule"
        ? localSchedules.find((s) => s.id === active.id)
        : localCandidates.find((c) => c.id === active.id);
    setActiveDragItem({
      id: String(active.id),
      name: item?.name ?? "",
      category: item?.category ?? "sightseeing",
      color: item?.color ?? "blue",
      source,
    });
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveDragItem(null);
    const { active, over } = event;
    if (!over || !currentPatternId || !currentDayId) return;

    const sourceType = active.data.current?.type as string | undefined;
    const overType = over.data.current?.type as string | undefined;

    const isOverCandidates = overType === "candidates" || overType === "candidate";
    const isOverTimeline = overType === "timeline" || overType === "schedule";

    if (sourceType === "schedule" && isOverTimeline) {
      if (active.id === over.id) return;
      // Use merged timeline so schedules can be dragged past cross-day entries
      const merged = buildMergedTimeline(localSchedules, crossDayEntries);
      const mergedIds = timelineSortableIds(merged);
      const activeId = String(active.id);
      const overId = String(over.id);
      const oldIndex = mergedIds.indexOf(activeId);
      const overIndex = mergedIds.indexOf(overId);
      if (oldIndex === -1 || overIndex === -1) return;

      const reorderedMerged = arrayMove(merged, oldIndex, overIndex);
      const reordered = timelineScheduleOrder(reorderedMerged);
      setLocalSchedules(reordered);

      const scheduleIds = reordered.map((s) => s.id);
      try {
        await api(
          `/api/trips/${tripId}/days/${currentDayId}/patterns/${currentPatternId}/schedules/reorder`,
          {
            method: "PATCH",
            body: JSON.stringify({ scheduleIds }),
          },
        );
        onDone();
      } catch (err) {
        setLocalSchedules(schedules);
        if (err instanceof ApiError && (err.status === 400 || err.status === 404)) {
          toast.error(MSG.CONFLICT_STALE);
        } else {
          toast.error(MSG.SCHEDULE_REORDER_FAILED);
        }
        onDone();
      }
    } else if (sourceType === "schedule" && isOverCandidates) {
      try {
        await api(`/api/trips/${tripId}/schedules/${active.id}/unassign`, {
          method: "POST",
        });
        toast.success(MSG.SCHEDULE_MOVED_TO_CANDIDATE);
        onDone();
      } catch (err) {
        if (err instanceof ApiError && (err.status === 400 || err.status === 404)) {
          toast.error(MSG.CONFLICT_STALE);
        } else {
          toast.error(MSG.SCHEDULE_MOVE_FAILED);
        }
        onDone();
      }
    } else if (sourceType === "candidate" && isOverTimeline) {
      try {
        await api(`/api/trips/${tripId}/candidates/${active.id}/assign`, {
          method: "POST",
          body: JSON.stringify({ dayPatternId: currentPatternId }),
        });

        if (overType === "schedule") {
          // Find the insertion position in schedule-only order.
          // When dropped on a cross-day entry, insert before the next
          // regular schedule in the merged timeline.
          const merged = buildMergedTimeline(localSchedules, crossDayEntries);
          const mergedIds = timelineSortableIds(merged);
          const overIdx = mergedIds.indexOf(String(over.id));
          if (overIdx !== -1) {
            let insertBeforeId: string | null = null;
            for (let k = overIdx; k < merged.length; k++) {
              const item = merged[k];
              if (item.type === "schedule") {
                insertBeforeId = item.schedule.id;
                break;
              }
            }
            const scheduleIds = localSchedules.map((s) => s.id);
            const insertIdx = insertBeforeId ? scheduleIds.indexOf(insertBeforeId) : -1;
            if (insertIdx !== -1) {
              scheduleIds.splice(insertIdx, 0, String(active.id));
            } else {
              scheduleIds.push(String(active.id));
            }
            await api(
              `/api/trips/${tripId}/days/${currentDayId}/patterns/${currentPatternId}/schedules/reorder`,
              {
                method: "PATCH",
                body: JSON.stringify({ scheduleIds }),
              },
            );
          }
        }

        toast.success(MSG.CANDIDATE_ASSIGNED);
        onDone();
      } catch (err) {
        if (err instanceof ApiError && (err.status === 400 || err.status === 404)) {
          toast.error(MSG.CONFLICT_STALE);
        } else {
          toast.error(MSG.CANDIDATE_ASSIGN_FAILED);
        }
        onDone();
      }
    } else if (sourceType === "candidate" && isOverCandidates) {
      if (active.id === over.id) return;
      const oldIndex = localCandidates.findIndex((c) => c.id === active.id);
      const overIndex = localCandidates.findIndex((c) => c.id === over.id);
      if (oldIndex === -1 || overIndex === -1) return;

      const reordered = arrayMove(localCandidates, oldIndex, overIndex);
      setLocalCandidates(reordered);

      const scheduleIds = reordered.map((c) => c.id);
      try {
        await api(`/api/trips/${tripId}/candidates/reorder`, {
          method: "PATCH",
          body: JSON.stringify({ scheduleIds }),
        });
        onDone();
      } catch (err) {
        setLocalCandidates(candidates);
        if (err instanceof ApiError && (err.status === 400 || err.status === 404)) {
          toast.error(MSG.CONFLICT_STALE);
        } else {
          toast.error(MSG.SCHEDULE_REORDER_FAILED);
        }
        onDone();
      }
    }
  }

  return {
    sensors,
    collisionDetection,
    activeDragItem,
    localSchedules,
    localCandidates,
    handleDragStart,
    handleDragEnd,
  };
}
