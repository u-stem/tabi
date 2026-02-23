import { useEffect, useState } from "react";

// Matches Tailwind's lg: breakpoint (1024px)
const LG_BREAKPOINT = 1024;

export function useIsLg(): boolean {
  const [isLg, setIsLg] = useState(false);

  useEffect(() => {
    const mql = matchMedia(`(min-width: ${LG_BREAKPOINT}px)`);
    setIsLg(mql.matches);

    function onChange(e: MediaQueryListEvent) {
      setIsLg(e.matches);
    }

    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isLg;
}
