import { useCallback, useEffect, useRef, useState } from "react";

const THRESHOLD = 80;
const MAX_PULL = 120;

function isDialogOrDrawerOpen(): boolean {
  return document.querySelector("[data-vaul-drawer], [role='dialog']") !== null;
}

type PullToRefreshState = {
  pulling: boolean;
  pullDistance: number;
  refreshing: boolean;
};

/**
 * Pull-to-refresh for a scroll container.
 * Returns state + touch handlers to attach to the scrollable element.
 */
export function usePullToRefresh(
  scrollRef: React.RefObject<HTMLElement | null>,
  onRefresh: () => Promise<void>,
) {
  const [state, setState] = useState<PullToRefreshState>({
    pulling: false,
    pullDistance: 0,
    refreshing: false,
  });

  const startYRef = useRef(0);
  const pullingRef = useRef(false);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      const el = scrollRef.current;
      if (!el || el.scrollTop > 0 || state.refreshing) return;
      if (isDialogOrDrawerOpen()) return;
      startYRef.current = e.touches[0].clientY;
      pullingRef.current = false;
    },
    [scrollRef, state.refreshing],
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      const el = scrollRef.current;
      if (!el || state.refreshing) return;
      if (isDialogOrDrawerOpen()) return;
      if (el.scrollTop > 0) {
        // Scrolled down — reset pull state
        if (pullingRef.current) {
          pullingRef.current = false;
          setState((s) => ({ ...s, pulling: false, pullDistance: 0 }));
        }
        return;
      }

      const deltaY = e.touches[0].clientY - startYRef.current;
      if (deltaY <= 0) return;

      // Prevent native scroll while pulling
      e.preventDefault();
      pullingRef.current = true;

      const distance = Math.min(deltaY * 0.5, MAX_PULL);
      setState((s) => ({ ...s, pulling: true, pullDistance: distance }));
    },
    [scrollRef, state.refreshing],
  );

  const handleTouchEnd = useCallback(async () => {
    if (!pullingRef.current) return;
    pullingRef.current = false;

    if (state.pullDistance >= THRESHOLD) {
      setState({ pulling: false, pullDistance: 0, refreshing: true });
      try {
        await onRefresh();
      } finally {
        setState({ pulling: false, pullDistance: 0, refreshing: false });
      }
    } else {
      setState({ pulling: false, pullDistance: 0, refreshing: false });
    }
  }, [state.pullDistance, onRefresh]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // passive: false needed to call preventDefault in touchmove
    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    el.addEventListener("touchend", handleTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
    };
  }, [scrollRef, handleTouchStart, handleTouchMove, handleTouchEnd]);

  return state;
}
