import { useCallback, useEffect, useRef, useState } from "react";

const THRESHOLD = 60;

type UsePullToRefreshOptions = {
  onRefresh: () => Promise<unknown>;
  enabled?: boolean;
};

export function usePullToRefresh({ onRefresh, enabled = true }: UsePullToRefreshOptions) {
  const [pulling, setPulling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const currentY = useRef(0);
  // Use refs so event listeners don't need to re-register on state changes
  const pullingRef = useRef(false);
  const pullDistanceRef = useRef(0);
  const refreshingRef = useRef(false);

  pullingRef.current = pulling;
  pullDistanceRef.current = pullDistance;
  refreshingRef.current = refreshing;

  const handleRefresh = useCallback(async () => {
    if (refreshingRef.current) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
      setPullDistance(0);
    }
  }, [onRefresh]);

  const handleRefreshRef = useRef(handleRefresh);
  handleRefreshRef.current = handleRefresh;

  useEffect(() => {
    if (!enabled) return;

    function onTouchStart(e: TouchEvent) {
      if (window.scrollY > 0 || refreshingRef.current) return;
      startY.current = e.touches[0].clientY;
      currentY.current = startY.current;
    }

    function onTouchMove(e: TouchEvent) {
      if (window.scrollY > 0 || refreshingRef.current) return;
      currentY.current = e.touches[0].clientY;
      const distance = currentY.current - startY.current;
      if (distance > 0) {
        const dampened = Math.min(distance * 0.4, THRESHOLD * 2);
        if (!pullingRef.current) setPulling(true);
        setPullDistance(dampened);
      }
    }

    function onTouchEnd() {
      if (!pullingRef.current) return;
      setPulling(false);
      if (pullDistanceRef.current >= THRESHOLD) {
        handleRefreshRef.current();
      } else {
        setPullDistance(0);
      }
    }

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [enabled]);

  return { pulling, refreshing, pullDistance, threshold: THRESHOLD };
}
