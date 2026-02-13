import { useCallback, useRef } from "react";

const LONG_PRESS_DURATION = 500;

type UseLongPressOptions = {
  onLongPress: (position: { x: number; y: number }) => void;
};

export function useLongPress({ onLongPress }: UseLongPressOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const posRef = useRef({ x: 0, y: 0 });
  const movedRef = useRef(false);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      posRef.current = { x: touch.clientX, y: touch.clientY };
      movedRef.current = false;

      timerRef.current = setTimeout(() => {
        if (!movedRef.current) {
          onLongPress(posRef.current);
        }
      }, LONG_PRESS_DURATION);
    },
    [onLongPress],
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      const dx = touch.clientX - posRef.current.x;
      const dy = touch.clientY - posRef.current.y;
      // Cancel if finger moves more than 10px
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        movedRef.current = true;
        clear();
      }
    },
    [clear],
  );

  const onTouchEnd = useCallback(() => {
    clear();
  }, [clear]);

  return { onTouchStart, onTouchMove, onTouchEnd };
}
