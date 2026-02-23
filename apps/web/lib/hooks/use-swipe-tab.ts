import { type RefObject, useEffect, useRef, useState } from "react";

const SWIPE_THRESHOLD = 50;
const LOCK_THRESHOLD = 15;
const HORIZONTAL_BIAS = 1.5;
const VELOCITY_THRESHOLD = 0.3;
const SNAP_DURATION = 250;

export type SwipeState = {
  adjacent: "prev" | "next" | null;
  isAnimating: boolean;
};

/**
 * Native-like finger-following swipe between tabs.
 *
 * Applies translateX directly to swipeRef for 60fps tracking,
 * only uses React state for adjacent tab mount/unmount and animation flag.
 * All listeners use capture phase to intercept before Radix UI components.
 */
export function useSwipeTab(
  containerRef: RefObject<HTMLElement | null>,
  swipeRef: RefObject<HTMLElement | null>,
  options: {
    onSwipeComplete: (direction: "left" | "right") => void;
    enabled?: boolean;
    canSwipePrev: boolean;
    canSwipeNext: boolean;
  },
): SwipeState {
  const [adjacent, setAdjacent] = useState<"prev" | "next" | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    const container = containerRef.current;
    const swipeEl = swipeRef.current;
    if (!container || !swipeEl || options.enabled === false) return;

    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let axis: "pending" | "horizontal" | "vertical" = "pending";
    let containerWidth = 0;
    let adjacentSet: "prev" | "next" | null = null;
    let animating = false;

    function resetSwipe() {
      axis = "pending";
      adjacentSet = null;
      animating = false;
      swipeEl!.style.transform = "";
      swipeEl!.style.transition = "";
      setAdjacent(null);
      setIsAnimating(false);
    }

    function handleTransitionEnd() {
      swipeEl!.removeEventListener("transitionend", handleTransitionEnd);
      if (!animating) return;

      const opts = optionsRef.current;
      // Determine if this was a complete swipe (moved to full width) or spring-back
      const currentTransform = swipeEl!.style.transform;
      const isFullSlide = currentTransform.includes(`${containerWidth}`) ||
        currentTransform.includes(`${-containerWidth}`);

      if (isFullSlide) {
        const direction = currentTransform.includes("-") ? "left" : "right";
        resetSwipe();
        opts.onSwipeComplete(direction);
      } else {
        resetSwipe();
      }
    }

    function handleTouchStart(e: TouchEvent) {
      if (animating) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      startTime = Date.now();
      axis = "pending";
      containerWidth = container!.offsetWidth;
    }

    function handleTouchMove(e: TouchEvent) {
      if (animating || axis === "vertical") return;

      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      const dx = currentX - startX;
      const dy = currentY - startY;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      if (axis === "pending") {
        if (absDx < LOCK_THRESHOLD && absDy < LOCK_THRESHOLD) return;
        axis = absDx > absDy * HORIZONTAL_BIAS ? "horizontal" : "vertical";
        if (axis === "vertical") return;
      }

      const opts = optionsRef.current;
      const canPrev = opts.canSwipePrev;
      const canNext = opts.canSwipeNext;

      // Set adjacent tab (once per swipe direction)
      if (dx < 0 && canNext && adjacentSet !== "next") {
        adjacentSet = "next";
        setAdjacent("next");
      } else if (dx > 0 && canPrev && adjacentSet !== "prev") {
        adjacentSet = "prev";
        setAdjacent("prev");
      }

      // Rubber-band at edges
      let translateX: number;
      if (dx < 0 && !canNext) {
        translateX = dx / 3;
      } else if (dx > 0 && !canPrev) {
        translateX = dx / 3;
      } else {
        translateX = dx;
      }

      swipeEl!.style.transform = `translateX(${translateX}px)`;
    }

    function handleTouchEnd(e: TouchEvent) {
      if (animating || axis !== "horizontal") {
        if (axis === "pending") resetSwipe();
        return;
      }

      const dx = e.changedTouches[0].clientX - startX;
      const absDx = Math.abs(dx);
      const elapsed = Date.now() - startTime;
      const velocity = elapsed > 0 ? absDx / elapsed : 0;

      const opts = optionsRef.current;
      const canPrev = opts.canSwipePrev;
      const canNext = opts.canSwipeNext;

      const isSwipeLeft = dx < 0 && canNext;
      const isSwipeRight = dx > 0 && canPrev;
      const meetsThreshold = absDx >= SWIPE_THRESHOLD || velocity >= VELOCITY_THRESHOLD;

      if (meetsThreshold && (isSwipeLeft || isSwipeRight)) {
        // Snap to full width
        animating = true;
        setIsAnimating(true);
        const targetX = dx < 0 ? -containerWidth : containerWidth;
        swipeEl!.addEventListener("transitionend", handleTransitionEnd, { once: true });
        swipeEl!.style.transition = `transform ${SNAP_DURATION}ms cubic-bezier(0.2, 0, 0, 1)`;
        // Force reflow so transition fires from current position
        swipeEl!.offsetHeight;
        swipeEl!.style.transform = `translateX(${targetX}px)`;
      } else {
        // Spring back to origin
        animating = true;
        setIsAnimating(true);
        swipeEl!.addEventListener("transitionend", handleTransitionEnd, { once: true });
        swipeEl!.style.transition = `transform ${SNAP_DURATION}ms cubic-bezier(0.2, 0, 0, 1)`;
        swipeEl!.offsetHeight;
        swipeEl!.style.transform = "translateX(0px)";
      }
    }

    const listenerOptions = { passive: true, capture: true } as const;
    container.addEventListener("touchstart", handleTouchStart, listenerOptions);
    container.addEventListener("touchmove", handleTouchMove, listenerOptions);
    container.addEventListener("touchend", handleTouchEnd, listenerOptions);

    return () => {
      container.removeEventListener("touchstart", handleTouchStart, true);
      container.removeEventListener("touchmove", handleTouchMove, true);
      container.removeEventListener("touchend", handleTouchEnd, true);
      swipeEl.style.transform = "";
      swipeEl.style.transition = "";
    };
  }, [containerRef, swipeRef, options.enabled]);

  return { adjacent, isAnimating };
}
