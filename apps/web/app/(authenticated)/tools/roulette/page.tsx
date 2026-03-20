"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { RouletteContent } from "@/components/roulette-content";
import type { ShortcutGroup } from "@/components/shortcut-help-dialog";
import { pageTitle } from "@/lib/constants";
import { useRegisterShortcuts, useShortcutHelp } from "@/lib/shortcut-help-context";

export default function RoulettePage() {
  const tt = useTranslations("tools");
  const { open: openShortcutHelp } = useShortcutHelp();
  const shortcuts: ShortcutGroup[] = useMemo(
    () => [
      {
        group: tt("shortcutGroup"),
        items: [
          { key: "Space", description: tt("shortcutSpin") },
          { key: "r", description: tt("shortcutReset") },
        ],
      },
    ],
    [tt],
  );
  useRegisterShortcuts(shortcuts);

  useEffect(() => {
    document.title = pageTitle(tt("roulette"));
  }, [tt]);

  useHotkeys("?", () => openShortcutHelp(), { useKey: true, preventDefault: true });

  return (
    <div className="mt-4 mx-auto max-w-2xl space-y-6">
      <RouletteContent />
    </div>
  );
}
