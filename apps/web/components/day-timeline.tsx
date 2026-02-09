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
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { SpotResponse } from "@tabi/shared";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { AddSpotDialog } from "./add-spot-dialog";
import { SpotItem } from "./spot-item";

type DayTimelineProps = {
  tripId: string;
  dayId: string;
  date: string;
  spots: SpotResponse[];
  onRefresh: () => void;
  disabled?: boolean;
};

export function DayTimeline({ tripId, dayId, date, spots, onRefresh, disabled }: DayTimelineProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  async function handleDelete(spotId: string) {
    try {
      await api(`/api/trips/${tripId}/days/${dayId}/spots/${spotId}`, {
        method: "DELETE",
      });
      toast.success("予定を削除しました");
      onRefresh();
    } catch {
      toast.error("予定の削除に失敗しました");
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = spots.findIndex((s) => s.id === active.id);
    const newIndex = spots.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(spots, oldIndex, newIndex);
    const spotIds = reordered.map((s) => s.id);

    try {
      await api(`/api/trips/${tripId}/days/${dayId}/spots/reorder`, {
        method: "PATCH",
        body: JSON.stringify({ spotIds }),
      });
      onRefresh();
    } catch {
      toast.error("並び替えに失敗しました");
    }
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{formatDate(date)}</span>
        <AddSpotDialog tripId={tripId} dayId={dayId} onAdd={onRefresh} disabled={disabled} />
      </div>

      {spots.length === 0 ? (
        <div className="rounded-md border border-dashed p-6 text-center">
          <p className="text-sm text-muted-foreground">まだ予定がありません</p>
          <p className="mt-1 text-xs text-muted-foreground">
            「+ 予定を追加」から行きたい場所を追加しましょう
          </p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={spots.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div>
              {spots.map((spot, index) => (
                <SpotItem
                  key={spot.id}
                  {...spot}
                  tripId={tripId}
                  dayId={dayId}
                  isFirst={index === 0}
                  isLast={index === spots.length - 1}
                  onDelete={() => handleDelete(spot.id)}
                  onUpdate={onRefresh}
                  disabled={disabled}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
