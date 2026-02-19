import type { MemberRole } from "@sugara/shared";
import { canEdit, isOwner } from "@sugara/shared";
import { and, eq } from "drizzle-orm";
import { db } from "../db/index";
import { dayPatterns, tripDays, tripMembers } from "../db/schema";

export { canEdit, isOwner };

export async function checkTripAccess(tripId: string, userId: string): Promise<MemberRole | null> {
  const member = await db.query.tripMembers.findFirst({
    where: and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, userId)),
  });
  return (member?.role as MemberRole) ?? null;
}

export async function verifyDayAccess(
  tripId: string,
  dayId: string,
  userId: string,
): Promise<MemberRole | null> {
  const [day, role] = await Promise.all([
    db.query.tripDays.findFirst({
      where: and(eq(tripDays.id, dayId), eq(tripDays.tripId, tripId)),
      columns: { id: true },
    }),
    checkTripAccess(tripId, userId),
  ]);
  if (!day) return null;
  return role;
}

export async function verifyPatternAccess(
  tripId: string,
  dayId: string,
  patternId: string,
  userId: string,
): Promise<MemberRole | null> {
  const [patternWithDay, role] = await Promise.all([
    db.query.dayPatterns.findFirst({
      where: and(eq(dayPatterns.id, patternId), eq(dayPatterns.tripDayId, dayId)),
      with: { tripDay: { columns: { id: true, tripId: true } } },
    }),
    checkTripAccess(tripId, userId),
  ]);
  if (!patternWithDay || patternWithDay.tripDay.tripId !== tripId) return null;
  return role;
}
