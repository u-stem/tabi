"use client";

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
          current === "candidates"
            ? "text-blue-600 dark:text-blue-400 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-blue-600 dark:after:bg-blue-400"
            : "text-muted-foreground hover:text-foreground",
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
          current === "bookmarks"
            ? "text-blue-600 dark:text-blue-400 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-blue-600 dark:after:bg-blue-400"
            : "text-muted-foreground hover:text-foreground",
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
          current === "activity"
            ? "text-blue-600 dark:text-blue-400 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-blue-600 dark:after:bg-blue-400"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        履歴
      </button>
    </div>
  );
}
