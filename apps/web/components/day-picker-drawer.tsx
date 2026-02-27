"use client";

import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
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
          <DrawerTitle>どの日に追加しますか？</DrawerTitle>
          <DrawerDescription className="sr-only">
            候補を追加する日を選択してください
          </DrawerDescription>
        </DrawerHeader>
        <div className="pb-4" role="radiogroup">
          {days.map((day) => {
            const dateStr = format(parseISO(day.date), "M/d (E)", { locale: ja });
            return (
              <label
                key={day.id}
                className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-md px-3 py-3 hover:bg-accent"
              >
                <input
                  type="radio"
                  name="day"
                  aria-label={`${day.dayIndex + 1}日目`}
                  checked={selectedDayId === day.id}
                  onChange={() => handleDayChange(day.id)}
                  className="h-4 w-4 accent-primary"
                />
                <span className="text-sm">
                  {day.dayIndex + 1}日目
                  <span className="ml-2 text-muted-foreground">{dateStr}</span>
                </span>
              </label>
            );
          })}
        </div>
        {currentPatterns && currentPatterns.length > 1 && (
          <div className="border-t py-3">
            <label className="text-xs text-muted-foreground">
              パターン
              <select
                className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={selectedPatternId}
                onChange={(e) => setSelectedPatternId(e.target.value)}
              >
                {currentPatterns.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
        <DrawerFooter>
          <Button
            onClick={() => {
              onConfirm(selectedDayId, selectedPatternId);
              onOpenChange(false);
            }}
          >
            追加する
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
