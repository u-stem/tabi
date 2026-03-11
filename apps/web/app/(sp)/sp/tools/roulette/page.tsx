"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ROULETTE_MODES, RouletteModeContent } from "@/components/roulette-content";
import { pageTitle } from "@/lib/constants";
import { useSwipeTab } from "@/lib/hooks/use-swipe-tab";
import { cn } from "@/lib/utils";

type Mode = (typeof ROULETTE_MODES)[number]["value"];

export default function SpRoulettePage() {
  useEffect(() => {
    document.title = pageTitle("ルーレット");
  }, []);

  const [mode, setMode] = useState<Mode>("prefecture");
  const modeRef = useRef(mode);
  const contentRef = useRef<HTMLDivElement>(null);
  const swipeRef = useRef<HTMLDivElement>(null);

  const modeIdx = ROULETTE_MODES.findIndex((m) => m.value === mode);

  const changeMode = useCallback((next: Mode) => {
    modeRef.current = next;
    setMode(next);
  }, []);

  const handleSwipe = useCallback(
    (direction: "left" | "right") => {
      const idx = ROULETTE_MODES.findIndex((m) => m.value === modeRef.current);
      const nextIdx = direction === "left" ? idx + 1 : idx - 1;
      if (nextIdx < 0 || nextIdx >= ROULETTE_MODES.length) return;
      changeMode(ROULETTE_MODES[nextIdx].value);
    },
    [changeMode],
  );

  const swipe = useSwipeTab(contentRef, swipeRef, {
    onSwipeComplete: handleSwipe,
    canSwipePrev: modeIdx > 0,
    canSwipeNext: modeIdx < ROULETTE_MODES.length - 1,
    enabled: true,
  });

  const adjacentMode =
    swipe.adjacent === "next"
      ? ROULETTE_MODES[modeIdx + 1]?.value
      : swipe.adjacent === "prev"
        ? ROULETTE_MODES[modeIdx - 1]?.value
        : undefined;

  return (
    <div className="mt-4 mx-auto max-w-2xl space-y-6">
      {/* Tab bar */}
      <div
        role="tablist"
        aria-orientation="horizontal"
        className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1"
      >
        {ROULETTE_MODES.map(({ value, label }, index) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={mode === value}
            tabIndex={mode === value ? 0 : -1}
            onClick={() => changeMode(value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") {
                e.preventDefault();
                changeMode(ROULETTE_MODES[(index + 1) % ROULETTE_MODES.length].value);
              } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                changeMode(
                  ROULETTE_MODES[(index - 1 + ROULETTE_MODES.length) % ROULETTE_MODES.length].value,
                );
              }
            }}
            className={cn(
              "min-h-[36px] rounded-md px-2 py-1.5 text-sm font-medium transition-[colors,transform] active:scale-[0.97]",
              mode === value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Swipe container */}
      <div ref={contentRef} className="min-h-[60vh] overflow-x-hidden px-0.5 -mx-0.5 touch-pan-y">
        <div ref={swipeRef} className="relative touch-pan-y will-change-transform">
          <div className="pt-0.5">
            <RouletteModeContent mode={mode} />
          </div>

          {swipe.adjacent && adjacentMode && (
            <div
              className="absolute top-0 left-0 w-full pt-0.5"
              aria-hidden="true"
              style={{
                transform: swipe.adjacent === "next" ? "translateX(100%)" : "translateX(-100%)",
              }}
            >
              <RouletteModeContent mode={adjacentMode} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
