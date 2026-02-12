"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ShortcutGroup } from "@/components/shortcut-help-dialog";
import { ShortcutHelpDialog } from "@/components/shortcut-help-dialog";

type ShortcutHelpContextValue = {
  open: () => void;
  register: (shortcuts: ShortcutGroup[]) => void;
};

const ShortcutHelpContext = createContext<ShortcutHelpContextValue | null>(null);

export function ShortcutHelpProvider({ children }: { children: React.ReactNode }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [shortcuts, setShortcuts] = useState<ShortcutGroup[]>([]);

  const value = useMemo<ShortcutHelpContextValue>(
    () => ({
      open: () => setDialogOpen(true),
      register: setShortcuts,
    }),
    [],
  );

  return (
    <ShortcutHelpContext.Provider value={value}>
      {children}
      <ShortcutHelpDialog open={dialogOpen} onOpenChange={setDialogOpen} shortcuts={shortcuts} />
    </ShortcutHelpContext.Provider>
  );
}

export function useShortcutHelp() {
  const ctx = useContext(ShortcutHelpContext);
  if (!ctx) throw new Error("useShortcutHelp must be used within ShortcutHelpProvider");
  return ctx;
}

/**
 * Register page-specific shortcuts and clean up on unmount.
 */
export function useRegisterShortcuts(shortcuts: ShortcutGroup[]) {
  const { register } = useShortcutHelp();
  useEffect(() => {
    register(shortcuts);
    return () => register([]);
  }, [shortcuts, register]);
}
