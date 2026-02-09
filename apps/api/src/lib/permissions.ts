import type { MemberRole } from "@tabi/shared";
import { and, eq } from "drizzle-orm";
import { db } from "../db/index";
import { dayPatterns, tripDays, tripMembers } from "../db/schema";

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

export async function verifyDayAccess(
  tripId: string,
  dayId: string,
  userId: string,
): Promise<MemberRole | null> {
  const day = await db.query.tripDays.findFirst({
    where: and(eq(tripDays.id, dayId), eq(tripDays.tripId, tripId)),
  });
  if (!day) return null;
  return checkTripAccess(tripId, userId);
}

export async function verifyPatternAccess(
  tripId: string,
  dayId: string,
  patternId: string,
  userId: string,
): Promise<MemberRole | null> {
  const day = await db.query.tripDays.findFirst({
    where: and(eq(tripDays.id, dayId), eq(tripDays.tripId, tripId)),
  });
  if (!day) return null;
  const pattern = await db.query.dayPatterns.findFirst({
    where: and(eq(dayPatterns.id, patternId), eq(dayPatterns.tripDayId, dayId)),
  });
  if (!pattern) return null;
  return checkTripAccess(tripId, userId);
}
