"use client";

import type { TripListItem } from "@tabi/shared";
import { STATUS_LABELS } from "@tabi/shared";
import { Check } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateRange, getDayCount } from "@/lib/format";
import { cn } from "@/lib/utils";

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
        "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-primary",
        checked && "bg-primary text-primary-foreground",
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
          <Badge variant="secondary">{STATUS_LABELS[status]}</Badge>
        </div>
        <CardDescription>{destination}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          {formatDateRange(startDate, endDate)} ({dayCount}日間)
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {totalSpots > 0 ? `${totalSpots}件のスポット` : "スポット未登録"}
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
        className="block w-full rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <Card
          className={cn(
            "transition-colors hover:bg-accent/50",
            selected && "ring-2 ring-primary",
          )}
        >
          {inner}
        </Card>
      </button>
    );
  }

  return (
    <Link
      href={`/trips/${id}`}
      className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <Card className="transition-colors hover:bg-accent/50">
        {inner}
      </Card>
    </Link>
  );
}
