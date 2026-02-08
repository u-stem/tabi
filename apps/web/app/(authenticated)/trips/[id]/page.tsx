"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { DayTimeline } from "@/components/day-timeline";
import { TripMap } from "@/components/trip-map-wrapper";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api";
import { TripActions } from "@/components/trip-actions";
import { formatDateRange } from "@/lib/format";
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
      if (err instanceof ApiError && err.status === 401) {
        router.push("/auth/login");
        return;
      }
      setError("旅行の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- router is stable
  }, [tripId]);

  useEffect(() => {
    fetchTrip();
  }, [fetchTrip]);

  if (loading) {
    return (
      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <div className="mb-6 space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="space-y-6">
            {["skeleton-1", "skeleton-2", "skeleton-3"].map((key) => (
              <div key={key} className="space-y-3">
                <Skeleton className="h-5 w-32" />
                <div className="space-y-2">
                  <Skeleton className="h-16 w-full rounded-md" />
                  <Skeleton className="h-16 w-full rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <Skeleton className="h-96 w-full rounded-lg" />
      </div>
    );
  }

  if (error || !trip) {
    return <p className="text-destructive">{error ?? "旅行が見つかりません"}</p>;
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* Left: Timeline */}
      <div>
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            &larr; マイ旅行に戻る
          </Link>
          <h1 className="text-2xl font-bold">{trip.title}</h1>
          <p className="text-muted-foreground">
            {trip.destination} / {formatDateRange(trip.startDate, trip.endDate)}
          </p>
          <div className="mt-3">
            <TripActions tripId={tripId} status={trip.status} />
          </div>
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
      <div className="h-[50vh] lg:sticky lg:top-4 lg:h-[calc(100vh-8rem)]">
        <TripMap spots={trip.days.flatMap((day) => day.spots)} />
      </div>
    </div>
  );
}
