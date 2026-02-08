"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { TripMap } from "@/components/trip-map-wrapper";
import { api } from "@/lib/api";
import { CATEGORY_LABELS } from "@tabi/shared";
import type { TripResponse } from "@tabi/shared";

export default function SharedTripPage() {
  const params = useParams();
  const token = params.token as string;
  const [trip, setTrip] = useState<TripResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<TripResponse>(`/api/shared/${token}`)
      .then(setTrip)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <p className="p-8 text-muted-foreground">読み込み中...</p>;
  if (error) return <p className="p-8 text-destructive">{error}</p>;
  if (!trip) return <p className="p-8 text-destructive">旅行が見つかりません</p>;

  return (
    <div className="container py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{trip.title}</h1>
        <p className="text-muted-foreground">
          {trip.destination} / {trip.startDate} - {trip.endDate}
        </p>
      </div>
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-6">
          {trip.days.map((day) => (
            <div key={day.id} className="space-y-3">
              <h3 className="font-semibold">
                {day.dayNumber}日目{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  {day.date}
                </span>
              </h3>
              {day.spots.length === 0 ? (
                <p className="text-sm text-muted-foreground">スポットなし</p>
              ) : (
                <div className="space-y-2">
                  {day.spots.map((spot) => (
                    <div key={spot.id} className="rounded-md border p-3">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground">
                          {CATEGORY_LABELS[spot.category as keyof typeof CATEGORY_LABELS] ?? spot.category}
                        </span>
                        <span className="font-medium">{spot.name}</span>
                        {spot.startTime && (
                          <span className="text-xs text-muted-foreground">
                            {spot.startTime}
                            {spot.endTime && ` - ${spot.endTime}`}
                          </span>
                        )}
                      </div>
                      {spot.memo && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {spot.memo}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="lg:sticky lg:top-4 lg:h-[calc(100vh-8rem)]">
          <TripMap spots={trip.days.flatMap((day) => day.spots)} />
        </div>
      </div>
    </div>
  );
}
