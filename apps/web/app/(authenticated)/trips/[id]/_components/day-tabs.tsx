"use client";

import type { TripResponse } from "@sugara/shared";
import { hashColor } from "@/components/presence-avatars";
import type { PresenceUser } from "@/lib/hooks/use-trip-sync";
import { TAB_ACTIVE, TAB_INACTIVE } from "@/lib/styles";
import { cn } from "@/lib/utils";

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
    <div className="flex shrink-0 select-none border-b" role="tablist" aria-label="日程タブ">
      <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto px-4">
        {hasPoll && (
          <button
            type="button"
            role="tab"
            aria-selected={selectedDay === -1}
            onClick={() => onSelectDay(-1)}
            className={cn(
              "relative shrink-0 px-4 py-2 text-sm font-medium transition-colors min-h-[44px] lg:min-h-0",
              selectedDay === -1 ? TAB_ACTIVE : TAB_INACTIVE,
            )}
          >
            日程調整
            {otherPresence
              .filter((u) => u.dayId === "poll")
              .slice(0, 3)
              .map((u, i) => (
                <span
                  key={u.userId}
                  className={cn("absolute top-1 h-1.5 w-1.5 rounded-full", hashColor(u.userId))}
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
            className={cn(
              "relative shrink-0 px-4 py-2 text-sm font-medium transition-colors min-h-[44px] lg:min-h-0",
              selectedDay === index ? TAB_ACTIVE : TAB_INACTIVE,
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
