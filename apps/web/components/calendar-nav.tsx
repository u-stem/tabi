"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

const START_YEAR = 2024;
const END_YEAR = 2030;

const yearOptions = Array.from({ length: END_YEAR - START_YEAR + 1 }, (_, i) => START_YEAR + i);

// Labels are set dynamically with translations
const monthValues = Array.from({ length: 12 }, (_, i) => i);

export { END_YEAR, START_YEAR };

type CalendarNavProps = {
  month: Date;
  onMonthChange: (month: Date) => void;
  showReset?: boolean;
  onReset?: () => void;
};

export function CalendarNav({ month, onMonthChange, showReset, onReset }: CalendarNavProps) {
  const tc = useTranslations("calendar");
  return (
    <div className="flex items-center gap-2 pt-3">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-7 w-7"
        onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() - 1))}
        aria-label={tc("prevMonth")}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <select
        value={month.getFullYear()}
        onChange={(e) => onMonthChange(new Date(Number(e.target.value), month.getMonth()))}
        className="rounded-md border border-input bg-background px-2 py-1 text-sm"
        aria-label={tc("yearLabel")}
      >
        {yearOptions.map((y) => (
          <option key={y} value={y}>
            {tc("yearSuffix", { year: y })}
          </option>
        ))}
      </select>
      <select
        value={month.getMonth()}
        onChange={(e) => onMonthChange(new Date(month.getFullYear(), Number(e.target.value)))}
        className="rounded-md border border-input bg-background px-2 py-1 text-sm"
        aria-label={tc("monthLabel")}
      >
        {monthValues.map((m) => (
          <option key={m} value={m}>
            {tc("monthName", { month: m + 1 })}
          </option>
        ))}
      </select>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-7 w-7"
        onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() + 1))}
        aria-label={tc("nextMonth")}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
      {showReset && onReset && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-muted-foreground"
          onClick={onReset}
        >
          <X className="mr-1 h-3 w-3" />
          {tc("reset")}
        </Button>
      )}
    </div>
  );
}
