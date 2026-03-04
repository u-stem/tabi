"use client";

import { useHotkeys } from "react-hotkeys-hook";
import { useShortcutHelp } from "@/lib/shortcut-help-context";

/**
 * Registers the "?" key globally so the shortcut help dialog can be opened
 * from any authenticated page, not just pages that define their own shortcuts.
 */
export function GlobalShortcutHotkey() {
  const { open } = useShortcutHelp();
  useHotkeys("?", open, { useKey: true, preventDefault: true });
  return null;
}
