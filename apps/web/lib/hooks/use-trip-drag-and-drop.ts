import {
  closestCorners,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  MouseSensor,
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
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { ApiError, api } from "@/lib/api";
import {
  computeCandidateInsertIndex,
  computeScheduleReorderIndex,
  type DropTarget,
  isOverUpperHalf,
} from "@/lib/drop-position";

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

// MouseSensor (not PointerSensor) so that touch input is handled exclusively
// by TouchSensor. PointerSensor responds to touch pointerdown and competes
// with useSwipeTab's horizontal swipe detection, causing wobble.
const MOUSE_SENSOR_OPTIONS = { activationConstraint: { distance: 8 } } as const;
const TOUCH_SENSOR_OPTIONS = {
  activationConstraint: { delay: 200, tolerance: 5 },
} as const;

function buildDropTarget(
  event: DragEndEvent,
  savedLastOverZone: "timeline" | "candidates" | null,
): DropTarget {
  const { over, activatorEvent, delta } = event;
  if (!over) {
    if (savedLastOverZone === "timeline" || savedLastOverZone === "candidates") {
      return { kind: "timeline" };
    }
    return { kind: "outside" };
  }
  const overType = over.data.current?.type as string | undefined;
  if (overType === "timeline" || overType === "candidates") {
    return { kind: "timeline" };
  }
  if (overType === "schedule" || overType === "candidate") {
    const upperHalf = isOverUpperHalf(activatorEvent, delta.y, over.rect);
    return { kind: "schedule", overId: String(over.id), upperHalf };
  }
  return { kind: "outside" };
}

export function useTripDragAndDrop({
  tripId,
  currentDayId,
  currentPatternId,
  schedules,
  candidates,
  crossDayEntries,
  onDone,
}: UseTripDragAndDropArgs) {
  const tm = useTranslations("messages");
  const [activeDragItem, setActiveDragItem] = useState<ActiveDragItem | null>(null);
  const [overScheduleId, setOverScheduleId] = useState<string | null>(null);
  const [overCandidateId, setOverCandidateId] = useState<string | null>(null);
  // null = no drag in progress; use server props directly
  const [localSchedules, setLocalSchedules] = useState<ScheduleResponse[] | null>(null);
  const [localCandidates, setLocalCandidates] = useState<CandidateResponse[] | null>(null);
  // Track last known drop zone so we can handle drops in empty space below the last item
  const [lastOverZone, setLastOverZone] = useState<"timeline" | "candidates" | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, MOUSE_SENSOR_OPTIONS),
    useSensor(TouchSensor, TOUCH_SENSOR_OPTIONS),
  );

  const collisionDetection = closestCorners;

  function handleDragStart(event: DragStartEvent) {
    const { active } = event;
    const type = active.data.current?.type as string | undefined;
    if (!type) return;

    const source = type === "candidate" ? "candidate" : "schedule";
    const currentSchedules = localSchedules ?? schedules;
    const currentCandidates = localCandidates ?? candidates;
    const item =
      source === "schedule"
        ? currentSchedules.find((s) => s.id === active.id)
        : currentCandidates.find((c) => c.id === active.id);
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
    // Capture snapshot so optimistic updates have a stable baseline during drag
    setLocalSchedules([...schedules]);
    setLocalCandidates([...candidates]);
  }

  function handleDragOver(event: DragOverEvent) {
    const { over } = event;
    if (!over) {
      // Keep overScheduleId so the insert indicator doesn't jump to the
      // bottom when the pointer briefly leaves all drop targets.
      // It will be reset in handleDragEnd.
      return;
    }
    const overType = over.data.current?.type as string | undefined;
    if (overType === "schedule" || overType === "timeline") {
      // Only update overScheduleId when hovering a specific schedule.
      // When hovering the timeline droppable (gap between items), keep the
      // previous value so the insert indicator doesn't briefly jump to the
      // bottom of the list.
      if (overType === "schedule") {
        setOverScheduleId(String(over.id));
      }
      setOverCandidateId(null);
      setLastOverZone("timeline");
    } else if (overType === "candidate" || overType === "candidates") {
      if (overType === "candidate") {
        setOverCandidateId(String(over.id));
      }
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

    // Resolve current lists once; handleDragStart captured a snapshot into state
    const currentSchedules = localSchedules ?? schedules;
    const currentCandidates = localCandidates ?? candidates;

    try {
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
        const activeId = String(active.id);
        const activeIdx = currentSchedules.findIndex((s) => s.id === activeId);
        if (activeIdx === -1) return;

        const target = buildDropTarget(event, savedLastOverZone);
        const destIdx = computeScheduleReorderIndex(
          currentSchedules,
          crossDayEntries,
          activeId,
          target,
        );
        if (destIdx === null) return;
        // arrayMove: from `activeIdx`, insert at `destIdx` in the post-removal
        // array. Skip when the destination is a no-op.
        if (destIdx === activeIdx) return;

        const reordered = arrayMove(currentSchedules, activeIdx, destIdx);
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
          if (err instanceof ApiError && (err.status === 400 || err.status === 404)) {
            toast.error(tm("conflictStale"));
          } else {
            toast.error(tm("scheduleReorderFailed"));
          }
          onDone();
        }
      } else if (sourceType === "schedule" && isOverCandidates) {
        const schedule = currentSchedules.find((s) => s.id === active.id);
        if (!schedule) return;

        // Calculate insertion position
        let insertIdx = currentCandidates.length;
        if (overType === "candidate" && over) {
          const idx = currentCandidates.findIndex((c) => c.id === over.id);
          if (idx !== -1) insertIdx = idx;
        }

        const newCandidate = { ...schedule, likeCount: 0, hmmCount: 0, myReaction: null };
        setLocalSchedules(currentSchedules.filter((s) => s.id !== active.id));
        const insertedCandidates = [...currentCandidates];
        insertedCandidates.splice(insertIdx, 0, newCandidate);
        setLocalCandidates(insertedCandidates);
        toast.success(tm("scheduleMovedToCandidate"));

        try {
          await api(`/api/trips/${tripId}/schedules/${active.id}/unassign`, {
            method: "POST",
          });
        } catch (err) {
          if (err instanceof ApiError && (err.status === 400 || err.status === 404)) {
            toast.error(tm("conflictStale"));
          } else {
            toast.error(tm("scheduleMoveFailed"));
          }
          onDone();
          return;
        }

        try {
          if (overType === "candidate") {
            // Build expected order from pre-mutation snapshot
            const reordered = [...currentCandidates];
            reordered.splice(insertIdx, 0, newCandidate);
            const scheduleIds = reordered.map((c) => c.id);
            await api(`/api/trips/${tripId}/candidates/reorder`, {
              method: "PATCH",
              body: JSON.stringify({ scheduleIds }),
            });
          }
        } catch {
          // unassign succeeded but reorder failed — refetch to sync
          onDone();
          return;
        }
        onDone();
      } else if (sourceType === "candidate" && isOverTimeline) {
        const candidate = currentCandidates.find((c) => c.id === active.id);
        if (!candidate) return;

        setLocalCandidates(currentCandidates.filter((c) => c.id !== active.id));

        const target = buildDropTarget(event, savedLastOverZone);
        const insertIdx = computeCandidateInsertIndex(currentSchedules, crossDayEntries, target);

        const newSchedule: ScheduleResponse = {
          id: candidate.id,
          name: candidate.name,
          category: candidate.category,
          address: candidate.address,
          startTime: candidate.startTime,
          endTime: candidate.endTime,
          sortOrder: insertIdx,
          memo: candidate.memo,
          urls: candidate.urls,
          departurePlace: candidate.departurePlace,
          arrivalPlace: candidate.arrivalPlace,
          transportMethod: candidate.transportMethod,
          color: candidate.color,
          endDayOffset: candidate.endDayOffset,
          latitude: candidate.latitude,
          longitude: candidate.longitude,
          placeId: candidate.placeId,
          updatedAt: candidate.updatedAt,
        };

        const insertedSchedules = [...currentSchedules];
        insertedSchedules.splice(insertIdx, 0, newSchedule);
        setLocalSchedules(insertedSchedules);
        toast.success(tm("candidateAssigned"));

        try {
          await api(`/api/trips/${tripId}/candidates/${active.id}/assign`, {
            method: "POST",
            body: JSON.stringify({ dayPatternId: currentPatternId }),
          });
        } catch (err) {
          if (err instanceof ApiError && (err.status === 400 || err.status === 404)) {
            toast.error(tm("conflictStale"));
          } else {
            toast.error(tm("candidateAssignFailed"));
          }
          onDone();
          return;
        }

        try {
          if (overType === "schedule") {
            const scheduleIds = [...currentSchedules.map((s) => s.id)];
            scheduleIds.splice(insertIdx, 0, String(active.id));
            await api(
              `/api/trips/${tripId}/days/${currentDayId}/patterns/${currentPatternId}/schedules/reorder`,
              {
                method: "PATCH",
                body: JSON.stringify({ scheduleIds }),
              },
            );
          }
        } catch {
          // assign succeeded but reorder failed — refetch to sync
          onDone();
          return;
        }
        onDone();
      } else if (sourceType === "candidate" && isOverCandidates) {
        if (over && active.id === over.id) return;
        const oldIndex = currentCandidates.findIndex((c) => c.id === active.id);
        // When over is null (dropped below last item), move to end
        const overIndex = over
          ? currentCandidates.findIndex((c) => c.id === over.id)
          : currentCandidates.length - 1;
        if (oldIndex === -1 || overIndex === -1) return;
        if (oldIndex === overIndex) return;

        const reordered = arrayMove(currentCandidates, oldIndex, overIndex);
        setLocalCandidates(reordered);

        const scheduleIds = reordered.map((c) => c.id);
        try {
          await api(`/api/trips/${tripId}/candidates/reorder`, {
            method: "PATCH",
            body: JSON.stringify({ scheduleIds }),
          });
          onDone();
        } catch (err) {
          if (err instanceof ApiError && (err.status === 400 || err.status === 404)) {
            toast.error(tm("conflictStale"));
          } else {
            toast.error(tm("scheduleReorderFailed"));
          }
          onDone();
        }
      }
    } finally {
      // Reset to null so the hook falls back to server props after the drop.
      // This prevents snap-back caused by stale server data overwriting
      // the optimistic state (dnd-kit Discussion #1522).
      setLocalSchedules(null);
      setLocalCandidates(null);
    }
  }

  async function reorderSchedule(id: string, direction: "up" | "down") {
    if (!currentDayId || !currentPatternId) return;
    const current = localSchedules ?? schedules;
    const idx = current.findIndex((s) => s.id === id);
    if (idx === -1) return;
    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= current.length) return;

    const reordered = arrayMove(current, idx, newIdx);
    setLocalSchedules(reordered);

    try {
      await api(
        `/api/trips/${tripId}/days/${currentDayId}/patterns/${currentPatternId}/schedules/reorder`,
        {
          method: "PATCH",
          body: JSON.stringify({ scheduleIds: reordered.map((s) => s.id) }),
        },
      );
      onDone();
    } catch (err) {
      if (err instanceof ApiError && (err.status === 400 || err.status === 404)) {
        toast.error(tm("conflictStale"));
      } else {
        toast.error(tm("scheduleReorderFailed"));
      }
      onDone();
    } finally {
      setLocalSchedules(null);
    }
  }

  async function reorderCandidate(id: string, direction: "up" | "down") {
    const current = localCandidates ?? candidates;
    const idx = current.findIndex((c) => c.id === id);
    if (idx === -1) return;
    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= current.length) return;

    const reordered = arrayMove(current, idx, newIdx);
    setLocalCandidates(reordered);

    try {
      await api(`/api/trips/${tripId}/candidates/reorder`, {
        method: "PATCH",
        body: JSON.stringify({ scheduleIds: reordered.map((c) => c.id) }),
      });
      onDone();
    } catch (err) {
      if (err instanceof ApiError && (err.status === 400 || err.status === 404)) {
        toast.error(tm("conflictStale"));
      } else {
        toast.error(tm("scheduleReorderFailed"));
      }
      onDone();
    } finally {
      setLocalCandidates(null);
    }
  }

  return {
    sensors,
    collisionDetection,
    activeDragItem,
    overScheduleId,
    overCandidateId,
    localSchedules: localSchedules ?? schedules,
    localCandidates: localCandidates ?? candidates,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    reorderSchedule,
    reorderCandidate,
  };
}
