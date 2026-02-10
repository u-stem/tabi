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
import type { SpotResponse } from "@tabi/shared";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";

type ActiveDragItem = {
  id: string;
  name: string;
  source: "spot" | "candidate";
};

type UseTripDragAndDropArgs = {
  tripId: string;
  currentDayId: string | null;
  currentPatternId: string | null;
  spots: SpotResponse[];
  candidates: SpotResponse[];
  onDone: () => void;
};

export function useTripDragAndDrop({
  tripId,
  currentDayId,
  currentPatternId,
  spots,
  candidates,
  onDone,
}: UseTripDragAndDropArgs) {
  const [activeDragItem, setActiveDragItem] = useState<ActiveDragItem | null>(null);
  const [localSpots, setLocalSpots] = useState<SpotResponse[]>([]);
  const [localCandidates, setLocalCandidates] = useState<SpotResponse[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  const collisionDetection = pointerWithin;

  useEffect(() => {
    setLocalSpots(spots);
  }, [spots]);

  useEffect(() => {
    setLocalCandidates(candidates);
  }, [candidates]);

  function handleDragStart(event: DragStartEvent) {
    const { active } = event;
    const type = active.data.current?.type as string | undefined;
    if (!type) return;

    const source = type === "candidate" ? "candidate" : "spot";
    let name = "";
    if (source === "spot") {
      name = localSpots.find((s) => s.id === active.id)?.name ?? "";
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
    const isOverTimeline = overType === "timeline" || overType === "spot";

    if (sourceType === "spot" && isOverTimeline) {
      if (active.id === over.id) return;
      const oldIndex = localSpots.findIndex((s) => s.id === active.id);
      const overIndex = localSpots.findIndex((s) => s.id === over.id);
      if (oldIndex === -1 || overIndex === -1) return;

      const reordered = arrayMove(localSpots, oldIndex, overIndex);
      setLocalSpots(reordered);

      const spotIds = reordered.map((s) => s.id);
      try {
        await api(
          `/api/trips/${tripId}/days/${currentDayId}/patterns/${currentPatternId}/spots/reorder`,
          {
            method: "PATCH",
            body: JSON.stringify({ spotIds }),
          },
        );
        onDone();
      } catch {
        setLocalSpots(spots);
        toast.error("並び替えに失敗しました");
      }
    } else if (sourceType === "spot" && isOverCandidates) {
      try {
        await api(`/api/trips/${tripId}/spots/${active.id}/unassign`, {
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

        if (overType === "spot") {
          const overIndex = localSpots.findIndex((s) => s.id === over.id);
          if (overIndex !== -1) {
            const spotIds = localSpots.map((s) => s.id);
            spotIds.splice(overIndex, 0, String(active.id));
            await api(
              `/api/trips/${tripId}/days/${currentDayId}/patterns/${currentPatternId}/spots/reorder`,
              {
                method: "PATCH",
                body: JSON.stringify({ spotIds }),
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

      const spotIds = reordered.map((c) => c.id);
      try {
        await api(`/api/trips/${tripId}/candidates/reorder`, {
          method: "PATCH",
          body: JSON.stringify({ spotIds }),
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
    localSpots,
    localCandidates,
    handleDragStart,
    handleDragEnd,
  };
}
