"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { SpotResponse } from "@tabi/shared";
import { ArrowUpDown } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { compareByStartTime, formatDate, getTimeStatus, type TimeStatus } from "@/lib/format";
import { useCurrentTime } from "@/lib/hooks/use-current-time";
import { AddSpotDialog } from "./add-spot-dialog";
import { SpotItem } from "./spot-item";

type DayTimelineProps = {
  tripId: string;
  dayId: string;
  patternId: string;
  date: string;
  spots: SpotResponse[];
  onRefresh: () => void;
  disabled?: boolean;
  headerContent?: React.ReactNode;
};

export function DayTimeline({
  tripId,
  dayId,
  patternId,
  date,
  spots,
  onRefresh,
  disabled,
  headerContent,
}: DayTimelineProps) {
  const [localSpots, setLocalSpots] = useState(spots);
  useEffect(() => {
    setLocalSpots(spots);
  }, [spots]);

  const now = useCurrentTime();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const isToday = date === todayStr;

  function getSpotTimeStatus(spot: SpotResponse): TimeStatus | null {
    if (!isToday) return null;
    return getTimeStatus(now, spot.startTime, spot.endTime);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  async function handleDelete(spotId: string) {
    try {
      await api(`/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/spots/${spotId}`, {
        method: "DELETE",
      });
      toast.success("予定を削除しました");
      onRefresh();
    } catch {
      toast.error("予定の削除に失敗しました");
    }
  }

  const isSorted =
    localSpots.length <= 1 ||
    localSpots.every((spot, i) => i === 0 || compareByStartTime(localSpots[i - 1], spot) <= 0);

  async function handleSortByTime() {
    const sorted = [...localSpots].sort(compareByStartTime);
    setLocalSpots(sorted);

    const spotIds = sorted.map((s) => s.id);
    try {
      await api(`/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/spots/reorder`, {
        method: "PATCH",
        body: JSON.stringify({ spotIds }),
      });
      onRefresh();
    } catch {
      setLocalSpots(spots);
      toast.error("並び替えに失敗しました");
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = localSpots.findIndex((s) => s.id === active.id);
    const newIndex = localSpots.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(localSpots, oldIndex, newIndex);
    setLocalSpots(reordered);

    const spotIds = reordered.map((s) => s.id);
    try {
      await api(`/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/spots/reorder`, {
        method: "PATCH",
        body: JSON.stringify({ spotIds }),
      });
      onRefresh();
    } catch {
      setLocalSpots(spots);
      toast.error("並び替えに失敗しました");
    }
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{formatDate(date)}</span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSortByTime}
            disabled={disabled || isSorted}
          >
            <ArrowUpDown className="h-4 w-4" />
            時刻順
          </Button>
          <AddSpotDialog
            tripId={tripId}
            dayId={dayId}
            patternId={patternId}
            onAdd={onRefresh}
            disabled={disabled}
          />
        </div>
      </div>
      {headerContent}

      {localSpots.length === 0 ? (
        <div className="rounded-md border border-dashed p-6 text-center">
          <p className="text-sm text-muted-foreground">まだ予定がありません</p>
          <p className="mt-1 text-xs text-muted-foreground">
            「+ 予定を追加」から行きたい場所を追加しましょう
          </p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={localSpots.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <div>
              {localSpots.map((spot, index) => (
                <SpotItem
                  key={spot.id}
                  {...spot}
                  tripId={tripId}
                  dayId={dayId}
                  patternId={patternId}
                  isFirst={index === 0}
                  isLast={index === localSpots.length - 1}
                  onDelete={() => handleDelete(spot.id)}
                  onUpdate={onRefresh}
                  disabled={disabled}
                  timeStatus={getSpotTimeStatus(spot)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
