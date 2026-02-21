"use client";

import type { TripListItem } from "@sugara/shared";
import { ROLE_LABELS, STATUS_LABELS } from "@sugara/shared";
import Image from "next/image";
import Link from "next/link";
import { memo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SelectionIndicator } from "@/components/ui/selection-indicator";
import { ROLE_COLORS, SELECTED_RING, STATUS_COLORS } from "@/lib/colors";
import { formatDateRange, getDayCount } from "@/lib/format";
import { cn } from "@/lib/utils";

type TripCardProps = TripListItem & {
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (id: string) => void;
};

export const TripCard = memo(function TripCard({
  id,
  title,
  destination,
  startDate,
  endDate,
  status,
  role,
  totalSchedules,
  coverImageUrl,
  coverImagePosition,
  selectable = false,
  selected = false,
  onSelect,
}: TripCardProps) {
  const hasDates = startDate && endDate;
  const dayCount = hasDates ? getDayCount(startDate, endDate) : null;
  const showRole = role !== "owner";

  const inner = (
    <div className="flex h-full flex-col">
      {coverImageUrl && (
        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-t-xl">
          <Image
            src={coverImageUrl}
            alt=""
            fill
            className="object-cover"
            style={{ objectPosition: `center ${coverImagePosition}%` }}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        </div>
      )}
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-2">
            {selectable && <SelectionIndicator checked={selected} />}
            <CardTitle className="truncate text-lg">{title}</CardTitle>
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
        {destination && <CardDescription className="truncate">{destination}</CardDescription>}
      </CardHeader>
      <CardContent className="mt-auto">
        <p className="text-sm text-muted-foreground">
          {hasDates ? `${formatDateRange(startDate, endDate)} (${dayCount}日間)` : "日程未定"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {totalSchedules > 0 ? `${totalSchedules}件の予定` : "予定なし"}
        </p>
      </CardContent>
    </div>
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
            "h-full transition-colors hover:bg-accent/50 group-focus-visible:border-ring group-focus-visible:ring-2 group-focus-visible:ring-ring",
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
      <Card className="h-full transition-colors hover:bg-accent/50 group-focus-visible:border-ring group-focus-visible:ring-2 group-focus-visible:ring-ring">
        {inner}
      </Card>
    </Link>
  );
});
