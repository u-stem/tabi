"use client";

import type { DayPatternResponse, TransportMethod, TripResponse } from "@tabi/shared";
import { CATEGORY_LABELS, TRANSPORT_METHOD_LABELS } from "@tabi/shared";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Logo } from "@/components/logo";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, api } from "@/lib/api";
import { formatDate, formatDateRange } from "@/lib/format";

export default function SharedTripPage() {
  const params = useParams();
  const token = params.token as string;
  const [trip, setTrip] = useState<TripResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<TripResponse>(`/api/shared/${token}`)
      .then(setTrip)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setError("このリンクは無効か、有効期限が切れています");
        } else {
          setError("旅行の取得に失敗しました");
        }
      })
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen">
        <header className="border-b">
          <div className="container flex h-14 items-center">
            <Logo />
          </div>
        </header>
        <div className="container py-8">
          <div className="mb-6 space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
      </div>
    );
  }

  if (error) return <p className="p-8 text-destructive">{error}</p>;
  if (!trip) return <p className="p-8 text-destructive">旅行が見つかりません</p>;

  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="container flex h-14 items-center">
          <Logo />
          <span className="ml-2 text-sm text-muted-foreground">共有プラン</span>
        </div>
      </header>
      <div className="container py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">{trip.title}</h1>
          <p className="text-muted-foreground">
            {trip.destination} / {formatDateRange(trip.startDate, trip.endDate)}
          </p>
        </div>
        <div className="space-y-6">
          {trip.days.map((day) => (
            <div key={day.id} className="space-y-3">
              <h3 className="font-semibold">
                {day.dayNumber}日目{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  {formatDate(day.date)}
                </span>
              </h3>
              {day.patterns.map((pattern) => (
                <PatternSection
                  key={pattern.id}
                  pattern={pattern}
                  showLabel={day.patterns.length > 1}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PatternSection({
  pattern,
  showLabel,
}: {
  pattern: DayPatternResponse;
  showLabel: boolean;
}) {
  return (
    <div>
      {showLabel && (
        <p className="mb-1 text-sm font-medium text-muted-foreground">{pattern.label}</p>
      )}
      {pattern.schedules.length === 0 ? (
        <p className="text-sm text-muted-foreground">まだ予定がありません</p>
      ) : (
        <div className="space-y-2">
          {pattern.schedules.map((schedule) => (
            <div key={schedule.id} className="rounded-md border p-3">
              <div className="flex items-center gap-2">
                <span className="rounded bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground">
                  {CATEGORY_LABELS[schedule.category]}
                </span>
                <span className="font-medium">{schedule.name}</span>
                {schedule.startTime && (
                  <span className="text-xs text-muted-foreground">
                    {schedule.startTime}
                    {schedule.endTime && ` - ${schedule.endTime}`}
                  </span>
                )}
              </div>
              {schedule.category === "transport" &&
                (schedule.departurePlace || schedule.arrivalPlace || schedule.transportMethod) && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {schedule.departurePlace && schedule.arrivalPlace
                      ? `${schedule.departurePlace} → ${schedule.arrivalPlace}`
                      : schedule.departurePlace || schedule.arrivalPlace}
                    {schedule.transportMethod &&
                      ` (${TRANSPORT_METHOD_LABELS[schedule.transportMethod as TransportMethod]})`}
                  </p>
                )}
              {schedule.memo && (
                <p className="mt-1 text-sm text-muted-foreground">{schedule.memo}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
