"use client";

import { TAB_ACTIVE, TAB_INACTIVE } from "@/lib/styles";
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
    <div className="flex shrink-0" role="tablist">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          className={cn(
            "relative flex-1 px-3 py-2.5 text-sm font-medium transition-colors min-h-[44px]",
            activeTab === tab.id ? TAB_ACTIVE : TAB_INACTIVE,
          )}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
          {tab.id === "candidates" && candidateCount > 0 && (
            <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1 text-xs">
              {candidateCount}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
