import { type RefObject, useEffect, useRef } from "react";

const SWIPE_THRESHOLD = 50;
const ANGLE_THRESHOLD = 30; // degrees — reject steep vertical gestures

/**
 * Detect horizontal swipes on a container and call onSwipe with direction.
 * Ignores swipes that are more vertical than horizontal.
 */
export function useSwipeTab(
  ref: RefObject<HTMLElement | null>,
  onSwipe: (direction: "left" | "right") => void,
) {
  const startX = useRef(0);
  const startY = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    function handleTouchStart(e: TouchEvent) {
      startX.current = e.touches[0].clientX;
      startY.current = e.touches[0].clientY;
    }

    function handleTouchEnd(e: TouchEvent) {
      const dx = e.changedTouches[0].clientX - startX.current;
      const dy = e.changedTouches[0].clientY - startY.current;
      const angle = Math.abs(Math.atan2(dy, dx) * (180 / Math.PI));

      // Only trigger for mostly-horizontal gestures
      if (Math.abs(dx) < SWIPE_THRESHOLD) return;
      if (angle > ANGLE_THRESHOLD && angle < 180 - ANGLE_THRESHOLD) return;

      onSwipe(dx < 0 ? "left" : "right");
    }

    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchend", handleTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchend", handleTouchEnd);
    };
  }, [ref, onSwipe]);
}
