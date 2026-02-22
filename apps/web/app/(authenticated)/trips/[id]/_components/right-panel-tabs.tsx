"use client";

import { cn } from "@/lib/utils";

export type RightPanelTab = "candidates" | "activity" | "bookmarks" | "expenses";

const CHIP_BASE =
  "flex-1 rounded-full px-3 py-1.5 text-center text-sm font-medium transition-[colors,transform] active:scale-[0.95]";
const CHIP_ACTIVE = "bg-muted text-foreground";
const CHIP_INACTIVE = "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground";

export function RightPanelTabs({
  current,
  onChange,
  candidateCount,
}: {
  current: RightPanelTab;
  onChange: (tab: RightPanelTab) => void;
  candidateCount: number;
}) {
  return (
    <div
      className="flex shrink-0 select-none gap-1.5 overflow-x-auto border-b px-3 pb-2.5 pt-3"
      role="tablist"
      aria-label="候補・履歴タブ"
    >
      <button
        type="button"
        role="tab"
        aria-selected={current === "candidates"}
        onClick={() => onChange("candidates")}
        className={cn(CHIP_BASE, current === "candidates" ? CHIP_ACTIVE : CHIP_INACTIVE)}
      >
        候補
        {candidateCount > 0 && <span className="ml-1 text-xs">{candidateCount}</span>}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={current === "bookmarks"}
        onClick={() => onChange("bookmarks")}
        className={cn(CHIP_BASE, current === "bookmarks" ? CHIP_ACTIVE : CHIP_INACTIVE)}
      >
        ブックマーク
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={current === "expenses"}
        onClick={() => onChange("expenses")}
        className={cn(CHIP_BASE, current === "expenses" ? CHIP_ACTIVE : CHIP_INACTIVE)}
      >
        費用
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={current === "activity"}
        onClick={() => onChange("activity")}
        className={cn(CHIP_BASE, current === "activity" ? CHIP_ACTIVE : CHIP_INACTIVE)}
      >
        履歴
      </button>
    </div>
  );
}
