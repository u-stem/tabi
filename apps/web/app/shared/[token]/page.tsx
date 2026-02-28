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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, ExternalLink, MapPin, RefreshCw, Route, StickyNote } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Logo } from "@/components/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, api } from "@/lib/api";
import { SCHEDULE_COLOR_CLASSES, STATUS_COLORS } from "@/lib/colors";
import { getCrossDayEntries } from "@/lib/cross-day";
import { getCrossDayLabel, getStartDayLabel } from "@/lib/cross-day-label";
import {
  formatDate,
  formatDateFromISO,
  formatDateRange,
  getDayCount,
  isSafeUrl,
  stripProtocol,
} from "@/lib/format";
import { useDelayedLoading } from "@/lib/hooks/use-delayed-loading";
import { CATEGORY_ICONS } from "@/lib/icons";
import { buildMergedTimeline } from "@/lib/merge-timeline";
import { MSG } from "@/lib/messages";
import { queryKeys } from "@/lib/query-keys";
import { supabase } from "@/lib/supabase";
import { buildMapsSearchUrl, buildTransportUrl } from "@/lib/transport-link";
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
  const token = typeof params.token === "string" ? params.token : null;
  const queryClient = useQueryClient();
  const [hasUpdate, setHasUpdate] = useState(false);

  const {
    data: trip,
    isLoading,
    error: queryError,
  } = useQuery({
    queryKey: queryKeys.shared.trip(token ?? ""),
    queryFn: () => api<SharedTripResponse>(`/api/shared/${token}`),
    enabled: token !== null,
  });

  const showSkeleton = useDelayedLoading(isLoading);

  // Derive error message from query error
  const error =
    queryError instanceof ApiError && queryError.status === 404
      ? MSG.SHARED_LINK_INVALID
      : queryError
        ? MSG.SHARED_TRIP_FETCH_FAILED
        : null;

  function handleRefresh() {
    setHasUpdate(false);
    queryClient.invalidateQueries({ queryKey: queryKeys.shared.trip(token ?? "") });
  }

  // Subscribe to broadcast updates
  useEffect(() => {
    if (!trip?.id) return;
    const tripId = trip.id;
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

  if (showSkeleton) {
    return (
      <div className="min-h-screen">
        <SharedHeader />
        <div className="container max-w-3xl py-8">
          {/* Hero skeleton */}
          <div className="mb-8 rounded-xl border bg-card px-6 py-6 shadow-sm">
            <Skeleton className="mb-3 h-5 w-16 rounded-full" />
            <Skeleton className="h-8 w-56" />
            <div className="mt-3 flex items-center gap-4">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-36" />
            </div>
          </div>
          {/* Day card skeletons */}
          <div className="space-y-6">
            {[1, 2].map((day) => (
              <div key={day} className="overflow-hidden rounded-xl border bg-card shadow-sm">
                <div className="border-b bg-muted/40 px-4 py-3 sm:px-5">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-6 w-6 rounded-full" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </div>
                <div className="space-y-2 p-4 sm:p-5">
                  {[1, 2].map((s) => (
                    <div key={s} className="flex items-start gap-3 rounded-lg px-3 py-2.5">
                      <Skeleton className="h-5 w-5 rounded-md" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-3 w-28" />
                      </div>
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

  // Avoid flashing error/not-found during the 200ms skeleton delay
  if (isLoading) {
    return (
      <div className="min-h-screen">
        <SharedHeader />
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
        <div className="sticky top-0 z-10 border-b bg-blue-50 px-4 py-2 text-center dark:bg-blue-950">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-blue-700 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200"
            onClick={handleRefresh}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            内容が更新されました。タップして最新を表示
          </Button>
        </div>
      )}
      <div className="container max-w-3xl py-8">
        {/* Hero */}
        <div className="mb-8 rounded-xl border bg-card px-6 py-6 shadow-sm">
          <Badge variant="outline" className={cn("mb-3 w-fit", STATUS_COLORS[trip.status])}>
            {STATUS_LABELS[trip.status]}
          </Badge>
          <h1 className="break-words text-2xl font-bold sm:text-3xl">{trip.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
            {trip.destination && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4 shrink-0" />
                {trip.destination}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4 shrink-0" />
              {formatDateRange(trip.startDate, trip.endDate)}
              <span className="text-xs">（{dayCount}日間）</span>
            </span>
          </div>
          {trip.shareExpiresAt && (
            <p className="mt-3 text-xs text-muted-foreground">
              共有リンクの有効期限: {formatDateFromISO(trip.shareExpiresAt)}
            </p>
          )}
        </div>
        <div className="space-y-6">
          {(trip.days ?? []).map((day) => {
            const crossDayEntries = getCrossDayEntries(trip.days ?? [], day.dayNumber);
            return (
              <section key={day.id} className="overflow-hidden rounded-xl border bg-card shadow-sm">
                <div className="border-b bg-muted/40 px-4 py-3 sm:px-5">
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-foreground text-[11px] font-bold text-background">
                      {day.dayNumber}
                    </span>
                    <span>{formatDate(day.date)}</span>
                    <span className="text-muted-foreground">
                      {(() => {
                        const d = new Date(day.date);
                        return ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
                      })()}曜日
                    </span>
                  </h3>
                </div>
                <div className="p-4 sm:p-5">
                  {(day.patterns ?? []).map((pattern, i) => (
                    <PatternSection
                      key={pattern.id}
                      pattern={pattern}
                      dayDate={day.date}
                      showLabel={(day.patterns ?? []).length > 1}
                      crossDayEntries={i === 0 ? crossDayEntries : undefined}
                    />
                  ))}
                  {day.memo && (
                    <div className="mt-3 flex items-start gap-2 border-t pt-3 text-sm text-muted-foreground">
                      <StickyNote className="mt-0.5 h-4 w-4 shrink-0" />
                      <p className="whitespace-pre-line">{day.memo}</p>
                    </div>
                  )}
                </div>
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
  dayDate,
  showLabel,
  crossDayEntries,
}: {
  pattern: DayPatternResponse;
  dayDate: string;
  showLabel: boolean;
  crossDayEntries?: CrossDayEntry[];
}) {
  const schedules = pattern.schedules ?? [];
  const merged = buildMergedTimeline(schedules, crossDayEntries);

  return (
    <div className={showLabel ? "mt-4 border-t pt-3" : ""}>
      {showLabel && (
        <p className="mb-2 text-sm font-medium text-muted-foreground">{pattern.label}</p>
      )}
      {merged.length === 0 ? (
        <p className="py-2 text-center text-sm text-muted-foreground">まだ予定がありません</p>
      ) : (
        <div className="relative space-y-1">
          {/* Vertical timeline line */}
          {merged.length > 1 && (
            <div className="absolute left-[11px] top-4 bottom-4 w-px bg-border" aria-hidden />
          )}
          {merged.map((item) =>
            item.type === "crossDay" ? (
              <ScheduleCard
                key={`cross-${item.entry.schedule.id}`}
                schedule={item.entry.schedule}
                dayDate={dayDate}
                crossDayDisplay
                crossDayPosition={item.entry.crossDayPosition}
              />
            ) : (
              <ScheduleCard key={item.schedule.id} schedule={item.schedule} dayDate={dayDate} />
            ),
          )}
        </div>
      )}
    </div>
  );
}

/** Compact read-only schedule row for the public shared view. */
function ScheduleCard({
  schedule,
  dayDate,
  crossDayDisplay,
  crossDayPosition,
}: {
  schedule: ScheduleResponse;
  dayDate: string;
  crossDayDisplay?: boolean;
  crossDayPosition?: "intermediate" | "final";
}) {
  const CategoryIcon = CATEGORY_ICONS[schedule.category];
  const colorClasses = SCHEDULE_COLOR_CLASSES[schedule.color ?? "blue"];
  const transportLabel =
    schedule.transportMethod && schedule.transportMethod in TRANSPORT_METHOD_LABELS
      ? TRANSPORT_METHOD_LABELS[schedule.transportMethod as TransportMethod]
      : schedule.transportMethod;

  const displayTime = crossDayDisplay ? schedule.endTime : schedule.startTime;
  const showEndTime = !crossDayDisplay && !schedule.endDayOffset && schedule.endTime;

  const roleLabel =
    crossDayDisplay && crossDayPosition
      ? getCrossDayLabel(schedule.category, crossDayPosition)
      : !crossDayDisplay && schedule.endDayOffset
        ? getStartDayLabel(schedule.category)
        : null;

  const safeUrls = schedule.urls.filter(isSafeUrl);

  const routeStr = crossDayDisplay
    ? schedule.arrivalPlace || ""
    : schedule.departurePlace && schedule.arrivalPlace
      ? `${schedule.departurePlace} → ${schedule.arrivalPlace}`
      : schedule.departurePlace || schedule.arrivalPlace || "";

  const transitUrl =
    schedule.departurePlace && schedule.arrivalPlace
      ? buildTransportUrl({
          from: schedule.departurePlace,
          to: schedule.arrivalPlace,
          method: schedule.transportMethod,
          date: dayDate,
          time: schedule.startTime,
        })
      : null;

  const hasDetails =
    (schedule.category === "transport" && (routeStr || transportLabel)) ||
    schedule.address ||
    safeUrls.length > 0 ||
    schedule.memo;

  return (
    <div
      className={cn(
        "relative flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors",
        crossDayDisplay ? "bg-muted/40" : "hover:bg-muted/30",
      )}
    >
      {/* Dot marker — aligns with the vertical line in PatternSection */}
      <div
        className={cn(
          "relative z-10 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-white",
          colorClasses.bg,
        )}
      >
        <CategoryIcon className="h-3 w-3" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="w-[5.5rem] shrink-0 text-xs tabular-nums text-muted-foreground">
            {displayTime && (
              <>
                {crossDayDisplay ? "~ " : ""}
                {displayTime.slice(0, 5)}
                {showEndTime && ` - ${schedule.endTime?.slice(0, 5)}`}
                {!crossDayDisplay && schedule.endDayOffset ? " ~" : ""}
              </>
            )}
          </span>
          <span className="break-words text-sm font-medium">{schedule.name}</span>
          {roleLabel && (
            <span className="rounded-sm bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">
              {roleLabel}
            </span>
          )}
        </div>

        {hasDetails && (
          <div className="mt-1 space-y-1 pl-24 text-xs text-muted-foreground">
            {schedule.category === "transport" && routeStr && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Route className="h-3 w-3 shrink-0 text-muted-foreground/70" />
                {transitUrl ? (
                  <a
                    href={transitUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {crossDayDisplay && schedule.arrivalPlace ? `→ ${routeStr}` : routeStr}
                  </a>
                ) : (
                  <span>
                    {crossDayDisplay && schedule.arrivalPlace ? `→ ${routeStr}` : routeStr}
                  </span>
                )}
                {transportLabel && <span className="shrink-0">({transportLabel})</span>}
              </span>
            )}
            {schedule.address && (
              <a
                href={buildMapsSearchUrl(schedule.address)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-fit max-w-full items-center gap-1.5 text-blue-600 hover:underline dark:text-blue-400"
              >
                <MapPin className="h-3 w-3 shrink-0 text-muted-foreground/70" />
                <span className="truncate">{schedule.address}</span>
              </a>
            )}
            {safeUrls.map((u) => (
              <a
                key={u}
                href={u}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-fit max-w-full items-center gap-1.5 text-blue-600 hover:underline dark:text-blue-400"
              >
                <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground/70" />
                <span className="truncate">{stripProtocol(u)}</span>
              </a>
            ))}
            {schedule.memo && (
              <div className="flex items-start gap-1.5">
                <StickyNote className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground/70" />
                <p className="whitespace-pre-line">{schedule.memo}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
