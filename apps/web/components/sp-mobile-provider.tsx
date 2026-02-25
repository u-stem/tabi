"use client";

import { MobileContext } from "@/lib/hooks/use-is-mobile";

export function SpMobileProvider({ children }: { children: React.ReactNode }) {
  return <MobileContext.Provider value={true}>{children}</MobileContext.Provider>;
}

// Use in desktop layouts so useMobile() always returns false regardless of viewport width.
// Without this, narrow desktop windows (< 768px) would be treated as mobile.
export function DesktopMobileProvider({ children }: { children: React.ReactNode }) {
  return <MobileContext.Provider value={false}>{children}</MobileContext.Provider>;
}
