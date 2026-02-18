"use client";

import { TAB_ACTIVE, TAB_INACTIVE } from "@/lib/styles";
import { cn } from "@/lib/utils";

export type RightPanelTab = "candidates" | "activity" | "bookmarks";

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
    <div className="flex shrink-0 select-none border-b" role="tablist" aria-label="候補・履歴タブ">
      <button
        type="button"
        role="tab"
        aria-selected={current === "candidates"}
        onClick={() => onChange("candidates")}
        className={cn(
          "relative shrink-0 px-4 py-2 text-sm font-medium transition-colors",
          current === "candidates" ? TAB_ACTIVE : TAB_INACTIVE,
        )}
      >
        候補
        {candidateCount > 0 && (
          <span className="ml-1 rounded-full bg-muted px-1.5 text-xs">{candidateCount}</span>
        )}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={current === "bookmarks"}
        onClick={() => onChange("bookmarks")}
        className={cn(
          "relative shrink-0 px-4 py-2 text-sm font-medium transition-colors",
          current === "bookmarks" ? TAB_ACTIVE : TAB_INACTIVE,
        )}
      >
        ブックマーク
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={current === "activity"}
        onClick={() => onChange("activity")}
        className={cn(
          "relative shrink-0 px-4 py-2 text-sm font-medium transition-colors",
          current === "activity" ? TAB_ACTIVE : TAB_INACTIVE,
        )}
      >
        履歴
      </button>
    </div>
  );
}
