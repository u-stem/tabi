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
}

const BASE_TABS: { id: MobileContentTab; label: string }[] = [
  { id: "schedule", label: "予定" },
  { id: "candidates", label: "候補" },
  { id: "expenses", label: "費用" },
  { id: "chat", label: "作戦会議" },
];

export function getMobileTabIds(): MobileContentTab[] {
  return BASE_TABS.map((t) => t.id);
}

export function MobileContentTabs({
  activeTab,
  onTabChange,
  candidateCount,
}: MobileContentTabsProps) {
  const tabs = BASE_TABS;

  return (
    <div
      className="my-2 grid shrink-0 grid-cols-4 gap-1 rounded-lg bg-muted p-1"
      role="tablist"
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          className={cn(
            "min-w-0 rounded-md px-2 py-1.5 text-sm font-medium transition-[colors,transform] min-h-[36px] active:scale-[0.97] overflow-hidden",
            activeTab === tab.id
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => onTabChange(tab.id, "tap")}
        >
          <span className="flex w-full items-center justify-center gap-1 whitespace-nowrap">
            <span className="truncate">{tab.label}</span>
            {tab.id === "candidates" && candidateCount > 0 && (
              <span className="shrink-0 text-xs">{candidateCount}</span>
            )}
          </span>
        </button>
      ))}
    </div>
  );
}
