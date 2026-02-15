import {
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  PointerSensor,
  pointerWithin,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import type {
  CandidateResponse,
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
  candidates: CandidateResponse[];
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
  const [overScheduleId, setOverScheduleId] = useState<string | null>(null);
  const [overCandidateId, setOverCandidateId] = useState<string | null>(null);
  const [localSchedules, setLocalSchedules] = useState<ScheduleResponse[]>([]);
  const [localCandidates, setLocalCandidates] = useState<CandidateResponse[]>([]);
  // Track last known drop zone so we can handle drops in empty space below the last item
  const [lastOverZone, setLastOverZone] = useState<"timeline" | "candidates" | null>(null);

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
    setOverScheduleId(null);
    setOverCandidateId(null);
    setLastOverZone(null);
  }

  function handleDragOver(event: DragOverEvent) {
    const { over } = event;
    if (!over) {
      setOverScheduleId(null);
      setOverCandidateId(null);
      return;
    }
    const overType = over.data.current?.type as string | undefined;
    if (overType === "schedule" || overType === "timeline") {
      setOverScheduleId(overType === "schedule" ? String(over.id) : null);
      setOverCandidateId(null);
      setLastOverZone("timeline");
    } else if (overType === "candidate" || overType === "candidates") {
      setOverCandidateId(overType === "candidate" ? String(over.id) : null);
      setOverScheduleId(null);
      setLastOverZone("candidates");
    } else {
      setOverScheduleId(null);
      setOverCandidateId(null);
      setLastOverZone(null);
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveDragItem(null);
    setOverScheduleId(null);
    setOverCandidateId(null);
    const { active, over } = event;
    const savedLastOverZone = lastOverZone;
    setLastOverZone(null);
    if (!currentPatternId || !currentDayId) return;

    const sourceType = active.data.current?.type as string | undefined;
    const overType = over?.data.current?.type as string | undefined;

    // When over is null (e.g. dropped below the last item), use lastOverZone
    const isOverCandidates = over
      ? overType === "candidates" || overType === "candidate"
      : savedLastOverZone === "candidates";
    const isOverTimeline = over
      ? overType === "timeline" || overType === "schedule"
      : savedLastOverZone === "timeline";

    if (!over && !isOverTimeline && !isOverCandidates) return;

    if (sourceType === "schedule" && isOverTimeline) {
      if (over && active.id === over.id) return;
      // Use merged timeline so schedules can be dragged past cross-day entries
      const merged = buildMergedTimeline(localSchedules, crossDayEntries);
      const mergedIds = timelineSortableIds(merged);
      const activeId = String(active.id);
      const oldIndex = mergedIds.indexOf(activeId);
      // When over is null (dropped below last item), move to end
      const overIndex = over ? mergedIds.indexOf(String(over.id)) : merged.length - 1;
      if (oldIndex === -1 || overIndex === -1) return;
      if (oldIndex === overIndex) return;

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
      const schedule = localSchedules.find((s) => s.id === active.id);
      if (!schedule) return;

      const prevCandidates = [...localCandidates];
      const prevSchedules = [...localSchedules];

      // Calculate insertion position
      let insertIdx = localCandidates.length;
      if (overType === "candidate" && over) {
        const idx = localCandidates.findIndex((c) => c.id === over.id);
        if (idx !== -1) insertIdx = idx;
      }

      const newCandidate = { ...schedule, likeCount: 0, hmmCount: 0, myReaction: null };
      setLocalSchedules((prev) => prev.filter((s) => s.id !== active.id));
      setLocalCandidates((prev) => {
        const next = [...prev];
        next.splice(insertIdx, 0, newCandidate);
        return next;
      });

      try {
        await api(`/api/trips/${tripId}/schedules/${active.id}/unassign`, {
          method: "POST",
        });
      } catch (err) {
        setLocalCandidates(prevCandidates);
        setLocalSchedules(prevSchedules);
        if (err instanceof ApiError && (err.status === 400 || err.status === 404)) {
          toast.error(MSG.CONFLICT_STALE);
        } else {
          toast.error(MSG.SCHEDULE_MOVE_FAILED);
        }
        onDone();
        return;
      }

      try {
        if (overType === "candidate") {
          // Build expected order from pre-mutation snapshot
          const reordered = [...prevCandidates];
          reordered.splice(insertIdx, 0, newCandidate);
          const scheduleIds = reordered.map((c) => c.id);
          await api(`/api/trips/${tripId}/candidates/reorder`, {
            method: "PATCH",
            body: JSON.stringify({ scheduleIds }),
          });
        }
        toast.success(MSG.SCHEDULE_MOVED_TO_CANDIDATE);
      } catch {
        // unassign succeeded but reorder failed — refetch to sync
        toast.success(MSG.SCHEDULE_MOVED_TO_CANDIDATE);
      }
      onDone();
    } else if (sourceType === "candidate" && isOverTimeline) {
      const candidate = localCandidates.find((c) => c.id === active.id);
      if (!candidate) return;

      const prevCandidates = [...localCandidates];
      const prevSchedules = [...localSchedules];

      setLocalCandidates((prev) => prev.filter((c) => c.id !== active.id));

      // Calculate insertion position (same logic as before)
      let insertIdx = localSchedules.length;
      if (overType === "schedule" && over) {
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
          const idx = insertBeforeId
            ? localSchedules.findIndex((s) => s.id === insertBeforeId)
            : -1;
          if (idx !== -1) insertIdx = idx;
        }
      }

      const newSchedule: ScheduleResponse = {
        id: candidate.id,
        name: candidate.name,
        category: candidate.category,
        address: candidate.address,
        startTime: candidate.startTime,
        endTime: candidate.endTime,
        sortOrder: insertIdx,
        memo: candidate.memo,
        url: candidate.url,
        departurePlace: candidate.departurePlace,
        arrivalPlace: candidate.arrivalPlace,
        transportMethod: candidate.transportMethod,
        color: candidate.color,
        endDayOffset: candidate.endDayOffset,
        updatedAt: candidate.updatedAt,
      };

      setLocalSchedules((prev) => {
        const next = [...prev];
        next.splice(insertIdx, 0, newSchedule);
        return next;
      });

      try {
        await api(`/api/trips/${tripId}/candidates/${active.id}/assign`, {
          method: "POST",
          body: JSON.stringify({ dayPatternId: currentPatternId }),
        });
      } catch (err) {
        // assign failed — full rollback
        setLocalCandidates(prevCandidates);
        setLocalSchedules(prevSchedules);
        if (err instanceof ApiError && (err.status === 400 || err.status === 404)) {
          toast.error(MSG.CONFLICT_STALE);
        } else {
          toast.error(MSG.CANDIDATE_ASSIGN_FAILED);
        }
        onDone();
        return;
      }

      try {
        if (overType === "schedule") {
          const scheduleIds = [...localSchedules.map((s) => s.id)];
          scheduleIds.splice(insertIdx, 0, String(active.id));
          await api(
            `/api/trips/${tripId}/days/${currentDayId}/patterns/${currentPatternId}/schedules/reorder`,
            {
              method: "PATCH",
              body: JSON.stringify({ scheduleIds }),
            },
          );
        }
        toast.success(MSG.CANDIDATE_ASSIGNED);
      } catch {
        // assign succeeded but reorder failed — refetch to sync
        toast.success(MSG.CANDIDATE_ASSIGNED);
      }
      onDone();
    } else if (sourceType === "candidate" && isOverCandidates) {
      if (over && active.id === over.id) return;
      const oldIndex = localCandidates.findIndex((c) => c.id === active.id);
      // When over is null (dropped below last item), move to end
      const overIndex = over
        ? localCandidates.findIndex((c) => c.id === over.id)
        : localCandidates.length - 1;
      if (oldIndex === -1 || overIndex === -1) return;
      if (oldIndex === overIndex) return;

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
    overScheduleId,
    overCandidateId,
    localSchedules,
    localCandidates,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
  };
}
