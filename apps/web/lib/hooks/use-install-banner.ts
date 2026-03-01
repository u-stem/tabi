import { useCallback, useEffect, useState } from "react";
import { useInstallPrompt } from "./use-install-prompt";

const DISMISSED_KEY = "install-banner-dismissed";

// Must be called only in effects (window/navigator not available during SSR)
function detectIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function detectStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches;
}

type BannerState = {
  isIos: boolean;
  isStandalone: boolean;
  dismissed: boolean;
};

export function useInstallBanner() {
  const { canInstall, promptInstall } = useInstallPrompt();
  // null = not yet mounted (SSR-safe: renders nothing until client-side init)
  const [state, setState] = useState<BannerState | null>(null);

  useEffect(() => {
    setState({
      isIos: detectIos(),
      isStandalone: detectStandalone(),
      dismissed: localStorage.getItem(DISMISSED_KEY) === "1",
    });
  }, []);

  const dismiss = useCallback(() => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setState((prev) => (prev ? { ...prev, dismissed: true } : prev));
  }, []);

  if (!state) {
    return { showBanner: false, isIos: false, canInstall, promptInstall, dismiss };
  }

  const { isIos, isStandalone, dismissed } = state;
  const showBanner = !isStandalone && !dismissed && (canInstall || isIos);

  return { showBanner, isIos, canInstall, promptInstall, dismiss };
}
