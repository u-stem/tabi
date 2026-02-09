"use client";

import type { TripResponse } from "@tabi/shared";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { DayTimeline } from "@/components/day-timeline";
import { EditTripDialog } from "@/components/edit-trip-dialog";
import { TripActions } from "@/components/trip-actions";

import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, api } from "@/lib/api";
import { formatDateRange, getDayCount } from "@/lib/format";
import { useOnlineStatus } from "@/lib/hooks/use-online-status";
import { cn } from "@/lib/utils";

export default function TripDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.id as string;
  const online = useOnlineStatus();
  const [trip, setTrip] = useState<TripResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState(0);

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
        <h1 className="text-2xl font-bold">{trip.title}</h1>
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
            onEdit={() => setEditOpen(true)}
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
      <div className="flex gap-1 overflow-x-auto border-b" role="tablist" aria-label="日程タブ">
        {trip.days.map((day, index) => (
          <button
            key={day.id}
            type="button"
            role="tab"
            aria-selected={selectedDay === index}
            aria-controls={`day-panel-${day.id}`}
            onClick={() => setSelectedDay(index)}
            className={cn(
              "relative shrink-0 px-4 py-2 text-sm font-medium transition-colors",
              selectedDay === index
                ? "text-blue-600 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-blue-600"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {day.dayNumber}日目
          </button>
        ))}
      </div>
      {trip.days[selectedDay] && (
        <div id={`day-panel-${trip.days[selectedDay].id}`} role="tabpanel" className="mt-4">
          <DayTimeline
            key={trip.days[selectedDay].id}
            tripId={tripId}
            dayId={trip.days[selectedDay].id}
            date={trip.days[selectedDay].date}
            spots={trip.days[selectedDay].spots}
            onRefresh={fetchTrip}
            disabled={!online}
          />
        </div>
      )}
    </div>
  );
}
