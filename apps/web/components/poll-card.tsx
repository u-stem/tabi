"use client";

import type { PollListItem } from "@sugara/shared";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { CalendarDays, Users } from "lucide-react";
import Link from "next/link";
import { memo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SelectionIndicator } from "@/components/ui/selection-indicator";
import { SELECTED_RING } from "@/lib/colors";
import { cn } from "@/lib/utils";

const STATUS_CONFIG = {
  open: {
    label: "日程調整中",
    className:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800",
  },
  confirmed: {
    label: "確定済み",
    className:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  },
  closed: {
    label: "終了",
    className:
      "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400 border-gray-200 dark:border-gray-800",
  },
} as const;

type PollCardProps = PollListItem & {
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (id: string) => void;
};

export const PollCard = memo(function PollCard({
  selectable = false,
  selected = false,
  onSelect,
  ...poll
}: PollCardProps) {
  const status = STATUS_CONFIG[poll.status];

  const inner = (
    <>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-2">
            {selectable && <SelectionIndicator checked={selected} />}
            <CardTitle className="text-base">{poll.title}</CardTitle>
          </div>
          <Badge variant="outline" className={status.className}>
            {status.label}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{poll.destination}</p>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {poll.respondedCount}/{poll.participantCount}人回答済み
          </span>
          {poll.deadline && (
            <span className="flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" />
              {format(new Date(poll.deadline), "M/d", { locale: ja })}まで
            </span>
          )}
        </div>
      </CardContent>
    </>
  );

  if (selectable) {
    return (
      <button
        type="button"
        onClick={() => onSelect?.(poll.id)}
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
    <Link href={`/polls/${poll.id}`} className="group block focus-visible:outline-none">
      <Card className="transition-colors hover:bg-accent/50 group-focus-visible:border-ring group-focus-visible:ring-2 group-focus-visible:ring-ring">
        {inner}
      </Card>
    </Link>
  );
});
