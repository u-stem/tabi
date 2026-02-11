"use client";

import type {
  DayPatternResponse,
  DayResponse,
  ScheduleResponse,
  TransportMethod,
  TripStatus,
} from "@sugara/shared";
import { CATEGORY_LABELS, STATUS_LABELS, TRANSPORT_METHOD_LABELS } from "@sugara/shared";
import { Calendar, Clock, MapPin } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Logo } from "@/components/logo";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, api } from "@/lib/api";
import { formatDate, formatDateRange, getDayCount } from "@/lib/format";

type SharedTripResponse = {
  id: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  status: TripStatus;
  days: DayResponse[];
  shareExpiresAt: string | null;
};

const STATUS_COLORS: Record<TripStatus, string> = {
  draft: "bg-gray-200 text-gray-800 border-gray-300",
  planned: "bg-blue-100 text-blue-800 border-blue-300",
  active: "bg-green-100 text-green-800 border-green-300",
  completed: "bg-purple-100 text-purple-800 border-purple-300",
};

function SharedHeader() {
  return (
    <header className="border-b">
      <div className="container flex h-14 items-center">
        <Logo />
        <span className="ml-2 text-sm text-muted-foreground">共有プラン</span>
      </div>
    </header>
  );
}

export default function SharedTripPage() {
  const params = useParams();
  const token = params.token as string;
  const [trip, setTrip] = useState<SharedTripResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<SharedTripResponse>(`/api/shared/${token}`)
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
        <SharedHeader />
        <div className="container max-w-3xl py-8">
          <div className="mb-8 space-y-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-4 w-72" />
          </div>
          <div className="space-y-6">
            {[1, 2].map((i) => (
              <div key={i} className="space-y-3 rounded-lg border p-4">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-12 w-full rounded-md" />
                <Skeleton className="h-12 w-full rounded-md" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen">
        <SharedHeader />
        <div className="container flex max-w-3xl flex-col items-center py-16 text-center">
          <Calendar className="mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-lg font-medium text-destructive">{error}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            リンクが正しいか確認するか、共有元に問い合わせてください
          </p>
        </div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="min-h-screen">
        <SharedHeader />
        <div className="container flex max-w-3xl flex-col items-center py-16 text-center">
          <p className="text-lg font-medium text-destructive">旅行が見つかりません</p>
        </div>
      </div>
    );
  }

  const dayCount = getDayCount(trip.startDate, trip.endDate);

  return (
    <div className="min-h-screen">
      <SharedHeader />
      <div className="container max-w-3xl py-8">
        <div className="mb-8">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold sm:text-2xl">{trip.title}</h1>
            <Badge variant="outline" className={STATUS_COLORS[trip.status]}>
              {STATUS_LABELS[trip.status]}
            </Badge>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {trip.destination}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {formatDateRange(trip.startDate, trip.endDate)}
              <span className="text-xs">({dayCount}日間)</span>
            </span>
          </div>
          {trip.shareExpiresAt && (
            <p className="mt-2 text-xs text-muted-foreground">
              共有リンクの有効期限: {new Date(trip.shareExpiresAt).toLocaleDateString("ja-JP")}
            </p>
          )}
        </div>
        <div className="space-y-6">
          {(trip.days ?? []).map((day) => (
            <section key={day.id} className="rounded-lg border bg-card p-4 sm:p-5">
              <h3 className="mb-3 flex items-center gap-2 text-base font-semibold">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {day.dayNumber}
                </span>
                {day.dayNumber}日目
                <span className="text-sm font-normal text-muted-foreground">
                  {formatDate(day.date)}
                </span>
              </h3>
              {(day.patterns ?? []).map((pattern) => (
                <PatternSection
                  key={pattern.id}
                  pattern={pattern}
                  showLabel={(day.patterns ?? []).length > 1}
                />
              ))}
            </section>
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
  const schedules = pattern.schedules ?? [];

  return (
    <div className={showLabel ? "mt-3" : ""}>
      {showLabel && (
        <p className="mb-2 text-sm font-medium text-muted-foreground">{pattern.label}</p>
      )}
      {schedules.length === 0 ? (
        <p className="py-2 text-center text-sm text-muted-foreground">まだ予定がありません</p>
      ) : (
        <div className="space-y-2">
          {schedules.map((schedule) => (
            <ScheduleCard key={schedule.id} schedule={schedule} />
          ))}
        </div>
      )}
    </div>
  );
}

function ScheduleCard({ schedule }: { schedule: ScheduleResponse }) {
  const categoryLabel = CATEGORY_LABELS[schedule.category] ?? schedule.category;
  const transportLabel =
    schedule.transportMethod && schedule.transportMethod in TRANSPORT_METHOD_LABELS
      ? TRANSPORT_METHOD_LABELS[schedule.transportMethod as TransportMethod]
      : schedule.transportMethod;

  return (
    <div className="cursor-default rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="text-xs">
          {categoryLabel}
        </Badge>
        <span className="font-medium">{schedule.name}</span>
        {schedule.startTime && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {schedule.startTime.slice(0, 5)}
            {schedule.endTime && ` - ${schedule.endTime.slice(0, 5)}`}
          </span>
        )}
      </div>
      {schedule.category === "transport" &&
        (schedule.departurePlace || schedule.arrivalPlace || transportLabel) && (
          <p className="mt-1 text-xs text-muted-foreground">
            {schedule.departurePlace && schedule.arrivalPlace
              ? `${schedule.departurePlace} → ${schedule.arrivalPlace}`
              : schedule.departurePlace || schedule.arrivalPlace}
            {transportLabel && ` (${transportLabel})`}
          </p>
        )}
      {schedule.address && (
        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3 shrink-0" />
          {schedule.address}
        </p>
      )}
      {schedule.memo && <p className="mt-1 text-sm text-muted-foreground">{schedule.memo}</p>}
    </div>
  );
}
