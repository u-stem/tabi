const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Extract userId from a friend-add QR code URL.
 * Returns the userId string if valid, null otherwise.
 */
export function parseQrFriendUrl(text: string, origin: string): string | null {
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }

  if (url.origin !== origin) return null;
  if (url.pathname !== "/friends/add") return null;

  const userId = url.searchParams.get("userId");
  if (!userId || !UUID_RE.test(userId)) return null;

  return userId;
}
