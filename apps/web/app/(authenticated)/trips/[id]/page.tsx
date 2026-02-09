"use client";

import type { TripResponse } from "@tabi/shared";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { DayTimeline } from "@/components/day-timeline";
import { EditTripDialog } from "@/components/edit-trip-dialog";
import { TripActions } from "@/components/trip-actions";

import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, api } from "@/lib/api";
import { formatDateRange, getDayCount } from "@/lib/format";
import { useOnlineStatus } from "@/lib/hooks/use-online-status";

export default function TripDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.id as string;
  const online = useOnlineStatus();
  const [trip, setTrip] = useState<TripResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);

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
      </div>
    );
  }

  if (error || !trip) {
    return <p className="text-destructive">{error ?? "旅行が見つかりません"}</p>;
  }

  const dayCount = getDayCount(trip.startDate, trip.endDate);

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <span aria-hidden="true">&larr;</span> ホームに戻る
        </Link>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">{trip.title}</h1>
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            disabled={!online}
            className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            編集
          </button>
        </div>
        <p className="text-muted-foreground">
          {`${trip.destination} / `}
          {formatDateRange(trip.startDate, trip.endDate)}
          <span className="ml-2 text-sm">({dayCount}日間)</span>
        </p>
        <div className="mt-3 flex items-center justify-between">
          <TripActions
            tripId={tripId}
            status={trip.status}
            onStatusChange={fetchTrip}
            disabled={!online}
          />
        </div>
      </div>
      <EditTripDialog
        tripId={tripId}
        title={trip.title}
        destination={trip.destination}
        startDate={trip.startDate}
        endDate={trip.endDate}
        open={editOpen}
        onOpenChange={setEditOpen}
        onUpdate={fetchTrip}
      />
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
  );
}
