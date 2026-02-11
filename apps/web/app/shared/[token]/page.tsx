"use client";

import type {
  CrossDayEntry,
  DayPatternResponse,
  DayResponse,
  ScheduleResponse,
  TransportMethod,
  TripStatus,
} from "@sugara/shared";
import { STATUS_LABELS, TRANSPORT_METHOD_LABELS } from "@sugara/shared";
import { Calendar, Clock, MapPin, RefreshCw } from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { Logo } from "@/components/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, api } from "@/lib/api";
import { SCHEDULE_COLOR_CLASSES } from "@/lib/colors";
import { getCrossDayEntries } from "@/lib/cross-day";
import { formatDate, formatDateRange, getDayCount } from "@/lib/format";
import { CATEGORY_ICONS } from "@/lib/icons";
import { buildMergedTimeline } from "@/lib/merge-timeline";
import { MSG } from "@/lib/messages";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

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
  const [hasUpdate, setHasUpdate] = useState(false);
  const tripIdRef = useRef<string | null>(null);

  const fetchTrip = useCallback(() => {
    api<SharedTripResponse>(`/api/shared/${token}`)
      .then((data) => {
        setTrip(data);
        tripIdRef.current = data.id;
        setHasUpdate(false);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setError(MSG.SHARED_LINK_INVALID);
        } else {
          setError(MSG.SHARED_TRIP_FETCH_FAILED);
        }
      })
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    fetchTrip();
  }, [fetchTrip]);

  // Subscribe to broadcast updates
  useEffect(() => {
    if (!tripIdRef.current) return;
    const tripId = tripIdRef.current;
    const channel = supabase
      .channel(`trip:${tripId}`)
      .on("broadcast", { event: "trip:updated" }, () => {
        setHasUpdate(true);
      })
      .subscribe();
    return () => {
      channel.unsubscribe();
    };
  }, [trip?.id]);

  if (loading) {
    return (
      <div className="min-h-screen">
        <SharedHeader />
        <div className="container max-w-3xl py-8">
          <div className="mb-8">
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <div className="mt-1 flex items-center gap-3">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-36" />
            </div>
          </div>
          <div className="space-y-6">
            {[1, 2].map((day) => (
              <div key={day} className="rounded-lg border bg-card p-4 sm:p-5">
                <div className="mb-3 flex items-center gap-2">
                  <Skeleton className="h-7 w-7 rounded-full" />
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <div className="space-y-2">
                  {[1, 2].map((s) => (
                    <div key={s} className="rounded-md border p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-5 w-12 rounded-full" />
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                      <Skeleton className="h-3 w-36" />
                    </div>
                  ))}
                </div>
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
          <p className="text-lg font-medium text-destructive">{MSG.SHARED_TRIP_NOT_FOUND}</p>
        </div>
      </div>
    );
  }

  const dayCount = getDayCount(trip.startDate, trip.endDate);

  return (
    <div className="min-h-screen">
      <SharedHeader />
      {hasUpdate && (
        <div className="sticky top-0 z-10 border-b bg-blue-50 px-4 py-2 text-center">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-blue-700 hover:text-blue-800"
            onClick={fetchTrip}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            内容が更新されました。タップして最新を表示
          </Button>
        </div>
      )}
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
          {(trip.days ?? []).map((day) => {
            const crossDayEntries = getCrossDayEntries(trip.days ?? [], day.dayNumber);
            return (
              <section key={day.id} className="rounded-lg border bg-card p-4 sm:p-5">
                <h3 className="mb-3 flex items-center gap-2 text-base font-semibold">
                  {day.dayNumber}日目
                  <span className="text-sm font-normal text-muted-foreground">
                    {formatDate(day.date)}
                  </span>
                </h3>
                {(day.patterns ?? []).map((pattern, i) => (
                  <PatternSection
                    key={pattern.id}
                    pattern={pattern}
                    showLabel={(day.patterns ?? []).length > 1}
                    crossDayEntries={i === 0 ? crossDayEntries : undefined}
                  />
                ))}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PatternSection({
  pattern,
  showLabel,
  crossDayEntries,
}: {
  pattern: DayPatternResponse;
  showLabel: boolean;
  crossDayEntries?: CrossDayEntry[];
}) {
  const schedules = pattern.schedules ?? [];
  const merged = buildMergedTimeline(schedules, crossDayEntries);

  return (
    <div className={showLabel ? "mt-3" : ""}>
      {showLabel && (
        <p className="mb-2 text-sm font-medium text-muted-foreground">{pattern.label}</p>
      )}
      {merged.length === 0 ? (
        <p className="py-2 text-center text-sm text-muted-foreground">まだ予定がありません</p>
      ) : (
        <div className="space-y-2">
          {merged.map((item) =>
            item.type === "crossDay" ? (
              <ScheduleCard
                key={`cross-${item.entry.schedule.id}`}
                schedule={item.entry.schedule}
                crossDayDisplay
              />
            ) : (
              <ScheduleCard key={item.schedule.id} schedule={item.schedule} />
            ),
          )}
        </div>
      )}
    </div>
  );
}

/** Read-only schedule card for the public shared view (no edit/delete actions). */
function ScheduleCard({
  schedule,
  crossDayDisplay,
}: {
  schedule: ScheduleResponse;
  crossDayDisplay?: boolean;
}) {
  const CategoryIcon = CATEGORY_ICONS[schedule.category];
  const colorClasses = SCHEDULE_COLOR_CLASSES[schedule.color ?? "blue"];
  const transportLabel =
    schedule.transportMethod && schedule.transportMethod in TRANSPORT_METHOD_LABELS
      ? TRANSPORT_METHOD_LABELS[schedule.transportMethod as TransportMethod]
      : schedule.transportMethod;

  const displayTime = crossDayDisplay ? schedule.endTime : schedule.startTime;
  const showEndTime = !crossDayDisplay && !schedule.endDayOffset && schedule.endTime;

  return (
    <div
      className={cn(
        "cursor-default rounded-md border p-3",
        crossDayDisplay && "border-dashed bg-muted/30",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <div
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white",
            colorClasses.bg,
          )}
        >
          <CategoryIcon className="h-3 w-3" />
        </div>
        <span className="font-medium">{schedule.name}</span>
        {displayTime && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {crossDayDisplay ? "~ " : ""}
            {displayTime.slice(0, 5)}
            {showEndTime && ` - ${schedule.endTime!.slice(0, 5)}`}
            {!crossDayDisplay && schedule.endDayOffset != null && schedule.endDayOffset > 0 && " ~"}
          </span>
        )}
      </div>
      {schedule.category === "transport" &&
        (schedule.departurePlace || schedule.arrivalPlace || transportLabel) && (
          <p className="mt-1 text-xs text-muted-foreground">
            {crossDayDisplay
              ? schedule.arrivalPlace && `→ ${schedule.arrivalPlace}`
              : schedule.departurePlace && schedule.arrivalPlace
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
      {schedule.url && (
        <a
          href={schedule.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 block truncate text-xs text-blue-600 hover:underline"
        >
          {schedule.url}
        </a>
      )}
      {schedule.memo && <p className="mt-1 text-sm text-muted-foreground">{schedule.memo}</p>}
    </div>
  );
}
