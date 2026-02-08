"use client";

import { SpotItem } from "./spot-item";
import { AddSpotDialog } from "./add-spot-dialog";
import { api } from "@/lib/api";

type Spot = {
  id: string;
  name: string;
  category: string;
  startTime?: string | null;
  endTime?: string | null;
  memo?: string | null;
};

type DayTimelineProps = {
  tripId: string;
  dayId: string;
  dayNumber: number;
  date: string;
  spots: Spot[];
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
    await api(`/api/trips/${tripId}/days/${dayId}/spots/${spotId}`, {
      method: "DELETE",
    });
    onRefresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">
          Day {dayNumber}{" "}
          <span className="text-sm font-normal text-muted-foreground">
            {date}
          </span>
        </h3>
        <AddSpotDialog tripId={tripId} dayId={dayId} onAdded={onRefresh} />
      </div>
      {spots.length === 0 ? (
        <p className="text-sm text-muted-foreground">No spots yet</p>
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
