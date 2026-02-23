import { type RefObject, useEffect, useRef } from "react";

// Minimum horizontal distance to trigger a swipe
const SWIPE_THRESHOLD = 60;
// Distance to determine initial direction (horizontal vs vertical)
const LOCK_THRESHOLD = 10;

/**
 * Detect horizontal swipes on a container and call onSwipe with direction.
 * Uses initial movement direction to decide: if the first significant move
 * is vertical, the swipe is cancelled so scrolling works normally.
 */
export function useSwipeTab(
  ref: RefObject<HTMLElement | null>,
  onSwipe: (direction: "left" | "right") => void,
) {
  const startX = useRef(0);
  const startY = useRef(0);
  // "pending" = not yet determined, "horizontal" / "vertical" = locked
  const axis = useRef<"pending" | "horizontal" | "vertical">("pending");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    function handleTouchStart(e: TouchEvent) {
      startX.current = e.touches[0].clientX;
      startY.current = e.touches[0].clientY;
      axis.current = "pending";
    }

    function handleTouchMove(e: TouchEvent) {
      if (axis.current !== "pending") return;

      const dx = Math.abs(e.touches[0].clientX - startX.current);
      const dy = Math.abs(e.touches[0].clientY - startY.current);

      if (dx >= LOCK_THRESHOLD || dy >= LOCK_THRESHOLD) {
        axis.current = dx > dy ? "horizontal" : "vertical";
      }
    }

    function handleTouchEnd(e: TouchEvent) {
      if (axis.current !== "horizontal") return;

      const dx = e.changedTouches[0].clientX - startX.current;
      if (Math.abs(dx) < SWIPE_THRESHOLD) return;

      onSwipe(dx < 0 ? "left" : "right");
    }

    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchmove", handleTouchMove, { passive: true });
    el.addEventListener("touchend", handleTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
    };
  }, [ref, onSwipe]);
}
