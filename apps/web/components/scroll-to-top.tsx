"use client";

import { ChevronUp } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type ScrollToTopProps = {
  /** Scrollable container ref. Falls back to window if not provided. */
  containerRef?: React.RefObject<HTMLElement | null>;
  /** Scroll threshold in px before showing the button */
  threshold?: number;
};

export function ScrollToTop({ containerRef, threshold = 200 }: ScrollToTopProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const target = containerRef?.current ?? window;

    function handleScroll() {
      const scrollTop =
        target instanceof Window ? target.scrollY : (target as HTMLElement).scrollTop;
      setVisible(scrollTop > threshold);
    }

    target.addEventListener("scroll", handleScroll, { passive: true });
    return () => target.removeEventListener("scroll", handleScroll);
  }, [containerRef, threshold]);

  function scrollToTop() {
    const target = containerRef?.current ?? window;
    target.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (!visible) return null;

  return (
    <div className="sticky bottom-4 z-10 flex justify-end">
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8 rounded-full shadow-md"
        onClick={scrollToTop}
        aria-label="トップに戻る"
      >
        <ChevronUp className="h-4 w-4" />
      </Button>
    </div>
  );
}
