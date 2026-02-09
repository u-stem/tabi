import type { MemberRole } from "@tabi/shared";
import { and, eq } from "drizzle-orm";
import { db } from "../db/index";
import { tripMembers } from "../db/schema";

export async function checkTripAccess(tripId: string, userId: string): Promise<MemberRole | null> {
  const member = await db.query.tripMembers.findFirst({
    where: and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, userId)),
  });
  return (member?.role as MemberRole) ?? null;
}

export function canEdit(role: MemberRole | null): boolean {
  return role === "owner" || role === "editor";
}

export function isOwner(role: MemberRole | null): boolean {
  return role === "owner";
}
