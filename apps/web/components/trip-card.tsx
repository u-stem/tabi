"use client";

import type { TripListItem, TripStatus } from "@tabi/shared";
import { STATUS_LABELS } from "@tabi/shared";
import { Check } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateRange, getDayCount } from "@/lib/format";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<TripStatus, string> = {
  draft: "bg-gray-100 text-gray-700 border-gray-200",
  planned: "bg-blue-50 text-blue-700 border-blue-200",
  active: "bg-green-50 text-green-700 border-green-200",
  completed: "bg-purple-50 text-purple-700 border-purple-200",
};

type TripCardProps = TripListItem & {
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (id: string) => void;
};

function SelectionIndicator({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-blue-500",
        checked && "bg-blue-500 text-white",
      )}
    >
      {checked && <Check className="h-3.5 w-3.5" />}
    </span>
  );
}

export function TripCard({
  id,
  title,
  destination,
  startDate,
  endDate,
  status,
  totalSpots,
  selectable = false,
  selected = false,
  onSelect,
}: TripCardProps) {
  const dayCount = getDayCount(startDate, endDate);

  const inner = (
    <>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {selectable && <SelectionIndicator checked={selected} />}
            <CardTitle className="text-lg">{title}</CardTitle>
          </div>
          <Badge variant="outline" className={STATUS_COLORS[status]}>
            {STATUS_LABELS[status]}
          </Badge>
        </div>
        <CardDescription>{destination}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          {formatDateRange(startDate, endDate)} ({dayCount}日間)
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {totalSpots > 0 ? `${totalSpots}件の予定` : "予定なし"}
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
            selected && "border-ring ring-2 ring-ring",
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
