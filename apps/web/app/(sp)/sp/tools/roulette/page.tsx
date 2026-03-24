"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ROULETTE_MODES, RouletteModeContent } from "@/components/roulette-content";
import { SpSwipeTabs, type SwipeTab } from "@/components/sp-swipe-tabs";
import { pageTitle } from "@/lib/constants";

type Mode = (typeof ROULETTE_MODES)[number]["value"];

export default function SpRoulettePage() {
  const tt = useTranslations("tools");

  const rouletteTabs: SwipeTab<Mode>[] = useMemo(
    () =>
      ROULETTE_MODES.map((m) => ({
        id: m.value,
        label: tt(m.labelKey),
      })),
    [tt],
  );

  useEffect(() => {
    document.title = pageTitle(tt("roulette"));
  }, [tt]);

  const [mode, setMode] = useState<Mode>("preset");

  const changeMode = useCallback((next: Mode) => {
    setMode(next);
  }, []);

  const renderContent = useCallback((m: Mode) => <RouletteModeContent mode={m} />, []);

  return (
    <div className="mt-4 mx-auto max-w-2xl space-y-6">
      <SpSwipeTabs<Mode>
        tabs={rouletteTabs}
        activeTab={mode}
        onTabChange={changeMode}
        renderContent={renderContent}
        swipeEnabled
      />
    </div>
  );
}
