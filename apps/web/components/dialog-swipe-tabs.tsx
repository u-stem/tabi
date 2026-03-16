"use client";

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type DialogTab<T extends string = string> = {
  id: T;
  label: string;
};

interface DialogSwipeTabsProps<T extends string> {
  tabs: DialogTab<T>[];
  activeTab: T;
  onTabChange: (tabId: T) => void;
  renderContent: (tabId: T) => ReactNode;
}

export function DialogSwipeTabs<T extends string>({
  tabs,
  activeTab,
  onTabChange,
  renderContent,
}: DialogSwipeTabsProps<T>) {
  const snapRef = useRef<HTMLDivElement>(null);
  const isProgrammaticRef = useRef(false);
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  const currentIdx = tabs.findIndex((t) => t.id === activeTab);
  const [visualIdx, setVisualIdx] = useState(currentIdx);

  useEffect(() => {
    setVisualIdx(currentIdx);
  }, [currentIdx]);

  // Detect tab from scroll position
  useEffect(() => {
    const el = snapRef.current;
    if (!el) return;

    function handleScroll() {
      if (!el || isProgrammaticRef.current) return;
      const w = el.clientWidth;
      if (w === 0) return;
      const idx = Math.round(el.scrollLeft / w);
      if (idx >= 0 && idx < tabs.length && idx !== visualIdx) {
        setVisualIdx(idx);
      }
    }

    function detectTab() {
      if (!el || isProgrammaticRef.current) return;
      const w = el.clientWidth;
      if (w === 0) return;
      const idx = Math.round(el.scrollLeft / w);
      const tab = tabs[idx];
      if (tab && tab.id !== activeTabRef.current) {
        onTabChange(tab.id);
      }
    }

    const hasScrollEnd = "onscrollend" in window;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function onScroll() {
      handleScroll();
      if (!hasScrollEnd) {
        clearTimeout(timer);
        timer = setTimeout(detectTab, 150);
      }
    }

    el.addEventListener("scroll", onScroll, { passive: true });
    if (hasScrollEnd) el.addEventListener("scrollend", detectTab);

    return () => {
      clearTimeout(timer);
      el.removeEventListener("scroll", onScroll);
      if (hasScrollEnd) el.removeEventListener("scrollend", detectTab);
    };
  }, [tabs, onTabChange, visualIdx]);

  // Sync activeTab to scroll position on tab click
  useEffect(() => {
    const el = snapRef.current;
    if (!el) return;
    const idx = tabs.findIndex((t) => t.id === activeTab);
    if (idx === -1) return;
    const target = idx * el.clientWidth;
    if (Math.abs(el.scrollLeft - target) < 2) return;
    isProgrammaticRef.current = true;
    el.scrollTo({ left: target, behavior: "smooth" });

    function clear() {
      isProgrammaticRef.current = false;
      el?.removeEventListener("scrollend", clear);
    }
    if ("onscrollend" in window) {
      el.addEventListener("scrollend", clear, { once: true });
    } else {
      setTimeout(clear, 400);
    }
  }, [activeTab, tabs]);

  const handleTabClick = useCallback(
    (tabId: T) => {
      if (tabId !== activeTabRef.current) onTabChange(tabId);
    },
    [onTabChange],
  );

  const gridCols = tabs.length === 2 ? "grid-cols-2" : "grid-cols-3";

  return (
    <div>
      <div role="tablist" className={cn("grid gap-1 rounded-lg bg-muted p-1", gridCols)}>
        {tabs.map((tab, i) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={cn(
              "rounded-md px-2 py-1.5 text-sm font-medium",
              i === visualIdx
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => handleTabClick(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div
        ref={snapRef}
        className="mt-1 flex overflow-x-auto snap-x snap-mandatory overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className="w-full shrink-0 snap-start snap-always p-0.5"
            role="tabpanel"
            {...(tab.id !== activeTab && { inert: true })}
          >
            {renderContent(tab.id)}
          </div>
        ))}
      </div>
    </div>
  );
}
