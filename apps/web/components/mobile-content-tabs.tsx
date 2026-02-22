"use client";

import { cn } from "@/lib/utils";

export type MobileContentTab = "schedule" | "candidates" | "expenses";

interface MobileContentTabsProps {
  activeTab: MobileContentTab;
  onTabChange: (tab: MobileContentTab) => void;
  candidateCount: number;
}

const TABS: { id: MobileContentTab; label: string }[] = [
  { id: "schedule", label: "予定" },
  { id: "candidates", label: "候補" },
  { id: "expenses", label: "費用" },
];

export function MobileContentTabs({
  activeTab,
  onTabChange,
  candidateCount,
}: MobileContentTabsProps) {
  return (
    <div className="mx-3 my-2 flex shrink-0 gap-1 rounded-lg bg-muted p-1" role="tablist">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          className={cn(
            "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors min-h-[36px]",
            activeTab === tab.id
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => onTabChange(tab.id)}
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
