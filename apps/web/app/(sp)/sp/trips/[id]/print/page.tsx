"use client";

import type {
  CrossDayEntry,
  DayResponse,
  ScheduleResponse,
  TransportMethod,
  TripResponse,
} from "@sugara/shared";
import { CATEGORY_LABELS, TRANSPORT_METHOD_LABELS } from "@sugara/shared";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { LoadingBoundary } from "@/components/ui/loading-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { pageTitle } from "@/lib/constants";
import { getCrossDayEntries } from "@/lib/cross-day";
import { getCrossDayLabel, getStartDayLabel } from "@/lib/cross-day-label";
import { formatDate, formatDateRange, getDayCount } from "@/lib/format";
import { useAuthRedirect } from "@/lib/hooks/use-auth-redirect";
import { buildMergedTimeline } from "@/lib/merge-timeline";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";

function PrintSkeleton() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-4xl space-y-8 p-8">
        {["day-1", "day-2", "day-3"].map((key) => (
          <div key={key} className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SpTripPrintPage() {
  const tm = useTranslations("messages");
  const params = useParams();
  const searchParams = useSearchParams();
  const tripId = typeof params.id === "string" ? params.id : null;

  const {
    data: trip,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.trips.detail(tripId ?? ""),
    queryFn: () => api<TripResponse>(`/api/trips/${tripId}`),
    enabled: tripId !== null,
  });
  useAuthRedirect(error);

  useEffect(() => {
    if (trip) {
      document.title = pageTitle(`${trip.title}（印刷）`);
    }
  }, [trip?.title]);

  useEffect(() => {
    if (!trip || searchParams.get("auto") !== "1") return;
    const timer = setTimeout(() => window.print(), 500);
    return () => clearTimeout(timer);
  }, [trip, searchParams]);

  return (
    <LoadingBoundary isLoading={isLoading} skeleton={<PrintSkeleton />}>
      {error || !trip ? (
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-destructive">{tm("tripFetchFailed")}</p>
        </div>
      ) : (
        <div className="mx-auto max-w-3xl px-6 py-8 print:max-w-none print:px-0 print:py-0">
          <header className="mb-6 print:mb-4">
            <div className="flex items-center gap-2">
              <Link
                href={`/sp/trips/${tripId}`}
                className="shrink-0 text-muted-foreground print:hidden"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <h1 className="flex-1 truncate text-lg font-semibold print:text-xl print:font-semibold">
                {trip.title}
              </h1>
              <Button size="sm" className="shrink-0 print:hidden" onClick={() => window.print()}>
                <Printer className="h-4 w-4" />
                印刷
              </Button>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              <span className="mr-3">{trip.destination}</span>
              {trip.startDate && trip.endDate && (
                <>
                  {formatDateRange(trip.startDate, trip.endDate)}
                  <span className="ml-1">({getDayCount(trip.startDate, trip.endDate)}日間)</span>
                </>
              )}
            </p>
          </header>

          <div className="space-y-5 print:space-y-3">
            {trip.days.map((day) => {
              const crossDayEntries = getCrossDayEntries(trip.days, day.dayNumber);
              return <DaySection key={day.id} day={day} crossDayEntries={crossDayEntries} />;
            })}
          </div>
        </div>
      )}
    </LoadingBoundary>
  );
}

function DaySection({
  day,
  crossDayEntries,
}: {
  day: DayResponse;
  crossDayEntries: CrossDayEntry[];
}) {
  const tm = useTranslations("messages");
  const showPatternLabels = day.patterns.length > 1;

  return (
    <section>
      <h2 className="mb-1.5 flex items-baseline gap-2 border-b pb-1.5 text-sm font-semibold print:font-medium">
        {day.dayNumber}日目
        <span className="text-xs font-normal text-muted-foreground">{formatDate(day.date)}</span>
      </h2>
      {day.patterns.map((pattern, i) => {
        const merged = buildMergedTimeline(
          pattern.schedules,
          i === 0 ? crossDayEntries : undefined,
        );
        return (
          <div key={pattern.id}>
            {showPatternLabels && (
              <p
                className={cn(
                  "mb-1 text-xs font-medium text-muted-foreground",
                  i > 0 ? "mt-4 print:mt-3" : "mt-1",
                )}
              >
                {pattern.label}
              </p>
            )}
            {merged.length === 0 ? (
              <p className="py-2 text-center text-xs text-muted-foreground">
                {tm("emptySchedule")}
              </p>
            ) : (
              <div className="overflow-x-auto print:overflow-visible">
                <table className="w-full min-w-[600px] table-fixed border-collapse text-xs print:min-w-0 print:text-[11px]">
                  <colgroup>
                    <col className="w-[15%]" />
                    <col className="w-[45%]" />
                    <col className="w-[40%]" />
                  </colgroup>
                  {i === 0 || showPatternLabels ? (
                    <thead>
                      <tr className="text-left text-[10px] text-muted-foreground">
                        <th className="py-1 pr-2 font-medium">時間</th>
                        <th className="py-1 pr-2 font-medium">名前</th>
                        <th className="py-1 font-medium">メモ</th>
                      </tr>
                    </thead>
                  ) : null}
                  <tbody>
                    {merged.map((item) => (
                      <PrintTableRow
                        key={
                          item.type === "crossDay"
                            ? `cross-${item.entry.schedule.id}`
                            : item.schedule.id
                        }
                        schedule={item.type === "crossDay" ? item.entry.schedule : item.schedule}
                        crossDayDisplay={item.type === "crossDay"}
                        crossDayPosition={
                          item.type === "crossDay" ? item.entry.crossDayPosition : undefined
                        }
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}

function PrintTableRow({
  schedule,
  crossDayDisplay,
  crossDayPosition,
}: {
  schedule: ScheduleResponse;
  crossDayDisplay?: boolean;
  crossDayPosition?: "intermediate" | "final";
}) {
  const displayTime = crossDayDisplay ? schedule.endTime : schedule.startTime;
  const showEndTime = !crossDayDisplay && !schedule.endDayOffset && schedule.endTime;
  const timeStr = displayTime
    ? `${crossDayDisplay ? "~ " : ""}${displayTime.slice(0, 5)}${showEndTime ? ` - ${schedule.endTime?.slice(0, 5)}` : ""}${!crossDayDisplay && schedule.endDayOffset ? " ~" : ""}`
    : "";

  const roleLabel =
    crossDayDisplay && crossDayPosition
      ? getCrossDayLabel(schedule.category, crossDayPosition)
      : !crossDayDisplay && schedule.endDayOffset
        ? getStartDayLabel(schedule.category)
        : null;

  const transportLabel =
    schedule.transportMethod && schedule.transportMethod in TRANSPORT_METHOD_LABELS
      ? TRANSPORT_METHOD_LABELS[schedule.transportMethod as TransportMethod]
      : schedule.transportMethod;

  const routeStr =
    schedule.category === "transport"
      ? [
          crossDayDisplay
            ? schedule.arrivalPlace && `→ ${schedule.arrivalPlace}`
            : schedule.departurePlace && schedule.arrivalPlace
              ? `${schedule.departurePlace} → ${schedule.arrivalPlace}`
              : schedule.departurePlace || schedule.arrivalPlace,
          transportLabel && `(${transportLabel})`,
        ]
          .filter(Boolean)
          .join(" ")
      : null;

  return (
    <tr
      className={cn(
        "border-b border-dotted last:border-b-0",
        crossDayDisplay && "text-muted-foreground",
      )}
    >
      <td className="whitespace-nowrap py-1 pr-2 align-top tabular-nums">{timeStr}</td>
      <td className="overflow-hidden py-1 pr-2 align-top">
        <div className="truncate print:whitespace-normal print:overflow-visible">
          <span>{schedule.name}</span>
          {roleLabel && <span className="ml-1 text-muted-foreground">({roleLabel})</span>}
          <span className="ml-1 text-muted-foreground">{CATEGORY_LABELS[schedule.category]}</span>
        </div>
        {routeStr && (
          <div className="truncate print:whitespace-normal print:overflow-visible text-muted-foreground">
            {routeStr}
          </div>
        )}
        {schedule.address && (
          <div className="truncate print:whitespace-normal print:overflow-visible text-muted-foreground">
            {schedule.address}
          </div>
        )}
      </td>
      <td className="whitespace-pre-line py-1 align-top text-muted-foreground">
        {schedule.memo || ""}
      </td>
    </tr>
  );
}
