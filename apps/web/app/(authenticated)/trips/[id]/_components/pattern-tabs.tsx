"use client";

import type { TripResponse } from "@sugara/shared";
import { MAX_PATTERNS_PER_DAY } from "@sugara/shared";
import {
  ChevronDown,
  ClipboardPaste,
  Copy,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ActionSheet } from "@/components/action-sheet";
import { PatternPickerDrawer } from "@/components/pattern-picker-drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useMobile } from "@/lib/hooks/use-is-mobile";
import type { usePatternOperations } from "@/lib/hooks/use-pattern-operations";
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
  const tm = useTranslations("messages");
  const tsch = useTranslations("schedule");
  const tc = useTranslations("common");
  const isMobile = useMobile();

  const DEFAULT_PATTERN_LABEL = "デフォルト";
  const patternDisplayLabel = (label: string) =>
    label === DEFAULT_PATTERN_LABEL ? tsch("defaultPattern") : label;

  if (isMobile) {
    return (
      <MobilePatternTabs
        patterns={patterns}
        currentDayId={currentDayId}
        currentPatternIndex={currentPatternIndex}
        canEdit={canEdit}
        online={online}
        patternOps={patternOps}
        onSelectPattern={onSelectPattern}
      />
    );
  }

  // Desktop: pill tabs with per-pattern DropdownMenu
  return (
    <div className="mb-2 flex flex-wrap select-none items-center gap-1.5">
      {patterns.map((pattern, index) => {
        const isActive = currentPatternIndex === index;
        return (
          <div
            key={pattern.id}
            className={cn(
              "flex max-w-48 items-center rounded-full border transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-1",
              isActive
                ? "border-transparent bg-muted text-foreground"
                : "border-transparent bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground",
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
              {patternDisplayLabel(pattern.label)}
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
                    {tsch("rename")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => patternOps.handleDuplicate(pattern.id)}
                    disabled={patterns.length >= MAX_PATTERNS_PER_DAY}
                  >
                    <Copy />
                    {tc("duplicate")}
                  </DropdownMenuItem>
                  {patterns.length > 1 && (
                    <DropdownMenuItem onClick={() => patternOps.setOverwriteSource(pattern)}>
                      <ClipboardPaste />
                      {tsch("overwrite")}
                    </DropdownMenuItem>
                  )}
                  {!pattern.isDefault && (
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => patternOps.setDeleteTarget(pattern)}
                    >
                      <Trash2 />
                      {tc("delete")}
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
                  <Plus className="inline h-3 w-3" /> {tsch("addPattern")}
                </button>
              </span>
            </TooltipTrigger>
            <TooltipContent>{tm("limitPatterns", { max: MAX_PATTERNS_PER_DAY })}</TooltipContent>
          </Tooltip>
        ) : (
          <button
            type="button"
            onClick={() => patternOps.add.setOpen(true)}
            className="shrink-0 rounded-full border border-dashed border-muted-foreground/30 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-muted-foreground hover:text-foreground"
          >
            <Plus className="inline h-3 w-3" /> {tsch("addPattern")}
          </button>
        ))}
    </div>
  );
}

// Mobile: current pattern pill (→ PatternPickerDrawer) + ActionSheet for management
function MobilePatternTabs({
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
  const tsch = useTranslations("schedule");
  const tc = useTranslations("common");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const currentPattern = patterns[currentPatternIndex];
  const multiplePatterns = patterns.length > 1;

  const DEFAULT_PATTERN_LABEL = "デフォルト";
  const patternDisplayLabel = (label: string) =>
    label === DEFAULT_PATTERN_LABEL ? tsch("defaultPattern") : label;

  const menuActions = currentPattern
    ? [
        {
          label: tsch("rename"),
          icon: <Pencil className="h-4 w-4" />,
          onClick: () => patternOps.rename.start(currentPattern),
        },
        ...(patterns.length < MAX_PATTERNS_PER_DAY
          ? [
              {
                label: tc("duplicate"),
                icon: <Copy className="h-4 w-4" />,
                onClick: () => patternOps.handleDuplicate(currentPattern.id),
              },
            ]
          : []),
        ...(multiplePatterns
          ? [
              {
                label: tsch("overwrite"),
                icon: <ClipboardPaste className="h-4 w-4" />,
                onClick: () => patternOps.setOverwriteSource(currentPattern),
              },
            ]
          : []),
        ...(!currentPattern.isDefault
          ? [
              {
                label: tc("delete"),
                icon: <Trash2 className="h-4 w-4" />,
                onClick: () => patternOps.setDeleteTarget(currentPattern),
                variant: "destructive" as const,
              },
            ]
          : []),
      ]
    : [];

  return (
    <div className="mb-2 flex select-none items-center gap-1.5">
      {/* Current pattern — tap to open picker when multiple patterns exist */}
      <button
        type="button"
        onClick={() => multiplePatterns && setPickerOpen(true)}
        disabled={!multiplePatterns}
        className="flex min-h-[36px] min-w-0 flex-1 items-center gap-1 rounded-full border border-transparent bg-muted px-3 py-1.5 text-xs font-medium disabled:pointer-events-none"
      >
        <span className="truncate">
          {currentPattern ? patternDisplayLabel(currentPattern.label) : null}
        </span>
        {multiplePatterns && <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />}
      </button>

      {/* Pattern management */}
      {canEdit && currentPattern && (
        <>
          <button
            type="button"
            aria-label={`${currentPattern.label}のメニュー`}
            onClick={() => setActionSheetOpen(true)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          <ActionSheet
            open={actionSheetOpen}
            onOpenChange={setActionSheetOpen}
            actions={menuActions}
          />
        </>
      )}

      {/* Add pattern */}
      {canEdit && online && (
        <button
          type="button"
          aria-label={tsch("addPattern")}
          disabled={patterns.length >= MAX_PATTERNS_PER_DAY}
          onClick={() => patternOps.add.setOpen(true)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-dashed border-muted-foreground/30 text-muted-foreground transition-colors disabled:pointer-events-none disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
        </button>
      )}

      <PatternPickerDrawer
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        patterns={patterns}
        currentPatternIndex={currentPatternIndex}
        onSelect={(index) => onSelectPattern(currentDayId, index)}
      />
    </div>
  );
}
