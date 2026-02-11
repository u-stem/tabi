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
import type { ScheduleResponse } from "@sugara/shared";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";

type ActiveDragItem = {
  id: string;
  name: string;
  source: "schedule" | "candidate";
};

type UseTripDragAndDropArgs = {
  tripId: string;
  currentDayId: string | null;
  currentPatternId: string | null;
  schedules: ScheduleResponse[];
  candidates: ScheduleResponse[];
  onDone: () => void;
};

export function useTripDragAndDrop({
  tripId,
  currentDayId,
  currentPatternId,
  schedules,
  candidates,
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
    let name = "";
    if (source === "schedule") {
      name = localSchedules.find((s) => s.id === active.id)?.name ?? "";
    } else {
      name = localCandidates.find((c) => c.id === active.id)?.name ?? "";
    }
    setActiveDragItem({ id: String(active.id), name, source });
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
      const oldIndex = localSchedules.findIndex((s) => s.id === active.id);
      const overIndex = localSchedules.findIndex((s) => s.id === over.id);
      if (oldIndex === -1 || overIndex === -1) return;

      const reordered = arrayMove(localSchedules, oldIndex, overIndex);
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
      } catch {
        setLocalSchedules(schedules);
        toast.error("並び替えに失敗しました");
      }
    } else if (sourceType === "schedule" && isOverCandidates) {
      try {
        await api(`/api/trips/${tripId}/schedules/${active.id}/unassign`, {
          method: "POST",
        });
        toast.success("候補に戻しました");
        onDone();
      } catch {
        toast.error("候補への移動に失敗しました");
      }
    } else if (sourceType === "candidate" && isOverTimeline) {
      try {
        await api(`/api/trips/${tripId}/candidates/${active.id}/assign`, {
          method: "POST",
          body: JSON.stringify({ dayPatternId: currentPatternId }),
        });

        if (overType === "schedule") {
          const overIndex = localSchedules.findIndex((s) => s.id === over.id);
          if (overIndex !== -1) {
            const scheduleIds = localSchedules.map((s) => s.id);
            scheduleIds.splice(overIndex, 0, String(active.id));
            await api(
              `/api/trips/${tripId}/days/${currentDayId}/patterns/${currentPatternId}/schedules/reorder`,
              {
                method: "PATCH",
                body: JSON.stringify({ scheduleIds }),
              },
            );
          }
        }

        toast.success("予定に追加しました");
        onDone();
      } catch {
        toast.error("予定への追加に失敗しました");
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
      } catch {
        setLocalCandidates(candidates);
        toast.error("並び替えに失敗しました");
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
