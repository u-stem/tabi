import { type RefObject, useEffect, useRef } from "react";

// Minimum horizontal distance to trigger a swipe
const SWIPE_THRESHOLD = 50;
// Distance to determine initial direction (horizontal vs vertical)
const LOCK_THRESHOLD = 15;
// dx must exceed dy by this factor to lock as horizontal —
// prevents diagonal scrolls from accidentally triggering tab switches
const HORIZONTAL_BIAS = 1.5;

/**
 * Detect horizontal swipes on a container and call onSwipe with direction.
 * Uses initial movement direction to decide: if the first significant move
 * is vertical, the swipe is cancelled so scrolling works normally.
 */
export function useSwipeTab(
  ref: RefObject<HTMLElement | null>,
  onSwipe: (direction: "left" | "right") => void,
  enabled = true,
) {
  // Store callback in ref so the effect never re-runs on callback changes.
  // This prevents listener detach/re-attach between tab switches which was
  // breaking the first swipe after a tab change.
  const onSwipeRef = useRef(onSwipe);
  onSwipeRef.current = onSwipe;

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;

    let startX = 0;
    let startY = 0;
    let axis: "pending" | "horizontal" | "vertical" = "pending";

    function handleTouchStart(e: TouchEvent) {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      axis = "pending";
    }

    function handleTouchMove(e: TouchEvent) {
      if (axis !== "pending") return;

      const dx = Math.abs(e.touches[0].clientX - startX);
      const dy = Math.abs(e.touches[0].clientY - startY);

      if (dx >= LOCK_THRESHOLD || dy >= LOCK_THRESHOLD) {
        axis = dx > dy * HORIZONTAL_BIAS ? "horizontal" : "vertical";
      }
    }

    function handleTouchEnd(e: TouchEvent) {
      if (axis !== "horizontal") return;

      const dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) < SWIPE_THRESHOLD) return;

      onSwipeRef.current(dx < 0 ? "left" : "right");
    }

    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchmove", handleTouchMove, { passive: true });
    el.addEventListener("touchend", handleTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
    };
  }, [ref, enabled]);
}
