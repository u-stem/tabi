"use client";

import { cn } from "@/lib/utils";

export type MobileContentTab =
  | "schedule"
  | "candidates"
  | "expenses"
  | "chat"
  | "bookmarks"
  | "activity";

interface MobileContentTabsProps {
  activeTab: MobileContentTab;
  onTabChange: (tab: MobileContentTab, source?: "tap") => void;
  candidateCount: number;
  showBookmarks?: boolean;
}

const BASE_TABS: { id: MobileContentTab; label: string }[] = [
  { id: "schedule", label: "予定" },
  { id: "candidates", label: "候補" },
  { id: "expenses", label: "費用" },
  { id: "chat", label: "作戦会議" },
];

const EXTRA_TABS: { id: MobileContentTab; label: string }[] = [
  { id: "bookmarks", label: "ブックマーク" },
  { id: "activity", label: "履歴" },
];

export function getMobileTabIds(showBookmarks?: boolean): MobileContentTab[] {
  const tabs = showBookmarks ? [...BASE_TABS, ...EXTRA_TABS] : BASE_TABS;
  return tabs.map((t) => t.id);
}

export function MobileContentTabs({
  activeTab,
  onTabChange,
  candidateCount,
  showBookmarks,
}: MobileContentTabsProps) {
  const tabs = showBookmarks ? [...BASE_TABS, ...EXTRA_TABS] : BASE_TABS;

  return (
    <div
      className="my-2 flex shrink-0 gap-1 overflow-x-auto rounded-lg bg-muted p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="tablist"
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          className={cn(
            "flex-none rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-[colors,transform] min-h-[36px] active:scale-[0.97]",
            activeTab === tab.id
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => onTabChange(tab.id, "tap")}
        >
          {tab.label}
          {tab.id === "candidates" && candidateCount > 0 && (
            <span className="ml-1 text-xs">{candidateCount}</span>
          )}
        </button>
      ))}
    </div>
  );
}
