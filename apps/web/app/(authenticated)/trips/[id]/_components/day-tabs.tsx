"use client";

import type { TripResponse } from "@sugara/shared";
import { hashColor } from "@/components/presence-avatars";
import type { PresenceUser } from "@/lib/hooks/use-trip-sync";
import { cn } from "@/lib/utils";

const CHIP_BASE =
  "relative shrink-0 flex items-center justify-center rounded-full px-3.5 py-1.5 text-sm font-medium transition-[colors,transform] min-h-[44px] lg:min-h-0 active:scale-[0.95]";
const CHIP_ACTIVE = "bg-muted text-foreground";
const CHIP_INACTIVE = "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground";

/** selectedDay: -1 = poll tab, 0+ = day index */
export function DayTabs({
  days,
  selectedDay,
  onSelectDay,
  otherPresence,
  hasPoll,
}: {
  days: TripResponse["days"];
  selectedDay: number;
  onSelectDay: (index: number) => void;
  otherPresence: PresenceUser[];
  hasPoll?: boolean;
}) {
  return (
    <div className="flex shrink-0 select-none" role="tablist" aria-label="日程タブ">
      <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-3 pb-0 pt-3">
        {hasPoll && (
          <button
            type="button"
            role="tab"
            aria-selected={selectedDay === -1}
            onClick={() => onSelectDay(-1)}
            className={cn(CHIP_BASE, selectedDay === -1 ? CHIP_ACTIVE : CHIP_INACTIVE)}
          >
            日程調整
            {otherPresence
              .filter((u) => u.dayId === "poll")
              .slice(0, 3)
              .map((u, i) => (
                <span
                  key={u.userId}
                  className={cn("absolute top-0.5 h-1.5 w-1.5 rounded-full", hashColor(u.userId))}
                  style={{ right: `${4 + i * 6}px` }}
                />
              ))}
          </button>
        )}
        {days.map((day, index) => (
          <button
            key={day.id}
            type="button"
            role="tab"
            aria-selected={selectedDay === index}
            aria-controls={`day-panel-${day.id}`}
            onClick={() => onSelectDay(index)}
            className={cn(CHIP_BASE, selectedDay === index ? CHIP_ACTIVE : CHIP_INACTIVE)}
          >
            {day.dayNumber}日目
            {otherPresence
              .filter((u) => u.dayId === day.id)
              .slice(0, 3)
              .map((u, i) => (
                <span
                  key={u.userId}
                  className={cn("absolute top-0.5 h-1.5 w-1.5 rounded-full", hashColor(u.userId))}
                  style={{ right: `${4 + i * 6}px` }}
                />
              ))}
          </button>
        ))}
      </div>
    </div>
  );
}
