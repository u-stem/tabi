"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { DayTimeline } from "@/components/day-timeline";
import { TripMap } from "@/components/trip-map-wrapper";
import { TripActions } from "@/components/trip-actions";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api";
import { formatDateRange, getDayCount } from "@/lib/format";
import { useOnlineStatus } from "@/lib/hooks/use-online-status";
import type { TripResponse } from "@tabi/shared";

export default function TripDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.id as string;
  const online = useOnlineStatus();
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
  }, [tripId, router]);

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
          <div className="space-y-4">
            {["skeleton-1", "skeleton-2", "skeleton-3"].map((key) => (
              <div key={key} className="rounded-lg border p-4 space-y-3">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-16 w-full rounded-md" />
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

  const allSpots = trip.days.flatMap((day) => day.spots);
  const hasGeoSpots = allSpots.some((s) => s.latitude && s.longitude);
  const dayCount = getDayCount(trip.startDate, trip.endDate);

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* Left: Timeline */}
      <div>
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <span aria-hidden="true">&larr;</span> マイ旅行に戻る
          </Link>
          <h1 className="text-2xl font-bold">{trip.title}</h1>
          <p className="text-muted-foreground">
            {trip.destination !== trip.title ? `${trip.destination} / ` : ""}
            {formatDateRange(trip.startDate, trip.endDate)}
            <span className="ml-2 text-sm">({dayCount}日間)</span>
          </p>
          <div className="mt-3 flex items-center justify-between">
            <TripActions tripId={tripId} status={trip.status} onStatusChange={fetchTrip} disabled={!online} />
          </div>
        </div>
        <div className="space-y-4">
          {trip.days.map((day) => (
            <DayTimeline
              key={day.id}
              tripId={tripId}
              dayId={day.id}
              dayNumber={day.dayNumber}
              date={day.date}
              spots={day.spots}
              onRefresh={fetchTrip}
              disabled={!online}
            />
          ))}
        </div>
      </div>

      {/* Right: Map */}
      <div className="h-[50vh] lg:sticky lg:top-4 lg:h-[calc(100vh-8rem)]">
        {hasGeoSpots ? (
          <TripMap spots={allSpots} />
        ) : (
          <div className="flex h-full items-center justify-center rounded-lg border border-dashed bg-muted/30">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                スポットに位置情報を追加すると
              </p>
              <p className="text-sm text-muted-foreground">地図が表示されます</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
