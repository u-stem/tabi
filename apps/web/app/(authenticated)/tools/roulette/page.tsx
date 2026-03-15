"use client";

import { useEffect, useMemo } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { RouletteContent } from "@/components/roulette-content";
import type { ShortcutGroup } from "@/components/shortcut-help-dialog";
import { pageTitle } from "@/lib/constants";
import { useRegisterShortcuts, useShortcutHelp } from "@/lib/shortcut-help-context";

export default function RoulettePage() {
  const { open: openShortcutHelp } = useShortcutHelp();
  const shortcuts: ShortcutGroup[] = useMemo(
    () => [
      {
        group: "ルーレット",
        items: [
          { key: "Space", description: "回す / もう一回" },
          { key: "r", description: "リセット" },
        ],
      },
    ],
    [],
  );
  useRegisterShortcuts(shortcuts);

  useEffect(() => {
    document.title = pageTitle("ルーレット");
  }, []);

  useHotkeys("?", () => openShortcutHelp(), { useKey: true, preventDefault: true });

  return (
    <div className="mt-4 mx-auto max-w-2xl space-y-6">
      <RouletteContent />
    </div>
  );
}
