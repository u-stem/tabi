import { useEffect, useRef, useState } from "react";
import { useSpScrollContainer } from "@/components/sp-scroll-container";

// Returns true when UI chrome should be hidden (user is scrolling down).
// Resets to false when near the top of the page.
export function useScrollDirection(threshold = 8): boolean {
  const scrollContainerRef = useSpScrollContainer();
  const [hidden, setHidden] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const el = scrollContainerRef?.current ?? null;
    const target: EventTarget = el ?? window;

    function handleScroll() {
      const currentY = el ? el.scrollTop : window.scrollY;
      const diff = currentY - lastScrollY.current;
      lastScrollY.current = currentY;

      if (currentY < 50) {
        setHidden(false);
        return;
      }

      if (Math.abs(diff) < threshold) return;

      setHidden(diff > 0);
    }

    target.addEventListener("scroll", handleScroll, { passive: true });
    return () => target.removeEventListener("scroll", handleScroll);
  }, [threshold, scrollContainerRef]);

  return hidden;
}
