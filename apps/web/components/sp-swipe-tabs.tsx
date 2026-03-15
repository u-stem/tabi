"use client";

import { type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSetActiveScrollElement } from "@/components/sp-scroll-container";
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
  swipeEnabled?: boolean;
  className?: string;
  /**
   * @deprecated No longer needed — panel height is now measured dynamically.
   */
  extraTopOffset?: number;
};

// SpHeader h-14 = 56px, tab bar p-1(8px) + button min-h-[36px] = 44px
const BASE_TOP = 56 + 44;
const PANEL_BOTTOM_PADDING = "calc(4rem + env(safe-area-inset-bottom, 0px))";

const GRID_COLS: Record<number, string> = {
  1: "grid-cols-1",
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
  swipeEnabled = true,
  className,
  extraTopOffset = 0,
}: SpSwipeTabsProps<T>) {
  const [measuredHeight, setMeasuredHeight] = useState<string | null>(null);
  const setActiveScrollElement = useSetActiveScrollElement();
  const snapRef = useRef<HTMLDivElement>(null);
  const panelRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  // Measure snap container's actual viewport position to compute exact panel height
  useLayoutEffect(() => {
    const el = snapRef.current;
    if (!el) return;
    const measure = () => {
      const top = el.getBoundingClientRect().top;
      if (top >= 0) setMeasuredHeight(`calc(100dvh - ${top}px)`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (el.parentElement) observer.observe(el.parentElement);
    return () => observer.disconnect();
  }, []);

  const panelHeight = measuredHeight ?? `calc(100dvh - ${BASE_TOP + extraTopOffset}px)`;

  // Guard to skip scrollend handling during programmatic scrollTo
  const isProgrammaticRef = useRef(false);
  // Visual tab index — ref for synchronous access in scroll handler, state for rendering
  const [visualTabIdx, setVisualTabIdx] = useState(() => tabs.findIndex((t) => t.id === activeTab));
  const visualTabIdxRef = useRef(visualTabIdx);

  const currentTabIdx = tabs.findIndex((t) => t.id === activeTab);

  // Sync visualTabIdx when activeTab changes externally (tab click, keyboard)
  useEffect(() => {
    visualTabIdxRef.current = currentTabIdx;
    setVisualTabIdx(currentTabIdx);
  }, [currentTabIdx]);

  // Register active panel as the scroll source for useScrollDirection / usePullToRefresh
  useEffect(() => {
    if (!setActiveScrollElement) return;
    const panelEl = panelRefs.current.get(activeTab) ?? null;
    setActiveScrollElement(panelEl);
    return () => {
      setActiveScrollElement(null);
    };
  }, [activeTab, setActiveScrollElement]);

  // Track scroll position for instant tab bar feedback + detect final tab on snap
  // Also clamp scroll to ±1 panel from the touch-start position to prevent skipping tabs
  useEffect(() => {
    const el = snapRef.current;
    if (!el) return;

    let anchorLeft = -1;

    function handleTouchStart() {
      if (!el) return;
      isProgrammaticRef.current = false;
      const panelWidth = el.clientWidth;
      if (panelWidth > 0) {
        anchorLeft = Math.round(el.scrollLeft / panelWidth) * panelWidth;
      }
    }

    function handleTouchEnd() {
      anchorLeft = -1;
    }

    function handleScroll() {
      if (!el) return;
      const panelWidth = el.clientWidth;
      if (panelWidth === 0) return;

      if (anchorLeft >= 0) {
        const minLeft = Math.max(0, anchorLeft - panelWidth);
        const maxLeft = Math.min(el.scrollWidth - panelWidth, anchorLeft + panelWidth);
        if (el.scrollLeft < minLeft) {
          el.scrollLeft = minLeft;
        } else if (el.scrollLeft > maxLeft) {
          el.scrollLeft = maxLeft;
        }
      }

      const idx = Math.round(el.scrollLeft / panelWidth);
      if (idx !== visualTabIdxRef.current && idx >= 0 && idx < tabs.length) {
        // Skip visual update during programmatic scroll (tab click) to prevent flicker
        if (isProgrammaticRef.current) return;
        visualTabIdxRef.current = idx;
        setVisualTabIdx(idx);
      }
    }

    function detectTab() {
      if (!el || isProgrammaticRef.current) return;
      const panelWidth = el.clientWidth;
      if (panelWidth === 0) return;
      const idx = Math.round(el.scrollLeft / panelWidth);
      const newTab = tabs[idx];
      if (newTab && newTab.id !== activeTabRef.current) {
        onTabChange(newTab.id);
      }
    }

    const hasScrollEnd = "onscrollend" in window;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function handleScrollWithFallback() {
      handleScroll();
      if (!hasScrollEnd) {
        clearTimeout(timer);
        timer = setTimeout(detectTab, 150);
      }
    }

    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchend", handleTouchEnd, { passive: true });
    el.addEventListener("touchcancel", handleTouchEnd, { passive: true });
    el.addEventListener("scroll", handleScrollWithFallback, { passive: true });
    if (hasScrollEnd) {
      el.addEventListener("scrollend", detectTab);
    }

    return () => {
      if (timer) clearTimeout(timer);
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchend", handleTouchEnd);
      el.removeEventListener("touchcancel", handleTouchEnd);
      el.removeEventListener("scroll", handleScrollWithFallback);
      if (hasScrollEnd) {
        el.removeEventListener("scrollend", detectTab);
      }
    };
  }, [tabs, onTabChange]);

  // Sync activeTab prop to scroll position (for tab click, keyboard, external changes)
  useEffect(() => {
    const el = snapRef.current;
    if (!el) return;
    const idx = tabs.findIndex((t) => t.id === activeTab);
    if (idx === -1) return;
    const targetLeft = idx * el.clientWidth;
    if (Math.abs(el.scrollLeft - targetLeft) < 2) return;
    isProgrammaticRef.current = true;
    el.scrollTo({ left: targetLeft, behavior: "smooth" });

    function clearGuard() {
      isProgrammaticRef.current = false;
      el?.removeEventListener("scrollend", clearGuard);
    }
    if ("onscrollend" in window) {
      el.addEventListener("scrollend", clearGuard, { once: true });
    } else {
      setTimeout(clearGuard, 600);
    }
  }, [activeTab, tabs]);

  const handleTabClick = useCallback(
    (tabId: T) => {
      if (tabId === activeTabRef.current) return;
      onTabChange(tabId);
    },
    [onTabChange],
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
        document.getElementById(getMobileTabTriggerId(targetId))?.focus();
      }
    },
    [tabs, onTabChange],
  );

  const setPanelRef = useCallback((tabId: string, el: HTMLDivElement | null) => {
    if (el) {
      panelRefs.current.set(tabId, el);
    } else {
      panelRefs.current.delete(tabId);
    }
  }, []);

  return (
    <div className={className}>
      {/* Tab bar — sticky within SpScrollContainer */}
      <div
        role="tablist"
        aria-orientation="horizontal"
        className={cn(
          "sticky top-0 z-20 grid gap-1 rounded-lg bg-muted p-1 touch-pan-x",
          GRID_COLS[tabs.length],
        )}
      >
        {tabs.map((tab, index) => {
          const isVisuallyActive = index === visualTabIdx;
          return (
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
                isVisuallyActive
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
          );
        })}
      </div>

      {children}

      {/* Scroll snap container — all tabs pre-rendered, each panel scrolls independently */}
      {currentTabIdx !== -1 && (
        <div
          ref={snapRef}
          className={cn(
            "flex [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            swipeEnabled
              ? "overflow-x-auto snap-x snap-mandatory overscroll-x-contain"
              : "overflow-x-hidden",
          )}
          style={{ height: panelHeight }}
        >
          {tabs.map((tab) => {
            const isActive = tab.id === activeTab;
            return (
              <div
                key={tab.id}
                ref={(el) => setPanelRef(tab.id, el)}
                className="w-full shrink-0 snap-start snap-always overflow-y-auto overscroll-y-contain pt-3"
                style={{ paddingBottom: PANEL_BOTTOM_PADDING }}
                id={getMobileTabPanelId(tab.id)}
                role="tabpanel"
                aria-labelledby={getMobileTabTriggerId(tab.id)}
                {...(!isActive && { inert: true })}
              >
                {renderContent(tab.id)}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
