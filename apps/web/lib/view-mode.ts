/**
 * View mode utility for desktop/SP (smartphone) page switching.
 *
 * Uses a cookie (`x-view-mode`) to persist the user's preference.
 * - `"sp"` — force SP pages
 * - `"desktop"` — force desktop pages
 * - absent — auto-detect via User-Agent (middleware handles this)
 */

export const VIEW_MODE_COOKIE = "x-view-mode";
export type ViewMode = "desktop" | "sp";

/** Authenticated routes that have SP counterparts. */
export const SP_ROUTES = ["/home", "/bookmarks", "/friends", "/trips"] as const;

/** Path prefix for all SP pages. */
export const SP_PREFIX = "/sp";

/**
 * Set the view mode cookie and navigate to the appropriate version.
 * Call this from client components (header toggle button, etc.).
 */
export function switchViewMode(mode: ViewMode): void {
  // Set cookie with 1-year expiry
  document.cookie = `${VIEW_MODE_COOKIE}=${mode}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;

  const { pathname, search, hash } = window.location;

  if (mode === "sp") {
    // Currently on desktop → navigate to SP
    if (!pathname.startsWith(SP_PREFIX)) {
      window.location.href = `${SP_PREFIX}${pathname}${search}${hash}`;
    }
  } else {
    // Currently on SP → navigate to desktop
    if (pathname.startsWith(SP_PREFIX)) {
      const desktopPath = pathname.slice(SP_PREFIX.length) || "/home";
      window.location.href = `${desktopPath}${search}${hash}`;
    }
  }
}

/**
 * Check if the current page is an SP page (client-side).
 */
export function isSpPage(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.pathname.startsWith(SP_PREFIX);
}

/**
 * Mobile User-Agent detection regex.
 * Used by middleware for auto-redirect when no cookie preference exists.
 */
export const MOBILE_UA_REGEX = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
