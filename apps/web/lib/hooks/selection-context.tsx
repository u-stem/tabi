"use client";

import { createContext, useContext } from "react";
import type { useScheduleSelection } from "./use-schedule-selection";

type SelectionContextValue = ReturnType<typeof useScheduleSelection> & {
  canEnter: boolean;
};

const SelectionContext = createContext<SelectionContextValue | null>(null);

export function SelectionProvider({
  value,
  children,
}: {
  value: SelectionContextValue;
  children: React.ReactNode;
}) {
  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

export function useSelection() {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error("useSelection must be used within SelectionProvider");
  return ctx;
}
