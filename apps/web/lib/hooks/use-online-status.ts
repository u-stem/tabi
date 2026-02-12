import { useEffect, useRef, useState } from "react";

// Verify actual connectivity with a lightweight request to the app origin.
// navigator.onLine can be false even when localhost is reachable (no internet but local dev works).
async function verifyConnectivity(signal?: AbortSignal): Promise<boolean> {
  try {
    const res = await fetch(`/?_t=${Date.now()}`, {
      method: "HEAD",
      cache: "no-store",
      signal,
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!navigator.onLine) {
      // navigator.onLine can be wrong (e.g. no internet but localhost works);
      // verify with a real fetch before showing offline banner
      const ac = new AbortController();
      abortRef.current = ac;
      verifyConnectivity(ac.signal).then((reachable) => {
        if (!ac.signal.aborted) {
          setOnline(reachable);
        }
      });
    }

    function handleOnline() {
      // Cancel any pending offline verification so it won't override this
      abortRef.current?.abort();
      abortRef.current = null;
      setOnline(true);
    }

    async function handleOffline() {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      const reachable = await verifyConnectivity(ac.signal);
      if (!ac.signal.aborted && !reachable) {
        setOnline(false);
      }
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      abortRef.current?.abort();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return online;
}
