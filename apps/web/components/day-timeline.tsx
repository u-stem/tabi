"use client";

import { toast } from "sonner";
import { SpotItem } from "./spot-item";
import { AddSpotDialog } from "./add-spot-dialog";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { SpotResponse } from "@tabi/shared";

type DayTimelineProps = {
  tripId: string;
  dayId: string;
  dayNumber: number;
  date: string;
  spots: SpotResponse[];
  onRefresh: () => void;
};

export function DayTimeline({
  tripId,
  dayId,
  dayNumber,
  date,
  spots,
  onRefresh,
}: DayTimelineProps) {
  async function handleDelete(spotId: string) {
    try {
      await api(`/api/trips/${tripId}/days/${dayId}/spots/${spotId}`, {
        method: "DELETE",
      });
      toast.success("スポットを削除しました");
      onRefresh();
    } catch (err) {
      console.error("Failed to delete spot:", err);
      toast.error("スポットの削除に失敗しました");
    }
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold">
          {dayNumber}日目
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            {formatDate(date)}
          </span>
        </h3>
        <AddSpotDialog tripId={tripId} dayId={dayId} onAdded={onRefresh} />
      </div>
      {spots.length === 0 ? (
        <div className="rounded-md border border-dashed p-6 text-center">
          <p className="text-sm text-muted-foreground">
            まだスポットがありません
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            「+ スポット追加」から行きたい場所を追加しましょう
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {spots.map((spot) => (
            <SpotItem key={spot.id} {...spot} onDelete={() => handleDelete(spot.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
