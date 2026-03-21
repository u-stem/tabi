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
 * When activeScrollElement is set, touch listeners attach to that element
 * and scrollTop checks use it instead of scrollRef.
 */
export function usePullToRefresh(
  scrollRef: React.RefObject<HTMLElement | null>,
  activeScrollElement: HTMLElement | null,
  onRefresh: () => Promise<void>,
) {
  const [state, setState] = useState<PullToRefreshState>({
    pulling: false,
    pullDistance: 0,
    refreshing: false,
  });

  const startYRef = useRef(0);
  const startXRef = useRef(0);
  const pullingRef = useRef(false);
  const refreshingRef = useRef(false);
  const pullDistanceRef = useRef(0);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (refreshingRef.current) return;
      if (activeScrollElement && activeScrollElement.scrollTop > 0) return;
      if (!activeScrollElement && scrollRef.current && scrollRef.current.scrollTop > 0) return;
      if (isDialogOrDrawerOpen()) return;
      startYRef.current = e.touches[0].clientY;
      startXRef.current = e.touches[0].clientX;
      pullingRef.current = false;
    },
    [scrollRef, activeScrollElement],
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (refreshingRef.current) return;
      if (isDialogOrDrawerOpen()) return;
      const scrolledDown = activeScrollElement
        ? activeScrollElement.scrollTop > 0
        : scrollRef.current
          ? scrollRef.current.scrollTop > 0
          : false;
      if (scrolledDown) {
        if (pullingRef.current) {
          pullingRef.current = false;
          setState((s) => ({ ...s, pulling: false, pullDistance: 0 }));
        }
        return;
      }

      const deltaY = e.touches[0].clientY - startYRef.current;
      if (deltaY <= 0) return;

      // Allow horizontal swipe (e.g. tab switching) without interference
      const deltaX = e.touches[0].clientX - startXRef.current;
      if (Math.abs(deltaX) > Math.abs(deltaY)) return;

      if (e.cancelable) e.preventDefault();
      pullingRef.current = true;

      const distance = Math.min(deltaY * 0.5, MAX_PULL);
      pullDistanceRef.current = distance;
      setState((s) => ({ ...s, pulling: true, pullDistance: distance }));
    },
    [scrollRef, activeScrollElement],
  );

  const handleTouchEnd = useCallback(async () => {
    if (!pullingRef.current) return;
    pullingRef.current = false;

    if (pullDistanceRef.current >= THRESHOLD) {
      refreshingRef.current = true;
      setState({ pulling: false, pullDistance: 0, refreshing: true });
      try {
        await onRefreshRef.current();
      } finally {
        refreshingRef.current = false;
        setState({ pulling: false, pullDistance: 0, refreshing: false });
      }
    } else {
      setState({ pulling: false, pullDistance: 0, refreshing: false });
    }
    pullDistanceRef.current = 0;
  }, []);

  useEffect(() => {
    const el = activeScrollElement ?? scrollRef.current;
    if (!el) return;
    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    el.addEventListener("touchend", handleTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
    };
  }, [scrollRef, activeScrollElement, handleTouchStart, handleTouchMove, handleTouchEnd]);

  return state;
}
