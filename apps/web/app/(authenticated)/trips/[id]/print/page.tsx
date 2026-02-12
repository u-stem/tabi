"use client";

import type {
  CrossDayEntry,
  DayPatternResponse,
  DayResponse,
  ScheduleResponse,
  TransportMethod,
  TripResponse,
} from "@sugara/shared";
import { CATEGORY_LABELS, TRANSPORT_METHOD_LABELS } from "@sugara/shared";
import { Clock, MapPin, Printer } from "lucide-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { ApiError, api } from "@/lib/api";
import { getCrossDayEntries } from "@/lib/cross-day";
import { formatDate, formatDateRange, getDayCount } from "@/lib/format";
import { CATEGORY_ICONS } from "@/lib/icons";
import { buildMergedTimeline } from "@/lib/merge-timeline";
import { MSG } from "@/lib/messages";
import { cn } from "@/lib/utils";

export default function TripPrintPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
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
      setError(MSG.TRIP_FETCH_FAILED);
    } finally {
      setLoading(false);
    }
  }, [tripId, router]);

  useEffect(() => {
    fetchTrip();
  }, [fetchTrip]);

  useEffect(() => {
    if (trip) {
      document.title = `${trip.title}（印刷） - sugara`;
    }
  }, [trip?.title]);

  useEffect(() => {
    if (!trip || searchParams.get("auto") !== "1") return;
    // Allow a brief render before triggering print
    const timer = setTimeout(() => window.print(), 500);
    return () => clearTimeout(timer);
  }, [trip, searchParams]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">読み込み中...</p>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-destructive">{error ?? MSG.TRIP_NOT_FOUND}</p>
      </div>
    );
  }

  const dayCount = getDayCount(trip.startDate, trip.endDate);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 print:px-0 print:py-0">
      <div className="mb-6 print:hidden">
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          印刷 / PDF保存
        </Button>
      </div>

      <header className="mb-8">
        <h1 className="text-2xl font-bold print:font-normal">{trip.title}</h1>
        <p className="mt-1 text-muted-foreground">
          <span className="mr-3">{trip.destination}</span>
          {formatDateRange(trip.startDate, trip.endDate)}
          <span className="ml-2 text-sm">({dayCount}日間)</span>
        </p>
      </header>

      <div className="space-y-6">
        {trip.days.map((day) => {
          const crossDayEntries = getCrossDayEntries(trip.days, day.dayNumber);
          return <DaySection key={day.id} day={day} crossDayEntries={crossDayEntries} />;
        })}
      </div>
    </div>
  );
}

function DaySection({
  day,
  crossDayEntries,
}: {
  day: DayResponse;
  crossDayEntries: CrossDayEntry[];
}) {
  return (
    <section className="break-inside-avoid rounded-lg border bg-card p-4 sm:p-5">
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold print:font-normal">
        {day.dayNumber}日目
        <span className="text-sm font-normal text-muted-foreground">{formatDate(day.date)}</span>
      </h2>
      {day.patterns.map((pattern, i) => (
        <PrintPatternSection
          key={pattern.id}
          pattern={pattern}
          showLabel={day.patterns.length > 1}
          crossDayEntries={i === 0 ? crossDayEntries : undefined}
        />
      ))}
    </section>
  );
}

function PrintPatternSection({
  pattern,
  showLabel,
  crossDayEntries,
}: {
  pattern: DayPatternResponse;
  showLabel: boolean;
  crossDayEntries?: CrossDayEntry[];
}) {
  const merged = buildMergedTimeline(pattern.schedules, crossDayEntries);

  return (
    <div className={showLabel ? "mt-3" : ""}>
      {showLabel && (
        <p className="mb-2 text-sm font-medium print:font-normal text-muted-foreground">
          {pattern.label}
        </p>
      )}
      {merged.length === 0 ? (
        <p className="py-2 text-center text-sm text-muted-foreground">まだ予定がありません</p>
      ) : (
        <div className="space-y-2">
          {merged.map((item) =>
            item.type === "crossDay" ? (
              <PrintScheduleCard
                key={`cross-${item.entry.schedule.id}`}
                schedule={item.entry.schedule}
                crossDayDisplay
              />
            ) : (
              <PrintScheduleCard key={item.schedule.id} schedule={item.schedule} />
            ),
          )}
        </div>
      )}
    </div>
  );
}

function PrintScheduleCard({
  schedule,
  crossDayDisplay,
}: {
  schedule: ScheduleResponse;
  crossDayDisplay?: boolean;
}) {
  const CategoryIcon = CATEGORY_ICONS[schedule.category];
  const transportLabel =
    schedule.transportMethod && schedule.transportMethod in TRANSPORT_METHOD_LABELS
      ? TRANSPORT_METHOD_LABELS[schedule.transportMethod as TransportMethod]
      : schedule.transportMethod;

  const displayTime = crossDayDisplay ? schedule.endTime : schedule.startTime;
  const showEndTime = !crossDayDisplay && !schedule.endDayOffset && schedule.endTime;

  return (
    <div className={cn("rounded-md border p-3", crossDayDisplay && "border-dashed bg-muted/30")}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-foreground text-foreground">
          <CategoryIcon className="h-3 w-3" />
        </div>
        <span className="font-medium print:font-normal">{schedule.name}</span>
        <span className="text-xs text-muted-foreground">{CATEGORY_LABELS[schedule.category]}</span>
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
      {schedule.memo && <p className="mt-1 text-sm text-muted-foreground">{schedule.memo}</p>}
    </div>
  );
}
