"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { DayTimeline } from "@/components/day-timeline";
import { TripMap } from "@/components/trip-map-wrapper";
import { api } from "@/lib/api";
import type { TripResponse } from "@tabi/shared";

export default function TripDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.id as string;
  const [trip, setTrip] = useState<TripResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrip = useCallback(async () => {
    try {
      const data = await api<TripResponse>(`/api/trips/${tripId}`);
      setTrip(data);
    } catch (err) {
      if (err instanceof Error && err.message.includes("401")) {
        router.push("/auth/login");
        return;
      }
      setError("旅行の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [tripId, router]);

  useEffect(() => {
    fetchTrip();
  }, [fetchTrip]);

  if (loading) {
    return <p className="text-muted-foreground">読み込み中...</p>;
  }

  if (error || !trip) {
    return <p className="text-destructive">{error ?? "旅行が見つかりません"}</p>;
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* Left: Timeline */}
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold">{trip.title}</h1>
          <p className="text-muted-foreground">
            {trip.destination} / {trip.startDate} - {trip.endDate}
          </p>
        </div>
        <div className="space-y-6">
          {trip.days.map((day) => (
            <DayTimeline
              key={day.id}
              tripId={tripId}
              dayId={day.id}
              dayNumber={day.dayNumber}
              date={day.date}
              spots={day.spots}
              onRefresh={fetchTrip}
            />
          ))}
        </div>
      </div>

      {/* Right: Map */}
      <div className="lg:sticky lg:top-4 lg:h-[calc(100vh-8rem)]">
        <TripMap spots={trip.days.flatMap((day) => day.spots)} />
      </div>
    </div>
  );
}
