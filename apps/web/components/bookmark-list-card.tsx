"use client";

import type { BookmarkListResponse } from "@sugara/shared";
import Link from "next/link";
import { memo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SelectionIndicator } from "@/components/ui/selection-indicator";
import { SELECTED_RING } from "@/lib/colors";
import { cn } from "@/lib/utils";

type BookmarkListCardProps = BookmarkListResponse & {
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (id: string) => void;
};

export const BookmarkListCard = memo(function BookmarkListCard({
  id,
  name,
  visibility,
  bookmarkCount,
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
            {visibility === "public"
              ? "公開"
              : visibility === "friends_only"
                ? "フレンド限定"
                : "非公開"}
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
    <Link href={`/bookmarks/${id}`} className="group block focus-visible:outline-none">
      <Card className="transition-colors hover:bg-accent/50 group-focus-visible:border-ring group-focus-visible:ring-2 group-focus-visible:ring-ring">
        {inner}
      </Card>
    </Link>
  );
});
