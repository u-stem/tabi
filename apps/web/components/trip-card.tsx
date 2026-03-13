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
  /** URL prefix for trip links. Defaults to "/trips". SP pages use "/sp/trips". */
  hrefPrefix?: string;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (id: string) => void;
  /** Pass true for the first visible card to avoid lazy-loading the LCP image. */
  priority?: boolean;
  unsettled?: boolean;
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
  hrefPrefix = "/trips",
  selectable = false,
  selected = false,
  onSelect,
  priority = false,
  unsettled = false,
}: TripCardProps) {
  const hasDates = startDate && endDate;
  const dayCount = hasDates ? getDayCount(startDate, endDate) : null;
  const showRole = role !== "owner";

  const inner = (
    <div className="flex flex-col">
      {coverImageUrl && (
        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-t-xl">
          <Image
            src={coverImageUrl}
            alt={`${title}のカバー画像`}
            fill
            priority={priority}
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
            {unsettled && (
              <Badge
                variant="outline"
                className="text-xs border-red-200 text-red-600 dark:border-red-800 dark:text-red-400"
              >
                未精算
              </Badge>
            )}
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
        <CardDescription className="truncate">{destination || "\u00A0"}</CardDescription>
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
            "transition-[colors,transform,box-shadow] hover:bg-accent/50 hover:shadow-md active:scale-[0.98] group-focus-visible:border-ring group-focus-visible:ring-2 group-focus-visible:ring-ring",
            selected && SELECTED_RING,
          )}
        >
          {inner}
        </Card>
      </button>
    );
  }

  return (
    <Link href={`${hrefPrefix}/${id}`} className="group block focus-visible:outline-none">
      <Card className="transition-[colors,transform,box-shadow] hover:bg-accent/50 hover:shadow-md active:scale-[0.98] group-focus-visible:border-ring group-focus-visible:ring-2 group-focus-visible:ring-ring">
        {inner}
      </Card>
    </Link>
  );
});
