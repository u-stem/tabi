import { useEffect, useRef, useState } from "react";
import { useSpActiveScrollElement, useSpScrollContainer } from "@/components/sp-scroll-container";

// Returns true when UI chrome should be hidden (user is scrolling down).
// Resets to false when near the top of the page.
// Prefers activeScrollElement (set by SpSwipeTabs) over SpScrollContainer.
export function useScrollDirection(threshold = 8): boolean {
  const scrollContainerRef = useSpScrollContainer();
  const activeScrollElement = useSpActiveScrollElement();
  const [hidden, setHidden] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const el = activeScrollElement ?? scrollContainerRef?.current ?? null;
    const target: EventTarget = el ?? window;

    // Reset tracking and visibility when the scroll target changes (e.g. tab switch)
    lastScrollY.current = el ? el.scrollTop : window.scrollY;
    setHidden(false);

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
  }, [threshold, scrollContainerRef, activeScrollElement]);

  return hidden;
}
