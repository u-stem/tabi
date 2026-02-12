"use client";

import { format, isValid, parse } from "date-fns";
import { ja } from "date-fns/locale";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";

const START_YEAR = 2024;
const END_YEAR = 2030;

const yearOptions = Array.from({ length: END_YEAR - START_YEAR + 1 }, (_, i) => START_YEAR + i);

const monthOptions = Array.from({ length: 12 }, (_, i) => ({
  value: i,
  label: `${i + 1}月`,
}));

type DateRangePickerProps = {
  startDate: string;
  endDate: string;
  onChangeStart: (date: string) => void;
  onChangeEnd: (date: string) => void;
};

function toDate(dateStr: string): Date {
  const result = parse(dateStr, "yyyy-MM-dd", new Date());
  if (!isValid(result)) return new Date();
  return result;
}

function toDateString(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function DateRangePicker({
  startDate,
  endDate,
  onChangeStart,
  onChangeEnd,
}: DateRangePickerProps) {
  const [month, setMonth] = useState<Date>(startDate ? toDate(startDate) : new Date());

  const selected: DateRange = {
    from: startDate ? toDate(startDate) : undefined,
    to: endDate ? toDate(endDate) : undefined,
  };

  function handleSelect(range: DateRange | undefined) {
    if (!range) return;
    onChangeStart(range.from ? toDateString(range.from) : "");
    onChangeEnd(range.to ? toDateString(range.to) : "");
  }

  function handlePrevMonth() {
    setMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1));
  }

  function handleNextMonth() {
    setMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1));
  }

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-2 pt-3">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={handlePrevMonth}
          aria-label="前の月"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <select
          value={month.getFullYear()}
          onChange={(e) => setMonth(new Date(Number(e.target.value), month.getMonth()))}
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
          onChange={(e) => setMonth(new Date(month.getFullYear(), Number(e.target.value)))}
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
          onClick={handleNextMonth}
          aria-label="次の月"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        {(startDate || endDate) && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground"
            onClick={() => {
              onChangeStart("");
              onChangeEnd("");
            }}
          >
            <X className="mr-1 h-3 w-3" />
            リセット
          </Button>
        )}
      </div>
      <Calendar
        mode="range"
        selected={selected}
        onSelect={handleSelect}
        month={month}
        onMonthChange={setMonth}
        numberOfMonths={2}
        locale={ja}
        hideNavigation
        startMonth={new Date(START_YEAR, 0)}
        endMonth={new Date(END_YEAR, 11)}
      />
    </div>
  );
}
