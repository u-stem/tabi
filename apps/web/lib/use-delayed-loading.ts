import { useEffect, useState } from "react";

const DEFAULT_DELAY_MS = 200;

/**
 * Delays showing loading state to avoid skeleton flash on fast loads.
 * Returns true only after `delay` ms have elapsed while `loading` is true.
 */
export function useDelayedLoading(loading: boolean, delay = DEFAULT_DELAY_MS): boolean {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!loading) {
      setShow(false);
      return;
    }
    const timer = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(timer);
  }, [loading, delay]);

  return show;
}
