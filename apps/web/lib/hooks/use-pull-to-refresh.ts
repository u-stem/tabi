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

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
      setPullDistance(0);
    }
  }, [onRefresh]);

  useEffect(() => {
    if (!enabled) return;

    function onTouchStart(e: TouchEvent) {
      if (window.scrollY > 0 || refreshing) return;
      startY.current = e.touches[0].clientY;
      currentY.current = startY.current;
    }

    function onTouchMove(e: TouchEvent) {
      if (window.scrollY > 0 || refreshing) return;
      currentY.current = e.touches[0].clientY;
      const distance = currentY.current - startY.current;
      if (distance > 0) {
        // Dampen the pull distance for a natural feel
        const dampened = Math.min(distance * 0.4, THRESHOLD * 2);
        setPulling(true);
        setPullDistance(dampened);
      }
    }

    function onTouchEnd() {
      if (!pulling) return;
      setPulling(false);
      if (pullDistance >= THRESHOLD) {
        handleRefresh();
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
  }, [enabled, pulling, pullDistance, refreshing, handleRefresh]);

  return { pulling, refreshing, pullDistance, threshold: THRESHOLD };
}
