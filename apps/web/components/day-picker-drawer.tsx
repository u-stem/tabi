"use client";

import { format, parseISO } from "date-fns";
import { enUS, ja } from "date-fns/locale";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

interface DayOption {
  id: string;
  date: string;
  dayIndex: number;
}

interface PatternOption {
  id: string;
  label: string;
}

interface DayPickerDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  days: DayOption[];
  defaultDayIndex: number;
  // patterns per day: first entry is treated as default selection
  patternsByDayId?: Record<string, PatternOption[]>;
  onConfirm: (dayId: string, patternId: string | undefined) => void;
}

export function DayPickerDrawer({
  open,
  onOpenChange,
  days,
  defaultDayIndex,
  patternsByDayId,
  onConfirm,
}: DayPickerDrawerProps) {
  const locale = useLocale();
  const calendarLocale = locale === "ja" ? ja : enUS;
  const td = useTranslations("dayPicker");
  const dateFormat = locale === "ja" ? "M月d日 (E)" : "MMM d (E)";
  const initialDayId = days[defaultDayIndex]?.id ?? days[0]?.id;
  const [selectedDayId, setSelectedDayId] = useState(() => initialDayId);
  const [selectedPatternId, setSelectedPatternId] = useState(
    () => patternsByDayId?.[initialDayId]?.[0]?.id,
  );

  function handleDayChange(dayId: string) {
    setSelectedDayId(dayId);
    setSelectedPatternId(patternsByDayId?.[dayId]?.[0]?.id);
  }

  const currentPatterns = patternsByDayId?.[selectedDayId];

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{td("title")}</DrawerTitle>
          <DrawerDescription className="sr-only">{td("description")}</DrawerDescription>
        </DrawerHeader>
        <div className="max-h-[50dvh] overflow-y-auto overscroll-contain" role="radiogroup">
          {days.map((day) => {
            const dateStr = format(parseISO(day.date), dateFormat, { locale: calendarLocale });
            return (
              <label
                key={day.id}
                className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-md px-3 py-3 hover:bg-accent"
              >
                <input
                  type="radio"
                  name="day"
                  aria-label={td("dayLabel", { n: day.dayIndex + 1 })}
                  checked={selectedDayId === day.id}
                  onChange={() => handleDayChange(day.id)}
                  className="h-4 w-4 accent-primary"
                />
                <span className="text-sm">
                  {td("dayLabel", { n: day.dayIndex + 1 })}
                  <span className="ml-2 text-muted-foreground">{dateStr}</span>
                </span>
              </label>
            );
          })}
        </div>
        {currentPatterns && currentPatterns.length > 1 && (
          <div className="border-t" role="radiogroup" aria-label={td("patternLabel")}>
            <p className="px-3 pt-3 text-xs text-muted-foreground">{td("patternLabel")}</p>
            {currentPatterns.map((p) => (
              <label
                key={p.id}
                className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-md px-3 py-3 hover:bg-accent"
              >
                <input
                  type="radio"
                  name="pattern"
                  aria-label={p.label}
                  checked={selectedPatternId === p.id}
                  onChange={() => setSelectedPatternId(p.id)}
                  className="h-4 w-4 accent-primary"
                />
                <span className="text-sm">{p.label}</span>
              </label>
            ))}
          </div>
        )}
        <DrawerFooter>
          <Button
            onClick={() => {
              onConfirm(selectedDayId, selectedPatternId);
              onOpenChange(false);
            }}
          >
            {td("confirm")}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
