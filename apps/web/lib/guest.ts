import type { useSession } from "@/lib/auth-client";

type SessionData = ReturnType<typeof useSession>["data"];

export function isGuestUser(session: SessionData): boolean {
  return !!(session?.user as { isAnonymous?: boolean } | undefined)?.isAnonymous;
}

export function getGuestDaysRemaining(session: SessionData): number {
  const guestExpiresAt = (session?.user as { guestExpiresAt?: string } | undefined)?.guestExpiresAt;
  if (!guestExpiresAt) return 0;
  const expiresAt = new Date(guestExpiresAt);
  return Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
}
