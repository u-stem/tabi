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
    } catch {
      toast.error("スポットの削除に失敗しました");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">
          {dayNumber}日目{" "}
          <span className="text-sm font-normal text-muted-foreground">
            {formatDate(date)}
          </span>
        </h3>
        <AddSpotDialog tripId={tripId} dayId={dayId} onAdded={onRefresh} />
      </div>
      {spots.length === 0 ? (
        <p className="text-sm text-muted-foreground">スポットなし</p>
      ) : (
        <div className="space-y-2">
          {spots.map((spot) => (
            <SpotItem
              key={spot.id}
              {...spot}
              onDelete={() => handleDelete(spot.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
