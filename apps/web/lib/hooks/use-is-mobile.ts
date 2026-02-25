import { createContext, useContext, useEffect, useState } from "react";

// Intentionally narrower than the layout breakpoint:
// avoid treating narrow desktop windows as mobile.
const MOBILE_BREAKPOINT = 768;

// SP pages set this to true so shared components don't rely on screen width.
export const MobileContext = createContext<boolean | null>(null);

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    setIsMobile(mql.matches);

    function onChange(e: MediaQueryListEvent) {
      setIsMobile(e.matches);
    }

    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    }

    // Older Safari fallback
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, []);

  return isMobile;
}

// Use this in shared components. SP layout provides true via MobileContext;
// desktop pages fall back to the screen-width hook.
export function useMobile(): boolean {
  const ctx = useContext(MobileContext);
  const isMobile = useIsMobile();
  return ctx !== null ? ctx : isMobile;
}
