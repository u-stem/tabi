"use client";

import type { TripResponse } from "@sugara/shared";
import { hashColor } from "@/components/presence-avatars";
import type { PresenceUser } from "@/lib/hooks/use-trip-sync";
import { cn } from "@/lib/utils";

export function DayTabs({
  days,
  selectedDay,
  onSelectDay,
  otherPresence,
}: {
  days: TripResponse["days"];
  selectedDay: number;
  onSelectDay: (index: number) => void;
  otherPresence: PresenceUser[];
}) {
  return (
    <div className="flex shrink-0 select-none border-b" role="tablist" aria-label="日程タブ">
      <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto px-4">
        {days.map((day, index) => (
          <button
            key={day.id}
            type="button"
            role="tab"
            aria-selected={selectedDay === index}
            aria-controls={`day-panel-${day.id}`}
            onClick={() => onSelectDay(index)}
            className={cn(
              "relative shrink-0 px-4 py-2 text-sm font-medium transition-colors",
              selectedDay === index
                ? "text-blue-600 dark:text-blue-400 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-blue-600 dark:after:bg-blue-400"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {day.dayNumber}日目
            {otherPresence
              .filter((u) => u.dayId === day.id)
              .slice(0, 3)
              .map((u, i) => (
                <span
                  key={u.userId}
                  className={cn("absolute top-1 h-1.5 w-1.5 rounded-full", hashColor(u.userId))}
                  style={{ right: `${4 + i * 6}px` }}
                />
              ))}
          </button>
        ))}
      </div>
    </div>
  );
}
