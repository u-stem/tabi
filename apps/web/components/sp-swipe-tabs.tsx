"use client";

import { type ReactNode, type RefObject, useCallback, useLayoutEffect, useRef } from "react";
import { useSwipeTab } from "@/lib/hooks/use-swipe-tab";
import { cn } from "@/lib/utils";

export type SwipeTab<T extends string = string> = {
  id: T;
  label: string;
  badge?: number;
};

export type SpSwipeTabsProps<T extends string = string> = {
  tabs: SwipeTab<T>[];
  activeTab: T;
  onTabChange: (tabId: T) => void;
  renderContent: (tabId: T) => ReactNode;
  /** Content inserted between tab bar and swipe container (e.g. toolbar) */
  children?: ReactNode;
  preserveScroll?: boolean;
  scrollRef?: RefObject<HTMLElement | null>;
  swipeEnabled?: boolean;
  className?: string;
};

const GRID_COLS: Record<number, string> = {
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
};

export function getMobileTabTriggerId(tabId: string): string {
  return `mobile-tab-trigger-${tabId}`;
}

export function getMobileTabPanelId(tabId: string): string {
  return `mobile-tab-panel-${tabId}`;
}

export function SpSwipeTabs<T extends string = string>({
  tabs,
  activeTab,
  onTabChange,
  renderContent,
  children,
  preserveScroll = false,
  scrollRef,
  swipeEnabled = true,
  className,
}: SpSwipeTabsProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const swipeRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  const scrollPositions = useRef<Record<string, number>>({});

  const currentTabIdx = tabs.findIndex((t) => t.id === activeTab);

  const handleSwipe = useCallback(
    (direction: "left" | "right") => {
      const idx = tabs.findIndex((t) => t.id === activeTabRef.current);
      if (idx === -1) return;
      const nextIdx = direction === "left" ? idx + 1 : idx - 1;
      if (nextIdx < 0 || nextIdx >= tabs.length) return;
      if (preserveScroll) {
        saveScrollPosition(activeTabRef.current);
      }
      onTabChange(tabs[nextIdx].id);
    },
    [tabs, onTabChange, preserveScroll],
  );

  const swipe = useSwipeTab(containerRef, swipeRef, {
    onSwipeComplete: handleSwipe,
    canSwipePrev: currentTabIdx > 0,
    canSwipeNext: currentTabIdx >= 0 && currentTabIdx < tabs.length - 1,
    enabled: swipeEnabled && currentTabIdx !== -1,
  });

  const adjacentTab =
    swipe.adjacent === "next"
      ? tabs[currentTabIdx + 1]?.id
      : swipe.adjacent === "prev"
        ? tabs[currentTabIdx - 1]?.id
        : undefined;

  function getScrollEl() {
    return scrollRef?.current ?? containerRef.current;
  }

  function saveScrollPosition(tabId: string) {
    const el = getScrollEl();
    if (el) {
      scrollPositions.current[tabId] = el.scrollTop;
    }
  }

  // Restore scroll position synchronously before paint
  useLayoutEffect(() => {
    if (!preserveScroll) return;
    const el = getScrollEl();
    el?.scrollTo(0, scrollPositions.current[activeTab] ?? 0);
  }, [activeTab, preserveScroll, scrollRef]);

  const handleTabClick = useCallback(
    (tabId: T) => {
      if (tabId === activeTabRef.current) return;
      if (preserveScroll) {
        saveScrollPosition(activeTabRef.current);
        // Pre-set scroll position before React commits DOM changes
        const el = getScrollEl();
        el?.scrollTo(0, scrollPositions.current[tabId] ?? 0);
      }
      onTabChange(tabId);
    },
    [onTabChange, preserveScroll, scrollRef],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      let targetId: T | undefined;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        targetId = tabs[(index + 1) % tabs.length].id;
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        targetId = tabs[(index - 1 + tabs.length) % tabs.length].id;
      } else if (e.key === "Home") {
        e.preventDefault();
        const first = tabs[0].id;
        if (first !== activeTabRef.current) targetId = first;
      } else if (e.key === "End") {
        e.preventDefault();
        const last = tabs[tabs.length - 1].id;
        if (last !== activeTabRef.current) targetId = last;
      }
      if (targetId !== undefined) {
        onTabChange(targetId);
      }
    },
    [tabs, onTabChange],
  );

  return (
    <div className={className}>
      {/* Tab bar */}
      <div
        role="tablist"
        aria-orientation="horizontal"
        className={cn("grid gap-1 rounded-lg bg-muted p-1", GRID_COLS[tabs.length])}
      >
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            id={getMobileTabTriggerId(tab.id)}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={getMobileTabPanelId(tab.id)}
            tabIndex={activeTab === tab.id ? 0 : -1}
            className={cn(
              "min-w-0 rounded-md px-2 py-1.5 text-sm font-medium min-h-[36px] overflow-hidden",
              activeTab === tab.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => handleTabClick(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
          >
            <span className="flex w-full items-center justify-center gap-1 whitespace-nowrap">
              <span className="truncate">{tab.label}</span>
              {tab.badge != null && tab.badge > 0 && (
                <span className="shrink-0 text-xs">{tab.badge}</span>
              )}
            </span>
          </button>
        ))}
      </div>

      {children}

      {/* Swipe container — only rendered when activeTab is in tabs list */}
      {currentTabIdx !== -1 && (
        <div
          ref={containerRef}
          className="min-h-[60vh] overflow-x-hidden px-0.5 -mx-0.5 touch-pan-y"
        >
          <div ref={swipeRef} className="relative touch-pan-y will-change-transform">
            {/* Active tab content */}
            <div
              className="pt-0.5"
              id={getMobileTabPanelId(activeTab)}
              role="tabpanel"
              aria-labelledby={getMobileTabTriggerId(activeTab)}
            >
              {renderContent(activeTab)}
            </div>

            {/* Adjacent tab (rendered only during swipe) */}
            {swipe.adjacent && adjacentTab && (
              <div
                className="absolute top-0 left-0 w-full pt-0.5"
                aria-hidden="true"
                style={{
                  transform: swipe.adjacent === "next" ? "translateX(100%)" : "translateX(-100%)",
                }}
              >
                {renderContent(adjacentTab as T)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
