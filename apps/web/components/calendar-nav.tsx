"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const START_YEAR = 2024;
const END_YEAR = 2030;

const yearOptions = Array.from({ length: END_YEAR - START_YEAR + 1 }, (_, i) => START_YEAR + i);

const monthOptions = Array.from({ length: 12 }, (_, i) => ({
  value: i,
  label: `${i + 1}月`,
}));

export { START_YEAR, END_YEAR };

type CalendarNavProps = {
  month: Date;
  onMonthChange: (month: Date) => void;
  showReset?: boolean;
  onReset?: () => void;
};

export function CalendarNav({ month, onMonthChange, showReset, onReset }: CalendarNavProps) {
  return (
    <div className="flex items-center gap-2 pt-3">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-7 w-7"
        onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() - 1))}
        aria-label="前の月"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <select
        value={month.getFullYear()}
        onChange={(e) => onMonthChange(new Date(Number(e.target.value), month.getMonth()))}
        className="rounded-md border border-input bg-background px-2 py-1 text-sm"
        aria-label="年"
      >
        {yearOptions.map((y) => (
          <option key={y} value={y}>
            {y}年
          </option>
        ))}
      </select>
      <select
        value={month.getMonth()}
        onChange={(e) => onMonthChange(new Date(month.getFullYear(), Number(e.target.value)))}
        className="rounded-md border border-input bg-background px-2 py-1 text-sm"
        aria-label="月"
      >
        {monthOptions.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-7 w-7"
        onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() + 1))}
        aria-label="次の月"
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
          リセット
        </Button>
      )}
    </div>
  );
}
