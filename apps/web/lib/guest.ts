import type { useSession } from "@/lib/auth-client";

type SessionData = ReturnType<typeof useSession>["data"];

type SessionUserWithGuest = {
  isAnonymous?: boolean;
  guestExpiresAt?: string;
};

function getGuestFields(session: SessionData): SessionUserWithGuest | null {
  if (!session?.user) return null;
  return session.user as SessionUserWithGuest;
}

export function isGuestUser(session: SessionData): boolean {
  return !!getGuestFields(session)?.isAnonymous;
}

export function getGuestDaysRemaining(session: SessionData): number {
  const guestExpiresAt = getGuestFields(session)?.guestExpiresAt;
  if (!guestExpiresAt) return 0;
  const expiresAt = new Date(guestExpiresAt);
  return Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
}
