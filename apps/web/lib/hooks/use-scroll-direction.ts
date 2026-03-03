import { useEffect, useRef, useState } from "react";

// Returns true when UI chrome should be hidden (user is scrolling down).
// Resets to false when near the top of the page.
export function useScrollDirection(threshold = 8): boolean {
  const [hidden, setHidden] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    function handleScroll() {
      const currentY = window.scrollY;
      const diff = currentY - lastScrollY.current;
      lastScrollY.current = currentY;

      if (currentY < 50) {
        setHidden(false);
        return;
      }

      if (Math.abs(diff) < threshold) return;

      setHidden(diff > 0);
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [threshold]);

  return hidden;
}
