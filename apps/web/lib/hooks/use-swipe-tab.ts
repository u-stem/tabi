import { type RefObject, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

const SWIPE_THRESHOLD = 50;
const LOCK_THRESHOLD = 18;
const HORIZONTAL_BIAS = 1.8;
const VELOCITY_THRESHOLD = 0.3;
const SNAP_DURATION = 250;
// a[href] is intentionally excluded: horizontal swipes on links cancel the
// browser's click (pointer moved too far), so links still work on true taps.
const SWIPE_IGNORE_SELECTOR = [
  "input",
  "textarea",
  "select",
  "button",
  "[role='button']",
  "[role='link']",
  "[role='combobox']",
  "[role='menuitem']",
  "[contenteditable='true']",
  "[data-swipe-ignore='true']",
].join(", ");

export type SwipeState = {
  adjacent: "prev" | "next" | null;
  isAnimating: boolean;
};

function shouldIgnoreSwipeStart(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest("[data-allow-swipe='true']")) return false;
  return target.closest(SWIPE_IGNORE_SELECTOR) !== null;
}

/**
 * Native-like finger-following swipe between tabs.
 *
 * Applies translateX directly to swipeRef for 60fps tracking,
 * only uses React state for adjacent tab mount/unmount and animation flag.
 *
 * Pointer events are used as the primary path so swipe still works inside
 * interactive controls that manipulate pointer capture (e.g. Radix Select).
 * Touch events are kept as a fallback for environments where pointer events
 * can be inconsistent.
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
    const containerEl = containerRef.current;
    const swipeEl = swipeRef.current;
    if (!containerEl || !swipeEl || options.enabled === false) return;
    const container = containerEl;
    const swipe = swipeEl;

    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let axis: "pending" | "horizontal" | "vertical" = "pending";
    let containerWidth = 0;
    let adjacentSet: "prev" | "next" | null = null;
    let animating = false;
    let tracking = false;
    let trackingSource: "pointer" | "touch" | null = null;
    let activePointerId: number | null = null;
    let activeTouchId: number | null = null;
    let unmounted = false;

    function resetSwipe() {
      axis = "pending";
      adjacentSet = null;
      animating = false;
      tracking = false;
      trackingSource = null;
      activePointerId = null;
      activeTouchId = null;
      swipe.style.transform = "";
      swipe.style.transition = "";
      setAdjacent(null);
      setIsAnimating(false);
    }

    function handleTransitionEnd() {
      swipe.removeEventListener("transitionend", handleTransitionEnd);
      if (unmounted || !animating) return;

      const opts = optionsRef.current;
      const currentTransform = swipe.style.transform;
      const isFullSlide =
        currentTransform.includes(`${containerWidth}`) ||
        currentTransform.includes(`${-containerWidth}`);

      if (isFullSlide) {
        const direction = currentTransform.includes("-") ? "left" : "right";
        // Flush React state synchronously so the new tab content renders
        // BEFORE we clear the transform — prevents one-frame flicker
        flushSync(() => {
          setAdjacent(null);
          setIsAnimating(false);
          opts.onSwipeComplete(direction);
        });
        axis = "pending";
        adjacentSet = null;
        animating = false;
        tracking = false;
        trackingSource = null;
        activePointerId = null;
        swipe.style.transform = "";
        swipe.style.transition = "";
      } else {
        resetSwipe();
      }
    }

    function startSwipe(clientX: number, clientY: number, source: "pointer" | "touch") {
      if (animating) return;
      containerWidth = container.offsetWidth;
      // Bail out if the container has no width (e.g. hidden/unmeasured) to
      // prevent the transform string comparison from producing false positives.
      if (containerWidth === 0) return;
      startX = clientX;
      startY = clientY;
      startTime = Date.now();
      axis = "pending";
      tracking = true;
      trackingSource = source;
    }

    function moveSwipe(clientX: number, clientY: number) {
      if (!tracking || animating || axis === "vertical") return;
      const dx = clientX - startX;
      const dy = clientY - startY;
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

      swipe.style.transform = `translateX(${translateX}px)`;
    }

    function endSwipe(clientX: number) {
      if (!tracking) return;
      trackingSource = null;
      activePointerId = null;
      if (animating || axis !== "horizontal") {
        if (axis === "pending") resetSwipe();
        return;
      }

      const dx = clientX - startX;
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
        swipe.addEventListener("transitionend", handleTransitionEnd, { once: true });
        swipe.style.transition = `transform ${SNAP_DURATION}ms cubic-bezier(0.2, 0, 0, 1)`;
        // Force reflow so transition fires from current position
        swipe.offsetHeight;
        swipe.style.transform = `translateX(${targetX}px)`;
      } else {
        // Spring back to origin
        animating = true;
        setIsAnimating(true);
        swipe.addEventListener("transitionend", handleTransitionEnd, { once: true });
        swipe.style.transition = `transform ${SNAP_DURATION}ms cubic-bezier(0.2, 0, 0, 1)`;
        swipe.offsetHeight;
        swipe.style.transform = "translateX(0px)";
      }
    }

    function handlePointerDown(e: PointerEvent) {
      if (e.pointerType !== "touch") return;
      if (shouldIgnoreSwipeStart(e.target)) return;
      if (trackingSource && trackingSource !== "pointer") return;
      if (activePointerId !== null) return;
      activePointerId = e.pointerId;
      startSwipe(e.clientX, e.clientY, "pointer");
    }

    function handlePointerMove(e: PointerEvent) {
      if (trackingSource !== "pointer" || activePointerId !== e.pointerId) return;
      moveSwipe(e.clientX, e.clientY);
    }

    function handlePointerUp(e: PointerEvent) {
      if (trackingSource !== "pointer" || activePointerId !== e.pointerId) return;
      endSwipe(e.clientX);
    }

    function handlePointerCancel(e: PointerEvent) {
      if (trackingSource !== "pointer" || activePointerId !== e.pointerId) return;
      resetSwipe();
    }

    function handleTouchStart(e: TouchEvent) {
      if (shouldIgnoreSwipeStart(e.target)) return;
      if (trackingSource === "pointer") return;
      if (activeTouchId !== null) return;
      const point = e.touches[0];
      if (!point) return;
      activeTouchId = point.identifier;
      startSwipe(point.clientX, point.clientY, "touch");
    }

    function handleTouchMove(e: TouchEvent) {
      if (trackingSource !== "touch") return;
      const point = Array.from(e.touches).find((t) => t.identifier === activeTouchId);
      if (!point) return;
      moveSwipe(point.clientX, point.clientY);
    }

    function handleTouchEnd(e: TouchEvent) {
      if (trackingSource !== "touch") return;
      const point = Array.from(e.changedTouches).find((t) => t.identifier === activeTouchId);
      if (!point) return;
      activeTouchId = null;
      endSwipe(point.clientX);
    }

    function handleTouchCancel() {
      if (trackingSource !== "touch") return;
      activeTouchId = null;
      resetSwipe();
    }

    // Intercept swipe start before nested controls update pointer capture.
    container.addEventListener("pointerdown", handlePointerDown, {
      passive: true,
      capture: true,
    });
    // Keep move/up on document to survive capture shifts from nested controls.
    document.addEventListener("pointermove", handlePointerMove, { passive: true });
    document.addEventListener("pointerup", handlePointerUp, { passive: true });
    document.addEventListener("pointercancel", handlePointerCancel, { passive: true });
    // Touch fallback path for environments where pointer events can be flaky.
    container.addEventListener("touchstart", handleTouchStart, { passive: true, capture: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: true });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });
    document.addEventListener("touchcancel", handleTouchCancel, { passive: true });

    return () => {
      unmounted = true;
      container.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
      document.removeEventListener("pointercancel", handlePointerCancel);
      container.removeEventListener("touchstart", handleTouchStart, true);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
      document.removeEventListener("touchcancel", handleTouchCancel);
      swipe.style.transform = "";
      swipe.style.transition = "";
    };
  }, [containerRef, swipeRef, options.enabled]);

  return { adjacent, isAnimating };
}
