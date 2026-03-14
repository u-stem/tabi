"use client";

import { useCallback, useEffect, useState } from "react";
import { ROULETTE_MODES, RouletteModeContent } from "@/components/roulette-content";
import { SpSwipeTabs, type SwipeTab } from "@/components/sp-swipe-tabs";
import { pageTitle } from "@/lib/constants";

type Mode = (typeof ROULETTE_MODES)[number]["value"];

const ROULETTE_TABS: SwipeTab<Mode>[] = ROULETTE_MODES.map((m) => ({
  id: m.value,
  label: m.label,
}));

export default function SpRoulettePage() {
  useEffect(() => {
    document.title = pageTitle("ルーレット");
  }, []);

  const [mode, setMode] = useState<Mode>("prefecture");

  const changeMode = useCallback((next: Mode) => {
    setMode(next);
  }, []);

  const renderContent = useCallback((m: Mode) => <RouletteModeContent mode={m} />, []);

  return (
    <div className="mt-4 mx-auto max-w-2xl space-y-6">
      <SpSwipeTabs<Mode>
        tabs={ROULETTE_TABS}
        activeTab={mode}
        onTabChange={changeMode}
        renderContent={renderContent}
        swipeEnabled
      />
    </div>
  );
}
