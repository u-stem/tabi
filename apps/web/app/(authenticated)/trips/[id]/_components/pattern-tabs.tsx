"use client";

import type { TripResponse } from "@sugara/shared";
import { MAX_PATTERNS_PER_DAY } from "@sugara/shared";
import { ChevronDown, Copy, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { PatternPickerDrawer } from "@/components/pattern-picker-drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useIsMobile } from "@/lib/hooks/use-is-mobile";
import type { usePatternOperations } from "@/lib/hooks/use-pattern-operations";
import { MSG } from "@/lib/messages";
import { cn } from "@/lib/utils";

type PatternOps = ReturnType<typeof usePatternOperations>;

export function PatternTabs({
  patterns,
  currentDayId,
  currentPatternIndex,
  canEdit,
  online,
  patternOps,
  onSelectPattern,
}: {
  patterns: TripResponse["days"][number]["patterns"];
  currentDayId: string;
  currentPatternIndex: number;
  canEdit: boolean;
  online: boolean;
  patternOps: PatternOps;
  onSelectPattern: (dayId: string, index: number) => void;
}) {
  const isMobile = useIsMobile();
  const [pickerOpen, setPickerOpen] = useState(false);
  const currentPattern = patterns[currentPatternIndex];

  if (isMobile) {
    return (
      <div className="mb-3 flex select-none items-center gap-1.5">
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-900 dark:text-blue-200 dark:hover:bg-blue-800"
        >
          <span className="max-w-32 truncate">{currentPattern?.label}</span>
          {patterns.length > 1 && <ChevronDown className="h-3 w-3" />}
        </button>
        {canEdit && online && patterns.length < MAX_PATTERNS_PER_DAY && (
          <button
            type="button"
            onClick={() => patternOps.add.setOpen(true)}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-muted-foreground/30 text-muted-foreground transition-colors hover:border-muted-foreground hover:text-foreground"
            aria-label="パターン追加"
          >
            <Plus className="h-3 w-3" />
          </button>
        )}
        {patterns.length > 1 && (
          <PatternPickerDrawer
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            patterns={patterns}
            currentPatternIndex={currentPatternIndex}
            onSelect={(index) => onSelectPattern(currentDayId, index)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="mb-3 flex flex-wrap select-none items-center gap-1.5">
      {patterns.map((pattern, index) => {
        const isActive = currentPatternIndex === index;
        return (
          <div
            key={pattern.id}
            className={cn(
              "flex max-w-48 items-center rounded-full border transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-1",
              isActive
                ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-900 dark:text-blue-200 dark:hover:bg-blue-800"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
            )}
          >
            <button
              type="button"
              onClick={() => onSelectPattern(currentDayId, index)}
              className={cn(
                "truncate py-1.5 text-xs font-medium focus:outline-none",
                canEdit ? "pl-3 pr-0.5" : "px-3",
              )}
            >
              {pattern.label}
            </button>
            {canEdit && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none sm:h-6 sm:w-6"
                    aria-label={`${pattern.label}のメニュー`}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => patternOps.rename.start(pattern)}>
                    <Pencil />
                    名前変更
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => patternOps.handleDuplicate(pattern.id)}
                    disabled={patterns.length >= MAX_PATTERNS_PER_DAY}
                  >
                    <Copy />
                    複製
                  </DropdownMenuItem>
                  {!pattern.isDefault && (
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => patternOps.setDeleteTarget(pattern)}
                    >
                      <Trash2 />
                      削除
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        );
      })}
      {canEdit &&
        online &&
        (patterns.length >= MAX_PATTERNS_PER_DAY ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <button
                  type="button"
                  disabled
                  className="shrink-0 cursor-not-allowed rounded-full border border-dashed border-muted-foreground/20 px-3 py-1.5 text-xs text-muted-foreground/50"
                >
                  <Plus className="inline h-3 w-3" /> パターン追加
                </button>
              </span>
            </TooltipTrigger>
            <TooltipContent>{MSG.LIMIT_PATTERNS}</TooltipContent>
          </Tooltip>
        ) : (
          <button
            type="button"
            onClick={() => patternOps.add.setOpen(true)}
            className="shrink-0 rounded-full border border-dashed border-muted-foreground/30 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-muted-foreground hover:text-foreground"
          >
            <Plus className="inline h-3 w-3" /> パターン追加
          </button>
        ))}
    </div>
  );
}
