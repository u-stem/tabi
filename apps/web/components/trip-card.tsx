"use client";

import type { MemberRole, TripListItem, TripStatus } from "@tabi/shared";
import { ROLE_LABELS, STATUS_LABELS } from "@tabi/shared";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SelectionIndicator } from "@/components/ui/selection-indicator";
import { SELECTED_RING } from "@/lib/colors";
import { formatDateRange, getDayCount } from "@/lib/format";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<TripStatus, string> = {
  draft: "bg-gray-200 text-gray-800 border-gray-300",
  planned: "bg-blue-100 text-blue-800 border-blue-300",
  active: "bg-green-100 text-green-800 border-green-300",
  completed: "bg-purple-100 text-purple-800 border-purple-300",
};

const ROLE_COLORS: Record<MemberRole, string> = {
  owner: "bg-amber-100 text-amber-800 border-amber-300",
  editor: "bg-sky-100 text-sky-800 border-sky-300",
  viewer: "bg-slate-100 text-slate-700 border-slate-300",
};

type TripCardProps = TripListItem & {
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (id: string) => void;
};

export function TripCard({
  id,
  title,
  destination,
  startDate,
  endDate,
  status,
  role,
  totalSchedules,
  selectable = false,
  selected = false,
  onSelect,
}: TripCardProps) {
  const dayCount = getDayCount(startDate, endDate);
  const showRole = role !== "owner";

  const inner = (
    <>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {selectable && <SelectionIndicator checked={selected} />}
            <CardTitle className="text-lg">{title}</CardTitle>
          </div>
          <div className="flex items-center gap-1.5">
            {showRole && (
              <Badge variant="outline" className={cn("text-xs", ROLE_COLORS[role])}>
                {ROLE_LABELS[role]}
              </Badge>
            )}
            <Badge variant="outline" className={STATUS_COLORS[status]}>
              {STATUS_LABELS[status]}
            </Badge>
          </div>
        </div>
        <CardDescription>{destination}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          {formatDateRange(startDate, endDate)} ({dayCount}日間)
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {totalSchedules > 0 ? `${totalSchedules}件の予定` : "予定なし"}
        </p>
      </CardContent>
    </>
  );

  if (selectable) {
    return (
      <button
        type="button"
        onClick={() => onSelect?.(id)}
        aria-pressed={selected}
        className="group block w-full text-left focus-visible:outline-none"
      >
        <Card
          className={cn(
            "transition-colors hover:bg-accent/50 group-focus-visible:border-ring group-focus-visible:ring-2 group-focus-visible:ring-ring",
            selected && SELECTED_RING,
          )}
        >
          {inner}
        </Card>
      </button>
    );
  }

  return (
    <Link href={`/trips/${id}`} className="group block focus-visible:outline-none">
      <Card className="transition-colors hover:bg-accent/50 group-focus-visible:border-ring group-focus-visible:ring-2 group-focus-visible:ring-ring">
        {inner}
      </Card>
    </Link>
  );
}
