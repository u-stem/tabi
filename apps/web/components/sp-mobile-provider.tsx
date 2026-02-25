"use client";

import { MobileContext } from "@/lib/hooks/use-is-mobile";

export function SpMobileProvider({ children }: { children: React.ReactNode }) {
  return <MobileContext.Provider value={true}>{children}</MobileContext.Provider>;
}
