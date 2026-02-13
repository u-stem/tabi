"use client";

import type { TripListItem } from "@sugara/shared";
import { ROLE_LABELS, STATUS_LABELS } from "@sugara/shared";
import { Copy, ExternalLink, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SelectionIndicator } from "@/components/ui/selection-indicator";
import { ROLE_COLORS, SELECTED_RING, STATUS_COLORS } from "@/lib/colors";
import { formatDateRange, getDayCount } from "@/lib/format";
import { useLongPress } from "@/lib/hooks/use-long-press";
import { cn } from "@/lib/utils";

type TripCardProps = TripListItem & {
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onDelete?: (id: string) => void;
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
  onDuplicate,
  onDelete,
}: TripCardProps) {
  const dayCount = getDayCount(startDate, endDate);
  const showRole = role !== "owner";
  const [contextOpen, setContextOpen] = useState(false);

  const handleLongPress = useCallback(() => {
    if (selectable || (!onDuplicate && !onDelete)) return;
    setContextOpen(true);
  }, [selectable, onDuplicate, onDelete]);

  const longPressHandlers = useLongPress({ onLongPress: handleLongPress });

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (selectable || (!onDuplicate && !onDelete)) return;
      e.preventDefault();
      setContextOpen(true);
    },
    [selectable, onDuplicate, onDelete],
  );

  const inner = (
    <>
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
        <CardDescription className="truncate">{destination}</CardDescription>
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
    <div className="relative">
      <Link
        href={`/trips/${id}`}
        className="group block select-none focus-visible:outline-none"
        style={{ WebkitTouchCallout: "none" }}
        onContextMenu={handleContextMenu}
        {...longPressHandlers}
      >
        <Card className="transition-colors hover:bg-accent/50 active:scale-[0.98] sm:active:scale-100 group-focus-visible:border-ring group-focus-visible:ring-2 group-focus-visible:ring-ring">
          {inner}
        </Card>
      </Link>
      <DropdownMenu open={contextOpen} onOpenChange={setContextOpen}>
        {/* Hidden trigger centered on card -- menu is controlled by long-press state only */}
        <DropdownMenuTrigger
          className="pointer-events-none absolute left-1/2 top-1/2 h-0 w-0 opacity-0"
          tabIndex={-1}
        />
        <DropdownMenuContent align="center">
          <DropdownMenuItem asChild>
            <Link href={`/trips/${id}`}>
              <ExternalLink className="h-4 w-4" />
              開く
            </Link>
          </DropdownMenuItem>
          {onDuplicate && (
            <DropdownMenuItem onClick={() => onDuplicate(id)}>
              <Copy className="h-4 w-4" />
              複製
            </DropdownMenuItem>
          )}
          {onDelete && (
            <DropdownMenuItem
              onClick={() => onDelete(id)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              削除
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
