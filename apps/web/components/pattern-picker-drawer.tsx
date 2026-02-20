"use client";

import { Check } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

interface PatternOption {
  id: string;
  label: string;
  isDefault: boolean;
}

interface PatternPickerDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patterns: PatternOption[];
  currentPatternIndex: number;
  onSelect: (index: number) => void;
}

export function PatternPickerDrawer({
  open,
  onOpenChange,
  patterns,
  currentPatternIndex,
  onSelect,
}: PatternPickerDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>パターン選択</DrawerTitle>
          <DrawerDescription className="sr-only">
            表示するパターンを選択してください
          </DrawerDescription>
        </DrawerHeader>
        <div className="pb-4" role="radiogroup">
          {patterns.map((pattern, index) => {
            const isActive = currentPatternIndex === index;
            return (
              <label
                key={pattern.id}
                className={cn(
                  "flex min-h-[44px] cursor-pointer items-center gap-3 rounded-md px-3 py-3 hover:bg-accent",
                  isActive && "bg-accent",
                )}
              >
                <input
                  type="radio"
                  name="pattern"
                  aria-label={pattern.label}
                  checked={isActive}
                  onChange={() => {
                    onSelect(index);
                    onOpenChange(false);
                  }}
                  className="sr-only"
                />
                <span className="flex-1 text-sm font-medium">{pattern.label}</span>
                {isActive && <Check className="h-4 w-4 text-primary" />}
              </label>
            );
          })}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
