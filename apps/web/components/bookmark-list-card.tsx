"use client";

import { type BookmarkListResponse, VISIBILITY_LABELS } from "@sugara/shared";
import Link from "next/link";
import { memo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SelectionIndicator } from "@/components/ui/selection-indicator";
import { SELECTED_RING } from "@/lib/colors";
import { cn } from "@/lib/utils";

type BookmarkListCardProps = BookmarkListResponse & {
  /** URL prefix for bookmark list links. Defaults to "/bookmarks". SP pages use "/sp/bookmarks". */
  hrefPrefix?: string;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (id: string) => void;
};

export const BookmarkListCard = memo(function BookmarkListCard({
  id,
  name,
  visibility,
  bookmarkCount,
  hrefPrefix = "/bookmarks",
  selectable = false,
  selected = false,
  onSelect,
}: BookmarkListCardProps) {
  const inner = (
    <>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-2">
            {selectable && <SelectionIndicator checked={selected} />}
            <CardTitle className="truncate text-lg">{name}</CardTitle>
          </div>
          <Badge
            variant={
              visibility === "public"
                ? "default"
                : visibility === "friends_only"
                  ? "secondary"
                  : "outline"
            }
            className="text-xs"
          >
            {VISIBILITY_LABELS[visibility]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          {bookmarkCount > 0 ? `${bookmarkCount}件のブックマーク` : "ブックマークなし"}
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
            "transition-[colors,transform,box-shadow] hover:bg-accent/50 hover:shadow-md lg:active:scale-[0.98] group-focus-visible:border-ring group-focus-visible:ring-2 group-focus-visible:ring-ring",
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
      <Card className="transition-[colors,transform,box-shadow] hover:bg-accent/50 hover:shadow-md lg:active:scale-[0.98] group-focus-visible:border-ring group-focus-visible:ring-2 group-focus-visible:ring-ring">
        {inner}
      </Card>
    </Link>
  );
});
