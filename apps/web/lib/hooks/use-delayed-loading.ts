import { useEffect, useRef, useState } from "react";

const DEFAULT_DELAY_MS = 200;

/**
 * Delays showing loading state to avoid skeleton flash on fast loads.
 * Returns true only after `delay` ms have elapsed while `loading` is true.
 * Once shown, stays true for at least `delay` ms to prevent flickering.
 */
export function useDelayedLoading(loading: boolean, delay = DEFAULT_DELAY_MS): boolean {
  const [show, setShow] = useState(false);
  const shownAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!loading) {
      if (shownAtRef.current === null) {
        // Skeleton was never shown, just reset
        setShow(false);
        return;
      }
      // Ensure minimum display time before hiding
      const elapsed = Date.now() - shownAtRef.current;
      if (elapsed >= delay) {
        setShow(false);
        shownAtRef.current = null;
        return;
      }
      const timer = setTimeout(() => {
        setShow(false);
        shownAtRef.current = null;
      }, delay - elapsed);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => {
      setShow(true);
      shownAtRef.current = Date.now();
    }, delay);
    return () => clearTimeout(timer);
  }, [loading, delay]);

  return show;
}
