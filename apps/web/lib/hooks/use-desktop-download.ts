import { useEffect, useState } from "react";
import { MOBILE_UA_REGEX } from "@/lib/view-mode";

export const DESKTOP_RELEASES_URL = "https://github.com/u-stem/sugara-releases/releases/latest";

/**
 * Returns whether to show the desktop app download link.
 * Hidden when already running as the Tauri app, as a PWA, or on mobile.
 */
export function useDesktopDownload(): { showLink: boolean } {
  const [showLink, setShowLink] = useState(false);

  useEffect(() => {
    const isDesktopApp = navigator.userAgent.includes("sugara-desktop");
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
    const isMobile = MOBILE_UA_REGEX.test(navigator.userAgent);
    setShowLink(!isDesktopApp && !isStandalone && !isMobile);
  }, []);

  return { showLink };
}
