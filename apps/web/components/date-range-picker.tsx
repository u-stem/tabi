"use client";

import { format, isValid, parse } from "date-fns";
import { ja } from "date-fns/locale";
import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { CalendarNav, END_YEAR, START_YEAR } from "@/components/calendar-nav";
import { Calendar } from "@/components/ui/calendar";

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

  return (
    <div className="flex flex-col items-center">
      <CalendarNav
        month={month}
        onMonthChange={setMonth}
        showReset={!!(startDate || endDate)}
        onReset={() => {
          onChangeStart("");
          onChangeEnd("");
        }}
      />
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
